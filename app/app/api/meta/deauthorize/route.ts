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

/** signed_request 검증 및 페이로드 파싱 */
function parseSignedRequest(signedRequest: string): { user_id: string } | null {
  try {
    const [encodedSig, payload] = signedRequest.split(".");
    if (!encodedSig || !payload) return null;

    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) return null;

    // Base64URL → Buffer
    const toBuffer = (b64url: string) =>
      Buffer.from(b64url.replace(/-/g, "+").replace(/_/g, "/"), "base64");

    // HMAC-SHA256 서명 검증
    const expectedSig = crypto
      .createHmac("sha256", appSecret)
      .update(payload)
      .digest();

    const actualSig = toBuffer(encodedSig);
    if (expectedSig.length !== actualSig.length || !crypto.timingSafeEqual(expectedSig, actualSig)) {
      console.warn("[Meta Deauth] 서명 검증 실패");
      return null;
    }

    const data = JSON.parse(toBuffer(payload).toString("utf8"));
    return data;
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
    if (!payload?.user_id) {
      return NextResponse.json({ error: "유효하지 않은 요청" }, { status: 403 });
    }

    // Instagram 계정 ID로 SocialAccount 찾아서 비활성화
    // (Meta의 user_id = Instagram accountId)
    await prisma.socialAccount.updateMany({
      where: {
        platform: "INSTAGRAM",
        accountId: payload.user_id,
      },
      data: {
        isActive: false,
      },
    });

    console.log(`[Meta Deauth] Instagram 연동 비활성화 완료: ${payload.user_id}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Meta Deauth] 처리 오류:", err);
    return NextResponse.json({ error: "처리 중 오류 발생" }, { status: 500 });
  }
}
