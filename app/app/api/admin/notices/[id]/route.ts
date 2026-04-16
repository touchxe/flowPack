import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/admin/notices/[id] — 공지 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json() as {
    title?: string;
    body?: string;
    type?: string;
    targetPlan?: string | null;
    isPublished?: boolean;
    expiresAt?: string | null;
  };

  const existing = await prisma.notice.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "공지를 찾을 수 없습니다" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.body !== undefined) data.body = body.body;
  if (body.type !== undefined) data.type = body.type;
  if (body.targetPlan !== undefined) data.targetPlan = body.targetPlan || null;
  if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (body.isPublished !== undefined) {
    data.isPublished = body.isPublished;
    if (body.isPublished && !existing.publishedAt) {
      data.publishedAt = new Date();
    }
  }

  const updated = await prisma.notice.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(updated);
}

// DELETE /api/admin/notices/[id] — 공지 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const existing = await prisma.notice.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "공지를 찾을 수 없습니다" }, { status: 404 });
  }

  await prisma.notice.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
