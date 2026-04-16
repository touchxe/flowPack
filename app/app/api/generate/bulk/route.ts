import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOpenAI, isOpenAIConfigured, openAINotConfiguredResponse } from "@/lib/openai";
import { z } from "zod";

const bulkItemSchema = z.object({
  id: z.string(),
  topic: z.string().min(1, "주제를 입력해주세요"),
  contentType: z.enum(["CAROUSEL", "BLOG"]),
  slideCount: z.number().min(3).max(10).optional(),
  tone: z.enum(["formal", "casual", "friendly"]).default("friendly"),
});

const bulkSchema = z.object({
  items: z.array(bulkItemSchema).min(1).max(10),
});

export async function POST(req: Request) {
  // OpenAI API 키 확인
  if (!isOpenAIConfigured()) return openAINotConfiguredResponse();

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { items } = bulkSchema.parse(body);

    // 크레딧 확인
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const requiredCredits = items.length;
    const availableCredits = user.creditsTotal - user.creditsUsed;

    if (availableCredits < requiredCredits) {
      return NextResponse.json(
        { error: `크레딧이 부족합니다. ${requiredCredits}개 중 ${availableCredits}개 사용 가능` },
        { status: 402 }
      );
    }

    const openai = getOpenAI();

    // 각 항목에 대한 결과 배열
    const results = [];

    // 순차적으로 처리
    for (const item of items) {
      try {
        const toneText =
          item.tone === "formal" ? "격식체" : item.tone === "casual" ? "캐주얼" : "친근한";

        if (item.contentType === "CAROUSEL") {
          // 카드뉴스 생성
          const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: `당신은 전문 SNS 카드뉴스 콘텐츠 작성자입니다.
톤: ${toneText}
슬라이드 수: ${item.slideCount || 5}`,
              },
              {
                role: "user",
                content: `주제 "${item.topic}"에 대한 카드뉴스 슬라이드를 JSON으로 생성해주세요.

응답 형식:
{
  "slides": [
    { "index": 0, "title": "제목", "body": "내용", "imagePrompt": "DALL-E image prompt in English" }
  ]
}

${item.slideCount || 5}개의 슬라이드를 생성. JSON 외에 다른 텍스트 없이 순수 JSON만 반환.`,
              },
            ],
            max_tokens: 2000,
          });

          const result = completion.choices[0]?.message?.content || "";
          const jsonMatch = result.match(/\{[\s\S]*\}/);

          if (jsonMatch) {
            const slidesData = JSON.parse(jsonMatch[0]);

            // SQLite는 JSON 필드를 String으로 저장
            const content = await prisma.content.create({
              data: {
                userId: session.user.id,
                title: item.topic,
                type: "CAROUSEL",
                slides: JSON.stringify(slidesData.slides),
                status: "DRAFT",
              },
            });

            results.push({
              id: item.id,
              status: "completed",
              contentId: content.id,
            });
          } else {
            results.push({
              id: item.id,
              status: "failed",
              error: "생성에 실패했습니다",
            });
          }
        } else {
          // 블로그 생성
          const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: "당신은 전문 블로그 콘텐츠 작가입니다. 마크다운 형식으로 작성해주세요.",
              },
              {
                role: "user",
                content: `다음 주제로 SEO 최적화 블로그 포스트를 작성해주세요:

주제: ${item.topic}
톤: ${toneText}`,
              },
            ],
            max_tokens: 3000,
          });

          const blogContent = completion.choices[0]?.message?.content || "";

          const content = await prisma.content.create({
            data: {
              userId: session.user.id,
              title: item.topic,
              type: "BLOG",
              body: blogContent,
              status: "DRAFT",
            },
          });

          results.push({
            id: item.id,
            status: "completed",
            contentId: content.id,
          });
        }

        // 크레딧 차감
        await prisma.user.update({
          where: { id: session.user.id },
          data: { creditsUsed: { increment: 1 } },
        });
      } catch (error) {
        console.error(`Bulk item error (${item.id}):`, error);
        results.push({
          id: item.id,
          status: "failed",
          error: error instanceof Error ? error.message : "생성에 실패했습니다",
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      totalCreditsUsed: results.filter((r) => r.status === "completed").length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Bulk generation error:", error);
    return NextResponse.json(
      { error: "오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
