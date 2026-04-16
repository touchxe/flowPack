"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Users, FileText, CreditCard, Zap, TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

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
  FREE: "#64748b", STARTER: "#6366F1", PRO: "#8B5CF6", ENTERPRISE: "#F59E0B",
};
const TYPE_COLORS: Record<string, string> = {
  CAROUSEL: "#6366F1", BLOG: "#10b981", VIDEO: "#F59E0B", BULK: "#ef4444", URL_TO_POST: "#8B5CF6",
};
const TYPE_LABELS: Record<string, string> = {
  CAROUSEL: "카드뉴스", BLOG: "블로그", VIDEO: "영상", BULK: "대량", URL_TO_POST: "URL변환",
};
const STATUS_LABELS: Record<string, { label: string; color: string; dot: string }> = {
  DRAFT:     { label: "초안", color: "#64748b", dot: "#64748b" },
  SCHEDULED: { label: "예약", color: "#F59E0B", dot: "#F59E0B" },
  PUBLISHED: { label: "발행", color: "#10b981", dot: "#10b981" },
  ARCHIVED:  { label: "보관", color: "#475569", dot: "#475569" },
};
const PLAN_LABELS: Record<string, string> = {
  FREE: "FREE", STARTER: "STARTER", PRO: "PRO", ENTERPRISE: "ENT",
};

function KpiCard({ title, value, sub, growth, icon: Icon, accent }: {
  title: string; value: string | number; sub: string; growth?: number | null;
  icon: React.ElementType; accent: string;
}) {
  return (
    <div style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 16, padding: "20px 22px", transition: "all 0.2s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = accent + "60"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1E293B"; }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</p>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: accent + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={16} color={accent} />
        </div>
      </div>
      <p style={{ fontSize: 30, fontWeight: 800, color: "#F1F5F9", marginBottom: 4 }}>{Number(value).toLocaleString()}</p>
      <p style={{ fontSize: 11, color: "#475569" }}>{sub}</p>
      {growth !== undefined && growth !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 10 }}>
          {growth > 0 ? <TrendingUp size={12} color="#10b981" /> : growth < 0 ? <TrendingDown size={12} color="#ef4444" /> : <Minus size={12} color="#475569" />}
          <span style={{ fontSize: 11, fontWeight: 700, color: growth > 0 ? "#10b981" : growth < 0 ? "#ef4444" : "#475569" }}>
            {growth > 0 ? "+" : ""}{growth}% 전월 대비
          </span>
        </div>
      )}
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const color = PLAN_COLORS[plan] ?? "#64748b";
  return (
    <span style={{ fontSize: 10, fontWeight: 800, color, background: color + "20", padding: "2px 8px", borderRadius: 5, textTransform: "uppercase" as const }}>
      {PLAN_LABELS[plan] ?? plan}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const cfg = STATUS_LABELS[status] ?? { label: status, color: "#64748b", dot: "#64748b" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: cfg.color }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.dot, display: "inline-block" }} />
      {cfg.label}
    </span>
  );
}

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
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #1E293B", borderTopColor: "#6366F1", animation: "spin 0.8s linear infinite" }} />
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

  const CHART_STYLE = { background: "#0F172A", border: "1px solid #1E293B", borderRadius: 16, padding: "18px 20px" };

  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPI 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        <KpiCard title="총 가입자"     value={kpi.totalUsers}         sub={`이번 달 신규 ${kpi.newUsersThisMonth}명`} growth={kpi.userGrowth}    icon={Users}      accent="#6366F1" />
        <KpiCard title="활성 구독"     value={kpi.activeSubscriptions} sub="현재 유료 구독"                                                          icon={CreditCard}  accent="#8B5CF6" />
        <KpiCard title="이번 달 콘텐츠" value={kpi.contentsThisMonth}   sub="생성된 콘텐츠 수"                           growth={kpi.contentGrowth} icon={FileText}    accent="#10b981" />
        <KpiCard title="크레딧 소비"    value={kpi.totalCreditsUsed}    sub={`유저당 평균 ${kpi.avgCreditsPerUser}개`}                               icon={Zap}         accent="#F59E0B" />
      </div>

      {/* 차트 — 가입자 추이 + 플랜 분포 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14 }}>
        <div style={CHART_STYLE}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Activity size={15} color="#6366F1" />
            <p style={{ fontSize: 13, fontWeight: 700, color: "#CBD5E1" }}>최근 30일 가입자 추이</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={charts.signupChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 10 }} tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fill: "#475569", fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 10 }} labelStyle={{ color: "#94A3B8", fontSize: 11 }} itemStyle={{ color: "#6366F1", fontSize: 11 }} />
              <Line type="monotone" dataKey="count" name="신규 가입" stroke="#6366F1" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#6366F1" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={CHART_STYLE}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#CBD5E1", marginBottom: 16 }}>플랜별 유저 분포</p>
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
        </div>
      </div>

      {/* 바 차트 + 피드 2종 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <div style={CHART_STYLE}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#CBD5E1", marginBottom: 16 }}>콘텐츠 타입별 생성 수</p>
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
        </div>

        {/* 최근 가입 유저 */}
        <div style={CHART_STYLE}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#CBD5E1", marginBottom: 14 }}>최근 가입 유저</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {feed.recentSignups.length === 0 ? (
              <p style={{ fontSize: 12, color: "#334155" }}>가입 유저 없음</p>
            ) : feed.recentSignups.map(u => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#6366F120", border: "1.5px solid #6366F130", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#818CF8", flexShrink: 0 }}>
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
        </div>

        {/* 최근 생성 콘텐츠 */}
        <div style={CHART_STYLE}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#CBD5E1", marginBottom: 14 }}>최근 생성 콘텐츠</p>
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
        </div>
      </div>
    </div>
  );
}
