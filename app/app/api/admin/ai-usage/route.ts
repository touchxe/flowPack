import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/ai-usage — AI 사용량 집계 + 상세
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const [monthLogs, allLogs, recentLogs, errorLogs] = await Promise.all([
    // 이번 달 집계
    prisma.aiUsageLog.findMany({
      where: { createdAt: { gte: startOfMonth } },
      select: {
        feature: true,
        model: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        estimatedCostUsd: true,
        isError: true,
        userId: true,
      },
    }),
    // 전체 집계
    prisma.aiUsageLog.count(),
    // 최근 30일 일별 비용
    prisma.aiUsageLog.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, estimatedCostUsd: true },
    }),
    // 에러 로그 (최근 50건)
    prisma.aiUsageLog.findMany({
      where: { isError: true },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        feature: true,
        model: true,
        errorCode: true,
        user: { select: { email: true } },
      },
    }),
  ]);

  // KPI 계산
  const totalCalls = monthLogs.length;
  const totalTokens = monthLogs.reduce((s, l) => s + l.totalTokens, 0);
  const totalCost = monthLogs.reduce((s, l) => s + l.estimatedCostUsd, 0);
  const errorCount = monthLogs.filter(l => l.isError).length;
  const errorRate = totalCalls > 0 ? Math.round((errorCount / totalCalls) * 100) : 0;

  // 기능별 토큰 집계
  const byFeature: Record<string, { calls: number; tokens: number; cost: number }> = {};
  for (const l of monthLogs) {
    if (!byFeature[l.feature]) byFeature[l.feature] = { calls: 0, tokens: 0, cost: 0 };
    byFeature[l.feature].calls += 1;
    byFeature[l.feature].tokens += l.totalTokens;
    byFeature[l.feature].cost += l.estimatedCostUsd;
  }
  const featureChart = Object.entries(byFeature).map(([feature, data]) => ({ feature, ...data }));

  // 모델별 비용 집계
  const byModel: Record<string, { calls: number; cost: number }> = {};
  for (const l of monthLogs) {
    if (!byModel[l.model]) byModel[l.model] = { calls: 0, cost: 0 };
    byModel[l.model].calls += 1;
    byModel[l.model].cost += l.estimatedCostUsd;
  }
  const modelChart = Object.entries(byModel).map(([model, data]) => ({ model, ...data }));

  // 일별 비용 (30일)
  const dailyCost: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(thirtyDaysAgo.getDate() + i);
    dailyCost[d.toISOString().slice(0, 10)] = 0;
  }
  for (const l of recentLogs) {
    const key = l.createdAt.toISOString().slice(0, 10);
    if (key in dailyCost) dailyCost[key] += l.estimatedCostUsd;
  }
  const dailyChart = Object.entries(dailyCost).map(([date, cost]) => ({
    date,
    cost: Math.round(cost * 10000) / 10000,
  }));

  // TOP 10 헤비유저
  const userUsage: Record<string, { tokens: number; calls: number; cost: number }> = {};
  for (const l of monthLogs) {
    if (!userUsage[l.userId]) userUsage[l.userId] = { tokens: 0, calls: 0, cost: 0 };
    userUsage[l.userId].tokens += l.totalTokens;
    userUsage[l.userId].calls += 1;
    userUsage[l.userId].cost += l.estimatedCostUsd;
  }
  const topUserIds = Object.entries(userUsage)
    .sort(([, a], [, b]) => b.tokens - a.tokens)
    .slice(0, 10)
    .map(([userId]) => userId);

  const topUsers = topUserIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: topUserIds } },
        select: { id: true, email: true, plan: true },
      })
    : [];

  const topUsersWithStats = topUserIds.map(uid => {
    const u = topUsers.find(u => u.id === uid);
    const stats = userUsage[uid]!;
    return {
      email: u?.email ?? "?",
      plan: u?.plan ?? "FREE",
      ...stats,
      cost: Math.round(stats.cost * 10000) / 10000,
    };
  });

  return NextResponse.json({
    kpi: {
      totalCalls,
      totalTokens,
      totalCost: Math.round(totalCost * 10000) / 10000,
      errorRate,
      allTimeCalls: allLogs,
    },
    charts: { featureChart, modelChart, dailyChart },
    topUsers: topUsersWithStats,
    errorLogs,
  });
}
