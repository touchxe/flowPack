/**
 * GET  /api/media       — 미디어 파일 목록 조회
 * DELETE /api/media     — 일괄 삭제 { ids: string[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFromCloudinary } from "@/lib/cloudinary";

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

  const [total, files] = await Promise.all([
    prisma.mediaFile.count({ where }),
    prisma.mediaFile.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit }),
  ]);

  const usageAgg = await prisma.mediaFile.aggregate({
    where: { userId: session.user.id },
    _sum: { size: true },
  });

  return NextResponse.json({
    files,
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

  const files = await prisma.mediaFile.findMany({
    where: { id: { in: ids }, userId: session.user.id },
  });

  if (files.length === 0)
    return NextResponse.json({ error: "삭제할 파일이 없습니다" }, { status: 404 });

  // publicId(blobKey)로 Cloudinary에서 삭제
  await Promise.allSettled(files.map(f => deleteFromCloudinary(f.blobKey)));

  await prisma.mediaFile.deleteMany({
    where: { id: { in: files.map((f: { id: string }) => f.id) } },
  });

  return NextResponse.json({ deleted: files.length });
}
