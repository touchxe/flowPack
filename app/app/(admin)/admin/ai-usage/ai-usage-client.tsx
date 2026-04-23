"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Brain, Zap, DollarSign, AlertTriangle, Activity, TrendingUp, Users, ServerCrash } from "lucide-react";
import { format } from "date-fns";

// ─── 타입 ────────────────────────────────────────────
interface AiUsageData {
  kpi: {
    totalCalls: number;
    totalTokens: number;
    totalCost: number;
    errorRate: number;
    allTimeCalls: number;
  };
  charts: {
    featureChart: { feature: string; calls: number; tokens: number; cost: number }[];
    modelChart: { model: string; calls: number; cost: number }[];
    dailyChart: { date: string; cost: number }[];
  };
  topUsers: { email: string; plan: string; tokens: number; calls: number; cost: number }[];
  errorLogs: { id: string; createdAt: string; feature: string; model: string; errorCode: string | null; user: { email: string } }[];
}

const FEATURE_LABELS: Record<string, string> = {
  CAROUSEL: "카드뉴스", BLOG: "블로그", BULK: "대량 생성",
  URL_TO_POST: "URL변환", LONGFORM: "롱폼",
};
const FEATURE_COLORS: Record<string, string> = {
  CAROUSEL: "var(--brand-500)", BLOG: "#10b981", BULK: "#ef4444",
  URL_TO_POST: "var(--brand-500)", LONGFORM: "#F59E0B",
};

// 멀티 제공사 모델 컬러 매핑
const MODEL_COLORS: Record<string, string> = {
  // OpenAI
  "gpt-5.1": "#10b981", "gpt-4.1-mini": "#34d399",
  "gpt-4o": "var(--brand-500)", "gpt-4o-mini": "var(--brand-500)",
  "o3": "#059669", "o4-mini": "#6ee7b7",
  // Anthropic
  "claude-opus-4-6": "#f97316", "claude-sonnet-4-6": "#fb923c",
  "claude-3-7-sonnet-20250219": "#fdba74", "claude-3-5-haiku-20241022": "#fed7aa",
  // Google
  "gemini-3.1-pro-preview": "#3b82f6", "gemini-3.1-flash-lite-preview": "#93c5fd",
  "gemini-2.5-pro": "#2563eb", "gemini-2.5-flash": "#60a5fa", "gemini-2.5-flash-lite": "#bfdbfe",
  // xAI
  "grok-4": "#a855f7", "grok-4-mini": "var(--brand-500)", "grok-3": "#7c3aed", "grok-3-mini": "#ddd6fe",
  // MiniMax
  "MiniMax-M2.7": "#ec4899", "MiniMax-M2.7-highspeed": "#f472b6",
  "MiniMax-M2.5": "#db2777", "MiniMax-M2.5-highspeed": "#f9a8d4", "MiniMax-M2": "#fbcfe8",
};

const PROVIDER_BADGE: Record<string, { label: string; color: string }> = {
  "gpt": { label: "OpenAI", color: "#10b981" },
  "o3": { label: "OpenAI", color: "#10b981" },
  "o4": { label: "OpenAI", color: "#10b981" },
  "claude": { label: "Anthropic", color: "#f97316" },
  "gemini": { label: "Google", color: "#3b82f6" },
  "grok": { label: "xAI", color: "#a855f7" },
  "MiniMax": { label: "MiniMax", color: "#ec4899" },
};

function getProviderInfo(model: string) {
  for (const [prefix, info] of Object.entries(PROVIDER_BADGE)) {
    if (model.startsWith(prefix)) return info;
  }
  return { label: "기타", color: "#64748b" };
}

const PLAN_COLORS: Record<string, string> = {
  FREE: "text-slate-400", STARTER: "text-blue-400", PRO: "text-purple-400", ENTERPRISE: "text-amber-400",
};

function KpiCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub: string; icon: React.ElementType; accent: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 hover:border-slate-700 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold tracking-widest text-slate-600 uppercase">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800`}>
          <Icon className={`h-4 w-4 ${accent}`} />
        </div>
      </div>
      <p className={`text-2xl font-extrabold ${accent}`}>{value}</p>
      <p className="text-[11px] text-slate-500 mt-1">{sub}</p>
    </div>
  );
}

const CHART_STYLE = "rounded-xl border border-slate-800 bg-slate-900/80 p-5";

export default function AiUsageClient() {
  const [data, setData] = useState<AiUsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/ai-usage")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        if (!d?.kpi) throw new Error("invalid response");
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-indigo-500" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <ServerCrash className="h-10 w-10 text-slate-700" />
        <p className="text-slate-500 text-sm">AI 사용량 데이터가 아직 없습니다</p>
        <p className="text-slate-600 text-xs">콘텐츠를 생성하면 사용량이 여기에 표시됩니다</p>
      </div>
    );
  }

  const { kpi, charts, topUsers, errorLogs } = data;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-slate-100">AI 사용량</h1>
        <p className="text-sm text-slate-500 mt-1">멀티 제공사 AI API 호출 현황 및 비용 모니터링</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="이번 달 호출" value={kpi.totalCalls.toLocaleString()} sub={`누적 ${kpi.allTimeCalls.toLocaleString()}회`} icon={Brain} accent="text-indigo-400" />
        <KpiCard label="총 토큰" value={kpi.totalTokens.toLocaleString()} sub="이번 달 사용량" icon={Zap} accent="text-emerald-400" />
        <KpiCard label="추정 비용" value={`$${kpi.totalCost.toFixed(2)}`} sub="이번 달 전체 비용" icon={DollarSign} accent="text-amber-400" />
        <KpiCard label="에러율" value={`${kpi.errorRate}%`} sub="이번 달 실패 비율" icon={AlertTriangle} accent={kpi.errorRate > 5 ? "text-red-400" : "text-slate-400"} />
      </div>

      {/* 차트 — 기능별 + 모델별 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`lg:col-span-2 ${CHART_STYLE}`}>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-indigo-400" />
            <p className="text-sm font-semibold text-slate-300">기능별 토큰 소비</p>
          </div>
          {charts.featureChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={charts.featureChart} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="feature" tick={{ fill: "#475569", fontSize: 10 }} tickFormatter={v => FEATURE_LABELS[v] ?? v} />
                <YAxis tick={{ fill: "#475569", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 10 }}
                  labelFormatter={v => FEATURE_LABELS[v as string] ?? v}
                  itemStyle={{ color: "#94A3B8", fontSize: 11 }}
                />
                <Bar dataKey="tokens" name="토큰" radius={[6, 6, 0, 0]}>
                  {charts.featureChart.map(e => (
                    <Cell key={e.feature} fill={FEATURE_COLORS[e.feature] ?? "#64748b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-slate-600 text-sm">데이터 없음</div>
          )}
        </div>

        <div className={CHART_STYLE}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-amber-400" />
            <p className="text-sm font-semibold text-slate-300">모델별 비용 분포</p>
          </div>
          {charts.modelChart.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={charts.modelChart} dataKey="cost" nameKey="model" innerRadius={40} outerRadius={60} paddingAngle={3}>
                    {charts.modelChart.map(e => (
                      <Cell key={e.model} fill={MODEL_COLORS[e.model] ?? "#64748b"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 10 }} itemStyle={{ color: "#94A3B8", fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {charts.modelChart.map(m => {
                  const provInfo = getProviderInfo(m.model);
                  return (
                    <div key={m.model} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ background: MODEL_COLORS[m.model] ?? "#64748b" }} />
                        <span className="text-slate-400 truncate max-w-[100px]">{m.model}</span>
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: provInfo.color + "20", color: provInfo.color }}>
                          {provInfo.label}
                        </span>
                      </div>
                      <span className="font-semibold text-slate-300">${m.cost.toFixed(3)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[140px] text-slate-600 text-sm">데이터 없음</div>
          )}
        </div>
      </div>

      {/* 일별 비용 라인 차트 */}
      <div className={CHART_STYLE}>
        <p className="text-sm font-semibold text-slate-300 mb-4">최근 30일 일별 비용 ($)</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={charts.dailyChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
            <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 10 }} tickFormatter={v => v.slice(5)} />
            <YAxis tick={{ fill: "#475569", fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 10 }}
              labelStyle={{ color: "#94A3B8", fontSize: 11 }}
              itemStyle={{ color: "#F59E0B", fontSize: 11 }}
            />
            <Line type="monotone" dataKey="cost" name="비용($)" stroke="#F59E0B" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#F59E0B" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* TOP 10 + 에러 로그 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* TOP 10 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden">
          <div className="border-b border-slate-800 px-5 py-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-400" />
            <p className="text-sm font-semibold text-slate-300">이번 달 TOP 10 헤비유저</p>
          </div>
          {topUsers.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-600">데이터 없음</div>
          ) : (
            <table className="w-full text-xs">
              <thead><tr className="border-b border-slate-800">
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-600 uppercase">유저</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-600 uppercase">호출</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-600 uppercase">토큰</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-600 uppercase">비용</th>
              </tr></thead>
              <tbody>
                {topUsers.map((u, i) => (
                  <tr key={u.email} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="text-slate-500">{i + 1}. </span>
                      <span className="text-slate-200">{u.email}</span>
                      <span className={`ml-1.5 text-[9px] font-bold ${PLAN_COLORS[u.plan] ?? "text-slate-500"}`}>{u.plan}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-400">{u.calls}</td>
                    <td className="px-4 py-2.5 text-right text-slate-300 font-mono">{u.tokens.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-amber-400 font-semibold">${u.cost.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 에러 로그 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden">
          <div className="border-b border-slate-800 px-5 py-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <p className="text-sm font-semibold text-slate-300">최근 에러 로그</p>
          </div>
          {errorLogs.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-emerald-600">에러 없음 🎉</div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-slate-800 sticky top-0 bg-slate-900">
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-600 uppercase">시간</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-600 uppercase">유저</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-600 uppercase">기능</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-600 uppercase">모델</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-600 uppercase">코드</th>
                </tr></thead>
                <tbody>
                  {errorLogs.map(e => {
                    const provInfo = getProviderInfo(e.model);
                    return (
                      <tr key={e.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="px-4 py-2 text-slate-500">{format(new Date(e.createdAt), "MM.dd HH:mm")}</td>
                        <td className="px-4 py-2 text-slate-400 truncate max-w-[120px]">{e.user.email}</td>
                        <td className="px-4 py-2 text-slate-300">{FEATURE_LABELS[e.feature] ?? e.feature}</td>
                        <td className="px-4 py-2">
                          <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: provInfo.color + "20", color: provInfo.color }}>
                            {e.model}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-red-400 font-mono">{e.errorCode ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
