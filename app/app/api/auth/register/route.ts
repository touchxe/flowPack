import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { usernameSchema } from "@/lib/username";

const registerSchema = z.object({
  email: z.string().email("유효한 이메일 주소를 입력해주세요"),
  username: usernameSchema.optional(),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다")
    .regex(/\d/, "숫자를 포함해야 합니다")
    .regex(/[^a-zA-Z0-9]/, "특수문자를 포함해야 합니다"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, username } = registerSchema.parse(body);

    // 이미 사용 중인 이메일 체크
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "이미 사용 중인 이메일입니다.", code: "EMAIL_TAKEN" },
        { status: 409 }
      );
    }

    if (username) {
      const existingUsername = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (existingUsername) {
        return NextResponse.json(
          { success: false, error: "이미 사용 중인 아이디입니다.", code: "USERNAME_TAKEN" },
          { status: 409 }
        );
      }
    }

    // 비밀번호 해싱
    const passwordHash = await bcrypt.hash(password, 12);

    // 사용자 생성
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        plan: "FREE",
        creditsUsed: 0,
        creditsTotal: 10,
      },
    });

    return NextResponse.json({
      success: true,
      data: { user: {
        id: user.id,
        email: user.email,
        username: user.username,
      } },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0].message, code: "VALIDATION_ERROR" },
        { status: 422 }
      );
    }

    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { success: false, error: "이미 사용 중인 이메일 또는 아이디입니다.", code: "DUPLICATE_ACCOUNT" },
        { status: 409 }
      );
    }
    console.error("Registration error:", error);
    return NextResponse.json(
      { success: false, error: "회원가입 중 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
