import { createHash, timingSafeEqual } from "node:crypto";
import bcrypt from "bcrypt";

import { isCredentialSmokeEnabled } from "@/lib/deployment-boundary.mjs";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 8 * 1024;
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

function response(status: number) {
  return new Response(null, { status, headers: NO_STORE });
}

function tokenMatches(expected: string | undefined, supplied: string | null) {
  if (!expected || expected.length < 32 || expected.length > 512 || !supplied) return false;
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  const suppliedDigest = createHash("sha256").update(supplied, "utf8").digest();
  return timingSafeEqual(expectedDigest, suppliedDigest);
}

/**
 * Credential continuity probe for the pre-cutover read-only destination. It
 * deliberately bypasses NextAuth so it cannot create/update a session or run
 * a sign-in callback. The dedicated operator token is sent only as a header.
 */
export async function POST(request: Request) {
  if (!isCredentialSmokeEnabled(process.env)) return response(404);
  if (!tokenMatches(
    process.env.FLOWPACK_AUTH_SMOKE_TOKEN,
    request.headers.get("x-flowpack-auth-smoke-token"),
  )) {
    return response(401);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isSafeInteger(contentLength) || contentLength > MAX_BODY_BYTES) return response(400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response(400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return response(400);
  const { email, password } = body as { email?: unknown; password?: unknown };
  if (
    typeof email !== "string" ||
    email.length < 3 ||
    email.length > 320 ||
    typeof password !== "string" ||
    password.length < 1 ||
    password.length > 1024
  ) {
    return response(401);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { passwordHash: true, role: true, isBlocked: true },
  });
  const passwordValid = user?.passwordHash
    ? await bcrypt.compare(password, user.passwordHash)
    : false;
  const roleValid = process.env.FLOWPACK_AUTH_SMOKE_REQUIRE_ADMIN !== "true" || user?.role === "ADMIN";
  return passwordValid && !user?.isBlocked && roleValid ? response(204) : response(401);
}
