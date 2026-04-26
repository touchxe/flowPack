/**
 * Instagram OAuth 콜백 라우트
 * GET /api/social-accounts/callback/instagram
 *
 * Instagram Login API 흐름:
 * 1. 사용자가 /api/social-accounts/connect/INSTAGRAM 클릭
 * 2. Instagram 로그인 페이지로 리다이렉트
 * 3. 승인 후 이 라우트로 code + state 반환
 * 4. code → 단기 토큰 → 장기 토큰(60일) 교환
 * 5. 사용자 프로필(id, username) 조회
 * 6. DB에 저장 → /social-accounts로 리다이렉트
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getInstagramUserProfile,
} from "@/lib/integrations/instagram";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  /* 사용자가 연동을 거부한 경우 */
  if (errorParam) {
    console.warn("Instagram OAuth 거부:", errorParam, errorDescription);
    return NextResponse.redirect(
      new URL("/social-accounts?error=instagram_denied", req.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/social-accounts?error=instagram_no_code", req.url)
    );
  }

  try {
    /* 1. code → 단기 액세스 토큰 교환 */
    const shortTokenResult = await exchangeCodeForToken(code);
    if (!shortTokenResult) {
      return NextResponse.redirect(
        new URL("/social-accounts?error=instagram_token_failed", req.url)
      );
    }

    /* 2. 단기 → 장기 토큰 교환 (60일) */
    const longTokenResult = await exchangeForLongLivedToken(shortTokenResult.accessToken);
    const accessToken = longTokenResult?.accessToken ?? shortTokenResult.accessToken;
    const expiresAt = longTokenResult
      ? new Date(Date.now() + longTokenResult.expiresIn * 1000)
      : null;

    /* 3. 사용자 프로필 조회 */
    const profile = await getInstagramUserProfile(accessToken);
    if (!profile) {
      return NextResponse.redirect(
        new URL("/social-accounts?error=instagram_no_profile", req.url)
      );
    }

    /* 4. DB 저장 (upsert: 재연동 지원) */
    // 저장 형식: "igUserId||accessToken||username"
    const storedToken = `${profile.id}||${accessToken}||${profile.username}`;

    const existing = await prisma.socialAccount.findUnique({
      where: {
        userId_platform: { userId: session.user.id, platform: "INSTAGRAM" },
      },
    });

    if (existing) {
      await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          accountName: profile.username,
          accountId: profile.id,
          accessToken: storedToken,
          tokenExpiresAt: expiresAt,
          isActive: true,
        },
      });
    } else {
      await prisma.socialAccount.create({
        data: {
          userId: session.user.id,
          platform: "INSTAGRAM",
          accountName: profile.username,
          accountId: profile.id,
          accessToken: storedToken,
          tokenExpiresAt: expiresAt,
        },
      });
    }

    return NextResponse.redirect(
      new URL("/social-accounts?success=connected", req.url)
    );
  } catch (err) {
    console.error("Instagram OAuth 콜백 오류:", err);
    return NextResponse.redirect(
      new URL("/social-accounts?error=instagram_server_error", req.url)
    );
  }
}
