import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { z } from "zod";
import { usernameSchema } from "@/lib/username";

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
        username: true,
        passwordHash: true,
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

    const { passwordHash, ...publicUser } = user;
    return NextResponse.json({
      success: true,
      data: { user: {
        ...publicUser,
        hasPassword: Boolean(passwordHash),
        availableCredits: publicUser.creditsTotal - publicUser.creditsUsed,
      } },
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

const profileNameSchema = z.object({ name: z.string().trim().min(1, "이름을 입력해주세요") }).strict();
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "비밀번호는 8자 이상이어야 합니다").regex(/\d/, "숫자를 포함해야 합니다").regex(/[^a-zA-Z0-9]/, "특수문자를 포함해야 합니다"),
}).strict();
const usernameRegistrationSchema = z.object({
  username: usernameSchema,
  currentPassword: z.string().min(1, "현재 비밀번호를 입력해주세요"),
}).strict();

// PATCH /api/user/me — 프로필 이름, 비밀번호 또는 최초 아이디 등록
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: unknown = await req.json();

    if (isRecord(body) && "name" in body) {
      const { name } = profileNameSchema.parse(body);
      await prisma.user.update({
        where: { id: session.user.id },
        data: { name },
      });
      return NextResponse.json({ success: true, data: { message: "프로필이 저장되었습니다." } });
    }

    if (isRecord(body) && "newPassword" in body) {
      const { currentPassword, newPassword } = passwordChangeSchema.parse(body);

      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (!user?.passwordHash) {
        return NextResponse.json({ success: false, error: "소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.", code: "FORBIDDEN" }, { status: 403 });
      }

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        return NextResponse.json({ success: false, error: "현재 비밀번호가 올바르지 않습니다.", code: "VALIDATION_ERROR" }, { status: 422 });
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({ where: { id: session.user.id }, data: { passwordHash } });
      return NextResponse.json({ success: true, data: { message: "비밀번호가 변경되었습니다." } });
    }

    if (isRecord(body) && "username" in body) {
      const { username, currentPassword } = usernameRegistrationSchema.parse(body);
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { passwordHash: true, username: true },
      });
      if (!user?.passwordHash) {
        return NextResponse.json({ success: false, error: "소셜 로그인 계정은 아이디를 등록할 수 없습니다.", code: "FORBIDDEN" }, { status: 403 });
      }
      if (user.username) {
        return NextResponse.json({ success: false, error: "아이디는 한 번만 등록할 수 있습니다.", code: "USERNAME_ALREADY_SET" }, { status: 409 });
      }
      if (!await bcrypt.compare(currentPassword, user.passwordHash)) {
        return NextResponse.json({ success: false, error: "현재 비밀번호가 올바르지 않습니다.", code: "VALIDATION_ERROR" }, { status: 422 });
      }
      const updated = await prisma.user.updateMany({
        where: { id: session.user.id, username: null },
        data: { username },
      });
      if (updated.count !== 1) {
        return NextResponse.json({ success: false, error: "아이디는 한 번만 등록할 수 있습니다.", code: "USERNAME_ALREADY_SET" }, { status: 409 });
      }
      return NextResponse.json({ success: true, data: { message: "아이디가 등록되었습니다.", username } });
    }

    return NextResponse.json({ success: false, error: "변경할 내용이 없습니다.", code: "VALIDATION_ERROR" }, { status: 422 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.issues[0].message, code: "VALIDATION_ERROR" }, { status: 422 });
    }
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ success: false, error: "이미 사용 중인 아이디입니다.", code: "USERNAME_TAKEN" }, { status: 409 });
    }
    console.error("Update user error:", error);
    return NextResponse.json({ success: false, error: "오류가 발생했습니다.", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
