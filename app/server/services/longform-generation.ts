import type { Prisma } from "@prisma/client";
import { callAI } from "@/lib/ai-client";
import { BLOG_SEMANTIC_MARKDOWN_GUIDELINES, normalizeGeneratedBlogMarkdown } from "@/lib/blog-markdown";
import type { GenerateExternalLongformInput } from "@/lib/validations/external-content-schema";
import type { GenerateExternalLongformJobInput } from "@/lib/validations/external-content-schema";
import { toStoredExternalMarkdown } from "@/lib/external-content-markdown";
import { ExternalApiError } from "@/server/services/external-api";

export interface GeneratedLongformDraft {
  title: string;
  body: string;
  provider: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}

async function withTimeout<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new ExternalApiError(503, "GENERATION_TIMEOUT", "AI 생성 시간이 초과되었습니다.")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function generateLongformDraft(
  input: GenerateExternalLongformInput,
): Promise<GeneratedLongformDraft> {
  const wordCount = input.length === "short" ? 500 : input.length === "medium" ? 1000 : 1500;
  const toneText = input.tone === "formal" ? "격식체" : input.tone === "casual" ? "캐주얼" : "친근한";
  const systemPrompt = `당신은 전문 블로그 콘텐츠 작가입니다.\n다음 지침에 따라 SEO에 최적화된 블로그 포스트를 작성해주세요:\n\n1. 도입부: 독자의 문제를 지적하고 해결책 제시\n2. 본론: 3~5개의 소제목으로 구성\n3. 결론: 행동 유도 (CTA)\n4. 각 소제목에 키워드 자연스럽게 포함\n5. 마크다운 형식으로 작성\n${BLOG_SEMANTIC_MARKDOWN_GUIDELINES}${input.instructions ? `\n\n[사용자 추가 지침]\n${input.instructions}` : ""}`;
  const userPrompt = `주제: ${input.topic}\n${input.keywords?.length ? `키워드: ${input.keywords.join(", ")}\n` : ""}길이: 약 ${wordCount}단어\n톤: ${toneText}\n업종: ${input.industry || "일반"}\n\n마크다운 형식으로만 작성해주세요.`;

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

  let title = input.topic;
  try {
    const titleResult = await withTimeout(callAI({
      messages: [
        { role: "system", content: "블로그 본문에 맞는 클릭하기 좋은 제목을 60자 이내의 일반 텍스트로 작성하세요." },
        { role: "user", content: contentBody.slice(0, 1500) },
      ],
      maxTokens: 80,
    }), 30_000);
    title = titleResult.content.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " ").slice(0, 200) || input.topic;
  } catch {
    // The generated body remains useful when optional title generation fails.
  }

  return {
    title,
    body: contentBody,
    provider: generated.provider,
    model: generated.model,
    systemPrompt,
    userPrompt,
  };
}

export async function createGeneratedLongformContent(
  tx: Prisma.TransactionClient,
  userId: string,
  input: GenerateExternalLongformJobInput,
  draft: GeneratedLongformDraft,
) {
  const mediaIds = input.images.map((image) => image.mediaId);
  const media = mediaIds.length === 0 ? [] : await tx.mediaFile.findMany({
    where: { id: { in: mediaIds }, userId, mediaType: "IMAGE" },
  });
  if (media.length !== mediaIds.length) {
    throw new ExternalApiError(422, "INVALID_MEDIA_REFERENCE", "사진이 없거나 사용할 권한이 없습니다.");
  }
  const mediaById = new Map(media.map((item) => [item.id, item]));
  const imageMarkdown = input.images.map((image) => {
    const safeAlt = image.altText.replace(/[\[\]]/g, "").trim();
    return `![${safeAlt}](flowpack-media:${image.mediaId})`;
  }).join("\n\n");
  const body = imageMarkdown ? `${draft.body}\n\n${imageMarkdown}` : draft.body;

  return tx.content.create({
    data: {
      userId,
      title: draft.title,
      type: "BLOG",
      status: "DRAFT",
      body: toStoredExternalMarkdown(body),
      coverMediaId: input.coverMediaId ?? null,
      thumbnailUrl: input.coverMediaId ? mediaById.get(input.coverMediaId)?.url : null,
      aiProvider: draft.provider,
      aiModel: draft.model,
      aiLog: JSON.stringify({
        messages: [
          { role: "system", content: draft.systemPrompt },
          { role: "user", content: draft.userPrompt },
        ],
        response: draft.body.slice(0, 3000),
        timestamp: new Date().toISOString(),
      }),
      tone: input.tone,
      industry: input.industry,
      keywords: input.keywords ? JSON.stringify(input.keywords) : null,
      images: {
        create: input.images.map((image, order) => ({
          mediaId: image.mediaId,
          url: mediaById.get(image.mediaId)?.url ?? "",
          altText: image.altText,
          order,
        })),
      },
    },
  });
}
