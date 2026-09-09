/** POST /api/media/upload — authenticated server-side storage upload. */
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deleteStoredObject,
  isStorageConfigured,
  isSupportedStorageMime,
  StoredObject,
  uploadStoredObject,
} from "@/lib/storage";

export const runtime = "nodejs";

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
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg",
  "application/pdf",
]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "스토리지가 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "파일이 필요합니다" }, { status: 400 });

  if (!ALLOWED_MIME.has(file.type) || !isSupportedStorageMime(file.type))
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

  const id = randomUUID();
  let stored: StoredObject | null = null;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    stored = await uploadStoredObject({
      id,
      ownerId: session.user.id,
      buffer,
      mimeType: file.type,
    });

    const saved = await prisma.mediaFile.create({
      data: {
        id,
        userId:    session.user.id,
        name:      file.name.trim().slice(0, 255) || "unnamed",
        url:       stored.url,
        blobKey:   stored.blobKey,
        mimeType:  file.type,
        mediaType,
        size:      buffer.length,
        width:     stored.width,
        height:    stored.height,
      },
    });

    return NextResponse.json({ file: saved }, { status: 201 });
  } catch {
    if (stored) {
      await deleteStoredObject({
        url: stored.url,
        blobKey: stored.blobKey,
        mimeType: file.type,
      }).catch(() => undefined);
    }
    return NextResponse.json({ error: "업로드 처리에 실패했습니다." }, { status: 500 });
  }
}
