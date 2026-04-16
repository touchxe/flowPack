import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 플랜별 크레딧 (confirm API와 동일)
const PLAN_CREDITS: Record<string, number> = {
  STARTER: 50,
  PRO: 200,
  ENTERPRISE: 999999,
};

/**
 * POST /api/webhooks/toss
 * Toss Payments 웹훅 수신
 *
 * 처리하는 이벤트:
 * - PAYMENT_STATUS_CHANGED: 결제 상태 변경 (성공/실패/취소)
 * - BILLING_STATUS_CHANGED: 자동결제(빌링) 상태 변경
 *
 * 참고: https://docs.tosspayments.com/reference/webhook
 */
export async function POST(req: NextRequest) {
  try {
    // ── 1. 웹훅 서명 검증 ────────────────────────────────────
    const webhookSecret = process.env.TOSS_WEBHOOK_SECRET;
    const signature = req.headers.get("toss-signature");

    // 실제 운영 시 서명 검증 필요
    // 현재는 시크릿이 placeholder라면 검증 스킵
    if (
      webhookSecret &&
      webhookSecret !== "toss_webhook_placeholder" &&
      signature !== webhookSecret
    ) {
      console.warn("[Toss Webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = await req.json();
    console.log("[Toss Webhook] Event:", event.eventType, event.data);

    // ── 2. 이벤트별 처리 ──────────────────────────────────────
    switch (event.eventType) {
      // 결제 성공 (빌링 자동결제)
      case "BILLING_STATUS_CHANGED": {
        const { billingKey, status } = event.data ?? {};

        if (status === "DONE") {
          // 정기결제 성공 → 구독 기간 연장
          const subscription = await prisma.subscription.findFirst({
            where: { tossBillingKey: billingKey, status: "active" },
          });

          if (subscription) {
            const newEnd = new Date(subscription.currentPeriodEnd);
            if (subscription.billingCycle === "yearly") {
              newEnd.setFullYear(newEnd.getFullYear() + 1);
            } else {
              newEnd.setMonth(newEnd.getMonth() + 1);
            }

            await prisma.subscription.update({
              where: { id: subscription.id },
              data: {
                currentPeriodStart: subscription.currentPeriodEnd,
                currentPeriodEnd: newEnd,
              },
            });
          }
        } else if (status === "CANCELED" || status === "FAILED") {
          // 정기결제 실패/취소 → 구독 취소 + 플랜 다운그레이드
          const subscription = await prisma.subscription.findFirst({
            where: { tossBillingKey: billingKey, status: "active" },
          });

          if (subscription) {
            await prisma.subscription.update({
              where: { id: subscription.id },
              data: { status: "canceled", canceledAt: new Date() },
            });

            await prisma.user.update({
              where: { id: subscription.userId },
              data: {
                plan: "FREE",
                creditsTotal: 10,
                creditsUsed: 0,
                creditsResetAt: new Date(),
              },
            });
          }
        }
        break;
      }

      // 일반 결제 상태 변경
      case "PAYMENT_STATUS_CHANGED": {
        const { paymentKey, status, orderId } = event.data ?? {};
        console.log(`[Toss Webhook] Payment ${paymentKey} → ${status} (order: ${orderId})`);
        // 필요 시 추가 처리
        break;
      }

      default:
        console.log("[Toss Webhook] Unknown event:", event.eventType);
    }

    // Toss는 200 응답 받으면 웹훅 성공으로 처리
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Toss Webhook] Error:", error);
    // 500 반환 시 Toss가 재전송하므로 200 반환
    return NextResponse.json({ received: false });
  }
}
