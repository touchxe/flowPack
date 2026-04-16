// 테스트용 ADMIN 계정 생성 스크립트
// 실행: node prisma/create_admin.mjs
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@flowpack.dev";
  const password = "Admin1234!";
  const hash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    // 이미 존재하면 role만 ADMIN으로 업데이트
    await prisma.user.update({
      where: { email },
      data: { role: "ADMIN", passwordHash: hash },
    });
    console.log(`✅ 기존 계정 업데이트: ${email} → ADMIN`);
  } else {
    await prisma.user.create({
      data: {
        email,
        name: "FlowPack Admin",
        passwordHash: hash,
        role: "ADMIN",
        plan: "PRO",
        creditsTotal: 9999,
      },
    });
    console.log(`✅ 新 ADMIN 계정 생성: ${email}`);
  }

  console.log(`🔑 이메일: ${email}`);
  console.log(`🔑 비밀번호: ${password}`);

  await prisma.$disconnect();
}

main().catch(console.error);
