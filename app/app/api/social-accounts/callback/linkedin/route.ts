import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptSocialToken } from "@/lib/social-token-crypto";
import { verifySocialOAuthState } from "@/lib/oauth-state";
import {
  exchangeLinkedInCodeForToken,
  getLinkedInProfile,
} from "@/lib/integrations/linkedin";

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
    return NextResponse.redirect(new URL("/social-accounts?error=linkedin_denied", req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/social-accounts?error=linkedin_no_code", req.url));
  }

  if (!verifySocialOAuthState(state, session.user.id, "LINKEDIN")) {
    return NextResponse.redirect(new URL("/social-accounts?error=linkedin_invalid_state", req.url));
  }

  try {
    const token = await exchangeLinkedInCodeForToken(code);
    if (!token) {
      return NextResponse.redirect(new URL("/social-accounts?error=linkedin_token_failed", req.url));
    }

    const profile = await getLinkedInProfile(token.accessToken);
    if (!profile) {
      return NextResponse.redirect(new URL("/social-accounts?error=linkedin_no_profile", req.url));
    }

    const storedToken = encryptSocialToken(`${profile.id}||${token.accessToken}||${profile.name}`);
    const tokenExpiresAt = token.expiresIn
      ? new Date(Date.now() + token.expiresIn * 1000)
      : null;

    const existing = await prisma.socialAccount.findFirst({
      where: { userId: session.user.id, platform: "LINKEDIN" },
    });

    if (existing) {
      await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          accountName: profile.name,
          accountId: profile.id,
          accessToken: storedToken,
          tokenExpiresAt,
          isActive: true,
        },
      });
    } else {
      await prisma.socialAccount.create({
        data: {
          userId: session.user.id,
          platform: "LINKEDIN",
          accountName: profile.name,
          accountId: profile.id,
          accessToken: storedToken,
          tokenExpiresAt,
        },
      });
    }

    return NextResponse.redirect(new URL("/social-accounts?success=connected", req.url));
  } catch (error) {
    console.error("LinkedIn OAuth callback error:", error);
    return NextResponse.redirect(new URL("/social-accounts?error=linkedin_server_error", req.url));
  }
}
