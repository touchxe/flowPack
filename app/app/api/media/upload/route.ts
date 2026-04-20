/**
 * POST /api/media/upload — Cloudinary에 파일 업로드 후 DB 저장
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isCloudinaryConfigured, uploadToCloudinary } from "@/lib/cloudinary";

const PLAN_LIMITS: Record<string, number> = {
  FREE:       100 * 1024 * 1024,           // 100MB
  STARTER:    1   * 1024 * 1024 * 1024,    // 1GB
  PRO:        10  * 1024 * 1024 * 1024,    // 10GB
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

  // Cloudinary 설정 확인
  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: "스토리지가 설정되지 않았습니다. Cloudinary 환경변수를 추가해주세요." },
      { status: 503 }
    );
  }

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

  // 플랜별 용량 검사
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

  // Buffer 변환 → Cloudinary 업로드
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const safeName = file.name
    .replace(/\.[^.]+$/, "") // 확장자 제거
    .replace(/[^a-zA-Z0-9가-힣_-]/g, "_")
    .slice(0, 60);

  const resourceType: "image" | "video" | "raw" =
    mediaType === "IMAGE" ? "image" :
    mediaType === "AUDIO" ? "video" : // Cloudinary는 audio도 video 타입
    "raw";

  const uploaded = await uploadToCloudinary(buffer, {
    folder:       `flowpack/${session.user.id}`,
    publicId:     `${Date.now()}_${safeName}`,
    resourceType,
    // 이미지만 변환 최적화 적용
    transformation: mediaType === "IMAGE"
      ? [{ quality: "auto", fetch_format: "auto" }]
      : undefined,
  });

  // DB 저장 (blobKey 대신 publicId 저장)
  const saved = await prisma.mediaFile.create({
    data: {
      userId:    session.user.id,
      name:      file.name,
      url:       uploaded.url,
      blobKey:   uploaded.publicId,   // publicId를 blobKey 컬럼에 저장
      mimeType:  file.type,
      mediaType,
      size:      file.size,
    },
  });

  return NextResponse.json({ file: saved }, { status: 201 });
}
