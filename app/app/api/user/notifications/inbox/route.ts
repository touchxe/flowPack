/**
 * GET /api/user/notifications/inbox
 * — 최근 알림 목록 + 미읽 카운트 조회
 *
 * Query params:
 *   limit: 조회 개수 (기본 20, max 50)
 *   cursor: 페이지네이션 커서 (마지막 알림 id)
 *   unreadOnly: "true"이면 미읽 알림만
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const cursor = searchParams.get("cursor") || undefined;
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId: session.user.id,
          ...(unreadOnly ? { isRead: false } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        ...(cursor
          ? {
              skip: 1,
              cursor: { id: cursor },
            }
          : {}),
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          actionUrl: true,
          metadata: true,
          isRead: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({
        where: {
          userId: session.user.id,
          isRead: false,
        },
      }),
    ]);

    const nextCursor =
      notifications.length === limit
        ? notifications[notifications.length - 1].id
        : null;

    return NextResponse.json({
      notifications,
      unreadCount,
      nextCursor,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    return NextResponse.json(
      { error: "알림을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
