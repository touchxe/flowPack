import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateContentSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요").optional(),
  body: z.string().optional(),
  slides: z.array(z.object({
    index: z.number(),
    title: z.string(),
    body: z.string(),
    imagePrompt: z.string().optional(),
  })).optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]).optional(),
  keywords: z.string().optional(),     // JSON 배열 문자열
  industry: z.string().optional(),
  scheduledAt: z.string().optional(),
});

function parseSlides(slides: unknown): unknown {
  if (!slides || typeof slides !== "string") return slides ?? null;

  try {
    return JSON.parse(slides);
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          ...(debug && { debug: { status: 401, contentId: id, reason: "NO_SESSION" } }),
        },
        { status: 401 }
      );
    }

    const content = await prisma.content.findUnique({
      where: { id },
      include: {
        user: { select: { id: true } },
        images: { orderBy: { order: "asc" } },
      },
    });

    if (!content) {
      return NextResponse.json(
        {
          error: "Content not found",
          ...(debug && { debug: { status: 404, contentId: id, userId: session.user.id, reason: "NOT_FOUND" } }),
        },
        { status: 404 }
      );
    }

    if (content.user.id !== session.user.id) {
      return NextResponse.json(
        {
          error: "Forbidden",
          ...(debug && {
            debug: {
              status: 403,
              contentId: id,
              userId: session.user.id,
              ownerId: content.user.id,
              reason: "OWNER_MISMATCH",
            },
          }),
        },
        { status: 403 }
      );
    }

    const normalizedContent = {
      ...content,
      slides: parseSlides(content.slides),
    };

    return NextResponse.json({
      content: normalizedContent,
      ...(debug && { debug: { status: 200, contentId: id, reason: "OK" } }),
    });
  } catch (error) {
    console.error("Content fetch error:", error);
    return NextResponse.json(
      {
        error: "콘텐츠를 불러오는 중 오류가 발생했습니다.",
        ...(debug && {
          debug: {
            status: 500,
            contentId: id,
            reason: "SERVER_ERROR",
            message: getErrorMessage(error),
          },
        }),
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const data = updateContentSchema.parse(body);

    // 기존 콘텐츠 확인
    const existing = await prisma.content.findUnique({
      where: { id },
      include: { user: { select: { id: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    if (existing.user.id !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 콘텐츠 업데이트
    const content = await prisma.content.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.body !== undefined && { body: data.body }),
        ...(data.slides !== undefined && { slides: JSON.stringify(data.slides) }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.keywords !== undefined && { keywords: data.keywords }),
        ...(data.industry !== undefined && { industry: data.industry }),
        ...(data.scheduledAt !== undefined && { scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null }),
      },
    });

    // 읽어율 slides도 파싱해서 반환
    const normalizedContent = {
      ...content,
      slides: parseSlides(content.slides),
    };

    return NextResponse.json({ success: true, content: normalizedContent });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Content update error:", error);
    return NextResponse.json({ error: "오류가 발생했습니다." }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.content.findUnique({
    where: { id },
    include: { user: { select: { id: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  if (existing.user.id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.content.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
