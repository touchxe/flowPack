import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/subscriptions — 구독 현황 + MRR 요약
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  // 플랜별 가격 (월 기준)
  const PLAN_PRICE: Record<string, number> = {
    STARTER: 199000,
    PRO: 499000,
    ENTERPRISE: 0,
  };

  const subscriptions = await prisma.subscription.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      plan: true,
      billingCycle: true,
      status: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      canceledAt: true,
      createdAt: true,
      tossBillingKey: true,
      user: { select: { email: true, name: true } },
    },
  });

  // MRR 계산 — status가 ACTIVE인 구독만
  const activeSubs = subscriptions.filter((s) => s.status === "ACTIVE");
  const mrrByPlan: Record<string, { count: number; mrr: number }> = {};

  for (const sub of activeSubs) {
    const planKey = sub.plan as string;
    const price = PLAN_PRICE[planKey] ?? 0;
    // 연간 구독은 월 환산
    const monthly = sub.billingCycle === "YEARLY" ? Math.round(price * 12 / 12) : price;

    if (!mrrByPlan[planKey]) {
      mrrByPlan[planKey] = { count: 0, mrr: 0 };
    }
    mrrByPlan[planKey].count += 1;
    mrrByPlan[planKey].mrr += monthly;
  }

  const totalMrr = Object.values(mrrByPlan).reduce((sum, v) => sum + v.mrr, 0);

  return NextResponse.json({
    subscriptions,
    summary: {
      mrrByPlan,
      totalMrr,
      activeCount: activeSubs.length,
    },
  });
}
