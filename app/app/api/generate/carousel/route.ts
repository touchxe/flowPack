import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOpenAI, isOpenAIConfigured, openAINotConfiguredResponse } from "@/lib/openai";
import { z } from "zod";

const generateSchema = z.object({
  topic: z.string().min(1, "주제를 입력해주세요"),
  industry: z.string().optional(),
  tone: z.enum(["formal", "casual", "friendly"]).optional(),
  style: z.string().optional(),
  slideCount: z.number().min(3).max(10).default(5),
});

export async function POST(req: Request) {
  // OpenAI API 키 확인
  if (!isOpenAIConfigured()) return openAINotConfiguredResponse();

  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { topic, industry, tone, style, slideCount } = generateSchema.parse(body);

    // 크레딧 확인
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const availableCredits = user.creditsTotal - user.creditsUsed;
    if (availableCredits < 1) {
      return Response.json({ error: "CREDIT_EXHAUSTED" }, { status: 402 });
    }

    // SSE 스트리밍 응답 생성
    const encoder = new TextEncoder();
    let fullContent = "";

    const sseStream = new ReadableStream({
      async start(controller) {
        try {
          // 진행 상태 전송
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "status", message: "AI가 콘텐츠를 생성 중입니다..." })}\n\n`)
          );

          const openai = getOpenAI();

          const toneText =
            tone === "formal" ? "격식체" : tone === "casual" ? "캐주얼" : "친근한";

          const openaiStream = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: `당신은 전문 SNS 카드뉴스 콘텐츠 작성자입니다.

테마: ${topic}
업종: ${industry || "일반"}
톤: ${toneText}
스타일: ${style || "홍보"}
슬라이드 수: ${slideCount}`,
              },
              {
                role: "user",
                content: `카드뉴스 슬라이드를 JSON으로 생성해주세요.

응답 형식:
{
  "slides": [
    { "index": 0, "title": "제목", "body": "내용", "imagePrompt": "DALL-E용 이미지 프롬프트 (영어)" }
  ]
}

요구사항:
- ${slideCount}개의 슬라이드를 생성
- 각 슬라이드는 제목(title), 본문(body), 이미지 프롬프트(imagePrompt)를 포함
- imagePrompt는 반드시 영어로 작성
- JSON 외에 다른 텍스트 없이 순수 JSON만 반환`,
              },
            ],
            max_tokens: 2000,
            stream: true,
          });

          // 스트리밍 응답 처리
          for await (const chunk of openaiStream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              fullContent += content;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "chunk", content })}\n\n`)
              );
            }
          }

          // JSON 파싱
          let slidesData;
          try {
            const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              slidesData = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error("JSON not found in response");
            }
          } catch {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "error", message: "생성된 콘텐츠 파싱에 실패했습니다." })}\n\n`)
            );
            controller.close();
            return;
          }

          // 슬라이드 유효성 검사
          if (!slidesData.slides || !Array.isArray(slidesData.slides) || slidesData.slides.length === 0) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "error", message: "올바르지 않은 슬라이드가 생성되었습니다. 다시 시도해주세요." })}\n\n`)
            );
            controller.close();
            return;
          }

          // DB 저장 (SQLite는 JSON 필드를 String으로 저장)
          const contentRecord = await prisma.content.create({
            data: {
              userId: session.user.id,
              title: topic,
              type: "CAROUSEL",
              slides: JSON.stringify(slidesData.slides),
              status: "DRAFT",
            },
          });

          // 크레딧 차감
          await prisma.user.update({
            where: { id: session.user.id },
            data: { creditsUsed: { increment: 1 } },
          });

          // done 이벤트에 slides 포함 (클라이언트가 재파싱 불필요)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done", contentId: contentRecord.id, slides: slidesData.slides })}\n\n`)
          );
        } catch (error) {
          console.error("Carousel generation error:", error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", message: "생성 중 오류가 발생했습니다." })}\n\n`)
          );
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
      return Response.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Carousel generation error:", error);
    return Response.json({ error: "오류가 발생했습니다." }, { status: 500 });
  }
}
