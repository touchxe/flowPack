import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/admin/payments/[id] — 환불 처리
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json() as { action: string; reason?: string };

  const payment = await prisma.paymentLog.findUnique({ where: { id } });
  if (!payment) {
    return NextResponse.json({ error: "결제 내역을 찾을 수 없습니다" }, { status: 404 });
  }

  if (body.action === "refund") {
    if (payment.status !== "SUCCESS") {
      return NextResponse.json({ error: "SUCCESS 상태만 환불 가능합니다" }, { status: 400 });
    }

    const updated = await prisma.paymentLog.update({
      where: { id },
      data: {
        status: "REFUNDED",
        refundedAt: new Date(),
        failureMsg: body.reason ?? "관리자 환불 처리",
      },
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "지원하지 않는 액션입니다" }, { status: 400 });
}

// GET /api/admin/payments/[id] — 결제 상세
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const payment = await prisma.paymentLog.findUnique({
    where: { id },
    include: { user: { select: { email: true, name: true, plan: true } } },
  });

  if (!payment) {
    return NextResponse.json({ error: "결제 내역을 찾을 수 없습니다" }, { status: 404 });
  }

  return NextResponse.json(payment);
}
