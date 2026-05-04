import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callAIStream, callAI, isAIConfigured, aiNotConfiguredResponse } from "@/lib/ai-client";
import { createNotification, notifyCreditWarning } from "@/lib/notifications";
import { z } from "zod";

const longformSchema = z.object({
  topic: z.string().min(1, "주제를 입력해주세요"),
  keywords: z.array(z.string()).optional(),
  length: z.enum(["short", "medium", "long"]).default("medium"),
  tone: z.enum(["formal", "casual", "friendly"]).default("friendly"),
  industry: z.string().optional(),
  instructions: z.string().optional(), // 사용자 작성 지침
});

export async function POST(req: Request) {
  // AI 설정 확인
  if (!(await isAIConfigured())) return aiNotConfiguredResponse();

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { topic, keywords, length, tone, industry, instructions } = longformSchema.parse(body);

    // 크레딧 확인
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 관리자(ADMIN) 또는 ENTERPRISE 플랜은 크레딧 제한 없음
    const isUnlimited = user.role === "ADMIN" || user.plan === "ENTERPRISE";
    const availableCredits = user.creditsTotal - user.creditsUsed;
    if (!isUnlimited && availableCredits < 1) {
      return NextResponse.json({ error: "CREDIT_EXHAUSTED" }, { status: 402 });
    }

    const wordCount = length === "short" ? 500 : length === "medium" ? 1000 : 1500;
    const toneText = tone === "formal" ? "격식체" : tone === "casual" ? "캐주얼" : "친근한";

    // SSE 스트리밍 응답
    const encoder = new TextEncoder();
    let fullContent = "";

    const sseStream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "status", message: "블로그 포스트 생성 중..." })}\n\n`)
          );

          // 통합 AI 스트리밍 호출
          const { stream, provider, model } = await callAIStream({
            messages: [
              {
                role: "system",
                content: `당신은 전문 블로그 콘텐츠 작가입니다.
다음 지침에 따라 SEO에 최적화된 블로그 포스트를 작성해주세요:

1. 도입부: 독자의 문제를 지적하고 해결책 제시
2. 본론: 3~5개의 소제목으로 구성
3. 결론: 행동 유도 (CTA)
4. 각 소제목에 키워드 자연스럽게 포함
5. 마크다운 형식으로 작성
${instructions ? `\n[사용자 추가 지침]\n${instructions}` : ""}`,
              },
              {
                role: "user",
                content: `다음 조건으로 블로그 포스트를 작성해주세요:

주제: ${topic}
${keywords?.length ? `키워드: ${keywords.join(", ")}` : ""}
길이: 약 ${wordCount}단어
톤: ${toneText}
업종: ${industry || "일반"}

마크다운 형식으로만 작성해주세요.`,
              },
            ],
            maxTokens: 4000,
          });

          // 스트리밍 콘텐츠 전송
          for await (const content of stream) {
            fullContent += content;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "chunk", content })}\n\n`)
            );
          }

          // AI 제목 자동 생성 (본문 기반 SEO 최적화)
          let autoTitle = topic;
          try {
            const titleResult = await callAI({
              messages: [
                {
                  role: "system",
                  content: "당신은 SEO 전문가입니다. 블로그 본문을 읽고 클릭율이 높은 제목을 60자 이내로 만드세요. 제목 텍스트만 반환하세요. 따옴표나 마크다운 없이.",
                },
                {
                  role: "user",
                  content: `다음 블로그 본문의 제목을 생성해주세요:\n\n주제: ${topic}\n\n${fullContent.slice(0, 1500)}`,
                },
              ],
              maxTokens: 80,
            });
            const generated = titleResult.content.trim();
            if (generated && generated.length > 0) {
              autoTitle = generated.replace(/^["'「]|["'」]$/g, "").trim();
            }
          } catch { /* 제목 생성 실패 시 topic 사용 */ }

          // SSE로 생성된 제목 전송
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "title", title: autoTitle })}\n\n`)
          );

          // DB 저장
          const aiMessages = [
            { role: "system", content: `당신은 전문 블로그 콘텐츠 작가입니다. (SEO 최적화)${instructions ? `\n[사용자 추가 지침]\n${instructions}` : ""}` },
            { role: "user", content: `주제: ${topic}, 길이: 약 ${wordCount}단어, 톤: ${toneText}, 업종: ${industry || "일반"}` },
          ];
          const aiLog = JSON.stringify({
            messages: aiMessages,
            response: fullContent.slice(0, 3000),
            generatedTitle: autoTitle,
            wordCount: fullContent.split(/\s+/).length,
            timestamp: new Date().toISOString(),
          });

          const contentRecord = await prisma.content.create({
            data: {
              userId: session.user.id,
              title: autoTitle,
              type: "BLOG",
              body: fullContent,
              status: "DRAFT",
              aiProvider: provider,
              aiModel: model,
              aiLog,
            },
          });

          // 크레딧 차감 (관리자/ENTERPRISE는 제외)
          if (!isUnlimited) {
            await prisma.user.update({
              where: { id: session.user.id },
              data: { creditsUsed: { increment: 1 } },
            });
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done", contentId: contentRecord.id, wordCount: fullContent.split(/\s+/).length, aiProvider: provider, aiModel: model })}\n\n`)
          );

          // 알림: 콘텐츠 생성 완료
          createNotification(session.user!.id, "CONTENT_CREATED", {
            title: "블로그 글 생성 완료",
            message: `'${autoTitle}' 블로그 글이 생성되었습니다`,
            actionUrl: "/contents",
            metadata: { contentId: contentRecord.id, type: "BLOG" },
          });

          // 알림: 크레딧 경고 체크
          notifyCreditWarning(session.user!.id, user.creditsUsed + 1, user.creditsTotal);
        } catch (error) {
          console.error("Longform generation error:", error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", message: "생성 중 오류가 발생했습니다" })}\n\n`)
          );

          // 알림: 콘텐츠 생성 실패
          createNotification(session.user!.id, "CONTENT_FAILED", {
            title: "블로그 글 생성 실패",
            message: `'${topic}' 블로그 글 생성 중 오류가 발생했습니다. 다시 시도해주세요.`,
            actionUrl: "/ai/longform",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(sseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Longform generation error:", error);
    return NextResponse.json(
      { error: "오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
