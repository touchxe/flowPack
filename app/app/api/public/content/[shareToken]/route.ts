import { NextResponse } from "next/server";
import { ensureContentShareSchema } from "@/lib/content-share-schema";
import { prisma } from "@/lib/prisma";

function parseSlides(slides: unknown): unknown {
  if (!slides || typeof slides !== "string") return slides ?? null;

  try {
    return JSON.parse(slides);
  } catch {
    return null;
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ shareToken: string }> }
): Promise<NextResponse> {
  const { shareToken } = await params;

  try {
    await ensureContentShareSchema();

    const content = await prisma.content.findUnique({
      where: { shareToken },
      select: {
        id: true,
        title: true,
        type: true,
        body: true,
        slides: true,
        thumbnailUrl: true,
        shareEnabled: true,
        annotations: {
          orderBy: { number: "asc" },
          select: {
            id: true,
            slideIndex: true,
            number: true,
            authorName: true,
            body: true,
            createdAt: true,
          },
        },
        images: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            url: true,
            altText: true,
            order: true,
          },
        },
      },
    });

    if (!content || !content.shareEnabled) {
      return NextResponse.json(
        { success: false, error: "공유 콘텐츠를 찾을 수 없습니다.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    await prisma.content.update({
      where: { id: content.id },
      data: { viewCount: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: content.id,
        title: content.title,
        type: content.type,
        body: content.body,
        slides: parseSlides(content.slides),
        thumbnailUrl: content.thumbnailUrl,
        images: content.images,
        annotations: content.annotations,
      },
    });
  } catch (error) {
    console.error("Public content fetch error:", error);
    return NextResponse.json(
      { success: false, error: "오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
