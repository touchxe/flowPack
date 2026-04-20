/**
 * 콘텐츠 배포 기록 조회 API
 * GET /api/content/[id]/publishes
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // 콘텐츠 소유권 확인
    const content = await prisma.content.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!content || content.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 배포 기록 조회
    const records = await prisma.publishRecord.findMany({
      where: { contentId: id },
      orderBy: { createdAt: "desc" },
      include: {
        socialAccount: {
          select: { platform: true, accountName: true },
        },
      },
    });

    // 앱 기본 URL (리다이렉트 추적 URL 생성용)
    const appUrl = process.env.NEXTAUTH_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://flow-pack.vercel.app");

    const publishes = records.map((r) => ({
      id: r.id,
      platform: r.socialAccount.platform,
      accountName: r.socialAccount.accountName,
      status: r.status,
      platformPostUrl: r.platformPostUrl,
      errorMessage: r.errorMessage,
      clickCount: r.clickCount,
      trackingUrl: `${appUrl}/r/${r.id}`,
      publishedAt: r.publishedAt,
      createdAt: r.createdAt,
    }));

    return NextResponse.json({ publishes });
  } catch (error) {
    console.error("Publish records error:", error);
    return NextResponse.json({ error: "오류가 발생했습니다" }, { status: 500 });
  }
}
