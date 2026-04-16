import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/user/instructions — 저장된 지침 목록
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const instructions = await prisma.userInstruction.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({ instructions });
}

// POST /api/user/instructions — 새 지침 저장
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { name: string; content: string; isDefault?: boolean };

  if (!body.name?.trim() || !body.content?.trim()) {
    return NextResponse.json({ error: "이름과 내용을 입력해주세요" }, { status: 400 });
  }

  // 기본 지침 설정 시 기존 기본 지침 해제
  if (body.isDefault) {
    await prisma.userInstruction.updateMany({
      where: { userId: session.user.id, isDefault: true },
      data: { isDefault: false },
    });
  }

  const instruction = await prisma.userInstruction.create({
    data: {
      userId: session.user.id,
      name: body.name.trim(),
      content: body.content.trim(),
      isDefault: body.isDefault ?? false,
    },
  });

  return NextResponse.json({ instruction }, { status: 201 });
}
