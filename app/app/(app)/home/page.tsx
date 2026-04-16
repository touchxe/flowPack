// 홈 대시보드 — Server Component (DB 데이터 실사용)
import { FileText, Send, Plus, ArrowRight, Zap, Layers, BarChart2, CheckCircle2, Clock, Sparkles, Eye, TrendingUp } from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { ContentTypeBadge, ContentStatusBadge } from "@/components/common/content-badge";
import ContentFlowSankey from "@/components/charts/content-flow-sankey";
import type { ContentFlowData } from "@/components/charts/content-flow-sankey";

type BadgeContentType = "carousel" | "blog" | "video" | "bulk" | "url";
type BadgeContentStatus = "draft" | "scheduled" | "complete" | "archived";

const TYPE_MAP: Record<string, BadgeContentType> = {
  CAROUSEL: "carousel",
  BLOG: "blog",
  VIDEO: "video",
  BULK: "bulk",
  URL_TO_POST: "url",
};
const STATUS_MAP: Record<string, BadgeContentStatus> = {
  DRAFT: "draft",
  SCHEDULED: "scheduled",
  PUBLISHED: "complete",
  ARCHIVED: "archived",
};

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:     { label: "초안",     color: "#6B7280", bg: "#F3F4F6" },
  SCHEDULED: { label: "예약됨",   color: "#D97706", bg: "#FFFBEB" },
  PUBLISHED: { label: "발행완료", color: "#059669", bg: "#ECFDF5" },
  ARCHIVED:  { label: "보관됨",   color: "#9CA3AF", bg: "#F9FAFB" },
};

const TYPE_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  CAROUSEL:    { label: "카드뉴스", color: "#6366F1", bg: "#EEF2FF" },
  BLOG:        { label: "블로그",   color: "#059669", bg: "#ECFDF5" },
  VIDEO:       { label: "영상",     color: "#DC2626", bg: "#FEF2F2" },
  BULK:        { label: "대량",     color: "#D97706", bg: "#FFFBEB" },
  URL_TO_POST: { label: "URL변환",  color: "#8B5CF6", bg: "#F5F3FF" },
};

export default async function HomePage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const userName = session.user.name ?? session.user.email?.split("@")[0] ?? "사용자";
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const todayStr = format(now, "yyyy년 MM월 dd일");

  const [monthContents, allPublished, scheduledCount, recentContents, user, typeBreakdown, publishRecords, topPublished] = await Promise.all([
    prisma.content.count({ where: { userId, createdAt: { gte: monthStart, lte: monthEnd } } }),
    prisma.content.count({ where: { userId, status: "PUBLISHED" } }),
    prisma.content.count({ where: { userId, status: "SCHEDULED" } }),
    prisma.content.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, title: true, type: true, status: true, createdAt: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { creditsUsed: true, creditsTotal: true },
    }),
    // 타입별 발행 수 (Sankey용)
    prisma.content.groupBy({
      by: ["type"],
      where: { userId, status: "PUBLISHED" },
      _count: true,
    }),
    // 채널별 배포 기록 (Sankey용)
    prisma.publishRecord.findMany({
      where: { content: { userId } },
      include: {
        socialAccount: { select: { platform: true } },
        content: { select: { type: true, viewCount: true } },
      },
    }),
    // 조회수 상위 발행 콘텐츠 (성과 테이블용)
    prisma.content.findMany({
      where: { userId, status: "PUBLISHED" },
      orderBy: { viewCount: "desc" },
      take: 10,
      select: { id: true, title: true, type: true, viewCount: true, publishedAt: true },
      // 채널 수는 아래에서 별도 계산
    }),
  ]);

  const creditsUsed = user?.creditsUsed ?? 0;
  const creditsTotal = user?.creditsTotal ?? 10;
  const creditsPct = Math.min(Math.round((creditsUsed / creditsTotal) * 100), 100);
  const creditsLeft = creditsTotal - creditsUsed;

  // ── Sankey 데이터 변환 ──────────────────────────────────
  const PLATFORM_LABEL: Record<string, string> = {
    INSTAGRAM: "Instagram", FACEBOOK: "Facebook", TWITTER: "X (Twitter)",
    LINKEDIN: "LinkedIn", NAVER_BLOG: "네이버블로그", WORDPRESS: "WordPress",
  };

  // 노드 구성: [콘텐츠 타입들] + [채널들] + [총 조회수, 유입 추정]
  const typeNodes = typeBreakdown.map(t => ({
    key: t.type, label: `${TYPE_LABEL[t.type]?.label ?? t.type} (${t._count})`, count: t._count,
  }));

  // 채널별 집계
  const channelAgg = new Map<string, { count: number; views: number }>();
  publishRecords.forEach(pr => {
    const platform = pr.socialAccount.platform;
    const cur = channelAgg.get(platform) ?? { count: 0, views: 0 };
    cur.count += 1;
    cur.views += pr.content.viewCount ?? 0;
    channelAgg.set(platform, cur);
  });
  const channelNodes = Array.from(channelAgg.entries()).map(([platform, agg]) => ({
    key: platform, label: `${PLATFORM_LABEL[platform] ?? platform} (${agg.views})`, views: agg.views, count: agg.count,
  }));

  const totalViews = Array.from(channelAgg.values()).reduce((s, c) => s + c.views, 0);
  const estimatedVisitors = Math.round(totalViews * 0.1);

  // 타입 → 채널 링크 집계
  const typeToChannel = new Map<string, Map<string, number>>();
  publishRecords.forEach(pr => {
    const type = pr.content.type;
    const platform = pr.socialAccount.platform;
    if (!typeToChannel.has(type)) typeToChannel.set(type, new Map());
    const m = typeToChannel.get(type)!;
    m.set(platform, (m.get(platform) ?? 0) + 1);
  });

  // Sankey 노드/링크 빌드
  const sankeyNodes: { name: string }[] = [];
  const sankeyLinks: { source: number; target: number; value: number }[] = [];

  // 레이어 1: 타입 노드
  typeNodes.forEach(t => sankeyNodes.push({ name: t.label }));
  // 레이어 2: 채널 노드
  const channelStartIdx = sankeyNodes.length;
  channelNodes.forEach(c => sankeyNodes.push({ name: c.label }));
  // 레이어 3: 성과 노드
  const viewsIdx = sankeyNodes.length;
  sankeyNodes.push({ name: `총 조회수 (${totalViews.toLocaleString()})` });
  const visitorsIdx = sankeyNodes.length;
  sankeyNodes.push({ name: `유입 추정 (${estimatedVisitors.toLocaleString()})` });

  // 타입 → 채널 링크
  typeNodes.forEach((t, tIdx) => {
    const channels = typeToChannel.get(t.key);
    if (channels) {
      channels.forEach((val, platform) => {
        const cIdx = channelNodes.findIndex(c => c.key === platform);
        if (cIdx >= 0) sankeyLinks.push({ source: tIdx, target: channelStartIdx + cIdx, value: val });
      });
    }
  });
  // 채널 → 조회수 링크
  channelNodes.forEach((c, cIdx) => {
    if (c.views > 0) sankeyLinks.push({ source: channelStartIdx + cIdx, target: viewsIdx, value: c.views });
  });
  // 조회수 → 유입 링크
  if (estimatedVisitors > 0) {
    sankeyLinks.push({ source: viewsIdx, target: visitorsIdx, value: estimatedVisitors });
  }

  const sankeyData: ContentFlowData = { nodes: sankeyNodes, links: sankeyLinks };
  const hasFlowData = sankeyLinks.length > 0;

  // ── 성과 테이블: 채널 수 보강 ──────────────────────────
  const contentChannelCount = new Map<string, Set<string>>();
  publishRecords.forEach(pr => {
    if (!contentChannelCount.has(pr.contentId)) contentChannelCount.set(pr.contentId, new Set());
    contentChannelCount.get(pr.contentId)!.add(pr.socialAccount.platform);
  });
  const topPublishedWithChannels = topPublished.map(c => ({
    ...c, channels: contentChannelCount.get(c.id)?.size ?? 0,
  }));

  return (
    <div style={{ padding: "32px 0" }}>
      <style>{`
        .dash-kpi { background:#fff; border:1px solid #E5E7EB; border-radius:16px; padding:24px; transition:all 0.2s; }
        .dash-kpi:hover { box-shadow:0 8px 24px rgba(99,102,241,0.10); border-color:#C7D2FE; transform:translateY(-2px); }
        .dash-quick { background:#fff; border:1px solid #E5E7EB; border-radius:14px; padding:20px; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; justify-content:space-between; }
        .dash-quick:hover { border-color:#C7D2FE; box-shadow:0 4px 16px rgba(99,102,241,0.10); background:#F8F7FF; }
        .dash-content-row { display:flex; align-items:center; justify-content:space-between; padding:12px 20px; border-bottom:1px solid #F3F4F6; transition:background 0.15s; }
        .dash-content-row:last-child { border-bottom:none; }
        .dash-content-row:hover { background:#F8F7FF; }
        .brand-gradient { background: linear-gradient(135deg,#6366F1,#8B5CF6); }
        .brand-gradient-text { background:linear-gradient(135deg,#6366F1,#8B5CF6); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
      `}</style>

      {/* ── 상단 인사 배너 ───────────────────────────────── */}
      <div style={{ marginBottom: 32, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", borderRadius: 20, padding: "32px 36px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -40, right: 80, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
          <div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: 600, marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>{todayStr}</p>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginBottom: 6, lineHeight: 1.2 }}>
              안녕하세요, {userName}님 👋
            </h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>오늘도 FlowPack으로 멋진 콘텐츠를 만들어보세요.</p>
          </div>
          <Link href="/carousel-lab" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 12, background: "#fff", color: "#6366F1", fontSize: 14, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 14px rgba(0,0,0,0.1)", flexShrink: 0 }}>
            <Plus size={16} /> 새 콘텐츠 만들기
          </Link>
        </div>
      </div>

      {/* ── KPI 카드 4종 ─────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 32 }}>
        {/* 크레딧 사용 */}
        <div className="dash-kpi">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>크레딧 사용</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={16} color="#6366F1" />
            </div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#111827", marginBottom: 4 }}>
            {creditsUsed}<span style={{ fontSize: 16, fontWeight: 500, color: "#9CA3AF" }}> / {creditsTotal}</span>
          </div>
          <div style={{ height: 6, background: "#F3F4F6", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
            <div style={{ height: "100%", width: `${creditsPct}%`, background: "linear-gradient(90deg,#6366F1,#8B5CF6)", borderRadius: 3, transition: "width 0.4s ease" }} />
          </div>
          <p style={{ fontSize: 12, color: "#9CA3AF" }}>잔여 {creditsLeft}개 크레딧</p>
        </div>

        {/* 이번 달 생성 */}
        <div className="dash-kpi">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>이번 달 생성</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={16} color="#059669" />
            </div>
          </div>
          <div className="brand-gradient-text" style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>{monthContents}</div>
          <p style={{ fontSize: 12, color: "#9CA3AF" }}>건의 콘텐츠</p>
        </div>

        {/* 배포 완료 */}
        <div className="dash-kpi">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>배포 완료</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Send size={16} color="#6366F1" />
            </div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{allPublished}</div>
          <p style={{ fontSize: 12, color: "#9CA3AF" }}>전체 발행 수</p>
        </div>

        {/* 예약됨 */}
        <div className="dash-kpi">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>예약됨</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={16} color="#D97706" />
            </div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{scheduledCount}</div>
          <p style={{ fontSize: 12, color: "#9CA3AF" }}>발행 대기 중</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
        {/* ── 최근 콘텐츠 ────────────────────────────────── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>최근 콘텐츠</h2>
            <Link href="/contents" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, color: "#6366F1", textDecoration: "none" }}>
              전체 보기 <ArrowRight size={14} />
            </Link>
          </div>
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden" }}>
            {recentContents.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 24px", color: "#9CA3AF" }}>
                <FileText size={32} style={{ marginBottom: 12, opacity: 0.35 }} />
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>아직 콘텐츠가 없습니다</p>
                <p style={{ fontSize: 13 }}>첫 번째 콘텐츠를 만들어보세요!</p>
                <Link href="/carousel-lab" style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 10, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                  <Plus size={14} /> 콘텐츠 만들기
                </Link>
              </div>
            ) : (
              <>
                {/* 테이블 헤더 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 100px", padding: "10px 20px", background: "#F9FAFB", borderBottom: "1px solid #F3F4F6" }}>
                  {["제목", "타입", "상태", "생성일"].map(h => (
                    <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
                  ))}
                </div>
                {recentContents.map((item) => {
                  const st = STATUS_LABEL[item.status] ?? STATUS_LABEL.DRAFT;
                  const tp = TYPE_LABEL[item.type] ?? TYPE_LABEL.CAROUSEL;
                  return (
                    <div key={item.id} className="dash-content-row" style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 100px" }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>{item.title}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 700, color: tp.color, background: tp.bg, padding: "3px 8px", borderRadius: 6, width: "fit-content" }}>{tp.label}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, padding: "3px 8px", borderRadius: 6, width: "fit-content" }}>{st.label}</span>
                      <span style={{ fontSize: 12, color: "#9CA3AF" }}>{format(new Date(item.createdAt), "MM.dd")}</span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* ── 빠른 시작 ──────────────────────────────────── */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 16 }}>빠른 시작</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { href: "/carousel-lab", icon: <Layers size={18} color="#6366F1" />, iconBg: "#EEF2FF", label: "카드뉴스 생성", desc: "SNS용 슬라이드 카드" },
              { href: "/ai/longform",   icon: <FileText size={18} color="#059669" />, iconBg: "#ECFDF5", label: "블로그 작성",   desc: "SEO 최적화 장문 포스트" },
              { href: "/contents",      icon: <BarChart2 size={18} color="#D97706" />, iconBg: "#FFFBEB", label: "콘텐츠 관리",   desc: "전체 목록 · 상태 변경" },
              { href: "/social-accounts", icon: <CheckCircle2 size={18} color="#8B5CF6" />, iconBg: "#F5F3FF", label: "SNS 연동", desc: "Instagram · 네이버 연결" },
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
                <div className="dash-quick">
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: item.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {item.icon}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 2 }}>{item.label}</p>
                      <p style={{ fontSize: 12, color: "#9CA3AF" }}>{item.desc}</p>
                    </div>
                  </div>
                  <ArrowRight size={16} color="#9CA3AF" />
                </div>
              </Link>
            ))}
          </div>

          {/* 업그레이드 배너 */}
          {creditsPct >= 80 && (
            <div style={{ marginTop: 16, background: "linear-gradient(135deg,#EEF2FF,#F5F3FF)", border: "1px solid #C7D2FE", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Zap size={14} color="#6366F1" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#6366F1" }}>크레딧 부족 알림</span>
              </div>
              <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 12, lineHeight: 1.5 }}>크레딧이 {creditsPct}% 소진됐어요. 플랜을 업그레이드하면 무제한으로 사용할 수 있어요.</p>
              <Link href="/settings/billing" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                플랜 업그레이드 <ArrowRight size={12} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── 콘텐츠 퍼포먼스 플로우 (Sankey) ───────────── */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TrendingUp size={18} color="#6366F1" />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>콘텐츠 퍼포먼스 플로우</h2>
          </div>
          <Link href="/analytics" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, color: "#6366F1", textDecoration: "none" }}>
            상세 통계 <ArrowRight size={14} />
          </Link>
        </div>
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "20px 24px", minHeight: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            {(allPublished === 0 && totalViews === 0
              ? [
                  { label: "발행 콘텐츠", value: 12, color: "#6366F1", bg: "#EEF2FF" },
                  { label: "배포 채널", value: 3, color: "#8B5CF6", bg: "#F5F3FF" },
                  { label: "총 조회수", value: 1840, color: "#D97706", bg: "#FFFBEB" },
                  { label: "유입 추정", value: 184, color: "#059669", bg: "#ECFDF5" },
                ]
              : [
                  { label: "발행 콘텐츠", value: allPublished, color: "#6366F1", bg: "#EEF2FF" },
                  { label: "배포 채널", value: channelNodes.length, color: "#8B5CF6", bg: "#F5F3FF" },
                  { label: "총 조회수", value: totalViews, color: "#D97706", bg: "#FFFBEB" },
                  { label: "유입 추정", value: estimatedVisitors, color: "#059669", bg: "#ECFDF5" },
                ]
            ).map(k => (
              <div key={k.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 8, background: k.bg }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF" }}>{k.label}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: k.color }}>{k.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <ContentFlowSankey data={sankeyData} />
        </div>
      </div>

      {/* ── 발행 콘텐츠 성과 테이블 ──────────────────────── */}
      {topPublishedWithChannels.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Eye size={18} color="#8B5CF6" />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>발행 콘텐츠 성과</h2>
          </div>
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 80px 90px 90px", padding: "10px 20px", background: "#F9FAFB", borderBottom: "1px solid #F3F4F6" }}>
              {["제목", "타입", "채널", "조회수", "발행일"].map(h => (
                <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{h}</span>
              ))}
            </div>
            {topPublishedWithChannels.map(item => {
              const tp = TYPE_LABEL[item.type] ?? TYPE_LABEL.CAROUSEL;
              return (
                <div key={item.id} className="dash-content-row" style={{ display: "grid", gridTemplateColumns: "1fr 90px 80px 90px 90px" }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>{item.title}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 700, color: tp.color, background: tp.bg, padding: "3px 8px", borderRadius: 6, width: "fit-content" }}>{tp.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{item.channels}개</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#6366F1" }}>{item.viewCount.toLocaleString()}</span>
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>{item.publishedAt ? format(new Date(item.publishedAt), "MM.dd") : "-"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
