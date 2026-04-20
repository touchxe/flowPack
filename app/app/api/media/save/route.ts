/**
 * POST /api/media/save — Cloudinary 직접 업로드 결과를 DB에 저장
 * 클라이언트가 Cloudinary에 직접 업로드 후 결과를 이 API로 전송
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function detectMediaType(mime: string): "IMAGE" | "AUDIO" | "DOCUMENT" | null {
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("audio/")) return "AUDIO";
  if (mime === "application/pdf") return "DOCUMENT";
  return null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    url: string;
    publicId: string;
    name: string;
    mimeType: string;
    size: number;
    width?: number;
    height?: number;
  };

  if (!body.url || !body.publicId || !body.name || !body.mimeType) {
    return NextResponse.json({ error: "필수 필드가 없습니다" }, { status: 400 });
  }

  const mediaType = detectMediaType(body.mimeType);
  if (!mediaType) {
    return NextResponse.json({ error: "지원하지 않는 파일 형식입니다" }, { status: 400 });
  }

  const saved = await prisma.mediaFile.create({
    data: {
      userId:    session.user.id,
      name:      body.name,
      url:       body.url,
      blobKey:   body.publicId,
      mimeType:  body.mimeType,
      mediaType,
      size:      body.size,
    },
  });

  console.log("[media/save] DB 저장 완료:", saved.id, body.url);
  return NextResponse.json({ file: saved }, { status: 201 });
}
