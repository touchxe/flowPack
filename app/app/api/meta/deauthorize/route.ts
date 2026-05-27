/**
 * Meta 앱 승인 취소 콜백 (Deauthorize Callback)
 * POST /api/meta/deauthorize
 *
 * 사용자가 Instagram 앱 연동을 취소하면 Meta가 이 URL로 POST 요청을 보냄.
 * signed_request 파라미터를 검증 후 해당 사용자의 소셜 계정을 비활성화.
 *
 * Meta 앱 설정 > Instagram > 승인 취소 콜백 URL:
 *   https://flow-pack.vercel.app/api/meta/deauthorize
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

type MetaCallbackPlatform = "INSTAGRAM" | "FACEBOOK" | "THREADS";

interface ParsedSignedRequest {
  userId: string;
  platform: MetaCallbackPlatform;
}

function getCallbackAppSecrets(): Array<{ secret: string; platform: MetaCallbackPlatform }> {
  const candidates = [
    { secret: process.env.FACEBOOK_APP_SECRET, platform: "FACEBOOK" as const },
    { secret: process.env.INSTAGRAM_APP_SECRET, platform: "INSTAGRAM" as const },
    { secret: process.env.META_APP_SECRET, platform: "INSTAGRAM" as const },
    { secret: process.env.THREADS_APP_SECRET, platform: "THREADS" as const },
  ];

  const seen = new Set<string>();
  return candidates.filter((candidate): candidate is { secret: string; platform: MetaCallbackPlatform } => {
    if (!candidate.secret || seen.has(candidate.secret)) return false;
    seen.add(candidate.secret);
    return true;
  });
}

/** signed_request 검증 및 페이로드 파싱 */
function parseSignedRequest(signedRequest: string): ParsedSignedRequest | null {
  try {
    const [encodedSig, payload] = signedRequest.split(".");
    if (!encodedSig || !payload) return null;

    // Base64URL → Buffer
    const toBuffer = (b64url: string) =>
      Buffer.from(b64url.replace(/-/g, "+").replace(/_/g, "/"), "base64");

    const actualSig = toBuffer(encodedSig);
    for (const { secret, platform } of getCallbackAppSecrets()) {
      const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest();

      if (expectedSig.length === actualSig.length && crypto.timingSafeEqual(expectedSig, actualSig)) {
        const data = JSON.parse(toBuffer(payload).toString("utf8")) as { user_id?: unknown };
        return typeof data.user_id === "string"
          ? { userId: data.user_id, platform }
          : null;
      }
    }

    console.warn("[Meta Deauth] 서명 검증 실패");
    return null;
  } catch (err) {
    console.error("[Meta Deauth] 파싱 오류:", err);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const signedRequest = formData.get("signed_request") as string | null;

    if (!signedRequest) {
      return NextResponse.json({ error: "signed_request 누락" }, { status: 400 });
    }

    const payload = parseSignedRequest(signedRequest);
    if (!payload) {
      return NextResponse.json({ error: "유효하지 않은 요청" }, { status: 403 });
    }

    // Meta의 user_id = 플랫폼 accountId
    await prisma.socialAccount.updateMany({
      where: {
        platform: payload.platform,
        accountId: payload.userId,
      },
      data: {
        isActive: false,
      },
    });

    console.log(`[Meta Deauth] ${payload.platform} 연동 비활성화 완료: ${payload.userId}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Meta Deauth] 처리 오류:", err);
    return NextResponse.json({ error: "처리 중 오류 발생" }, { status: 500 });
  }
}
