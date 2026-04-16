// bcrypt 해시 검증 스크립트
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "admin@flowpack.dev" },
    select: { passwordHash: true, role: true, isBlocked: true },
  });

  console.log("User found:", !!user);
  console.log("Role:", user?.role);
  console.log("isBlocked:", user?.isBlocked);
  console.log("Hash preview:", user?.passwordHash?.slice(0, 30));

  if (user?.passwordHash) {
    const match = await bcrypt.compare("Admin1234!", user.passwordHash);
    console.log("Password match (Admin1234!):", match);
    const match2 = await bcrypt.compare("admin1234!", user.passwordHash);
    console.log("Password match (admin1234!):", match2);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
