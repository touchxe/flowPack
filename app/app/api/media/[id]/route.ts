/**
 * GET    /api/media/[id] — 단건 조회
 * PUT    /api/media/[id] — 메타데이터 수정
 * DELETE /api/media/[id] — 단건 삭제
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFromCloudinary } from "@/lib/cloudinary";

function isContentImageId(id: string): boolean {
  return id.startsWith("content-image:");
}

function getContentImageId(id: string): string {
  return id.replace("content-image:", "");
}

function estimateDataUrlBytes(url: string): number {
  if (!url.startsWith("data:")) return 0;

  const [, payload = ""] = url.split(",", 2);
  if (!payload) return 0;
  if (!url.includes(";base64,")) return new TextEncoder().encode(decodeURIComponent(payload)).length;

  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

function toContentImageFile(image: {
  id: string;
  contentId: string;
  url: string;
  altText: string | null;
  order: number;
  createdAt: Date;
  content: { id: string; title: string };
}) {
  return {
    id: `content-image:${image.id}`,
    name: image.altText || `${image.content.title} 이미지`,
    url: `/api/content/${image.contentId}/images/${image.id}/serve`,
    blobKey: image.id,
    mimeType: "image/*",
    mediaType: "IMAGE" as const,
    size: estimateDataUrlBytes(image.url),
    width: null,
    height: null,
    duration: null,
    alt: image.altText || image.content.title,
    tags: null,
    createdAt: image.createdAt,
    updatedAt: image.createdAt,
    source: "CONTENT_IMAGE" as const,
    contentId: image.contentId,
    contentTitle: image.content.title,
    canEdit: true,
    canDelete: true,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  if (isContentImageId(id)) {
    const image = await prisma.contentImage.findFirst({
      where: {
        id: getContentImageId(id),
        content: { userId: session.user.id },
      },
      include: { content: { select: { id: true, title: true } } },
    });
    if (!image) return NextResponse.json({ error: "Not Found" }, { status: 404 });
    return NextResponse.json({ file: toContentImageFile(image) });
  }

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
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const body = await req.json() as { alt?: string; tags?: string[]; name?: string };

  if (isContentImageId(id)) {
    const imageId = getContentImageId(id);
    const existing = await prisma.contentImage.findFirst({
      where: {
        id: imageId,
        content: { userId: session.user.id },
      },
      include: { content: { select: { id: true, title: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Not Found" }, { status: 404 });

    const currentName = existing.altText || `${existing.content.title} 이미지`;
    const nextAltText = body.name?.trim() && body.name.trim() !== currentName
      ? body.name.trim()
      : (body.alt ?? existing.altText ?? "").trim();
    const updated = await prisma.contentImage.update({
      where: { id: imageId },
      data: { altText: nextAltText },
      include: { content: { select: { id: true, title: true } } },
    });

    return NextResponse.json({ file: toContentImageFile(updated) });
  }

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
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);

  if (isContentImageId(id)) {
    const image = await prisma.contentImage.findFirst({
      where: {
        id: getContentImageId(id),
        content: { userId: session.user.id },
      },
    });
    if (!image) return NextResponse.json({ error: "Not Found" }, { status: 404 });

    await prisma.contentImage.delete({ where: { id: image.id } });
    return NextResponse.json({ ok: true });
  }

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
