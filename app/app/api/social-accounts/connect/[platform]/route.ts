import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Mock OAuth callback - simulates successful OAuth flow
// In production, this would handle actual OAuth callbacks from each platform

export async function GET(
  req: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { platform } = await params;
  const validPlatforms = ["INSTAGRAM", "FACEBOOK", "TWITTER", "LINKEDIN", "NAVER_BLOG", "WORDPRESS"];

  if (!validPlatforms.includes(platform.toUpperCase())) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  // Mock: Create a demo account for the platform
  const mockAccounts: Record<string, { accountName: string; accountId: string }> = {
    INSTAGRAM: { accountName: "demo_instagram", accountId: "ig_123456789" },
    FACEBOOK: { accountName: "demo_facebook_page", accountId: "fb_987654321" },
    TWITTER: { accountName: "demo_twitter", accountId: "tw_456789123" },
    LINKEDIN: { accountName: "demo_linkedin", accountId: "li_789123456" },
    NAVER_BLOG: { accountName: "demo_naver_blog", accountId: "nv_321654987" },
    WORDPRESS: { accountName: "demo_wordpress", accountId: "wp_654987321" },
  };

  const mockData = mockAccounts[platform.toUpperCase()];

  // Check if already connected
  const platformEnum = platform.toUpperCase() as "INSTAGRAM" | "FACEBOOK" | "TWITTER" | "LINKEDIN" | "NAVER_BLOG" | "WORDPRESS";
  
  const existing = await prisma.socialAccount.findUnique({
    where: {
      userId_platform: {
        userId: session.user.id,
        platform: platformEnum,
      },
    },
  });

  if (existing) {
    return NextResponse.redirect(new URL("/social-accounts?error=already_connected", req.url));
  }

  // Create mock account
  const account = await prisma.socialAccount.create({
    data: {
      userId: session.user.id,
      platform: platformEnum,
      accountName: mockData.accountName,
      accountId: mockData.accountId,
      accessToken: `mock_token_${Date.now()}`,
      refreshToken: `mock_refresh_${Date.now()}`,
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  return NextResponse.redirect(new URL("/social-accounts?success=connected", req.url));
}
