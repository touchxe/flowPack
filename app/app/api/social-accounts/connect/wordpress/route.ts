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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "알 수 없는 오류";
}

function jsonError(
  error: string,
  status: number,
  code: string,
  details?: string[]
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error,
      code,
      details,
    },
    { status }
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("로그인이 필요합니다.", 401, "UNAUTHORIZED");
  }

  try {
    const body = await req.json();
    const { siteUrl, username, appPassword } = connectSchema.parse(body);

    /* 1. 동일 사이트 URL이 이미 연동되어 있는지 확인 (같은 URL만 차단) */
    const existing = await prisma.socialAccount.findFirst({
      where: { userId: session.user.id, platform: "WORDPRESS", accountId: siteUrl },
    });

    if (existing) {
      return jsonError(
        "이 WordPress 사이트는 이미 연동되어 있습니다.",
        400,
        "DUPLICATE_WORDPRESS_SITE",
        [`입력한 사이트 URL: ${siteUrl}`]
      );
    }

    /* 1-1. WordPress 최대 연동 수 제한 (5개) */
    const wpCount = await prisma.socialAccount.count({
      where: { userId: session.user.id, platform: "WORDPRESS" },
    });

    if (wpCount >= 5) {
      return jsonError(
        "WordPress 사이트는 최대 5개까지 연동할 수 있습니다.",
        400,
        "WORDPRESS_SITE_LIMIT_EXCEEDED",
        [`현재 연동된 WordPress 사이트 수: ${wpCount}`]
      );
    }

    /* 2. 연결 테스트로 자격 증명 검증 */
    const testResult = await testWordPressConnection({ siteUrl, username, appPassword });

    if (!testResult.success) {
      return jsonError(
        "WordPress 연결 테스트에 실패했습니다.",
        400,
        "WORDPRESS_TEST_FAILED",
        [
          testResult.error ?? "WordPress REST API 또는 인증 응답을 확인할 수 없습니다.",
          `입력한 사이트 URL: ${siteUrl}`,
          "Cafe24 스팸 SHIELD, 방화벽, 보안 플러그인이 Vercel 서버 요청을 차단하는지 확인해주세요.",
        ]
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
    }).catch((error: unknown) => {
      throw new Error(`DB_SAVE_FAILED: ${getErrorMessage(error)}`);
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
      return jsonError(
        "입력값을 확인해주세요.",
        400,
        "VALIDATION_ERROR",
        error.issues.map((issue) => issue.message)
      );
    }

    const message = getErrorMessage(error);
    if (message.startsWith("DB_SAVE_FAILED:")) {
      console.error("WordPress DB save error:", error);
      return jsonError(
        "WordPress 연결 테스트는 성공했지만 FlowPack에 저장하지 못했습니다.",
        500,
        "DB_SAVE_FAILED",
        [message.replace("DB_SAVE_FAILED: ", "")]
      );
    }

    console.error("WordPress connect error:", error);
    return jsonError(
      "WordPress 연동 처리 중 서버 오류가 발생했습니다.",
      500,
      "INTERNAL_ERROR",
      [message]
    );
  }
}
