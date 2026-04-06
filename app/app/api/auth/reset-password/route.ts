import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "토큰이 필요합니다."),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다")
    .regex(/\d/, "숫자를 포함해야 합니다")
    .regex(/[^a-zA-Z0-9]/, "특수문자를 포함해야 합니다"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, password } = resetPasswordSchema.parse(body);

    // 토큰 검증
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: "유효하지 않은 토큰입니다." },
        { status: 400 }
      );
    }

    // 토큰 만료 확인
    if (verificationToken.expires < new Date()) {
      // 만료된 토큰 삭제
      await prisma.verificationToken.delete({
        where: { token },
      });

      return NextResponse.json(
        { error: "토큰이 만료되었습니다. 다시 요청해주세요." },
        { status: 400 }
      );
    }

    const email = verificationToken.identifier;

    // 비밀번호 해싱
    const passwordHash = await bcrypt.hash(password, 12);

    // 사용자 비밀번호 업데이트
    await prisma.user.update({
      where: { email },
      data: { passwordHash },
    });

    // 사용된 토큰 삭제
    await prisma.verificationToken.delete({
      where: { token },
    });

    return NextResponse.json({
      success: true,
      message: "비밀번호가 변경되었습니다.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
