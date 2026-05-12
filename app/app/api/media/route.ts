/**
 * GET  /api/media       — 미디어 파일 목록 조회
 * DELETE /api/media     — 일괄 삭제 { ids: string[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFromCloudinary } from "@/lib/cloudinary";

function estimateDataUrlBytes(url: string): number {
  if (!url.startsWith("data:")) return 0;

  const [, payload = ""] = url.split(",", 2);
  if (!payload) return 0;
  if (!url.includes(";base64,")) return new TextEncoder().encode(decodeURIComponent(payload)).length;

  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type   = searchParams.get("type") || "ALL";
  const search = searchParams.get("search") || "";
  const sort   = searchParams.get("sort") || "date";
  const page   = parseInt(searchParams.get("page") || "1");
  const limit  = parseInt(searchParams.get("limit") || "24");

  const where = {
    userId: session.user.id,
    ...(type !== "ALL" ? { mediaType: type as "IMAGE" | "AUDIO" | "DOCUMENT" } : {}),
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const orderBy =
    sort === "name" ? { name: "asc" as const } :
    sort === "size" ? { size: "desc" as const } :
    { createdAt: "desc" as const };

  const includeContentImages = type === "ALL" || type === "IMAGE";
  const contentImageWhere = {
    content: { userId: session.user.id },
    ...(search ? {
      OR: [
        { altText: { contains: search, mode: "insensitive" as const } },
        { content: { title: { contains: search, mode: "insensitive" as const } } },
      ],
    } : {}),
  };

  const [mediaTotal, mediaFiles, contentImageTotal, contentImages] = await Promise.all([
    prisma.mediaFile.count({ where }),
    prisma.mediaFile.findMany({ where, orderBy }),
    includeContentImages ? prisma.contentImage.count({ where: contentImageWhere }) : Promise.resolve(0),
    includeContentImages
      ? prisma.contentImage.findMany({
        where: contentImageWhere,
        include: { content: { select: { id: true, title: true } } },
      })
      : Promise.resolve([]),
  ]);

  const usageAgg = await prisma.mediaFile.aggregate({
    where: { userId: session.user.id },
    _sum: { size: true },
  });

  const contentImageFiles = contentImages.map((image) => ({
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
  }));

  const libraryFiles = mediaFiles.map((file) => ({
    ...file,
    source: "LIBRARY" as const,
    canEdit: true,
    canDelete: true,
  }));

  const files = [...libraryFiles, ...contentImageFiles].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, "ko");
    if (sort === "size") return b.size - a.size;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const total = mediaTotal + contentImageTotal;
  const pagedFiles = files.slice((page - 1) * limit, page * limit);

  return NextResponse.json({
    files: pagedFiles,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
    usageBytes: usageAgg._sum.size ?? 0,
  });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids } = await req.json() as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: "ids 필드가 필요합니다" }, { status: 400 });

  const mediaIds = ids.filter((id) => !id.startsWith("content-image:"));
  const contentImageIds = ids
    .filter((id) => id.startsWith("content-image:"))
    .map((id) => id.replace("content-image:", ""));

  const files = await prisma.mediaFile.findMany({
    where: { id: { in: mediaIds }, userId: session.user.id },
  });

  const contentImages = await prisma.contentImage.findMany({
    where: {
      id: { in: contentImageIds },
      content: { userId: session.user.id },
    },
  });

  if (files.length === 0 && contentImages.length === 0)
    return NextResponse.json({ error: "삭제할 파일이 없습니다" }, { status: 404 });

  // publicId(blobKey)로 Cloudinary에서 삭제 (mimeType으로 resource_type 자동 판별)
  await Promise.allSettled(files.map(f => deleteFromCloudinary(f.blobKey, f.mimeType)));

  await prisma.$transaction([
    prisma.mediaFile.deleteMany({
      where: { id: { in: files.map((f: { id: string }) => f.id) } },
    }),
    prisma.contentImage.deleteMany({
      where: { id: { in: contentImages.map((image: { id: string }) => image.id) } },
    }),
  ]);

  return NextResponse.json({
    deleted: files.length + contentImages.length,
    mediaDeleted: files.length,
    contentImagesDeleted: contentImages.length,
  });
}
