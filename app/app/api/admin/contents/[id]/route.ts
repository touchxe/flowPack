import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/admin/contents/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const existing = await prisma.content.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "콘텐츠를 찾을 수 없습니다" }, { status: 404 });
  }

  await prisma.content.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
