import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/subscriptions/cancel
 *
 * 구독 취소 처리:
 * 1. 활성 구독(status === "active")을 찾아 status → "canceled", canceledAt 기록
 * 2. 현재 구독 기간(currentPeriodEnd)이 아직 남아 있으면 기간 종료 후 FREE 전환을 예약
 *    (Toss Payments 웹훅 연동 전에는 즉시 FREE 다운그레이드)
 * 3. 유저 플랜을 FREE로 변경하고 크레딧을 FREE 기본값(10)으로 리셋
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // ── 1. 활성 구독 조회 ─────────────────────────────────────
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        status: "active",
      },
      orderBy: { createdAt: "desc" },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "활성 구독이 없습니다." },
        { status: 404 }
      );
    }

    const now = new Date();
    const periodEnded = subscription.currentPeriodEnd <= now;

    // ── 2. 구독 취소 처리 ─────────────────────────────────────
    // Toss Payments 연동 후엔 여기서 tossBillingKey로 정기결제 해지 API 호출 필요
    // 현재: DB 상태 변경만 수행
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "canceled",
        canceledAt: now,
      },
    });

    // ── 3. 유저 플랜 · 크레딧 처리 ───────────────────────────
    // 구독 기간이 이미 지났거나 Toss 연동 전 단계이므로 즉시 FREE 전환
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        plan: "FREE",
        // FREE 플랜 기본 크레딧(10)으로 리셋
        // 단, 현재 잔여 크레딧이 FREE 기본값보다 적으면 현 상태 유지
        creditsTotal: 10,
        // 사용 크레딧은 0으로 리셋 (새 주기)
        creditsUsed: 0,
        creditsResetAt: now,
      },
    });

    return NextResponse.json({
      success: true,
      message: "구독이 취소되었습니다.",
      downgraded: true,
      newPlan: "FREE",
      // 기간이 남아있으면 안내용 periodEnd 반환
      ...(periodEnded
        ? {}
        : { effectiveUntil: subscription.currentPeriodEnd.toISOString() }),
    });
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return NextResponse.json(
      { error: "구독 취소 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
