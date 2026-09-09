import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readStoredObject } from "@/lib/storage";

export const runtime = "nodejs";

function contentDisposition(name: string): string {
  const safe = name.replace(/[\r\n"]/g, "_").slice(0, 255) || "download";
  return `inline; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const file = await prisma.mediaFile.findFirst({
    where: { id, userId: session.user.id },
    select: { url: true, blobKey: true, mimeType: true, name: true },
  });
  if (!file) return NextResponse.json({ error: "Not Found" }, { status: 404 });

  try {
    const stored = await readStoredObject({ url: file.url, blobKey: file.blobKey });
    return new NextResponse(stored.buffer, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(stored.size),
        "Content-Disposition": contentDisposition(file.name),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Stored object is unavailable" }, { status: 404 });
  }
}
