import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createAnnotationSchema = z.object({
  slideIndex: z.number().int().min(0),
  authorName: z.string().trim().max(40).optional(),
  body: z.string().trim().min(1, "수정의견을 입력해주세요").max(1000),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ shareToken: string }> }
): Promise<NextResponse> {
  const { shareToken } = await params;

  try {
    const content = await prisma.content.findUnique({
      where: { shareToken },
      select: {
        id: true,
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
      },
    });

    if (!content || !content.shareEnabled) {
      return NextResponse.json(
        { success: false, error: "공유 콘텐츠를 찾을 수 없습니다.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: content.annotations });
  } catch (error) {
    console.error("Public annotation fetch error:", error);
    return NextResponse.json(
      { success: false, error: "오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ shareToken: string }> }
): Promise<NextResponse> {
  const { shareToken } = await params;

  try {
    const body = await req.json();
    const data = createAnnotationSchema.parse(body);

    const content = await prisma.content.findUnique({
      where: { shareToken },
      select: {
        id: true,
        shareEnabled: true,
        _count: { select: { annotations: true } },
      },
    });

    if (!content || !content.shareEnabled) {
      return NextResponse.json(
        { success: false, error: "공유 콘텐츠를 찾을 수 없습니다.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const annotation = await prisma.contentAnnotation.create({
      data: {
        contentId: content.id,
        slideIndex: data.slideIndex,
        number: content._count.annotations + 1,
        authorName: data.authorName || null,
        body: data.body,
      },
      select: {
        id: true,
        slideIndex: true,
        number: true,
        authorName: true,
        body: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, data: annotation }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: error.issues[0]?.message ?? "입력값을 확인해주세요.",
          code: "VALIDATION_ERROR",
        },
        { status: 422 }
      );
    }

    console.error("Create annotation error:", error);
    return NextResponse.json(
      { success: false, error: "오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
