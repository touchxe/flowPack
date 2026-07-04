import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSocialOAuthState } from "@/lib/oauth-state";
import { buildFacebookOAuthUrl } from "@/lib/integrations/facebook";
import { buildInstagramOAuthUrl } from "@/lib/integrations/instagram";
import { buildThreadsOAuthUrl } from "@/lib/integrations/threads";
import { buildLinkedInOAuthUrl } from "@/lib/integrations/linkedin";
import { buildXOAuthUrl, createXCodeVerifier } from "@/lib/integrations/x";

/**
 * SNS 플랫폼 연동 시작점
 * - INSTAGRAM/FACEBOOK/THREADS/TWITTER/LINKEDIN: 실제 OAuth URL로 리다이렉트
 * - WORDPRESS: 별도 API (social-accounts/connect/wordpress/route.ts)
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

  if (platformUpper === "NAVER_BLOG") {
    return NextResponse.redirect(new URL("/social-accounts?error=naver_not_ready", req.url));
  }

  try {
    if (platformUpper === "INSTAGRAM") {
      const state = createSocialOAuthState(session.user.id, "INSTAGRAM");
      return NextResponse.redirect(buildInstagramOAuthUrl(state));
    }

    if (platformUpper === "FACEBOOK") {
      const state = createSocialOAuthState(session.user.id, "FACEBOOK");
      return NextResponse.redirect(buildFacebookOAuthUrl(state));
    }

    if (platformUpper === "THREADS") {
      const state = createSocialOAuthState(session.user.id, "THREADS");
      return NextResponse.redirect(buildThreadsOAuthUrl(state));
    }

    if (platformUpper === "TWITTER") {
      const state = createSocialOAuthState(session.user.id, "TWITTER");
      const codeVerifier = createXCodeVerifier();
      const res = NextResponse.redirect(buildXOAuthUrl(state, codeVerifier));
      res.cookies.set("flowpack_x_code_verifier", codeVerifier, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 10 * 60,
        path: "/",
      });
      return res;
    }

    if (platformUpper === "LINKEDIN") {
      const state = createSocialOAuthState(session.user.id, "LINKEDIN");
      return NextResponse.redirect(buildLinkedInOAuthUrl(state));
    }
  } catch (error) {
    console.error("Social OAuth start error:", error);
    return NextResponse.redirect(new URL(`/social-accounts?error=${platformUpper.toLowerCase()}_config_missing`, req.url));
  }

  return NextResponse.redirect(new URL("/social-accounts?error=unsupported_platform", req.url));
}
