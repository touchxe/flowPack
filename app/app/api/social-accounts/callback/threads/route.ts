/**
 * Threads OAuth 콜백 라우트
 * GET /api/social-accounts/callback/threads
 *
 * Threads OAuth 흐름:
 * 1. /api/social-accounts/connect/THREADS 클릭
 * 2. threads.net OAuth 페이지로 리다이렉트
 * 3. 승인 후 이 라우트로 code + state 반환
 * 4. code → 단기 토큰 → 장기 토큰(60일) 교환
 * 5. 사용자 프로필(username) 조회
 * 6. DB에 저장 → /social-accounts로 리다이렉트
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  exchangeThreadsCodeForToken,
  exchangeThreadsLongLivedToken,
  getThreadsUserProfile,
} from "@/lib/integrations/threads";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(new URL("/social-accounts?error=threads_denied", req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/social-accounts?error=threads_no_code", req.url));
  }

  try {
    /* 1. code → 단기 토큰 */
    const shortToken = await exchangeThreadsCodeForToken(code);
    if (!shortToken) {
      return NextResponse.redirect(new URL("/social-accounts?error=threads_token_failed", req.url));
    }

    /* 2. 단기 → 장기 토큰 (60일) */
    const longToken = await exchangeThreadsLongLivedToken(shortToken.accessToken);
    const accessToken = longToken?.accessToken ?? shortToken.accessToken;
    const expiresAt = longToken
      ? new Date(Date.now() + longToken.expiresIn * 1000)
      : null;

    /* 3. 프로필 조회 */
    const profile = await getThreadsUserProfile(shortToken.userId, accessToken);
    const username = profile?.username ?? shortToken.userId;

    /* 4. 저장 형식: "userId||accessToken||username" */
    const storedToken = `${shortToken.userId}||${accessToken}||${username}`;

    /* 5. DB upsert */
    const existing = await prisma.socialAccount.findFirst({
      where: { userId: session.user.id, platform: "THREADS" as never },
    });

    const accountData = {
      accountName: username,
      accountId: shortToken.userId,
      accessToken: storedToken,
      tokenExpiresAt: expiresAt,
      isActive: true,
    };

    if (existing) {
      await prisma.socialAccount.update({ where: { id: existing.id }, data: accountData });
    } else {
      await prisma.socialAccount.create({
        data: {
          userId: session.user.id,
          platform: "THREADS" as never,
          ...accountData,
        },
      });
    }

    return NextResponse.redirect(new URL("/social-accounts?success=connected", req.url));
  } catch (err) {
    console.error("Threads OAuth callback error:", err);
    return NextResponse.redirect(new URL("/social-accounts?error=threads_server_error", req.url));
  }
}
