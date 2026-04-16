/**
 * Instagram OAuth 콜백 라우트
 * GET /api/social-accounts/callback/instagram
 *
 * Meta OAuth 흐름:
 * 1. 사용자가 /api/social-accounts/connect/INSTAGRAM 클릭
 * 2. Meta OAuth 페이지로 리다이렉트
 * 3. 승인 후 이 라우트로 code + state 반환
 * 4. code → short-lived token → long-lived token 교환
 * 5. Facebook 페이지 → Instagram 비즈니스 계정 ID 조회
 * 6. DB에 저장 → /social-accounts로 리다이렉트
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getUserPages,
  getInstagramAccountId,
} from "@/lib/integrations/instagram";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");

  /* 사용자가 연동을 거부한 경우 */
  if (errorParam) {
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
    /* 1. code → 단기 토큰 교환 */
    const shortToken = await exchangeCodeForToken(code);
    if (!shortToken) {
      return NextResponse.redirect(
        new URL("/social-accounts?error=instagram_token_failed", req.url)
      );
    }

    /* 2. 단기 → 장기 토큰 교환 (60일) */
    const longToken = await exchangeForLongLivedToken(shortToken.accessToken);
    const accessToken = longToken?.accessToken ?? shortToken.accessToken;
    const expiresAt = longToken
      ? new Date(Date.now() + longToken.expiresIn * 1000)
      : null;

    /* 3. Facebook 페이지 목록 조회 */
    const pages = await getUserPages(accessToken);
    if (pages.length === 0) {
      return NextResponse.redirect(
        new URL("/social-accounts?error=instagram_no_pages", req.url)
      );
    }

    /* 4. 첫 번째 페이지에서 Instagram 비즈니스 계정 찾기 */
    let igCredentials: { igAccountId: string; username: string; pageAccessToken: string } | null = null;

    for (const page of pages) {
      const result = await getInstagramAccountId(page.id, page.accessToken);
      if (result) {
        igCredentials = {
          igAccountId: result.igAccountId,
          username: result.username,
          pageAccessToken: page.accessToken,
        };
        break;
      }
    }

    if (!igCredentials) {
      return NextResponse.redirect(
        new URL("/social-accounts?error=instagram_no_business_account", req.url)
      );
    }

    /* 5. 기존 연동 확인 */
    const existing = await prisma.socialAccount.findUnique({
      where: {
        userId_platform: { userId: session.user.id, platform: "INSTAGRAM" },
      },
    });

    /* 6. DB 저장 (upsert: 재연동 지원) */
    // 저장 형식: "igAccountId||pageAccessToken||username"
    const storedToken = `${igCredentials.igAccountId}||${igCredentials.pageAccessToken}||${igCredentials.username}`;

    if (existing) {
      await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          accountName: igCredentials.username,
          accountId: igCredentials.igAccountId,
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
          accountName: igCredentials.username,
          accountId: igCredentials.igAccountId,
          accessToken: storedToken,
          tokenExpiresAt: expiresAt,
        },
      });
    }

    return NextResponse.redirect(
      new URL("/social-accounts?success=connected", req.url)
    );
  } catch (err) {
    console.error("Instagram OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/social-accounts?error=instagram_server_error", req.url)
    );
  }
}
