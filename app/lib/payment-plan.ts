export const PAID_PLAN_IDS = ["STARTER", "PRO"] as const;
export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];
export type BillingCycle = "monthly" | "yearly";

const PLAN_PRICES: Record<PaidPlanId, Record<BillingCycle, number>> = {
  STARTER: { monthly: 199000, yearly: 1980000 },
  PRO: { monthly: 499000, yearly: 4980000 },
};

const PLAN_CREDITS: Record<PaidPlanId, number> = {
  STARTER: 50,
  PRO: 200,
};

const ORDER_ID_PATTERN = /^flowpack_(STARTER|PRO)_(monthly|yearly)_([A-Za-z0-9_-]{6,48})$/;

export function getPlanPrice(plan: PaidPlanId, billingCycle: BillingCycle): number {
  return PLAN_PRICES[plan][billingCycle];
}

export function getPlanCredits(plan: PaidPlanId): number {
  return PLAN_CREDITS[plan];
}

export function parseFlowPackOrderId(orderId: string): { plan: PaidPlanId; billingCycle: BillingCycle } | null {
  const match = ORDER_ID_PATTERN.exec(orderId);
  if (!match) return null;
  return { plan: match[1] as PaidPlanId, billingCycle: match[2] as BillingCycle };
}
