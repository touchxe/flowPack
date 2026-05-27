/**
 * Meta 데이터 삭제 요청 콜백 (Data Deletion Request)
 * POST /api/meta/data-deletion
 *
 * GDPR 준수: 사용자가 Meta에 데이터 삭제를 요청하면 Meta가 이 URL로 POST.
 * signed_request 검증 후 해당 사용자의 Meta 연동 데이터를 삭제.
 * 삭제 확인 URL과 추적 코드(confirmation_code)를 반환해야 함.
 *
 * Meta 앱 설정 > Instagram > 데이터 삭제 요청 URL:
 *   https://flow-pack.vercel.app/api/meta/data-deletion
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

type MetaCallbackPlatform = "INSTAGRAM" | "THREADS";

interface ParsedSignedRequest {
  userId: string;
  platform: MetaCallbackPlatform;
}

function getCallbackAppSecrets(): Array<{ secret: string; platform: MetaCallbackPlatform }> {
  const candidates = [
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
function parseSignedRequest(signedRequest: string): ParsedSignedRequest | null {
  try {
    const [encodedSig, payload] = signedRequest.split(".");
    if (!encodedSig || !payload) return null;

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

    console.warn("[Meta DataDeletion] 서명 검증 실패");
    return null;
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
    if (!payload) {
      return NextResponse.json({ error: "유효하지 않은 요청" }, { status: 403 });
    }

    // Meta의 user_id = 플랫폼 accountId
    const deleted = await prisma.socialAccount.deleteMany({
      where: {
        platform: payload.platform,
        accountId: payload.userId,
      },
    });

    console.log(`[Meta DataDeletion] 삭제 완료: platform=${payload.platform}, accountId=${payload.userId}, count=${deleted.count}`);

    // Meta 필수 응답 형식: url + confirmation_code
    const confirmationCode = `fp_del_${payload.platform.toLowerCase()}_${payload.userId}_${Date.now()}`;
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

  // confirmation_code 형식: fp_del_{platform}_{accountId}_{timestamp}
  return NextResponse.json({
    confirmation_code: code,
    status: "deleted",
    message: "FlowPack에서 해당 Meta 연동 데이터가 삭제되었습니다.",
  });
}
