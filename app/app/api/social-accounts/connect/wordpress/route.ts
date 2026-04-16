/**
 * WordPress 계정 연동 API
 * POST /api/social-accounts/connect/wordpress — 자격 증명 검증 후 DB에 저장
 * DELETE /api/social-accounts/connect/wordpress — 연동 해제
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { testWordPressConnection } from "@/lib/integrations/wordpress";

const connectSchema = z.object({
  siteUrl: z.string().url({ message: "올바른 사이트 URL을 입력하세요 (예: https://myblog.com)" }),
  username: z.string().min(1, "사용자명을 입력하세요"),
  appPassword: z.string().min(8, "Application Password를 입력하세요 (최소 8자)"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { siteUrl, username, appPassword } = connectSchema.parse(body);

    /* 1. 이미 연동된 계정인지 확인 */
    const existing = await prisma.socialAccount.findUnique({
      where: { userId_platform: { userId: session.user.id, platform: "WORDPRESS" } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "이미 WordPress 계정이 연동되어 있습니다. 기존 연동을 해제 후 다시 시도하세요." },
        { status: 400 }
      );
    }

    /* 2. 연결 테스트로 자격 증명 검증 */
    const testResult = await testWordPressConnection({ siteUrl, username, appPassword });

    if (!testResult.success) {
      return NextResponse.json(
        { error: testResult.error ?? "WordPress 연결에 실패했습니다." },
        { status: 400 }
      );
    }

    /* 3. 자격 증명 저장 (형식: "siteUrl||username||appPassword") */
    const accessToken = `${siteUrl}||${username}||${appPassword}`;
    const siteDomain = new URL(siteUrl).hostname;

    const account = await prisma.socialAccount.create({
      data: {
        userId: session.user.id,
        platform: "WORDPRESS",
        accountName: siteDomain,
        accountId: siteUrl,
        accessToken,
      },
    });

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        platform: account.platform,
        accountName: account.accountName,
        connectedAt: account.connectedAt,
      },
      siteName: testResult.siteName,
      wpVersion: testResult.wpVersion,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("WordPress connect error:", error);
    return NextResponse.json({ error: "연동 중 오류가 발생했습니다." }, { status: 500 });
  }
}
