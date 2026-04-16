import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/users/[id] — 유저 상세 + 콘텐츠 목록
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      plan: true,
      role: true,
      isBlocked: true,
      creditsUsed: true,
      creditsTotal: true,
      createdAt: true,
      updatedAt: true,
      contents: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          createdAt: true,
        },
      },
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          plan: true,
          billingCycle: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "유저를 찾을 수 없습니다" }, { status: 404 });
  }

  return NextResponse.json(user);
}

// PATCH /api/admin/users/[id] — 플랜/크레딧/정지/역할 변경
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json() as {
    plan?: string;
    creditsAdjust?: number;
    isBlocked?: boolean;
    role?: string;
  };

  // 현재 유저 조회
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { creditsUsed: true, creditsTotal: true },
  });
  if (!user) {
    return NextResponse.json({ error: "유저를 찾을 수 없습니다" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.plan !== undefined) updateData.plan = body.plan;
  if (body.isBlocked !== undefined) updateData.isBlocked = body.isBlocked;
  if (body.role !== undefined) updateData.role = body.role;
  if (body.creditsAdjust !== undefined) {
    // creditsTotal을 증감으로 조정 (잔여 = total - used)
    updateData.creditsTotal = Math.max(0, user.creditsTotal + body.creditsAdjust);
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: updateData,
    select: {
      id: true,
      plan: true,
      role: true,
      isBlocked: true,
      creditsUsed: true,
      creditsTotal: true,
    },
  });

  return NextResponse.json(updated);
}
