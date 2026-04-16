import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/content/[id]/images/[imageId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, imageId } = await params;

  // 콘텐츠 소유권 확인
  const image = await prisma.contentImage.findUnique({
    where: { id: imageId },
    include: { content: { select: { userId: true } } },
  });

  if (!image || image.content.userId !== session.user.id || image.contentId !== id) {
    return NextResponse.json({ error: "이미지를 찾을 수 없습니다" }, { status: 404 });
  }

  await prisma.contentImage.delete({ where: { id: imageId } });

  return NextResponse.json({ success: true });
}
