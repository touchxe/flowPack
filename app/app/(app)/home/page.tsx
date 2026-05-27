// 홈 대시보드 — Server Component (DB 데이터 실사용)
// The Verge Design System — Canvas Black + Jelly Mint + Ultraviolet
import { FileText, Send, Plus, ArrowRight, Zap, Layers, BarChart2, CheckCircle2, Clock, Sparkles, Eye, TrendingUp, MousePointerClick } from "lucide-react";
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

/* ── The Verge 상태/타입 라벨 (Tailwind 클래스로 전환) ── */
const STATUS_LABEL: Record<string, { label: string; textClass: string; bgClass: string }> = {
  DRAFT:     { label: "초안",     textClass: "text-fp-muted",     bgClass: "bg-fp-inactive-bg" },
  SCHEDULED: { label: "예약됨",   textClass: "text-fp-warning",  bgClass: "bg-fp-warning-bg" },
  PUBLISHED: { label: "발행완료", textClass: "text-brand-500",   bgClass: "bg-fp-primary-subtle" },
  ARCHIVED:  { label: "보관됨",   textClass: "text-fp-inactive", bgClass: "bg-fp-inactive-bg" },
};

const TYPE_LABEL: Record<string, { label: string; textClass: string; bgClass: string }> = {
  CAROUSEL:    { label: "카드뉴스", textClass: "text-brand-500",    bgClass: "bg-fp-primary-subtle" },
  BLOG:        { label: "블로그",   textClass: "text-uv",           bgClass: "bg-uv/10" },
  VIDEO:       { label: "영상",     textClass: "text-chart-red",    bgClass: "bg-chart-red/10" },
  BULK:        { label: "대량",     textClass: "text-chart-orange", bgClass: "bg-chart-orange/10" },
  URL_TO_POST: { label: "URL변환",  textClass: "text-chart-blue",   bgClass: "bg-chart-blue/10" },
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
    // 채널별 배포 기록 (Sankey용 + 클릭 추적)
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
    }),
  ]);

  // 총 클릭수 집계 (리다이렉트 추적)
  const totalClicks = publishRecords.reduce((sum, pr) => sum + (pr.clickCount ?? 0), 0);

  const creditsUsed = user?.creditsUsed ?? 0;
  const creditsTotal = user?.creditsTotal ?? 10;
  const creditsPct = Math.min(Math.round((creditsUsed / creditsTotal) * 100), 100);
  const creditsLeft = creditsTotal - creditsUsed;

  // ── Sankey 데이터 변환 ──────────────────────────────────
  const PLATFORM_LABEL: Record<string, string> = {
    INSTAGRAM: "Instagram", FACEBOOK: "Facebook", TWITTER: "X (Twitter)",
    LINKEDIN: "LinkedIn", NAVER_BLOG: "네이버블로그", WORDPRESS: "WordPress",
  };

  const typeNodes = typeBreakdown.map(t => ({
    key: t.type, label: `${TYPE_LABEL[t.type]?.label ?? t.type} (${t._count})`, count: t._count,
  }));

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

  const typeToChannel = new Map<string, Map<string, number>>();
  publishRecords.forEach(pr => {
    const type = pr.content.type;
    const platform = pr.socialAccount.platform;
    if (!typeToChannel.has(type)) typeToChannel.set(type, new Map());
    const m = typeToChannel.get(type)!;
    m.set(platform, (m.get(platform) ?? 0) + 1);
  });

  const sankeyNodes: { name: string }[] = [];
  const sankeyLinks: { source: number; target: number; value: number }[] = [];

  typeNodes.forEach(t => sankeyNodes.push({ name: t.label }));
  const channelStartIdx = sankeyNodes.length;
  channelNodes.forEach(c => sankeyNodes.push({ name: c.label }));
  const viewsIdx = sankeyNodes.length;
  sankeyNodes.push({ name: `총 조회수 (${totalViews.toLocaleString()})` });
  const visitorsIdx = sankeyNodes.length;
  sankeyNodes.push({ name: `유입 추정 (${estimatedVisitors.toLocaleString()})` });

  typeNodes.forEach((t, tIdx) => {
    const channels = typeToChannel.get(t.key);
    if (channels) {
      channels.forEach((val, platform) => {
        const cIdx = channelNodes.findIndex(c => c.key === platform);
        if (cIdx >= 0) sankeyLinks.push({ source: tIdx, target: channelStartIdx + cIdx, value: val });
      });
    }
  });
  channelNodes.forEach((c, cIdx) => {
    if (c.views > 0) sankeyLinks.push({ source: channelStartIdx + cIdx, target: viewsIdx, value: c.views });
  });
  if (estimatedVisitors > 0) {
    sankeyLinks.push({ source: viewsIdx, target: visitorsIdx, value: estimatedVisitors });
  }

  const sankeyData: ContentFlowData = { nodes: sankeyNodes, links: sankeyLinks };
  const hasFlowData = sankeyLinks.length > 0;

  const contentChannelCount = new Map<string, Set<string>>();
  publishRecords.forEach(pr => {
    if (!contentChannelCount.has(pr.contentId)) contentChannelCount.set(pr.contentId, new Set());
    contentChannelCount.get(pr.contentId)!.add(pr.socialAccount.platform);
  });
  const topPublishedWithChannels = topPublished.map(c => ({
    ...c, channels: contentChannelCount.get(c.id)?.size ?? 0,
  }));

  return (
    <div className="dashboard-relaxed py-10">
      <style>{`
        .dashboard-relaxed .text-fp-muted { color:#4B5563 !important; }
        .dashboard-relaxed .text-fp-secondary { color:#374151 !important; }
        .dashboard-relaxed .text-fp-heading { color:#0F172A !important; }
        .dashboard-relaxed .text-fp-body { color:#1F2937 !important; }
      `}</style>
      {/* ── 상단 인사 배너 ── */}
      <div className="mb-10 bg-fp-card-bg border border-fp-primary-border rounded-[22px] px-10 py-9 relative overflow-hidden shadow-card">
        <div className="absolute -top-[60px] -right-[60px] w-[240px] h-[240px] rounded-full bg-brand-500/[0.04] pointer-events-none" />
        <div className="absolute -bottom-[40px] right-20 w-[160px] h-[160px] rounded-full bg-uv/[0.06] pointer-events-none" />
        <div className="flex items-center justify-between gap-8 relative">
          <div>
            <p className="text-sm text-fp-muted font-semibold mb-2 tracking-[0.04em] uppercase font-mono">{todayStr}</p>
            <h1 className="text-[30px] font-extrabold text-fp-heading mb-2 leading-tight">
              안녕하세요, {userName}님 👋
            </h1>
            <p className="text-base text-fp-secondary">오늘도 FlowPack으로 멋진 콘텐츠를 만들어보세요.</p>
          </div>
          <Link href="/carousel-lab" className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-3xl bg-brand-500 text-fp-page-bg text-[15px] font-bold no-underline shrink-0 hover:bg-brand-600 transition-colors">
            <Plus size={17} /> 새 콘텐츠 만들기
          </Link>
        </div>
      </div>

      {/* ── KPI 카드 4종 ── */}
      <div className="grid grid-cols-4 gap-5 mb-10">
        {/* 크레딧 사용 */}
        <div className="bg-fp-card-bg border border-fp-border rounded-[22px] p-7 transition-all hover:border-fp-border-strong">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] font-bold text-fp-muted uppercase tracking-[0.06em] font-mono">크레딧 사용</span>
            <div className="w-9 h-9 rounded-xl bg-fp-primary-subtle flex items-center justify-center">
              <Zap size={18} className="text-brand-500" />
            </div>
          </div>
          <div className="text-[36px] font-extrabold text-fp-heading mb-2">
            {creditsUsed}<span className="text-lg font-medium text-fp-muted">/ {creditsTotal}</span>
          </div>
          <div className="h-2 bg-fp-border rounded-[4px] overflow-hidden mb-3">
            <div
              className="h-full rounded-[4px] transition-[width] duration-400 ease-out"
              style={{ width: `${creditsPct}%`, background: "var(--brand-gradient)" }}
            />
          </div>
          <p className="text-[13px] text-fp-muted font-medium">잔여 {creditsLeft}개 크레딧</p>
        </div>

        {/* 이번 달 생성 */}
        <div className="bg-fp-card-bg border border-fp-border rounded-[22px] p-7 transition-all hover:border-fp-border-strong">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] font-bold text-fp-muted uppercase tracking-[0.06em] font-mono">이번 달 생성</span>
            <div className="w-9 h-9 rounded-xl bg-fp-primary-subtle flex items-center justify-center">
              <Sparkles size={18} className="text-brand-500" />
            </div>
          </div>
          <div className="text-[36px] font-extrabold mb-2 bg-clip-text text-transparent" style={{ background: "linear-gradient(135deg, var(--brand-500), var(--uv))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {monthContents}
          </div>
          <p className="text-[13px] text-fp-muted font-medium">건의 콘텐츠</p>
        </div>

        {/* 배포 완료 */}
        <div className="bg-fp-card-bg border border-fp-border rounded-[22px] p-7 transition-all hover:border-fp-border-strong">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] font-bold text-fp-muted uppercase tracking-[0.06em] font-mono">배포 완료</span>
            <div className="w-9 h-9 rounded-xl bg-fp-primary-subtle flex items-center justify-center">
              <Send size={18} className="text-uv" />
            </div>
          </div>
          <div className="text-[36px] font-extrabold text-fp-heading mb-2">{allPublished}</div>
          <p className="text-[13px] text-fp-muted font-medium">전체 발행 수</p>
        </div>

        {/* 총 클릭수 */}
        <div className="bg-fp-card-bg border border-fp-border rounded-[22px] p-7 transition-all hover:border-fp-border-strong">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] font-bold text-fp-muted uppercase tracking-[0.06em] font-mono">총 클릭수</span>
            <div className="w-9 h-9 rounded-xl bg-chart-orange/10 flex items-center justify-center">
              <MousePointerClick size={18} className="text-chart-orange" />
            </div>
          </div>
          <div className="text-[36px] font-extrabold text-chart-orange mb-2">{totalClicks.toLocaleString()}</div>
          <p className="text-[13px] text-fp-muted font-medium">추적 링크 클릭 합계</p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-8">
        {/* ── 최근 콘텐츠 ── */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-fp-heading">최근 콘텐츠</h2>
            <Link href="/contents" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-500 no-underline hover:text-brand-600">
              전체 보기 <ArrowRight size={15} />
            </Link>
          </div>
          <div className="bg-fp-card-bg border border-fp-border rounded-[22px] overflow-hidden shadow-card">
            {recentContents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-18 px-7 text-fp-muted">
                <FileText size={36} className="mb-4 opacity-45" />
                <p className="text-base font-semibold mb-1.5 text-fp-heading">아직 콘텐츠가 없습니다</p>
                <p className="text-sm">첫 번째 콘텐츠를 만들어보세요!</p>
                <Link href="/carousel-lab" className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-3xl bg-brand-500 text-fp-page-bg text-sm font-bold no-underline hover:bg-brand-600 transition-colors">
                  <Plus size={15} /> 콘텐츠 만들기
                </Link>
              </div>
            ) : (
              <>
                {/* 테이블 헤더 */}
                <div className="grid grid-cols-[1fr_108px_108px_108px] px-6 py-3.5 bg-fp-section-bg border-b border-fp-border-soft">
                  {["제목", "타입", "상태", "생성일"].map(h => (
                    <span key={h} className="text-xs font-bold text-fp-muted uppercase tracking-[0.06em] font-mono">{h}</span>
                  ))}
                </div>
                <div>
                  {recentContents.map((item, idx) => {
                    const st = STATUS_LABEL[item.status] ?? STATUS_LABEL.DRAFT;
                    const tp = TYPE_LABEL[item.type] ?? TYPE_LABEL.CAROUSEL;
                    return (
                      <div key={item.id} className={`grid grid-cols-[1fr_108px_108px_108px] items-center justify-between px-6 py-4 transition-colors hover:bg-fp-section-bg ${idx !== recentContents.length - 1 ? 'border-b border-fp-border-soft' : ''}`}>
                        <span className="text-sm font-semibold text-fp-heading overflow-hidden text-ellipsis whitespace-nowrap pr-4">{item.title}</span>
                        <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full w-fit ${tp.textClass} ${tp.bgClass}`}>{tp.label}</span>
                        <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full w-fit ${st.textClass} ${st.bgClass}`}>{st.label}</span>
                        <span className="text-[13px] font-medium text-fp-muted">{format(new Date(item.createdAt), "MM.dd")}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── 빠른 시작 ── */}
        <div>
          <h2 className="text-lg font-bold text-fp-heading mb-5">빠른 시작</h2>
          <div className="flex flex-col gap-3.5">
            {[
              { href: "/carousel-lab",    icon: <Layers size={18} className="text-brand-500" />,      iconBg: "bg-fp-primary-subtle",  label: "카드뉴스 생성",  desc: "SNS용 슬라이드 카드" },
              { href: "/ai/longform",     icon: <FileText size={18} className="text-uv" />,      iconBg: "bg-uv/10",             label: "블로그 글 생성",     desc: "AI 블로그 초안 작성" },
              { href: "/contents",        icon: <BarChart2 size={18} className="text-chart-orange" />,  iconBg: "bg-chart-orange/10",   label: "콘텐츠 관리",     desc: "전체 목록 · 상태 변경" },
              { href: "/social-accounts", icon: <CheckCircle2 size={18} className="text-chart-blue" />, iconBg: "bg-chart-blue/10",    label: "SNS 연동",          desc: "Instagram · 네이버 연결" },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="no-underline">
                <div className="bg-fp-card-bg border border-fp-border rounded-[22px] p-6 cursor-pointer transition-all flex items-center justify-between gap-4 hover:border-[rgba(var(--brand-rgb),0.3)] hover:bg-fp-section-bg">
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${item.iconBg}`}>
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-fp-heading mb-1">{item.label}</p>
                      <p className="text-[13px] font-medium text-fp-secondary">{item.desc}</p>
                    </div>
                  </div>
                  <ArrowRight size={17} className="text-fp-muted" />
                </div>
              </Link>
            ))}
          </div>

          {/* 업그레이드 배너 */}
          {creditsPct >= 80 && (
            <div className="mt-5 bg-fp-card-bg border border-fp-primary-border rounded-[22px] px-6 py-5 shadow-card">
              <div className="flex items-center gap-2.5 mb-2.5">
                <Zap size={15} className="text-brand-500" />
                <span className="text-[13px] font-bold text-brand-500">크레딧 부족 알림</span>
              </div>
              <p className="text-[13px] font-medium text-fp-secondary mb-4 leading-relaxed">크레딧이 {creditsPct}% 소진됐어요. 플랜을 업그레이드하면 무제한으로 사용할 수 있어요.</p>
              <Link href="/settings/billing" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-3xl bg-brand-500 text-fp-page-bg text-[13px] font-bold no-underline hover:bg-brand-600 transition-colors">
                플랜 업그레이드 <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── 콘텐츠 퍼포먼스 플로우 (Sankey) ── */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <TrendingUp size={20} className="text-brand-500" />
            <h2 className="text-lg font-bold text-fp-heading">콘텐츠 퍼포먼스 플로우</h2>
          </div>
          <Link href="/analytics" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-500 no-underline hover:text-brand-600">
            상세 통계 <ArrowRight size={15} />
          </Link>
        </div>
        <div className="bg-fp-card-bg border border-fp-border rounded-[22px] py-6 px-7 min-h-[220px] shadow-card">
          <div className="flex items-center gap-5 mb-5 flex-wrap">
            {(allPublished === 0 && totalViews === 0
              ? [
                  { label: "유입 추정", value: 184, textClass: "text-chart-blue", bgClass: "bg-chart-blue/10" },
                ]
              : [
                  { label: "발행 콘텐츠", value: allPublished, textClass: "text-brand-500", bgClass: "bg-fp-primary-subtle" },
                  { label: "배포 채널", value: channelNodes.length, textClass: "text-uv", bgClass: "bg-uv/10" },
                  { label: "총 조회수", value: totalViews, textClass: "text-brand-500", bgClass: "bg-fp-primary-subtle" },
                  { label: "유입 추정", value: estimatedVisitors, textClass: "text-chart-blue", bgClass: "bg-chart-blue/10" },
                ]
            ).map(k => (
              <div key={k.label} className={`flex items-center gap-2.5 px-4 py-2 rounded-full ${k.bgClass}`}>
                <span className="text-xs font-semibold text-fp-muted">{k.label}</span>
                <span className={`text-lg font-extrabold ${k.textClass}`}>{k.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <ContentFlowSankey data={sankeyData} />
        </div>
      </div>

      {/* ── 발행 콘텐츠 성과 테이블 ── */}
      {topPublishedWithChannels.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2.5 mb-5">
            <Eye size={20} className="text-uv" />
            <h2 className="text-lg font-bold text-fp-heading">발행 콘텐츠 성과</h2>
          </div>
          <div className="bg-fp-card-bg border border-fp-border rounded-[22px] overflow-hidden shadow-card">
            <div className="grid grid-cols-[1fr_88px_78px_88px_88px_88px] px-6 py-3.5 bg-fp-section-bg border-b border-fp-border-soft">
              {["제목", "타입", "채널", "조회수", "클릭수", "발행일"].map(h => (
                <span key={h} className="text-xs font-bold text-fp-muted uppercase tracking-[0.06em] font-mono">{h}</span>
              ))}
            </div>
            <div>
              {topPublishedWithChannels.map((item, idx) => {
                const tp = TYPE_LABEL[item.type] ?? TYPE_LABEL.CAROUSEL;
                const itemClicks = publishRecords
                  .filter(pr => pr.contentId === item.id)
                  .reduce((sum, pr) => sum + (pr.clickCount ?? 0), 0);
                return (
                  <div key={item.id} className={`grid grid-cols-[1fr_88px_78px_88px_88px_88px] items-center px-6 py-4 transition-colors hover:bg-fp-section-bg ${idx !== topPublishedWithChannels.length - 1 ? 'border-b border-fp-border-soft' : ''}`}>
                    <span className="text-sm font-semibold text-fp-heading overflow-hidden text-ellipsis whitespace-nowrap pr-4">{item.title}</span>
                    <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full w-fit ${tp.textClass} ${tp.bgClass}`}>{tp.label}</span>
                    <span className="text-sm font-semibold text-fp-body">{item.channels}개</span>
                    <span className="text-sm font-bold text-brand-500">{item.viewCount.toLocaleString()}</span>
                    <span className="text-sm font-bold text-chart-orange">{itemClicks.toLocaleString()}</span>
                    <span className="text-[13px] font-medium text-fp-muted">{item.publishedAt ? format(new Date(item.publishedAt), "MM.dd") : "-"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
