import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "touchmine@nate.com";
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.error(`❌ 계정을 찾을 수 없음: ${email}`);
    return;
  }

  const updated = await prisma.user.update({
    where: { email },
    data: { role: "ADMIN" },
  });

  console.log(`✅ ${updated.email} → ADMIN 승격 완료!`);
}

main().finally(() => prisma.$disconnect());
