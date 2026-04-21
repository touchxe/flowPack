"use client";

import { useState, useEffect } from "react";
import { FileText, Eye, Send, TrendingUp, BarChart3, Calendar, Zap, MousePointerClick } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Area, AreaChart,
} from "recharts";
import ContentFlowSankey from "@/components/charts/content-flow-sankey";
import type { ContentFlowData } from "@/components/charts/content-flow-sankey";

interface Stats { totalCreated: number; totalPublished: number; totalViews: number; totalClicks: number; }
interface ChartData { date: string; count: number; }
interface PlatformStat { platform: string; views: number; likes: number; clicks: number; }
interface FunnelData { created: number; distributed: number; totalViews: number; estimatedVisitors: number; }
interface TopContent { id: string; title: string; type: string; viewCount: number; clickCount: number; channels: number; publishedAt: string | null; }

const platformNames: Record<string, string> = {
  INSTAGRAM: "Instagram", FACEBOOK: "Facebook", TWITTER: "X (Twitter)",
  LINKEDIN: "LinkedIn", NAVER_BLOG: "Naver Blog", WORDPRESS: "WordPress",
};

const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: "#E1306C", FACEBOOK: "#1877F2", TWITTER: "#1DA1F2",
  LINKEDIN: "#0077B5", NAVER_BLOG: "#03C75A", WORDPRESS: "#21759B",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 12 }}>
      <p style={{ fontWeight: 700, color: "#111827", marginBottom: 4 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {p.value.toLocaleString()}</p>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("30");
  const [stats, setStats] = useState<Stats | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [platformStats, setPlatformStats] = useState<PlatformStat[]>([]);
  const [sankeyData, setSankeyData] = useState<ContentFlowData>({ nodes: [], links: [] });
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [topContents, setTopContents] = useState<TopContent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAnalytics(); }, [period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?period=${period}`);
      if (res.ok) {
        const d = await res.json();
        setStats(d.summary);
        setChartData(d.chartData);
        setPlatformStats(d.platformStats);
        if (d.sankeyData) setSankeyData(d.sankeyData);
        if (d.funnel) setFunnel(d.funnel);
        if (d.topContents) setTopContents(d.topContents);
      }
    } catch {}
    finally { setLoading(false); }
  };

  const periodLabel = period === "7" ? "7일" : period === "30" ? "30일" : "90일";

  const KPI_CARDS = [
    { label: "생성된 콘텐츠", value: stats?.totalCreated ?? 0, icon: <FileText size={18} color="var(--brand-500)" />, bg: "#EEF2FF", color: "var(--brand-500)", sub: `이번 ${periodLabel}간` },
    { label: "총 조회수",     value: stats?.totalViews ?? 0,   icon: <Eye size={18} color="var(--fp-cyan)" />,   bg: "#F5F3FF", color: "var(--fp-cyan)", sub: "누적 조회수" },
    { label: "총 클릭수",     value: stats?.totalClicks ?? 0,  icon: <MousePointerClick size={18} color="#D97706" />, bg: "#FFF7ED", color: "#D97706", sub: "추적 링크 클릭" },
    { label: "배포 완료",     value: stats?.totalPublished ?? 0, icon: <Send size={18} color="#059669" />, bg: "#ECFDF5", color: "#059669", sub: `이번 ${periodLabel}간` },
  ];

  return (
    <div style={{ padding: "24px 28px" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        .chart-card { background:#fff; border:1.5px solid #E5E7EB; border-radius:16px; padding:22px; }
        .skeleton { background:linear-gradient(90deg,#F3F4F6 25%,#E5E7EB 50%,#F3F4F6 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:8px; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, marginBottom: 4 }}>통계</h1>
          <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>콘텐츠 성과와 채널별 성능을 확인하세요</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger style={{ width: 120, height: 38, borderRadius: 10, fontSize: 13, border: "1.5px solid #E5E7EB" }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7일</SelectItem>
            <SelectItem value="30">30일</SelectItem>
            <SelectItem value="90">90일</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
        {KPI_CARDS.map((k, i) => (
          <div key={i} style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>{k.label}</p>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: k.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{k.icon}</div>
            </div>
            {loading ? (
              <div className="skeleton" style={{ height: 32, width: "60%" }} />
            ) : (
              <p style={{ fontSize: 28, fontWeight: 800, color: k.color, margin: 0 }}>
                {k.value.toLocaleString()}{(k as any).suffix || ""}
              </p>
            )}
            <p style={{ fontSize: 11, color: "#C4C9D4", marginTop: 4 }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* 차트 2열 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* 콘텐츠 생성 추이 */}
        <div className="chart-card">
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0, marginBottom: 2 }}>콘텐츠 생성 추이</h2>
            <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>일별 생성 콘텐츠 수</p>
          </div>
          {loading ? <div className="skeleton" style={{ height: 200 }} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand-500)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--brand-500)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "#9CA3AF" }} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "#9CA3AF" }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="count" name="생성" stroke="var(--brand-500)" strokeWidth={2.5} fill="url(#areaGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 채널별 성능 */}
        <div className="chart-card">
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0, marginBottom: 2 }}>채널별 조회수</h2>
            <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>플랫폼별 조회수</p>
          </div>
          {loading ? <div className="skeleton" style={{ height: 200 }} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={platformStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="platform" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: "#9CA3AF" }}
                  tickFormatter={(v) => platformNames[v]?.split(" ")[0] || v} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "#9CA3AF" }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="views" name="조회수" radius={[6, 6, 0, 0]} fill="var(--brand-500)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 채널별 상세 테이블 */}
      <div className="chart-card">
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <BarChart3 size={17} color="var(--brand-500)" />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>채널별 상세</h2>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1.5px solid #F3F4F6" }}>
                {["채널", "조회수", "클릭수", "좋아요", "효율 (좋아요/조회수)"].map((h, i) => (
                  <th key={i} style={{ padding: "10px 12px", textAlign: i === 0 ? "left" : "right", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1,2,3].map(i => (
                  <tr key={i}><td colSpan={4} style={{ padding: "12px" }}><div className="skeleton" style={{ height: 20 }} /></td></tr>
                ))
              ) : platformStats.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: "center", padding: "32px", color: "#9CA3AF", fontSize: 13 }}>데이터가 없습니다</td></tr>
              ) : (
                platformStats.map((s, i) => {
                  const efficiency = s.views > 0 ? ((s.likes / s.views) * 100).toFixed(1) : "0.0";
                  return (
                    <tr key={s.platform} style={{ borderBottom: "1px solid #F9FAFB", transition: "background 0.1s" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#F9FAFB"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                      <td style={{ padding: "12px", display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: PLATFORM_COLORS[s.platform] || "#9CA3AF" }} />
                        <span style={{ fontWeight: 600, color: "#374151" }}>{platformNames[s.platform] || s.platform}</span>
                      </td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: 700, color: "#111827" }}>{s.views.toLocaleString()}</td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: 700, color: "#D97706" }}>{s.clicks.toLocaleString()}</td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: 600, color: "#374151" }}>{s.likes.toLocaleString()}</td>
                      <td style={{ padding: "12px", textAlign: "right" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: Number(efficiency) > 5 ? "#059669" : "#9CA3AF", background: Number(efficiency) > 5 ? "#ECFDF5" : "#F9FAFB", padding: "3px 8px", borderRadius: 6 }}>
                          {efficiency}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 콘텐츠 퍼포먼스 플로우 (Sankey) ───────────── */}
      <div className="chart-card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TrendingUp size={17} color="var(--brand-500)" />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>콘텐츠 퍼포먼스 플로우</h2>
          </div>
          <span style={{ fontSize: 12, color: "#9CA3AF" }}>콘텐츠 → 채널 → 조회수 → 유입</span>
        </div>

        {/* 퍼널 요약 바 */}
        {funnel && (
          <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 20 }}>
            {[
              { label: "발행", value: funnel.created, color: "var(--brand-500)", bg: "#EEF2FF", pct: "100%" },
              { label: "배포", value: funnel.distributed, color: "var(--fp-cyan)", bg: "#F5F3FF", pct: funnel.created > 0 ? `${Math.round((funnel.distributed / funnel.created) * 100)}%` : "0%" },
              { label: "조회", value: funnel.totalViews, color: "#D97706", bg: "#FFFBEB", pct: "―" },
              { label: "유입", value: funnel.estimatedVisitors, color: "#059669", bg: "#ECFDF5", pct: funnel.totalViews > 0 ? `CTR ${((funnel.estimatedVisitors / funnel.totalViews) * 100).toFixed(1)}%` : "0%" },
            ].map((step, idx, arr) => (
              <div key={step.label} style={{ flex: 1, display: "flex", alignItems: "center" }}>
                <div style={{ flex: 1, background: step.bg, borderRadius: 12, padding: "12px 16px", textAlign: "center" }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", margin: 0 }}>{step.label}</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: step.color, margin: "4px 0 2px" }}>{step.value.toLocaleString()}</p>
                  <p style={{ fontSize: 10, fontWeight: 700, color: step.color, opacity: 0.7, margin: 0 }}>{step.pct}</p>
                </div>
                {idx < arr.length - 1 && (
                  <div style={{ width: 24, textAlign: "center", color: "#D1D5DB", fontSize: 16, fontWeight: 900 }}>→</div>
                )}
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="skeleton" style={{ height: 280 }} />
        ) : (
          <ContentFlowSankey data={sankeyData} />
        )}
      </div>

      {/* ── 콘텐츠별 성과 TOP 10 ─────────────────────── */}
      {topContents.length > 0 && (
        <div className="chart-card" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Eye size={17} color="var(--fp-cyan)" />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>콘텐츠별 성과 TOP 10</h2>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1.5px solid #F3F4F6" }}>
                {["#", "제목", "타입", "채널", "조회수", "클릭수", "발행일"].map((h, i) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: i < 2 ? "left" : "right", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topContents.map((item, idx) => {
                const maxViews = topContents[0]?.viewCount || 1;
                const barWidth = Math.max((item.viewCount / maxViews) * 100, 3);
                const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
                  CAROUSEL: { label: "카드뉴스", color: "var(--brand-500)", bg: "#EEF2FF" },
                  BLOG: { label: "블로그", color: "#059669", bg: "#ECFDF5" },
                  VIDEO: { label: "영상", color: "#DC2626", bg: "#FEF2F2" },
                  BULK: { label: "대량", color: "#D97706", bg: "#FFF7ED" },
                  URL_TO_POST: { label: "URL변환", color: "var(--fp-cyan)", bg: "#F5F3FF" },
                };
                const tp = TYPE_LABELS[item.type] ?? TYPE_LABELS.CAROUSEL;
                return (
                  <tr key={item.id} style={{ borderBottom: "1px solid #F9FAFB", transition: "background 0.1s" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#F9FAFB"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "#D1D5DB", width: 36 }}>{idx + 1}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 500, color: "#111827", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: tp.color, background: tp.bg, padding: "3px 8px", borderRadius: 6 }}>{tp.label}</span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: "#374151" }}>{item.channels}개</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                        <div style={{ width: 60, height: 6, borderRadius: 3, background: "#F3F4F6", overflow: "hidden" }}>
                          <div style={{ width: `${barWidth}%`, height: "100%", borderRadius: 3, background: "linear-gradient(90deg, var(--brand-500), var(--fp-cyan))" }} />
                        </div>
                        <span style={{ fontWeight: 700, color: "var(--brand-500)", minWidth: 40 }}>{item.viewCount.toLocaleString()}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#D97706" }}>{(item.clickCount ?? 0).toLocaleString()}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, color: "#9CA3AF" }}>
                      {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }) : "―"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
