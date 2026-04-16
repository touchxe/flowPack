import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/user/instructions/[id] — 지침 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json() as { name?: string; content?: string; isDefault?: boolean };

  const existing = await prisma.userInstruction.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "지침을 찾을 수 없습니다" }, { status: 404 });
  }

  // 기본 지침 설정 시 기존 해제
  if (body.isDefault) {
    await prisma.userInstruction.updateMany({
      where: { userId: session.user.id, isDefault: true },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.userInstruction.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.content !== undefined && { content: body.content.trim() }),
      ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
    },
  });

  return NextResponse.json({ instruction: updated });
}

// DELETE /api/user/instructions/[id] — 지침 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.userInstruction.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "지침을 찾을 수 없습니다" }, { status: 404 });
  }

  await prisma.userInstruction.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
