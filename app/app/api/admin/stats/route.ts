import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // ── KPI 데이터 ────────────────────────────────────────────
  const [
    totalUsers,
    newUsersThisMonth,
    newUsersLastMonth,
    activeSubscriptions,
    contentsThisMonth,
    contentsLastMonth,
    allUsers,
  ] = await Promise.all([
    // 전체 유저 수
    prisma.user.count(),
    // 이번 달 신규 유저
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    // 저번 달 신규 유저 (증감률 계산용)
    prisma.user.count({ where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
    // 활성 구독 수 (ACTIVE 상태)
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    // 이번 달 생성 콘텐츠
    prisma.content.count({ where: { createdAt: { gte: startOfMonth } } }),
    // 저번 달 생성 콘텐츠
    prisma.content.count({ where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
    // 크레딧 소비 합산용
    prisma.user.findMany({ select: { creditsUsed: true } }),
  ]);

  // 이번 달 크레딧 소비 (전체 합산)
  const totalCreditsUsed = allUsers.reduce((sum, u) => sum + u.creditsUsed, 0);

  // 증감률 계산
  const userGrowth =
    newUsersLastMonth > 0
      ? Math.round(((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100)
      : null;
  const contentGrowth =
    contentsLastMonth > 0
      ? Math.round(((contentsThisMonth - contentsLastMonth) / contentsLastMonth) * 100)
      : null;

  // ── 플랜별 분포 (도넛 차트) ───────────────────────────────
  const planDistribution = await prisma.user.groupBy({
    by: ["plan"],
    _count: { plan: true },
  });

  // ── 콘텐츠 타입별 생성 수 (바 차트) ─────────────────────────
  const contentByType = await prisma.content.groupBy({
    by: ["type"],
    _count: { type: true },
  });

  // ── 최근 30일 일별 가입자 (라인 차트) ────────────────────────
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const recentUsers = await prisma.user.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // 날짜별 그루핑
  const dailySignups: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(thirtyDaysAgo.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dailySignups[key] = 0;
  }
  for (const u of recentUsers) {
    const key = u.createdAt.toISOString().slice(0, 10);
    if (key in dailySignups) dailySignups[key]++;
  }
  const signupChart = Object.entries(dailySignups).map(([date, count]) => ({
    date,
    count,
  }));

  // ── 최신 활동 피드 ────────────────────────────────────────
  const [recentSignups, recentContents] = await Promise.all([
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, plan: true, createdAt: true },
    }),
    prisma.content.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    }),
  ]);

  return NextResponse.json({
    kpi: {
      totalUsers,
      newUsersThisMonth,
      userGrowth,
      activeSubscriptions,
      contentsThisMonth,
      contentGrowth,
      totalCreditsUsed,
      avgCreditsPerUser: allUsers.length > 0 ? Math.round(totalCreditsUsed / allUsers.length) : 0,
    },
    charts: {
      signupChart,
      planDistribution: planDistribution.map((p) => ({
        plan: p.plan,
        count: p._count.plan,
      })),
      contentByType: contentByType.map((c) => ({
        type: c.type,
        count: c._count.type,
      })),
    },
    feed: {
      recentSignups,
      recentContents,
    },
  });
}
