import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const forgotPasswordSchema = z.object({
  email: z.string().email("유효한 이메일 주소를 입력해주세요"),
});

function generateResetToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = forgotPasswordSchema.parse(body);

    // 사용자 존재 확인
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // 사용자가 존재하지 않아도 일관된 응답 (보안상)
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "비밀번호 재설정 링크를 이메일로 전송했습니다.",
      });
    }

    // 기존 토큰 삭제
    await prisma.verificationToken.deleteMany({
      where: { identifier: email },
    });

    // 새 토큰 생성
    const token = generateResetToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1시간 후 만료

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires,
      },
    });

    // 개발 환경에서는 콘솔에 토큰 출력
    console.log(`
🔑 Password Reset Token for ${email}:`);
    console.log(`   http://localhost:3000/find-password/reset?token=${token}
`);

    // 이메일이 설정되어 있으면 전송
    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const resetUrl = `${process.env.NEXTAUTH_URL}/find-password/reset?token=${token}`;

      await resend.emails.send({
        from: "FlowPack <noreply@flowpack.com>",
        to: email,
        subject: "[FlowPack] 비밀번호 재설정 요청",
        html: `
          <h1>비밀번호 재설정</h1>
          <p>안녕하세요,</p>
          <p>비밀번호 재설정을 요청하셨습니다. 아래 링크를 클릭하여 새 비밀번호를 설정해주세요.</p>
          <p><a href="${resetUrl}">비밀번호 재설정하기</a></p>
          <p>이 링크는 1시간유효효합니다.</p>
          <p>본인이 요청하지 않았다면 이 이메일을 무시해주세요.</p>
        `,
      });
    }

    return NextResponse.json({
      success: true,
      message: "비밀번호 재설정 링크를 이메일로 전송했습니다.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
