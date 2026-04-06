import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const generateImageSchema = z.object({
  prompt: z.string().min(1, "프롬프트를 입력해주세요"),
  style: z.enum(["natural", "vivid"]).default("natural"),
  size: z.enum(["1024x1024", "1792x1024", "1024x1792"]).default("1024x1024"),
  contentId: z.string().optional(),
});

export async function POST(req: Request) {
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

    const availableCredits = user.creditsTotal - user.creditsUsed;
    if (availableCredits < 1) {
      return NextResponse.json({ error: "CREDIT_EXHAUSTED" }, { status: 402 });
    }

    // OpenAI DALL-E API 호출
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    // 크레딧 차감
    await prisma.user.update({
      where: { id: session.user.id },
      data: { creditsUsed: { increment: 1 } },
    });

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
