/**
 * POST /api/media/upload — Vercel Blob에 파일 업로드 후 DB 저장
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";

const PLAN_LIMITS: Record<string, number> = {
  FREE:       100 * 1024 * 1024,
  STARTER:    1   * 1024 * 1024 * 1024,
  PRO:        10  * 1024 * 1024 * 1024,
  ENTERPRISE: Infinity,
};

function detectMediaType(mime: string): "IMAGE" | "AUDIO" | "DOCUMENT" | null {
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("audio/")) return "AUDIO";
  if (mime === "application/pdf") return "DOCUMENT";
  return null;
}

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg",
  "application/pdf",
]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // BLOB_READ_WRITE_TOKEN 없으면 안내
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return NextResponse.json({ error: "스토리지가 설정되지 않았습니다. Vercel Blob 토큰을 추가해주세요." }, { status: 503 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "파일이 필요합니다" }, { status: 400 });

  if (!ALLOWED_MIME.has(file.type))
    return NextResponse.json({ error: `허용되지 않는 파일 형식입니다: ${file.type}` }, { status: 400 });

  const mediaType = detectMediaType(file.type);
  if (!mediaType) return NextResponse.json({ error: "지원하지 않는 파일 형식입니다" }, { status: 400 });

  const maxSize =
    mediaType === "IMAGE" ? 20 * 1024 * 1024 :
    mediaType === "AUDIO" ? 50 * 1024 * 1024 :
    10 * 1024 * 1024;

  if (file.size > maxSize)
    return NextResponse.json({ error: `파일 크기가 너무 큽니다 (최대 ${maxSize / 1024 / 1024}MB)` }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });
  const planLimit = PLAN_LIMITS[user?.plan ?? "FREE"];
  const usageAgg = await prisma.mediaFile.aggregate({
    where: { userId: session.user.id },
    _sum: { size: true },
  });
  if ((usageAgg._sum.size ?? 0) + file.size > planLimit)
    return NextResponse.json({ error: "저장 용량이 초과되었습니다. 플랜을 업그레이드해 주세요." }, { status: 400 });

  const pathname = `media/${session.user.id}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
  const blob = await put(pathname, file, { access: "public" });

  const saved = await prisma.mediaFile.create({
    data: {
      userId: session.user.id,
      name: file.name,
      url: blob.url,
      blobKey: blob.pathname,
      mimeType: file.type,
      mediaType,
      size: file.size,
    },
  });

  return NextResponse.json({ file: saved }, { status: 201 });
}
