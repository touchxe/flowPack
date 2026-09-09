import { createHash, timingSafeEqual } from "node:crypto";

import { isSocialTokenSmokeEnabled } from "@/lib/deployment-boundary.mjs";
import { prisma } from "@/lib/prisma";
import {
  inspectSocialTokenContinuity,
  MAX_ACTIVE_SOCIAL_TOKEN_SMOKE_ROWS,
} from "@/lib/social-token-continuity.mjs";
import { decryptSocialToken } from "@/lib/social-token-crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
 * Read-only continuity probe for the active SocialAccount token corpus. The
 * response contains no account identity, provider, token, decrypted value, or
 * count. A single malformed encrypted value makes the whole probe fail.
 */
export async function POST(request: Request) {
  if (!isSocialTokenSmokeEnabled(process.env)) return response(404);
  if (!tokenMatches(
    process.env.FLOWPACK_SOCIAL_TOKEN_SMOKE_TOKEN,
    request.headers.get("x-flowpack-social-token-smoke-token"),
  )) {
    return response(401);
  }

  let rows: Array<{ accessToken: string }>;
  try {
    rows = await prisma.socialAccount.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { accessToken: true },
      take: MAX_ACTIVE_SOCIAL_TOKEN_SMOKE_ROWS + 1,
    });
  } catch {
    return response(503);
  }

  try {
    inspectSocialTokenContinuity(
      rows.map(({ accessToken }) => accessToken),
      { decrypt: decryptSocialToken },
    );
  } catch {
    return response(409);
  }
  return response(204);
}
