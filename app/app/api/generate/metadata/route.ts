/**
 * AI 메타데이터 추천 API
 * POST /api/generate/metadata
 * 본문 기반으로 키워드 + 업종을 AI가 자동 추천
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const requestSchema = z.object({
  contentId: z.string(),
});

const INDUSTRIES = [
  { value: "tech", label: "IT/기술" },
  { value: "finance", label: "금융" },
  { value: "education", label: "교육" },
  { value: "healthcare", label: "의료" },
  { value: "retail", label: "도소매" },
  { value: "religion", label: "종교/비영리" },
  { value: "marketing", label: "마케팅" },
  { value: "lifestyle", label: "라이프스타일" },
  { value: "food", label: "음식/요리" },
  { value: "travel", label: "여행" },
  { value: "other", label: "기타" },
];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { contentId } = requestSchema.parse(body);

    // 콘텐츠 조회
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: { id: true, userId: true, title: true, body: true, keywords: true, industry: true },
    });

    if (!content || content.userId !== session.user.id) {
      return NextResponse.json({ error: "콘텐츠를 찾을 수 없습니다" }, { status: 404 });
    }

    const textForAnalysis = `제목: ${content.title}\n\n${(content.body ?? "").slice(0, 3000)}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `당신은 SEO 전문가입니다. 주어진 블로그 글을 분석하여 다음을 추천하세요:
1. keywords: SEO에 효과적인 키워드 6~8개 (한국어, 배열)
2. industry: 가장 적합한 업종 1개 (아래 값 중 하나)

업종 선택지: ${INDUSTRIES.map(i => `"${i.value}" (${i.label})`).join(", ")}

반드시 JSON 형식으로 응답하세요:
{"keywords": ["키워드1", "키워드2", ...], "industry": "tech"}`,
        },
        {
          role: "user",
          content: textForAnalysis,
        },
      ],
    });

    const result = JSON.parse(completion.choices[0].message.content ?? "{}");
    const keywords: string[] = Array.isArray(result.keywords) ? result.keywords : [];
    const industry: string = typeof result.industry === "string" ? result.industry : "other";

    // DB에 저장
    await prisma.content.update({
      where: { id: contentId },
      data: {
        keywords: JSON.stringify(keywords),
        industry,
      },
    });

    return NextResponse.json({
      keywords,
      industry,
      industryLabel: INDUSTRIES.find(i => i.value === industry)?.label ?? industry,
    });
  } catch (error) {
    console.error("Metadata generation error:", error);
    return NextResponse.json({ error: "메타데이터 생성 중 오류가 발생했습니다" }, { status: 500 });
  }
}
