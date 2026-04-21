// touchmine@nate.com ADMIN 승격 스크립트
// 실행: node prisma/set_admin_user.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const email = "touchmine@nate.com";

const user = await prisma.user.findUnique({ where: { email } });

if (!user) {
  console.error(`❌ 계정을 찾을 수 없음: ${email}`);
} else {
  const updated = await prisma.user.update({
    where: { email },
    data: { role: "ADMIN" },
  });
  console.log(`✅ ${updated.email} → ADMIN 승격 완료!`);
}

await prisma.$disconnect();
