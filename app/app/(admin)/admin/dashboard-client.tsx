"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Users, FileText, CreditCard, Zap, Activity } from "lucide-react";
import { KpiCard, ChartPanel, PlanBadge, StatusDot } from "@/components/blocks";

interface Stats {
  kpi: {
    totalUsers: number; newUsersThisMonth: number; userGrowth: number | null;
    activeSubscriptions: number; contentsThisMonth: number; contentGrowth: number | null;
    totalCreditsUsed: number; avgCreditsPerUser: number;
  };
  charts: {
    signupChart: { date: string; count: number }[];
    planDistribution: { plan: string; count: number }[];
    contentByType: { type: string; count: number }[];
  };
  feed: {
    recentSignups: { id: string; name: string | null; email: string; plan: string; createdAt: string }[];
    recentContents: { id: string; title: string; type: string; status: string; createdAt: string; user: { email: string } }[];
  };
}

const PLAN_COLORS: Record<string, string> = {
  FREE: "#64748b", STARTER: "var(--fp-primary-subtle0)", PRO: "var(--fp-primary-subtle0)", ENTERPRISE: "#F59E0B",
};
const TYPE_COLORS: Record<string, string> = {
  CAROUSEL: "var(--fp-primary-subtle0)", BLOG: "#10b981", VIDEO: "#F59E0B", BULK: "#ef4444", URL_TO_POST: "var(--fp-primary-subtle0)",
};
const TYPE_LABELS: Record<string, string> = {
  CAROUSEL: "카드뉴스", BLOG: "블로그", VIDEO: "영상", BULK: "대량", URL_TO_POST: "URL변환",
};

/* KpiCard, PlanBadge, StatusDot — @/components/blocks에서 import */

export default function AdminDashboardClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        // kpi 필드가 없으면 유효하지 않은 응답으로 처리
        if (!data?.kpi) throw new Error("invalid response");
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, flexDirection: "column", gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #1E293B", borderTopColor: "var(--fp-primary-subtle0)", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ fontSize: 13, color: "#475569" }}>데이터 로딩 중...</p>
      </div>
    );
  }
  if (!stats) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#475569", fontSize: 14 }}>데이터를 불러올 수 없습니다</div>;
  }

  const { kpi, charts, feed } = stats;

  // kpi가 없는 경우 방어 (API 응답 구조 불일치 대비)
  if (!kpi) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#475569", fontSize: 14, flexDirection: "column", gap: 8 }}>
        <p>통계 데이터를 불러올 수 없습니다</p>
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 8, padding: "6px 16px", borderRadius: 8, background: "#1E293B", border: "1px solid #334155", color: "#94A3B8", fontSize: 13, cursor: "pointer" }}
        >
          새로고침
        </button>
      </div>
    );
  }

  /* ChartPanel 블록 사용으로 CHART_STYLE 인라인 제거 */

  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPI 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        <KpiCard title="총 가입자"     value={kpi.totalUsers}         sub={`이번 달 신규 ${kpi.newUsersThisMonth}명`} growth={kpi.userGrowth}    icon={Users}      accent="var(--fp-primary-subtle0)" />
        <KpiCard title="활성 구독"     value={kpi.activeSubscriptions} sub="현재 유료 구독"                                                          icon={CreditCard}  accent="var(--fp-primary-subtle0)" />
        <KpiCard title="이번 달 콘텐츠" value={kpi.contentsThisMonth}   sub="생성된 콘텐츠 수"                           growth={kpi.contentGrowth} icon={FileText}    accent="#10b981" />
        <KpiCard title="크레딧 소비"    value={kpi.totalCreditsUsed}    sub={`유저당 평균 ${kpi.avgCreditsPerUser}개`}                               icon={Zap}         accent="#F59E0B" />
      </div>

      {/* 차트 — 가입자 추이 + 플랜 분포 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14 }}>
        <ChartPanel title="최근 30일 가입자 추이" icon={<Activity size={15} color="var(--fp-primary-subtle0)" />}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={charts.signupChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 10 }} tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fill: "#475569", fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 10 }} labelStyle={{ color: "#94A3B8", fontSize: 11 }} itemStyle={{ color: "var(--fp-primary-subtle0)", fontSize: 11 }} />
              <Line type="monotone" dataKey="count" name="신규 가입" stroke="var(--fp-primary-subtle0)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "var(--fp-primary-subtle0)" }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="플랜별 유저 분포">
          {charts.planDistribution.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={charts.planDistribution} dataKey="count" nameKey="plan" innerRadius={40} outerRadius={62} paddingAngle={3}>
                    {charts.planDistribution.map(entry => (
                      <Cell key={entry.plan} fill={PLAN_COLORS[entry.plan] ?? "#64748b"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 10 }} itemStyle={{ color: "#94A3B8", fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {charts.planDistribution.map(p => (
                  <div key={p.plan} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: PLAN_COLORS[p.plan] ?? "#64748b" }} />
                      <span style={{ fontSize: 11, color: "#94A3B8" }}>{p.plan}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#CBD5E1" }}>{p.count}명</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 140, color: "#334155", fontSize: 13 }}>데이터 없음</div>
          )}
        </ChartPanel>
      </div>

      {/* 바 차트 + 피드 2종 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <ChartPanel title="콘텐츠 타입별 생성 수">
          {charts.contentByType.length > 0 ? (
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={charts.contentByType} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="type" tick={{ fill: "#475569", fontSize: 10 }} tickFormatter={v => TYPE_LABELS[v] ?? v} />
                <YAxis tick={{ fill: "#475569", fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 10 }} labelFormatter={v => TYPE_LABELS[v as string] ?? v} itemStyle={{ color: "#94A3B8", fontSize: 11 }} />
                <Bar dataKey="count" name="생성 수" radius={[4, 4, 0, 0]}>
                  {charts.contentByType.map(entry => (
                    <Cell key={entry.type} fill={TYPE_COLORS[entry.type] ?? "#64748b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 170, color: "#334155", fontSize: 13 }}>데이터 없음</div>
          )}
        </ChartPanel>

        {/* 최근 가입 유저 */}
        <ChartPanel title="최근 가입 유저">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {feed.recentSignups.length === 0 ? (
              <p style={{ fontSize: 12, color: "#334155" }}>가입 유저 없음</p>
            ) : feed.recentSignups.map(u => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(var(--brand-rgb), 0.13)", border: "1.5px solid rgba(var(--brand-rgb), 0.19)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "var(--fp-primary-subtle0)", flexShrink: 0 }}>
                    {(u.name ?? u.email)[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#CBD5E1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 110 }}>{u.name ?? "—"}</p>
                    <p style={{ fontSize: 10, color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 110 }}>{u.email}</p>
                  </div>
                </div>
                <PlanBadge plan={u.plan} />
              </div>
            ))}
          </div>
        </ChartPanel>

        {/* 최근 생성 콘텐츠 */}
        <ChartPanel title="최근 생성 콘텐츠">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {feed.recentContents.length === 0 ? (
              <p style={{ fontSize: 12, color: "#334155" }}>콘텐츠 없음</p>
            ) : feed.recentContents.map(c => (
              <div key={c.id} style={{ borderBottom: "1px solid #1E293B", paddingBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                  <StatusDot status={c.status} />
                  <span style={{ fontSize: 9, fontWeight: 800, color: TYPE_COLORS[c.type] ?? "#64748b", background: (TYPE_COLORS[c.type] ?? "#64748b") + "20", padding: "1px 5px", borderRadius: 4, textTransform: "uppercase" as const }}>
                    {TYPE_LABELS[c.type] ?? c.type}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "#CBD5E1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</p>
                <p style={{ fontSize: 10, color: "#334155" }}>{c.user.email}</p>
              </div>
            ))}
          </div>
        </ChartPanel>
      </div>
    </div>
  );
}
