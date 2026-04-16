import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/notices — 공지 목록
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const notices = await prisma.notice.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ notices });
}

// POST /api/admin/notices — 공지 생성
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json() as {
    title: string;
    body: string;
    type: string;
    targetPlan?: string;
    isPublished?: boolean;
    expiresAt?: string;
  };

  if (!body.title?.trim() || !body.body?.trim()) {
    return NextResponse.json({ error: "제목과 내용은 필수입니다" }, { status: 400 });
  }

  const notice = await prisma.notice.create({
    data: {
      title: body.title.trim(),
      body: body.body.trim(),
      type: body.type ?? "FEATURE",
      targetPlan: body.targetPlan || null,
      isPublished: body.isPublished ?? false,
      publishedAt: body.isPublished ? new Date() : null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    },
  });

  return NextResponse.json(notice, { status: 201 });
}
