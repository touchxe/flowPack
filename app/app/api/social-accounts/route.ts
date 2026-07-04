import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptSocialToken } from "@/lib/social-token-crypto";
import { z } from "zod";

const connectSchema = z.object({
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "TWITTER", "LINKEDIN", "NAVER_BLOG", "WORDPRESS", "THREADS"]),
  accountName: z.string(),
  accountId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const accounts = await prisma.socialAccount.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      platform: true,
      accountName: true,
      accountId: true,
      tokenExpiresAt: true,
      isActive: true,
      connectedAt: true,
      updatedAt: true,
    },
    orderBy: { connectedAt: "desc" },
  });

  return NextResponse.json({ success: true, data: accounts, accounts });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const data = connectSchema.parse(body);

    // Check if already connected (동일 플랫폼+계정 조합)
    const existing = await prisma.socialAccount.findFirst({
      where: {
        userId: session.user.id,
        platform: data.platform,
        accountId: data.accountId,
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "이미 연동된 계정입니다", code: "DUPLICATE_ACCOUNT" },
        { status: 400 }
      );
    }

    const account = await prisma.socialAccount.create({
      data: {
        userId: session.user.id,
        platform: data.platform,
        accountName: data.accountName,
        accountId: data.accountId,
        accessToken: encryptSocialToken(data.accessToken),
        refreshToken: data.refreshToken ? encryptSocialToken(data.refreshToken) : null,
        tokenExpiresAt: data.tokenExpiresAt ? new Date(data.tokenExpiresAt) : null,
      },
      select: {
        id: true,
        platform: true,
        accountName: true,
        accountId: true,
        tokenExpiresAt: true,
        isActive: true,
        connectedAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: account, account });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0].message, code: "VALIDATION_ERROR" },
        { status: 422 }
      );
    }

    console.error("Connect account error:", error);
    return NextResponse.json(
      { success: false, error: "연동 중 오류가 발생했습니다", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("id");

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: "계정 ID가 필요합니다", code: "VALIDATION_ERROR" },
        { status: 422 }
      );
    }

    const account = await prisma.socialAccount.findUnique({
      where: { id: accountId },
    });

    if (!account || account.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "계정을 찾을 수 없습니다", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    await prisma.socialAccount.delete({
      where: { id: accountId },
    });

    return NextResponse.json({ success: true, data: { id: accountId } });
  } catch (error) {
    console.error("Disconnect account error:", error);
    return NextResponse.json(
      { success: false, error: "연동 해제 중 오류가 발생했습니다", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
