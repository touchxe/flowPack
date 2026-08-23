"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, CreditCard, FileText, Users, Zap } from "lucide-react";
import { AdminBadge, AdminEmptyState, AdminLoadingState, AdminMetricCard, AdminPanel } from "@/components/admin/admin-ui";

interface Stats {
  kpi: { totalUsers: number; newUsersThisMonth: number; userGrowth: number | null; activeSubscriptions: number; contentsThisMonth: number; contentGrowth: number | null; totalCreditsUsed: number; avgCreditsPerUser: number };
  charts: { signupChart: { date: string; count: number }[]; planDistribution: { plan: string; count: number }[]; contentByType: { type: string; count: number }[] };
  feed: { recentSignups: { id: string; name: string | null; email: string; plan: string; createdAt: string }[]; recentContents: { id: string; title: string; type: string; status: string; createdAt: string; user: { email: string } }[] };
}

const PLAN_TONE: Record<string, "neutral" | "info" | "success" | "warning"> = { FREE: "neutral", STARTER: "info", PRO: "success", ENTERPRISE: "warning" };
const PLAN_COLORS: Record<string, string> = { FREE: "#7f91a8", STARTER: "#38bdf8", PRO: "#34d399", ENTERPRISE: "#fbbf24" };
const TYPE_COLORS: Record<string, string> = { CAROUSEL: "#38bdf8", BLOG: "#34d399", VIDEO: "#fbbf24", BULK: "#fb7185", URL_TO_POST: "#a5b4fc" };
const TYPE_LABELS: Record<string, string> = { CAROUSEL: "카드뉴스", BLOG: "블로그", VIDEO: "영상", BULK: "대량 생성", URL_TO_POST: "URL 변환" };
const STATUS_TONE: Record<string, "neutral" | "success" | "warning"> = { DRAFT: "neutral", SCHEDULED: "warning", PUBLISHED: "success", ARCHIVED: "neutral" };

export default function AdminDashboardClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/stats")
      .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
      .then((data) => { if (!data?.kpi) throw new Error("invalid response"); if (active) setStats(data); })
      .catch(() => { if (active) setStats(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <AdminLoadingState />;
  if (!stats) return <AdminEmptyState title="통계 데이터를 불러오지 못했습니다" description="잠시 후 새로고침하거나 관리자 API 상태를 확인하세요." />;

  const { kpi, charts, feed } = stats;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard title="총 가입자" value={kpi.totalUsers} description={`이번 달 신규 ${kpi.newUsersThisMonth.toLocaleString()}명`} trend={kpi.userGrowth} icon={Users} />
        <AdminMetricCard title="활성 구독" value={kpi.activeSubscriptions} description="현재 유료 구독" icon={CreditCard} tone="success" />
        <AdminMetricCard title="이번 달 콘텐츠" value={kpi.contentsThisMonth} description="생성된 콘텐츠 수" trend={kpi.contentGrowth} icon={FileText} tone="warning" />
        <AdminMetricCard title="크레딧 소비" value={kpi.totalCreditsUsed} description={`유저당 평균 ${kpi.avgCreditsPerUser.toLocaleString()}개`} icon={Zap} tone="neutral" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <AdminPanel title="최근 30일 가입자 추이" icon={<Activity className="h-4 w-4" />}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={charts.signupChart}>
              <CartesianGrid stroke="#263850" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: "#7f91a8", fontSize: 10 }} tickFormatter={(value) => value.slice(5)} />
              <YAxis tick={{ fill: "#7f91a8", fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#16253a", border: "1px solid #3b5270", borderRadius: 8 }} labelStyle={{ color: "#b7c5d6" }} itemStyle={{ color: "#67e8f9" }} />
              <Line type="monotone" dataKey="count" name="신규 가입" stroke="#38bdf8" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#67e8f9" }} />
            </LineChart>
          </ResponsiveContainer>
        </AdminPanel>

        <AdminPanel title="플랜별 유저 분포">
          {charts.planDistribution.length ? <>
            <ResponsiveContainer width="100%" height={146}>
              <PieChart><Pie data={charts.planDistribution} dataKey="count" nameKey="plan" innerRadius={40} outerRadius={62} paddingAngle={3}>{charts.planDistribution.map((entry) => <Cell key={entry.plan} fill={PLAN_COLORS[entry.plan] ?? "#7f91a8"} />)}</Pie><Tooltip contentStyle={{ background: "#16253a", border: "1px solid #3b5270", borderRadius: 8 }} itemStyle={{ color: "#b7c5d6" }} /></PieChart>
            </ResponsiveContainer>
            <ul className="mt-2 space-y-2">{charts.planDistribution.map((plan) => <li key={plan.plan} className="flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-2 text-[var(--admin-text-secondary)]"><span className="h-2 w-2 rounded-full" style={{ background: PLAN_COLORS[plan.plan] ?? "#7f91a8" }} />{plan.plan}</span><AdminBadge tone={PLAN_TONE[plan.plan] ?? "neutral"}>{plan.count.toLocaleString()}명</AdminBadge></li>)}</ul>
          </> : <AdminEmptyState title="플랜 데이터가 없습니다" description="구독 데이터가 쌓이면 여기에 표시됩니다." />}
        </AdminPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <AdminPanel title="콘텐츠 유형별 생성 수">
          {charts.contentByType.length ? <ResponsiveContainer width="100%" height={180}><BarChart data={charts.contentByType} barSize={22}><CartesianGrid stroke="#263850" strokeDasharray="3 3" /><XAxis dataKey="type" tick={{ fill: "#7f91a8", fontSize: 10 }} tickFormatter={(value) => TYPE_LABELS[value] ?? value} /><YAxis tick={{ fill: "#7f91a8", fontSize: 10 }} allowDecimals={false} /><Tooltip contentStyle={{ background: "#16253a", border: "1px solid #3b5270", borderRadius: 8 }} labelFormatter={(value) => TYPE_LABELS[String(value)] ?? String(value)} itemStyle={{ color: "#b7c5d6" }} /><Bar dataKey="count" name="생성 수" radius={[4, 4, 0, 0]}>{charts.contentByType.map((entry) => <Cell key={entry.type} fill={TYPE_COLORS[entry.type] ?? "#7f91a8"} />)}</Bar></BarChart></ResponsiveContainer> : <AdminEmptyState title="콘텐츠 데이터가 없습니다" description="생성 이력이 쌓이면 차트가 표시됩니다." />}
        </AdminPanel>

        <AdminPanel title="최근 가입 유저">
          {feed.recentSignups.length ? <ul className="space-y-3">{feed.recentSignups.map((user) => <li key={user.id} className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--admin-text)]">{user.name ?? "이름 미입력"}</p><p className="truncate text-xs text-[var(--admin-text-muted)]">{user.email}</p></div><AdminBadge tone={PLAN_TONE[user.plan] ?? "neutral"}>{user.plan}</AdminBadge></li>)}</ul> : <AdminEmptyState title="새 가입자가 없습니다" description="새로운 가입이 발생하면 표시됩니다." />}
        </AdminPanel>

        <AdminPanel title="최근 생성 콘텐츠">
          {feed.recentContents.length ? <ul className="space-y-3">{feed.recentContents.map((content) => <li key={content.id} className="border-b border-[var(--admin-border)] pb-3 last:border-0 last:pb-0"><div className="mb-1 flex items-center gap-2"><AdminBadge tone={STATUS_TONE[content.status] ?? "neutral"}>{content.status}</AdminBadge><span className="text-[11px] text-cyan-200">{TYPE_LABELS[content.type] ?? content.type}</span></div><p className="truncate text-sm font-semibold text-[var(--admin-text)]">{content.title}</p><p className="truncate text-xs text-[var(--admin-text-muted)]">{content.user.email}</p></li>)}</ul> : <AdminEmptyState title="생성된 콘텐츠가 없습니다" description="새 콘텐츠가 생성되면 표시됩니다." />}
        </AdminPanel>
      </div>
    </div>
  );
}
