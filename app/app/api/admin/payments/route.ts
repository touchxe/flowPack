import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/payments — 결제 목록 + KPI
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");     // SUCCESS / FAILED / REFUNDED / CANCELED
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = 20;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [payments, total, kpiAll, kpiMonth] = await Promise.all([
    // 결제 목록
    prisma.paymentLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { email: true, name: true, plan: true } } },
    }),
    // 전체 개수
    prisma.paymentLog.count({ where }),
    // 전체 KPI
    prisma.paymentLog.findMany({
      select: { status: true, amount: true },
    }),
    // 이번 달 KPI
    prisma.paymentLog.findMany({
      where: { createdAt: { gte: startOfMonth } },
      select: { status: true, amount: true },
    }),
  ]);

  // KPI 계산
  const monthTotal = kpiMonth.reduce((sum, p) => p.status === "SUCCESS" ? sum + p.amount : sum, 0);
  const monthSuccess = kpiMonth.filter(p => p.status === "SUCCESS").length;
  const monthFailed = kpiMonth.filter(p => p.status === "FAILED").length;
  const monthRefunded = kpiMonth.filter(p => p.status === "REFUNDED").length;
  const successRate = (monthSuccess + monthFailed) > 0
    ? Math.round((monthSuccess / (monthSuccess + monthFailed)) * 100)
    : 100;

  // 빌링키 마스킹
  const maskedPayments = payments.map(p => ({
    ...p,
    tossPaymentKey: p.tossPaymentKey ? "****" + p.tossPaymentKey.slice(-4) : null,
  }));

  return NextResponse.json({
    payments: maskedPayments,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    kpi: {
      monthTotal,
      successRate,
      monthRefunded,
      monthSuccess,
      monthFailed,
      totalAll: kpiAll.filter(p => p.status === "SUCCESS").reduce((s, p) => s + p.amount, 0),
    },
  });
}
