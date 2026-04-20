/**
 * GET    /api/media/[id] — 단건 조회
 * PUT    /api/media/[id] — 메타데이터 수정
 * DELETE /api/media/[id] — 단건 삭제
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFromCloudinary } from "@/lib/cloudinary";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const file = await prisma.mediaFile.findFirst({ where: { id, userId: session.user.id } });
  if (!file) return NextResponse.json({ error: "Not Found" }, { status: 404 });
  return NextResponse.json({ file });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json() as { alt?: string; tags?: string[]; name?: string };

  const result = await prisma.mediaFile.updateMany({
    where: { id, userId: session.user.id },
    data: {
      ...(body.alt  !== undefined ? { alt: body.alt } : {}),
      ...(body.tags !== undefined ? { tags: JSON.stringify(body.tags) } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
    },
  });
  if (result.count === 0) return NextResponse.json({ error: "Not Found" }, { status: 404 });

  const updated = await prisma.mediaFile.findUnique({ where: { id } });
  return NextResponse.json({ file: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const file = await prisma.mediaFile.findFirst({ where: { id, userId: session.user.id } });
  if (!file) return NextResponse.json({ error: "Not Found" }, { status: 404 });

  console.log("[media/delete] 삭제 시도:", { id, blobKey: file.blobKey, mimeType: file.mimeType });

  try {
    await deleteFromCloudinary(file.blobKey, file.mimeType);
    console.log("[media/delete] Cloudinary 삭제 성공");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[media/delete] Cloudinary 삭제 실패:", msg);
    // Cloudinary 삭제 실패해도 DB는 삭제 (이미 없는 파일일 수 있음)
  }

  await prisma.mediaFile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
