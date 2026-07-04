import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptSocialToken } from "@/lib/social-token-crypto";
import { verifySocialOAuthState } from "@/lib/oauth-state";
import { exchangeXCodeForToken, getXUserProfile } from "@/lib/integrations/x";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const codeVerifier = req.cookies.get("flowpack_x_code_verifier")?.value;

  if (errorParam) {
    return NextResponse.redirect(new URL("/social-accounts?error=twitter_denied", req.url));
  }

  if (!code || !codeVerifier) {
    return NextResponse.redirect(new URL("/social-accounts?error=twitter_no_code", req.url));
  }

  if (!verifySocialOAuthState(state, session.user.id, "TWITTER")) {
    return NextResponse.redirect(new URL("/social-accounts?error=twitter_invalid_state", req.url));
  }

  try {
    const token = await exchangeXCodeForToken(code, codeVerifier);
    if (!token) {
      return NextResponse.redirect(new URL("/social-accounts?error=twitter_token_failed", req.url));
    }

    const profile = await getXUserProfile(token.accessToken);
    if (!profile) {
      return NextResponse.redirect(new URL("/social-accounts?error=twitter_no_profile", req.url));
    }

    const storedToken = encryptSocialToken(`${profile.id}||${token.accessToken}||${profile.username}`);
    const refreshToken = token.refreshToken
      ? encryptSocialToken(token.refreshToken)
      : null;
    const tokenExpiresAt = token.expiresIn
      ? new Date(Date.now() + token.expiresIn * 1000)
      : null;

    const existing = await prisma.socialAccount.findFirst({
      where: { userId: session.user.id, platform: "TWITTER" },
    });

    if (existing) {
      await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          accountName: profile.username,
          accountId: profile.id,
          accessToken: storedToken,
          refreshToken,
          tokenExpiresAt,
          isActive: true,
        },
      });
    } else {
      await prisma.socialAccount.create({
        data: {
          userId: session.user.id,
          platform: "TWITTER",
          accountName: profile.username,
          accountId: profile.id,
          accessToken: storedToken,
          refreshToken,
          tokenExpiresAt,
        },
      });
    }

    const res = NextResponse.redirect(new URL("/social-accounts?success=connected", req.url));
    res.cookies.delete("flowpack_x_code_verifier");
    return res;
  } catch (error) {
    console.error("Twitter OAuth callback error:", error);
    return NextResponse.redirect(new URL("/social-accounts?error=twitter_server_error", req.url));
  }
}
