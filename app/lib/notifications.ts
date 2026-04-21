/**
 * 알림 생성 헬퍼
 *
 * 사용 예:
 *   await createNotification(userId, "CONTENT_CREATED", {
 *     title: "카드뉴스 생성 완료",
 *     message: "'맛집 TOP5' 카드뉴스가 생성되었습니다",
 *     actionUrl: "/contents",
 *     metadata: { contentId: "xxx" },
 *   });
 */

import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

interface CreateNotificationOpts {
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 단일 유저에게 알림 생성
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  opts: CreateNotificationOpts,
) {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        type,
        title: opts.title,
        message: opts.message,
        actionUrl: opts.actionUrl,
        metadata: opts.metadata ? JSON.stringify(opts.metadata) : undefined,
      },
    });
  } catch (error) {
    // 알림 생성 실패가 핵심 플로우를 중단시키면 안 됨
    console.error("[Notification] 알림 생성 실패:", error);
    return null;
  }
}

/**
 * 여러 유저에게 동일 알림 일괄 생성 (공지사항 등)
 */
export async function createBulkNotifications(
  userIds: string[],
  type: NotificationType,
  opts: CreateNotificationOpts,
) {
  try {
    return await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type,
        title: opts.title,
        message: opts.message,
        actionUrl: opts.actionUrl,
        metadata: opts.metadata ? JSON.stringify(opts.metadata) : undefined,
      })),
    });
  } catch (error) {
    console.error("[Notification] 일괄 알림 생성 실패:", error);
    return null;
  }
}

/**
 * 크레딧 소진 경고 알림 (중복 방지: 같은 타입이 오늘 이미 있으면 스킵)
 */
export async function notifyCreditWarning(
  userId: string,
  creditsUsed: number,
  creditsTotal: number,
) {
  const pct = Math.round((creditsUsed / creditsTotal) * 100);

  // 크레딧 100% 소진
  if (creditsUsed >= creditsTotal) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        type: "CREDIT_EXHAUSTED",
        createdAt: { gte: todayStart },
      },
    });
    if (existing) return; // 오늘 이미 알림 발송됨

    await createNotification(userId, "CREDIT_EXHAUSTED", {
      title: "크레딧 소진",
      message: `이번 달 크레딧 ${creditsTotal}건이 모두 소진되었습니다. 플랜 업그레이드로 무제한 이용하세요.`,
      actionUrl: "/settings/billing",
      metadata: { creditsUsed, creditsTotal },
    });
    return;
  }

  // 크레딧 80% 이상 소진
  if (pct >= 80) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        type: "CREDIT_LOW",
        createdAt: { gte: todayStart },
      },
    });
    if (existing) return;

    await createNotification(userId, "CREDIT_LOW", {
      title: "크레딧 부족 알림",
      message: `크레딧이 ${pct}% 소진되었습니다 (${creditsUsed}/${creditsTotal}건). 업그레이드를 고려해보세요.`,
      actionUrl: "/settings/billing",
      metadata: { creditsUsed, creditsTotal, percent: pct },
    });
  }
}
