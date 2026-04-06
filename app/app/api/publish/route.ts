import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const publishSchema = z.object({
  contentId: z.string(),
  socialAccountIds: z.array(z.string()).min(1),
  scheduledAt: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { contentId, socialAccountIds, scheduledAt } = publishSchema.parse(body);

    // Get content
    const content = await prisma.content.findUnique({
      where: { id: contentId },
    });

    if (!content || content.userId !== session.user.id) {
      return NextResponse.json(
        { error: "콘텐츠를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // Get social accounts
    const accounts = await prisma.socialAccount.findMany({
      where: {
        id: { in: socialAccountIds },
        userId: session.user.id,
        isActive: true,
      },
    });

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: "유효한 연동 계정이 없습니다" },
        { status: 400 }
      );
    }

    const isScheduled = !!scheduledAt;
    const scheduledDate = isScheduled ? new Date(scheduledAt) : null;

    // Create publish records and process each platform
    const results = [];

    for (const account of accounts) {
      // Create pending record
      const record = await prisma.publishRecord.create({
        data: {
          contentId,
          socialAccountId: account.id,
          status: isScheduled ? "PENDING" : "SUCCESS", // Mock: immediate = success
          platformPostUrl: isScheduled ? undefined : `https://mock.example.com/post/${Date.now()}`,
          publishedAt: isScheduled ? undefined : new Date(),
        },
      });

      if (!isScheduled) {
        // Mock: Simulate successful immediate publish
        results.push({
          socialAccountId: account.id,
          platform: account.platform,
          accountName: account.accountName,
          status: "SUCCESS",
          platformPostId: `mock_${account.platform}_${Date.now()}`,
          platformPostUrl: record.platformPostUrl,
        });
      } else {
        // Scheduled - would be processed by cron job
        results.push({
          socialAccountId: account.id,
          platform: account.platform,
          accountName: account.accountName,
          status: "PENDING",
          scheduledAt: scheduledDate,
        });
      }
    }

    // Update content status if published immediately
    if (!isScheduled) {
      await prisma.content.update({
        where: { id: contentId },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });
    } else {
      await prisma.content.update({
        where: { id: contentId },
        data: {
          status: "SCHEDULED",
          scheduledAt: scheduledDate,
        },
      });
    }

    return NextResponse.json({
      success: true,
      results,
      isScheduled,
      scheduledAt: scheduledDate,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Publish error:", error);
    return NextResponse.json(
      { error: "배포 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const contentId = searchParams.get("contentId");

  if (!contentId) {
    return NextResponse.json(
      { error: "contentId가 필요합니다" },
      { status: 400 }
    );
  }

  const records = await prisma.publishRecord.findMany({
    where: {
      contentId,
      content: { userId: session.user.id },
    },
    include: {
      socialAccount: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ records });
}
