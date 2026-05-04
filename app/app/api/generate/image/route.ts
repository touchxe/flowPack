import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getImageClient, isAIConfigured, aiNotConfiguredResponse } from "@/lib/ai-client";
import { z } from "zod";

const generateImageSchema = z.object({
  prompt: z.string().min(1, "프롬프트를 입력해주세요"),
  style: z.enum(["natural", "vivid"]).default("natural"),
  size: z.enum(["1024x1024", "1792x1024", "1024x1792"]).default("1024x1024"),
  contentId: z.string().optional(),
});

export async function POST(req: Request) {
  // AI 설정 확인 (이미지는 OpenAI 전용이지만 동일 체크)
  if (!(await isAIConfigured())) return aiNotConfiguredResponse();

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { prompt, style, size, contentId } = generateImageSchema.parse(body);

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

    // DALL-E 전용 OpenAI 클라이언트 (DB API 키 → 환경변수 폴백)
    const openai = await getImageClient();

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      style: style as "natural" | "vivid",
      size: size as "1024x1024" | "1792x1024" | "1024x1792",
      quality: "standard",
      n: 1,
    });

    const imageData = response.data?.[0];
    if (!imageData?.url) {
      return NextResponse.json({ error: "이미지 생성에 실패했습니다" }, { status: 500 });
    }

    const imageUrl = imageData.url;
    const revisedPrompt = imageData.revised_prompt;

    // ContentImage 레코드 생성 (contentId가 있는 경우)
    if (contentId) {
      await prisma.contentImage.create({
        data: {
          contentId,
          url: imageUrl,
          altText: revisedPrompt || prompt,
        },
      });
    }

    // 크레딧 차감 (관리자/ENTERPRISE는 제외)
    if (!isUnlimited) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { creditsUsed: { increment: 1 } },
      });
    }

    return NextResponse.json({
      success: true,
      url: imageUrl,
      revisedPrompt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }

    console.error("Image generation error:", error);
    return NextResponse.json({ error: "이미지 생성 중 오류가 발생했습니다" }, { status: 500 });
  }
}
