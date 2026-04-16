// 결제 설정 페이지
// Toss Payments 연동 전: 구독 정보는 DB에서, 결제수단/내역은 빈 상태 표시
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import BillingClient from "./billing-client";

export default async function BillingSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // 유저의 구독 정보 (최신 1건)
  const subscription = await prisma.subscription.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  // 현재 유저 플랜 (User 테이블)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });

  return (
    <BillingClient
      currentPlan={user?.plan ?? "FREE"}
      subscription={
        subscription
          ? {
              plan: subscription.plan,
              status: subscription.status,
              billingCycle: subscription.billingCycle,
              currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
              canceledAt: subscription.canceledAt?.toISOString() ?? null,
            }
          : null
      }
    />
  );
}
