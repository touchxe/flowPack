/**
 * Meta 데이터 삭제 요청 콜백 (Data Deletion Request)
 * POST /api/meta/data-deletion
 *
 * GDPR 준수: 사용자가 Meta에 데이터 삭제를 요청하면 Meta가 이 URL로 POST.
 * signed_request 검증 후 해당 사용자의 Instagram 연동 데이터를 삭제.
 * 삭제 확인 URL과 추적 코드(confirmation_code)를 반환해야 함.
 *
 * Meta 앱 설정 > Instagram > 데이터 삭제 요청 URL:
 *   https://flow-pack.vercel.app/api/meta/data-deletion
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function getAppBaseUrl(req: Request): string {
  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim();
  if (nextAuthUrl) return nextAuthUrl.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    const host = vercelUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    return `https://${host}`;
  }

  return new URL(req.url).origin;
}

/** signed_request 검증 및 페이로드 파싱 */
function parseSignedRequest(signedRequest: string): { user_id: string } | null {
  try {
    const [encodedSig, payload] = signedRequest.split(".");
    if (!encodedSig || !payload) return null;

    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) return null;

    const toBuffer = (b64url: string) =>
      Buffer.from(b64url.replace(/-/g, "+").replace(/_/g, "/"), "base64");

    // HMAC-SHA256 서명 검증
    const expectedSig = crypto
      .createHmac("sha256", appSecret)
      .update(payload)
      .digest();

    const actualSig = toBuffer(encodedSig);
    if (expectedSig.length !== actualSig.length || !crypto.timingSafeEqual(expectedSig, actualSig)) {
      console.warn("[Meta DataDeletion] 서명 검증 실패");
      return null;
    }

    const data = JSON.parse(toBuffer(payload).toString("utf8"));
    return data;
  } catch (err) {
    console.error("[Meta DataDeletion] 파싱 오류:", err);
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

    // Instagram accountId로 SocialAccount 삭제
    const deleted = await prisma.socialAccount.deleteMany({
      where: {
        platform: "INSTAGRAM",
        accountId: payload.user_id,
      },
    });

    console.log(`[Meta DataDeletion] 삭제 완료: instagramId=${payload.user_id}, count=${deleted.count}`);

    // Meta 필수 응답 형식: url + confirmation_code
    const confirmationCode = `fp_del_${payload.user_id}_${Date.now()}`;
    const statusUrl = `${getAppBaseUrl(req)}/api/meta/data-deletion?code=${confirmationCode}`;

    return NextResponse.json({
      url: statusUrl,
      confirmation_code: confirmationCode,
    });
  } catch (err) {
    console.error("[Meta DataDeletion] 처리 오류:", err);
    return NextResponse.json({ error: "처리 중 오류 발생" }, { status: 500 });
  }
}

/** 삭제 상태 확인 페이지 (Meta가 검토용으로 접근) */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "코드 누락" }, { status: 400 });
  }

  // confirmation_code 형식: fp_del_{instagramId}_{timestamp}
  return NextResponse.json({
    confirmation_code: code,
    status: "deleted",
    message: "FlowPack에서 해당 Instagram 연동 데이터가 삭제되었습니다.",
  });
}
