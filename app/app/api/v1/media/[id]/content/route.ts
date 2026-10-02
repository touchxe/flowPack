import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readStoredObject } from "@/lib/storage";
import { ExternalApiError, authenticateExternalRequest, errorResponse } from "@/server/services/external-api";

export const runtime = "nodejs";

function contentDisposition(name: string): string {
  const safe = name.replace(/[\r\n"]/g, "_").slice(0, 255) || "image";
  return `inline; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const principal = await authenticateExternalRequest(request, "media:read");
    const { id } = await params;
    const file = await prisma.mediaFile.findFirst({
      where: { id, userId: principal.userId, mediaType: "IMAGE", url: { not: { startsWith: "pending:" } } },
      select: { url: true, blobKey: true, mimeType: true, name: true },
    });
    if (!file) throw new ExternalApiError(404, "NOT_FOUND", "사진을 찾을 수 없습니다.");
    if (!file.url.startsWith("/api/media/")) {
      return NextResponse.redirect(file.url, { status: 307 });
    }
    const stored = await readStoredObject({ url: file.url, blobKey: file.blobKey });
    return new NextResponse(stored.buffer, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(stored.size),
        "Content-Disposition": contentDisposition(file.name),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
