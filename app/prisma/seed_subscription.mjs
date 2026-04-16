import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findUnique({
    where: { email: "admin@flowpack.dev" },
  });

  if (!admin) {
    console.log("Admin user not found");
    return;
  }

  // 기존 구독 삭제
  await prisma.subscription.deleteMany({ where: { userId: admin.id } });

  // PRO 활성 구독 생성 (1달 후 만료)
  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + 1);

  const sub = await prisma.subscription.create({
    data: {
      userId: admin.id,
      plan: "PRO",
      billingCycle: "monthly",
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: end,
    },
  });

  // admin 유저를 PRO 플랜으로 업데이트
  await prisma.user.update({
    where: { id: admin.id },
    data: { plan: "PRO", creditsTotal: 200, creditsUsed: 0 },
  });

  console.log("✅ Test subscription created:", sub.id);
  console.log("   Plan: PRO | Status: active | Expires:", end.toISOString());
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
