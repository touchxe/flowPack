import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/content/[id]/images/[imageId]/serve — 이미지 바이너리 서빙
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { imageId } = await params;

  const image = await prisma.contentImage.findUnique({
    where: { id: imageId },
    select: { url: true },
  });

  if (!image) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // base64 data URL인 경우 → 바이너리로 변환하여 서빙
  if (image.url.startsWith("data:")) {
    const match = image.url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: "Invalid data URL" }, { status: 400 });
    }
    const mimeType = match[1];
    const base64 = match[2];
    const buffer = Buffer.from(base64, "base64");

    return new Response(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  // 외부 URL인 경우 → 리다이렉트
  return NextResponse.redirect(image.url, 302);
}
