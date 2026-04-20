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
  console.log("[media/upload] 시작");

  const session = await auth();
  if (!session?.user?.id) {
    console.log("[media/upload] 인증 실패");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.log("[media/upload] 사용자:", session.user.id);

  // Cloudinary 설정 확인
  const configured = isCloudinaryConfigured();
  console.log("[media/upload] Cloudinary 설정:", {
    configured,
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME ?? "없음",
    has_key: !!process.env.CLOUDINARY_API_KEY,
    has_secret: !!process.env.CLOUDINARY_API_SECRET,
  });

  if (!configured) {
    return NextResponse.json(
      { error: "스토리지가 설정되지 않았습니다. Cloudinary 환경변수를 추가해주세요." },
      { status: 503 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "파일이 필요합니다" }, { status: 400 });

  console.log("[media/upload] 파일:", { name: file.name, type: file.type, size: file.size });

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
  console.log("[media/upload] Cloudinary 업로드 시작...");
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const safeName = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9가-힣_-]/g, "_")
      .slice(0, 60);

    const resourceType: "image" | "video" | "raw" =
      mediaType === "IMAGE" ? "image" :
      mediaType === "AUDIO" ? "video" :
      "raw";

    const uploaded = await uploadToCloudinary(buffer, {
      folder:       `flowpack/${session.user.id}`,
      publicId:     `${Date.now()}_${safeName}`,
      resourceType,
      transformation: mediaType === "IMAGE"
        ? [{ quality: "auto", fetch_format: "auto" }]
        : undefined,
    });

    console.log("[media/upload] Cloudinary 업로드 성공:", uploaded.url);

    const saved = await prisma.mediaFile.create({
      data: {
        userId:    session.user.id,
        name:      file.name,
        url:       uploaded.url,
        blobKey:   uploaded.publicId,
        mimeType:  file.type,
        mediaType,
        size:      file.size,
      },
    });

    console.log("[media/upload] DB 저장 완료:", saved.id);
    return NextResponse.json({ file: saved }, { status: 201 });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[media/upload] 오류:", msg);
    return NextResponse.json({ error: `업로드 오류: ${msg}` }, { status: 500 });
  }
}
