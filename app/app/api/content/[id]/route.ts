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
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const content = await prisma.content.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true },
      },
    },
  });

  if (!content) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  if (content.user.id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ content });
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
        ...(data.slides !== undefined && { slides: data.slides }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });

    return NextResponse.json({ success: true, content });
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
