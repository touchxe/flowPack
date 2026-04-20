import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildInstagramOAuthUrl } from "@/lib/integrations/instagram";
import { buildThreadsOAuthUrl } from "@/lib/integrations/threads";

/**
 * SNS 플랫폼 연동 시작점
 * - INSTAGRAM: 실제 Meta OAuth URL로 리다이렉트 (META_APP_ID 설정 시)
 * - WORDPRESS: 별도 API (social-accounts/connect/wordpress/route.ts)
 * - 나머지: Mock 데모 연동
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { platform } = await params;
  const platformUpper = platform.toUpperCase();
  const validPlatforms = ["INSTAGRAM", "FACEBOOK", "TWITTER", "LINKEDIN", "NAVER_BLOG", "WORDPRESS", "THREADS"];

  if (!validPlatforms.includes(platformUpper)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  /* ── WordPress: 전용 모달 UI를 사용하므로 여기선 처리 안 함 ── */
  if (platformUpper === "WORDPRESS") {
    return NextResponse.json(
      { error: "WordPress는 별도 연동 방식을 사용합니다." },
      { status: 400 }
    );
  }

  /* ── Instagram: 실제 Meta OAuth ──────────────────── */
  if (platformUpper === "INSTAGRAM") {
    if (process.env.META_APP_ID && process.env.META_APP_SECRET) {
      try {
        const state = Buffer.from(JSON.stringify({ userId: session.user.id, ts: Date.now() })).toString("base64url");
        const oauthUrl = buildInstagramOAuthUrl(state);
        return NextResponse.redirect(oauthUrl);
      } catch {}
    }
  }

  /* ── Threads: 실제 OAuth ─────────────────────────── */
  if (platformUpper === "THREADS") {
    if (process.env.THREADS_APP_ID && process.env.THREADS_APP_SECRET) {
      try {
        const state = Buffer.from(JSON.stringify({ userId: session.user.id, ts: Date.now() })).toString("base64url");
        const oauthUrl = buildThreadsOAuthUrl(state);
        return NextResponse.redirect(oauthUrl);
      } catch {}
    }
    // 환경변수 미설정 시 Mock으로 fallback
  }

  /* ── 나머지 플랫폼: Mock 데모 연동 ──────────────────── */
  const mockAccounts: Record<string, { accountName: string; accountId: string }> = {
    INSTAGRAM:  { accountName: "demo_instagram",  accountId: "ig_123456789"  },
    FACEBOOK:   { accountName: "demo_facebook",   accountId: "fb_987654321"  },
    TWITTER:    { accountName: "demo_twitter",    accountId: "tw_456789123"  },
    LINKEDIN:   { accountName: "demo_linkedin",   accountId: "li_789123456"  },
    NAVER_BLOG: { accountName: "demo_naver_blog", accountId: "nv_321654987"  },
    THREADS:    { accountName: "demo_threads",    accountId: "th_111222333"  },
  };

  const mockData = mockAccounts[platformUpper];
  const platformEnum = platformUpper as "INSTAGRAM" | "FACEBOOK" | "TWITTER" | "LINKEDIN" | "NAVER_BLOG" | "WORDPRESS";

  const existing = await prisma.socialAccount.findUnique({
    where: { userId_platform: { userId: session.user.id, platform: platformEnum } },
  });

  if (existing) {
    return NextResponse.redirect(new URL("/social-accounts?error=already_connected", req.url));
  }

  await prisma.socialAccount.create({
    data: {
      userId: session.user.id,
      platform: platformEnum,
      accountName: mockData.accountName,
      accountId: mockData.accountId,
      accessToken: `mock_token_${Date.now()}`,
      refreshToken: `mock_refresh_${Date.now()}`,
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return NextResponse.redirect(new URL("/social-accounts?success=connected", req.url));
}
