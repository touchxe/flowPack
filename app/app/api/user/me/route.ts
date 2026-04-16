import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        plan: true,
        creditsTotal: true,
        creditsUsed: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        ...user,
        availableCredits: user.creditsTotal - user.creditsUsed,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// PATCH /api/user/me — 프로필(이름) 또는 비밀번호 변경
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, currentPassword, newPassword } = body;

    // 이름 변경
    if (name !== undefined) {
      const trimmed = z.string().min(1, "이름을 입력해주세요").parse(name.trim());
      await prisma.user.update({
        where: { id: session.user.id },
        data: { name: trimmed },
      });
      return NextResponse.json({ success: true, message: "프로필이 저장되었습니다." });
    }

    // 비밀번호 변경
    if (currentPassword && newPassword) {
      const schema = z.object({
        currentPassword: z.string().min(1),
        newPassword: z
          .string()
          .min(8, "비밀번호는 8자 이상이어야 합니다")
          .regex(/\d/, "숫자를 포함해야 합니다")
          .regex(/[^a-zA-Z0-9]/, "특수문자를 포함해야 합니다"),
      });
      schema.parse({ currentPassword, newPassword });

      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (!user?.passwordHash) {
        return NextResponse.json({ error: "소셜 로그인 계정은 비밀번호를 변경할 수 없습니다." }, { status: 400 });
      }

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        return NextResponse.json({ error: "현재 비밀번호가 올바르지 않습니다." }, { status: 400 });
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({ where: { id: session.user.id }, data: { passwordHash } });
      return NextResponse.json({ success: true, message: "비밀번호가 변경되었습니다." });
    }

    return NextResponse.json({ error: "변경할 내용이 없습니다." }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Update user error:", error);
    return NextResponse.json({ error: "오류가 발생했습니다." }, { status: 500 });
  }
}
