import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOpenAI, isOpenAIConfigured, openAINotConfiguredResponse } from "@/lib/openai";
import { z } from "zod";
import * as cheerio from "cheerio";

const urlToContentSchema = z.object({
  url: z.string().url("유효한 URL을 입력해주세요"),
  contentType: z.enum(["CAROUSEL", "BLOG"]).default("CAROUSEL"),
  tone: z.enum(["formal", "casual", "friendly"]).default("friendly"),
  slideCount: z.number().min(3).max(10).default(5).optional(),
});

async function fetchUrlContent(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "FlowPack Content Analyzer/1.0",
      },
      signal: AbortSignal.timeout(10000), // 10초 타임아웃
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 제목 추출
    const title =
      $("meta[property='og:title']").attr("content") ||
      $("title").text() ||
      $("h1").first().text() ||
      "";

    // 설명 추출
    const description =
      $("meta[property='og:description']").attr("content") ||
      $("meta[name='description']").attr("content") ||
      "";

    // 본문 추출 (노이즈 제거)
    $("script, style, nav, header, footer, aside, .ad, .advertisement").remove();

    let content = "";
    $("p, h1, h2, h3, h4, h5, h6, li").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 20) {
        content += text + "\n";
      }
    });

    content = content.trim().slice(0, 5000);

    return { title: title.trim(), description: description.trim(), content };
  } catch (error) {
    throw new Error("URL에 접근할 수 없습니다");
  }
}

export async function POST(req: Request) {
  // OpenAI API 키 확인
  if (!isOpenAIConfigured()) return openAINotConfiguredResponse();

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { url, contentType, tone, slideCount } = urlToContentSchema.parse(body);

    // 크레딧 확인
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const availableCredits = user.creditsTotal - user.creditsUsed;
    if (availableCredits < 1) {
      return NextResponse.json({ error: "CREDIT_EXHAUSTED" }, { status: 402 });
    }

    // URL 콘텐츠 fetch
    const { title, description, content } = await fetchUrlContent(url);

    if (!content) {
      return NextResponse.json(
        { error: "URL에서 콘텐츠를 추출할 수 없습니다" },
        { status: 400 }
      );
    }

    const openai = getOpenAI();
    const toneText = tone === "formal" ? "격식체" : tone === "casual" ? "캐주얼" : "친근한";

    if (contentType === "CAROUSEL") {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `당신은 콘텐츠 변환 전문가입니다. 입력된 웹페이지 내용을 분석하여 카드뉴스 형식으로 변환해주세요.

톤: ${toneText}
슬라이드 수: ${slideCount || 5}`,
          },
          {
            role: "user",
            content: `다음 웹페이지 내용을 카드뉴스로 변환해주세요.

원본 URL: ${url}
제목: ${title}
설명: ${description}
내용: ${content}

응답 형식:
{
  "slides": [
    { "index": 0, "title": "제목", "body": "내용", "imagePrompt": "DALL-E image prompt in English" }
  ]
}

${slideCount || 5}개의 슬라이드를 생성하고, JSON 외에 다른 텍스트 없이 순수 JSON만 반환.`,
          },
        ],
        max_tokens: 2000,
      });

      const result = completion.choices[0]?.message?.content || "";

      // JSON 파싱
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return NextResponse.json(
          { error: "변환에 실패했습니다" },
          { status: 500 }
        );
      }

      const slidesData = JSON.parse(jsonMatch[0]);

      // DB 저장 (SQLite String 필드)
      const contentRecord = await prisma.content.create({
        data: {
          userId: session.user.id,
          title: title || "URL 콘텐츠",
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

      return NextResponse.json({
        success: true,
        contentId: contentRecord.id,
        originalUrl: url,
      });
    } else {
      // BLOG 변환
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "당신은 콘텐츠 변환 전문가입니다. 입력된 웹페이지 내용을 분석하여 SEO 최적화 블로그 포스트 형식으로 변환해주세요.",
          },
          {
            role: "user",
            content: `다음 웹페이지 내용을 블로그 포스트로 변환해주세요.

원본 URL: ${url}
제목: ${title}
설명: ${description}
내용: ${content}

톤: ${toneText}
마크다운 형식으로 반환.`,
          },
        ],
        max_tokens: 3000,
      });

      const blogContent = completion.choices[0]?.message?.content || "";

      // DB 저장
      const contentRecord = await prisma.content.create({
        data: {
          userId: session.user.id,
          title: title || "URL 콘텐츠",
          type: "BLOG",
          body: blogContent,
          status: "DRAFT",
        },
      });

      // 크레딧 차감
      await prisma.user.update({
        where: { id: session.user.id },
        data: { creditsUsed: { increment: 1 } },
      });

      return NextResponse.json({
        success: true,
        contentId: contentRecord.id,
        originalUrl: url,
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("URL to content error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
