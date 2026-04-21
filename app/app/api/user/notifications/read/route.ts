/**
 * PATCH /api/user/notifications/read
 * — 단일 읽음 처리 또는 일괄 읽음 처리
 *
 * Body:
 *   { id: "xxx" }        → 단일 읽음
 *   { all: true }        → 전체 읽음
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    if (body.all === true) {
      // 전체 읽음 처리
      const result = await prisma.notification.updateMany({
        where: {
          userId: session.user.id,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `${result.count}건의 알림을 읽음 처리했습니다.`,
        updatedCount: result.count,
      });
    }

    if (body.id && typeof body.id === "string") {
      // 단일 읽음 처리 (본인 소유 확인)
      const notification = await prisma.notification.findFirst({
        where: {
          id: body.id,
          userId: session.user.id,
        },
      });

      if (!notification) {
        return NextResponse.json(
          { error: "알림을 찾을 수 없습니다." },
          { status: 404 },
        );
      }

      await prisma.notification.update({
        where: { id: body.id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "읽음 처리되었습니다.",
      });
    }

    return NextResponse.json(
      { error: "id 또는 all 파라미터가 필요합니다." },
      { status: 400 },
    );
  } catch (error) {
    console.error("Read notification error:", error);
    return NextResponse.json(
      { error: "처리 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
