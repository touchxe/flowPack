import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userOwnsNasObjectReference } from "@/lib/nas-media-authorization.mjs";
import {
  isMigratedNasObjectKey,
  mimeTypeForNasObjectKey,
  readNasObject,
} from "@/lib/nas-storage.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  let session;
  try {
    session = await auth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: PRIVATE_HEADERS });
  }
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: PRIVATE_HEADERS });
  }

  // Never turn this route into a public-CDN endpoint. Tailscale access is an
  // additional network boundary, not a replacement for application ownership.
  if (
    process.env.FLOWPACK_DEPLOYMENT_PROFILE !== "nas-private" ||
    process.env.FLOWPACK_STORAGE_DRIVER !== "nas" ||
    !process.env.FLOWPACK_STORAGE_ROOT
  ) {
    return NextResponse.json({ error: "Not Found" }, { status: 404, headers: PRIVATE_HEADERS });
  }

  const { key: segments } = await params;
  const key = Array.isArray(segments) ? segments.join("/") : "";
  if (!isMigratedNasObjectKey(key)) {
    return NextResponse.json({ error: "Not Found" }, { status: 404, headers: PRIVATE_HEADERS });
  }

  const mimeType = mimeTypeForNasObjectKey(key);
  if (!mimeType) {
    return NextResponse.json({ error: "Not Found" }, { status: 404, headers: PRIVATE_HEADERS });
  }

  try {
    const owned = await userOwnsNasObjectReference({
      db: prisma,
      userId: session.user.id,
      key,
    });
    if (!owned) {
      return NextResponse.json({ error: "Not Found" }, { status: 404, headers: PRIVATE_HEADERS });
    }
    const stored = await readNasObject({ root: process.env.FLOWPACK_STORAGE_ROOT, key });
    return new NextResponse(stored.buffer, {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Length": String(stored.size),
        "Content-Type": mimeType,
      },
    });
  } catch {
    return NextResponse.json({ error: "Not Found" }, { status: 404, headers: PRIVATE_HEADERS });
  }
}
