import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/content/[id]/images — 이미지 일괄 등록
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const content = await prisma.content.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!content || content.userId !== session.user.id) {
    return NextResponse.json({ error: "콘텐츠를 찾을 수 없습니다" }, { status: 404 });
  }

  const body = await req.json() as {
    images: { url: string; altText?: string; order?: number }[];
  };

  if (!Array.isArray(body.images) || body.images.length === 0) {
    return NextResponse.json({ error: "이미지 목록이 비어있습니다" }, { status: 400 });
  }

  // base64 data URL은 그대로 저장 (실제 서비스에서는 스토리지 업로드 필요)
  const created = await prisma.$transaction(async (tx) => {
    const images = await Promise.all(body.images.map(img =>
      tx.contentImage.create({
        data: {
          contentId: id,
          url: img.url,
          altText: img.altText ?? "",
          order: img.order ?? 0,
        },
      }),
    ));
    await tx.content.update({ where: { id }, data: { revision: { increment: 1 } } });
    return images;
  });

  return NextResponse.json({ images: created }, { status: 201 });
}

// GET /api/content/[id]/images — 이미지 목록 조회
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const content = await prisma.content.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!content) {
    return NextResponse.json({ error: "콘텐츠를 찾을 수 없습니다" }, { status: 404 });
  }

  const images = await prisma.contentImage.findMany({
    where: { contentId: id },
    orderBy: { order: "asc" },
  });

  return NextResponse.json({ images });
}
