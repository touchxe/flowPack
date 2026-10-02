import { ZodError } from "zod";
import { callAI, isAIConfigured } from "@/lib/ai-client";
import { BLOG_SEMANTIC_MARKDOWN_GUIDELINES, normalizeGeneratedBlogMarkdown } from "@/lib/blog-markdown";
import { prisma } from "@/lib/prisma";
import { firstZodError, generateExternalLongformSchema } from "@/lib/validations/external-content-schema";
import {
  ExternalApiError,
  assertJsonRequestSize,
  authenticateExternalRequest,
  beginIdempotentRequest,
  errorPayload,
  failIdempotentRequest,
  hashJson,
  requireIdempotencyKey,
} from "@/server/services/external-api";

export const runtime = "nodejs";
export const maxDuration = 300;

async function withTimeout<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new ExternalApiError(503, "GENERATION_TIMEOUT", "AI 생성 시간이 초과되었습니다.")), milliseconds);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  let trackedRequestId: string | null = null;
  let reservedUserId: string | null = null;
  try {
    const principal = await authenticateExternalRequest(request, "content:generate");
    assertJsonRequestSize(request, 64 * 1024);
    const idempotencyKey = requireIdempotencyKey(request);
    const parsed = generateExternalLongformSchema.parse(await request.json());
    const started = await beginIdempotentRequest({
      principal, method: "POST", path: "/api/v1/generations/longform",
      idempotencyKey, requestHash: hashJson(parsed),
    });
    if (started.kind === "replay") return Response.json(started.payload, { status: started.status });
    trackedRequestId = started.requestId;

    if (!(await isAIConfigured())) {
      throw new ExternalApiError(503, "AI_NOT_CONFIGURED", "AI 기능이 설정되지 않았습니다.");
    }

    const user = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "users" WHERE "id" = ${principal.userId} FOR UPDATE`;
      const current = await tx.user.findUnique({
        where: { id: principal.userId },
        select: { role: true, plan: true, creditsUsed: true, creditsTotal: true },
      });
      if (!current) throw new ExternalApiError(404, "NOT_FOUND", "사용자를 찾을 수 없습니다.");
      const unlimited = current.role === "ADMIN" || current.plan === "ENTERPRISE";
      if (!unlimited && current.creditsUsed >= current.creditsTotal) {
        throw new ExternalApiError(402, "CREDIT_EXHAUSTED", "사용 가능한 AI 크레딧이 없습니다.");
      }
      if (!unlimited) {
        await tx.user.update({ where: { id: principal.userId }, data: { creditsUsed: { increment: 1 } } });
        await tx.externalRequest.update({ where: { id: started.requestId }, data: { creditReserved: true } });
      }
      return { ...current, unlimited };
    });
    if (!user.unlimited) reservedUserId = principal.userId;

    const wordCount = parsed.length === "short" ? 500 : parsed.length === "medium" ? 1000 : 1500;
    const toneText = parsed.tone === "formal" ? "격식체" : parsed.tone === "casual" ? "캐주얼" : "친근한";
    const systemPrompt = `당신은 전문 블로그 콘텐츠 작가입니다.\n다음 지침에 따라 SEO에 최적화된 블로그 포스트를 작성해주세요:\n\n1. 도입부: 독자의 문제를 지적하고 해결책 제시\n2. 본론: 3~5개의 소제목으로 구성\n3. 결론: 행동 유도 (CTA)\n4. 각 소제목에 키워드 자연스럽게 포함\n5. 마크다운 형식으로 작성\n${BLOG_SEMANTIC_MARKDOWN_GUIDELINES}${parsed.instructions ? `\n\n[사용자 추가 지침]\n${parsed.instructions}` : ""}`;
    const userPrompt = `주제: ${parsed.topic}\n${parsed.keywords?.length ? `키워드: ${parsed.keywords.join(", ")}\n` : ""}길이: 약 ${wordCount}단어\n톤: ${toneText}\n업종: ${parsed.industry || "일반"}\n\n마크다운 형식으로만 작성해주세요.`;
    let generated: Awaited<ReturnType<typeof callAI>>;
    try {
      generated = await withTimeout(callAI({
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        maxTokens: 4000,
      }), 240_000);
    } catch (error) {
      if (error instanceof ExternalApiError) throw error;
      throw new ExternalApiError(502, "GENERATION_FAILED", "AI 글 생성에 실패했습니다.");
    }
    const contentBody = normalizeGeneratedBlogMarkdown(generated.content);
    if (!contentBody) throw new ExternalApiError(502, "GENERATION_FAILED", "AI가 빈 내용을 반환했습니다.");

    let title = parsed.topic;
    try {
      const titleResult = await withTimeout(callAI({
        messages: [
          { role: "system", content: "블로그 본문에 맞는 클릭하기 좋은 제목을 60자 이내의 일반 텍스트로 작성하세요." },
          { role: "user", content: contentBody.slice(0, 1500) },
        ],
        maxTokens: 80,
      }), 30_000);
      title = titleResult.content.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " ").slice(0, 200) || parsed.topic;
    } catch { /* 본문 생성 결과는 유지하고 입력 주제를 제목으로 사용한다. */ }

    const content = await prisma.$transaction(async (tx) => {
      const saved = await tx.content.create({
        data: {
          userId: principal.userId,
          title,
          type: "BLOG",
          status: "DRAFT",
          body: contentBody,
          aiProvider: generated.provider,
          aiModel: generated.model,
          aiLog: JSON.stringify({
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            response: contentBody.slice(0, 3000),
            timestamp: new Date().toISOString(),
          }),
          tone: parsed.tone,
          industry: parsed.industry,
          keywords: parsed.keywords ? JSON.stringify(parsed.keywords) : null,
        },
      });
      const externalContent = {
        id: saved.id,
        title: saved.title,
        type: saved.type,
        status: saved.status,
        body: saved.body ?? "",
        bodyFormat: "markdown" as const,
        images: [],
        coverMediaId: null,
        revision: saved.revision,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      };
      const payload = {
        success: true,
        data: { ...externalContent, aiProvider: generated.provider, aiModel: generated.model },
      };
      await tx.externalRequest.update({
        where: { id: started.requestId },
        data: {
          state: "COMPLETED", responseStatus: 201, responseData: JSON.stringify(payload),
          resourceId: saved.id, creditReserved: false, leaseExpiresAt: null,
        },
      });
      return { payload, contentId: saved.id };
    });
    reservedUserId = null;
    return Response.json(content.payload, { status: 201 });
  } catch (error) {
    const normalized = error instanceof ZodError
      ? new ExternalApiError(400, "VALIDATION_ERROR", firstZodError(error))
      : error;
    const { status, payload } = errorPayload(normalized);
    if (trackedRequestId && reservedUserId) {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "users" WHERE "id" = ${reservedUserId} FOR UPDATE`;
        const requestState = await tx.externalRequest.findUnique({ where: { id: trackedRequestId! } });
        if (requestState?.creditReserved) {
          await tx.$executeRaw`UPDATE "users" SET "creditsUsed" = GREATEST("creditsUsed" - 1, 0) WHERE "id" = ${reservedUserId}`;
        }
        await tx.externalRequest.update({
          where: { id: trackedRequestId! },
          data: {
            state: "FAILED", responseStatus: status, responseData: JSON.stringify(payload),
            errorCode: payload.code, creditReserved: false, leaseExpiresAt: null,
          },
        });
      }).catch(() => undefined);
    } else if (trackedRequestId) {
      await failIdempotentRequest(trackedRequestId, status, payload, payload.code).catch(() => undefined);
    }
    return Response.json(payload, { status });
  }
}
