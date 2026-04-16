import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const confirmSchema = z.object({
  paymentKey: z.string(),
  orderId: z.string(),
  amount: z.number(),
  plan: z.enum(["STARTER", "PRO", "ENTERPRISE"]),
  billingCycle: z.enum(["monthly", "yearly"]),
});

// 플랜별 크레딧
const PLAN_CREDITS: Record<string, number> = {
  STARTER: 50,
  PRO: 200,
  ENTERPRISE: 999999,
};

/**
 * POST /api/payments/confirm
 * Toss Payments 결제 승인 → 구독 생성 → 플랜 업그레이드
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { paymentKey, orderId, amount, plan, billingCycle } =
      confirmSchema.parse(body);

    // ── 1. Toss Payments 결제 승인 API 호출 ──────────────────
    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey || secretKey === "test_sk_placeholder") {
      // 테스트 모드: 실제 API 호출 없이 성공 처리
      console.warn("[Toss] TOSS_SECRET_KEY not configured — using test mode");
    } else {
      const tossRes = await fetch(
        "https://api.tosspayments.com/v1/payments/confirm",
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ paymentKey, orderId, amount }),
        }
      );

      if (!tossRes.ok) {
        const err = await tossRes.json();
        console.error("[Toss] Confirm failed:", err);
        return NextResponse.json(
          { error: err.message ?? "결제 승인에 실패했습니다." },
          { status: 400 }
        );
      }
    }

    // ── 2. 기존 구독 취소 후 새 구독 생성 ─────────────────────
    await prisma.subscription.updateMany({
      where: { userId: session.user.id, status: "active" },
      data: { status: "canceled", canceledAt: new Date() },
    });

    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === "yearly") {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const subscription = await prisma.subscription.create({
      data: {
        userId: session.user.id,
        plan: plan as any,
        billingCycle,
        status: "active",
        tossBillingKey: paymentKey, // 정기결제 시 billingKey로 교체 필요
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    // ── 3. 유저 플랜 & 크레딧 업그레이드 ─────────────────────
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        plan: plan as any,
        creditsTotal: PLAN_CREDITS[plan] ?? 50,
        creditsUsed: 0,
        creditsResetAt: now,
      },
    });

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      plan,
      periodEnd: periodEnd.toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("[Payments] Confirm error:", error);
    return NextResponse.json(
      { error: "결제 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
