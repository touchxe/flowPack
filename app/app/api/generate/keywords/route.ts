import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOpenAI, isOpenAIConfigured, openAINotConfiguredResponse } from "@/lib/openai";

// POST /api/generate/keywords — 주제 기반 SEO 키워드 자동 추천
export async function POST(req: NextRequest) {
  if (!isOpenAIConfigured()) return openAINotConfiguredResponse();

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { topic: string; industry?: string };
  if (!body.topic?.trim()) {
    return NextResponse.json({ error: "주제를 입력해주세요" }, { status: 400 });
  }

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `당신은 SEO 키워드 전문가입니다. 주어진 블로그 주제에 대해 검색엔진 최적화에 유리한 핵심 키워드를 추천해주세요.
반드시 JSON 배열로만 응답하세요. 설명 없이 키워드만 반환합니다.
예: ["키워드1", "키워드2", "키워드3"]`,
        },
        {
          role: "user",
          content: `주제: ${body.topic}\n${body.industry ? `업종: ${body.industry}` : ""}\n\n이 주제에 적합한 SEO 키워드 6~8개를 JSON 배열로 추천해주세요.`,
        },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
    // JSON 파싱 시도
    let keywords: string[];
    try {
      keywords = JSON.parse(raw);
    } catch {
      // JSON이 아닌 경우 줄바꿈/쉼표로 분리
      keywords = raw.replace(/[\[\]"]/g, "").split(/[,\n]/).map(k => k.trim()).filter(Boolean);
    }

    return NextResponse.json({ keywords });
  } catch (error) {
    console.error("Keyword generation error:", error);
    return NextResponse.json({ error: "키워드 생성에 실패했습니다" }, { status: 500 });
  }
}
