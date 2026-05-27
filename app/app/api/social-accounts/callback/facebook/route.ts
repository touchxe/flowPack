/**
 * Facebook OAuth 콜백 라우트
 * GET /api/social-accounts/callback/facebook
 *
 * Facebook Login 흐름:
 * 1. /api/social-accounts/connect/FACEBOOK 클릭
 * 2. Facebook OAuth 화면으로 리다이렉트
 * 3. 승인 후 이 라우트로 code + state 반환
 * 4. code → 사용자 토큰 → 장기 사용자 토큰 교환
 * 5. /me/accounts에서 관리 Page access token 조회
 * 6. 첫 번째 Page를 SocialAccount로 저장
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  encryptFacebookToken,
  exchangeFacebookCodeForToken,
  exchangeFacebookLongLivedToken,
  getFacebookPages,
  verifyFacebookOAuthState,
} from "@/lib/integrations/facebook";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(new URL("/social-accounts?error=facebook_denied", req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/social-accounts?error=facebook_no_code", req.url));
  }

  if (!verifyFacebookOAuthState(state, session.user.id)) {
    return NextResponse.redirect(new URL("/social-accounts?error=facebook_invalid_state", req.url));
  }

  try {
    const shortToken = await exchangeFacebookCodeForToken(code, req.url);
    if (!shortToken) {
      return NextResponse.redirect(new URL("/social-accounts?error=facebook_token_failed", req.url));
    }

    const longToken = await exchangeFacebookLongLivedToken(shortToken.accessToken);
    const userAccessToken = longToken?.accessToken ?? shortToken.accessToken;
    const tokenExpiresAt = longToken?.expiresIn
      ? new Date(Date.now() + longToken.expiresIn * 1000)
      : null;

    const pages = await getFacebookPages(userAccessToken);
    const page = pages[0];
    if (!page) {
      return NextResponse.redirect(new URL("/social-accounts?error=facebook_no_page", req.url));
    }

    const storedToken = encryptFacebookToken(`${page.id}||${page.accessToken}||${page.name}`);

    const existing = await prisma.socialAccount.findFirst({
      where: { userId: session.user.id, platform: "FACEBOOK" },
    });

    const accountData = {
      accountName: page.name,
      accountId: page.id,
      accessToken: storedToken,
      tokenExpiresAt,
      isActive: true,
    };

    if (existing) {
      await prisma.socialAccount.update({
        where: { id: existing.id },
        data: accountData,
      });
    } else {
      await prisma.socialAccount.create({
        data: {
          userId: session.user.id,
          platform: "FACEBOOK",
          ...accountData,
        },
      });
    }

    return NextResponse.redirect(new URL("/social-accounts?success=connected", req.url));
  } catch (error) {
    console.error("Facebook OAuth callback error:", error);
    return NextResponse.redirect(new URL("/social-accounts?error=facebook_server_error", req.url));
  }
}
