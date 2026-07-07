// 홈 대시보드 - Server Component (DB 데이터 실사용)
import type { ReactElement } from "react";
import {
  ArrowRight,
  BarChart2,
  CheckCircle2,
  Eye,
  FileText,
  Layers,
  MousePointerClick,
  Plus,
  Send,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { startOfMonth, endOfMonth, format } from "date-fns";
import ContentFlowSankey from "@/components/charts/content-flow-sankey";
import type { ContentFlowData } from "@/components/charts/content-flow-sankey";

const STATUS_LABEL: Record<string, { label: string; textClass: string; bgClass: string }> = {
  DRAFT: { label: "초안", textClass: "text-fp-muted", bgClass: "bg-fp-inactive-bg" },
  SCHEDULED: { label: "예약됨", textClass: "text-fp-warning", bgClass: "bg-fp-warning-bg" },
  PUBLISHED: { label: "발행 완료", textClass: "text-brand-500", bgClass: "bg-fp-primary-subtle" },
  ARCHIVED: { label: "보관됨", textClass: "text-fp-inactive", bgClass: "bg-fp-inactive-bg" },
};

const TYPE_LABEL: Record<string, { label: string; textClass: string; bgClass: string }> = {
  CAROUSEL: { label: "카드뉴스", textClass: "text-brand-500", bgClass: "bg-fp-primary-subtle" },
  BLOG: { label: "블로그", textClass: "text-uv", bgClass: "bg-uv/10" },
  VIDEO: { label: "영상", textClass: "text-chart-red", bgClass: "bg-chart-red/10" },
  BULK: { label: "대량", textClass: "text-chart-orange", bgClass: "bg-chart-orange/10" },
  URL_TO_POST: { label: "URL 변환", textClass: "text-chart-blue", bgClass: "bg-chart-blue/10" },
};

function getProgressWidthClass(percent: number): string {
  if (percent >= 100) return "w-full";
  if (percent >= 90) return "w-11/12";
  if (percent >= 80) return "w-10/12";
  if (percent >= 70) return "w-9/12";
  if (percent >= 60) return "w-8/12";
  if (percent >= 50) return "w-7/12";
  if (percent >= 40) return "w-6/12";
  if (percent >= 30) return "w-5/12";
  if (percent >= 20) return "w-4/12";
  if (percent >= 10) return "w-3/12";
  if (percent > 0) return "w-2/12";
  return "w-0";
}

export default async function HomePage(): Promise<ReactElement> {
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
  const creditsPct = creditsTotal > 0 ? Math.min(Math.round((creditsUsed / creditsTotal) * 100), 100) : 0;
  const creditsLeft = creditsTotal - creditsUsed;

  // ── Sankey 데이터 변환 ──────────────────────────────────
  const platformLabel: Record<string, string> = {
    INSTAGRAM: "Instagram",
    FACEBOOK: "Facebook",
    TWITTER: "X (Twitter)",
    LINKEDIN: "LinkedIn",
    NAVER_BLOG: "네이버 블로그",
    WORDPRESS: "WordPress",
  };

  const typeNodes = typeBreakdown.map((t) => ({
    key: t.type, label: `${TYPE_LABEL[t.type]?.label ?? t.type} (${t._count})`, count: t._count,
  }));

  const channelAgg = new Map<string, { count: number; views: number }>();
  publishRecords.forEach((pr) => {
    const platform = pr.socialAccount.platform;
    const cur = channelAgg.get(platform) ?? { count: 0, views: 0 };
    cur.count += 1;
    cur.views += pr.content.viewCount ?? 0;
    channelAgg.set(platform, cur);
  });
  const channelNodes = Array.from(channelAgg.entries()).map(([platform, agg]) => ({
    key: platform, label: `${platformLabel[platform] ?? platform} (${agg.views})`, views: agg.views, count: agg.count,
  }));

  const totalViews = Array.from(channelAgg.values()).reduce((s, c) => s + c.views, 0);
  const estimatedVisitors = Math.round(totalViews * 0.1);

  const typeToChannel = new Map<string, Map<string, number>>();
  publishRecords.forEach((pr) => {
    const type = pr.content.type;
    const platform = pr.socialAccount.platform;
    const channelMap = typeToChannel.get(type) ?? new Map<string, number>();
    channelMap.set(platform, (channelMap.get(platform) ?? 0) + 1);
    typeToChannel.set(type, channelMap);
  });

  const sankeyNodes: { name: string }[] = [];
  const sankeyLinks: { source: number; target: number; value: number }[] = [];

  typeNodes.forEach((t) => sankeyNodes.push({ name: t.label }));
  const channelStartIdx = sankeyNodes.length;
  channelNodes.forEach((c) => sankeyNodes.push({ name: c.label }));
  const viewsIdx = sankeyNodes.length;
  sankeyNodes.push({ name: `총 조회수 (${totalViews.toLocaleString()})` });
  const visitorsIdx = sankeyNodes.length;
  sankeyNodes.push({ name: `유입 추정 (${estimatedVisitors.toLocaleString()})` });

  typeNodes.forEach((t, tIdx) => {
    const channels = typeToChannel.get(t.key);
    if (channels) {
      channels.forEach((val, platform) => {
        const cIdx = channelNodes.findIndex((c) => c.key === platform);
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
  publishRecords.forEach((pr) => {
    if (!contentChannelCount.has(pr.contentId)) contentChannelCount.set(pr.contentId, new Set());
    const platforms = contentChannelCount.get(pr.contentId);
    platforms?.add(pr.socialAccount.platform);
  });
  const topPublishedWithChannels = topPublished.map((c) => ({
    ...c, channels: contentChannelCount.get(c.id)?.size ?? 0,
  }));

  const progressWidthClass = getProgressWidthClass(creditsPct);
  const kpiCards = [
    {
      label: "크레딧 사용",
      value: creditsUsed.toLocaleString(),
      suffix: `/ ${creditsTotal.toLocaleString()}`,
      description: `잔여 ${creditsLeft.toLocaleString()}개 크레딧`,
      icon: <Zap size={20} className="text-brand-500" />,
      iconBg: "bg-fp-primary-subtle",
      valueClass: "text-fp-heading",
    },
    {
      label: "이번 달 생성",
      value: monthContents.toLocaleString(),
      suffix: "건",
      description: "이번 달 만든 콘텐츠",
      icon: <Sparkles size={20} className="text-brand-500" />,
      iconBg: "bg-fp-primary-subtle",
      valueClass: "bg-gradient-to-r from-brand-500 to-uv bg-clip-text text-transparent",
    },
    {
      label: "배포 완료",
      value: allPublished.toLocaleString(),
      suffix: "건",
      description: `예약 대기 ${scheduledCount.toLocaleString()}건`,
      icon: <Send size={20} className="text-uv" />,
      iconBg: "bg-uv/10",
      valueClass: "text-fp-heading",
    },
    {
      label: "총 클릭수",
      value: totalClicks.toLocaleString(),
      suffix: "회",
      description: "추적 링크 클릭 합계",
      icon: <MousePointerClick size={20} className="text-chart-orange" />,
      iconBg: "bg-chart-orange/10",
      valueClass: "text-chart-orange",
    },
  ];

  const quickActions = [
    { href: "/carousel-lab", icon: <Layers size={20} className="text-brand-500" />, iconBg: "bg-fp-primary-subtle", label: "카드뉴스 생성", desc: "SNS용 슬라이드 카드" },
    { href: "/ai/longform", icon: <FileText size={20} className="text-uv" />, iconBg: "bg-uv/10", label: "블로그 글 생성", desc: "AI 블로그 초안 작성" },
    { href: "/contents", icon: <BarChart2 size={20} className="text-chart-orange" />, iconBg: "bg-chart-orange/10", label: "콘텐츠 관리", desc: "전체 목록과 상태 변경" },
    { href: "/social-accounts", icon: <CheckCircle2 size={20} className="text-chart-blue" />, iconBg: "bg-chart-blue/10", label: "SNS 연동", desc: "Instagram과 네이버 연결" },
  ];

  return (
    <div className="space-y-10 py-8 lg:py-10">
      <section className="relative overflow-hidden rounded-2xl border border-fp-primary-border bg-fp-card-bg px-6 py-7 shadow-card md:px-8 lg:px-10 lg:py-9">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-fp-primary-subtle to-transparent opacity-70" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-3 font-mono text-sm font-semibold text-fp-muted">{todayStr}</p>
            <h1 className="mb-3 text-3xl font-extrabold leading-tight text-fp-heading md:text-4xl">
              안녕하세요, {userName}님
            </h1>
            <p className="max-w-2xl text-base font-medium leading-relaxed text-fp-secondary md:text-lg">
              오늘 확인할 콘텐츠 현황과 배포 흐름을 한 화면에서 정리했습니다.
            </p>
          </div>
          <Link href="/carousel-lab" className="inline-flex h-12 shrink-0 items-center justify-center gap-2.5 rounded-2xl bg-brand-500 px-7 text-base font-bold text-black no-underline transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Plus size={18} /> 새 콘텐츠 만들기
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <article key={card.label} className="rounded-2xl border border-fp-border bg-fp-card-bg p-6 transition-colors hover:border-fp-border-strong md:p-7">
            <div className="mb-5 flex items-center justify-between gap-4">
              <span className="font-mono text-sm font-bold text-fp-muted">{card.label}</span>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.iconBg}`}>
                {card.icon}
              </div>
            </div>
            <div className={`mb-3 font-mono text-4xl font-extrabold leading-none tabular-nums md:text-[42px] ${card.valueClass}`}>
              {card.value}
              <span className="ml-2 text-lg font-semibold text-fp-muted">{card.suffix}</span>
            </div>
            {card.label === "크레딧 사용" && (
              <div className="mb-4 h-2.5 overflow-hidden rounded-full bg-fp-border">
                <div className={`h-full rounded-full bg-gradient-to-r from-brand-500 to-uv transition-[width] duration-500 ${progressWidthClass}`} />
              </div>
            )}
            <p className="text-sm font-medium text-fp-muted md:text-base">{card.description}</p>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        <div>
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-fp-heading">최근 콘텐츠</h2>
            <Link href="/contents" className="inline-flex items-center gap-1.5 text-base font-semibold text-brand-500 no-underline hover:text-brand-600">
              전체 보기 <ArrowRight size={15} />
            </Link>
          </div>
          <div className="overflow-hidden rounded-2xl border border-fp-border bg-fp-card-bg shadow-card">
            {recentContents.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-7 py-16 text-center text-fp-muted">
                <FileText size={40} className="mb-5 opacity-45" />
                <p className="mb-2 text-lg font-bold text-fp-heading">아직 콘텐츠가 없습니다</p>
                <p className="text-base">첫 번째 콘텐츠를 만들어보세요.</p>
                <Link href="/carousel-lab" className="mt-6 inline-flex h-11 items-center gap-2 rounded-2xl bg-brand-500 px-6 text-sm font-bold text-black no-underline transition-colors hover:bg-brand-600">
                  <Plus size={15} /> 콘텐츠 만들기
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[680px]">
                  <div className="grid grid-cols-[minmax(0,1fr)_120px_120px_120px] border-b border-fp-border-soft bg-fp-section-bg px-7 py-4">
                    {["제목", "타입", "상태", "생성일"].map((h) => (
                      <span key={h} className="font-mono text-sm font-bold text-fp-muted">{h}</span>
                    ))}
                  </div>
                  <div>
                    {recentContents.map((item, idx) => {
                      const status = STATUS_LABEL[item.status] ?? STATUS_LABEL.DRAFT;
                      const type = TYPE_LABEL[item.type] ?? TYPE_LABEL.CAROUSEL;
                      return (
                        <div key={item.id} className={`grid grid-cols-[minmax(0,1fr)_120px_120px_120px] items-center px-7 py-5 transition-colors hover:bg-fp-section-bg ${idx !== recentContents.length - 1 ? "border-b border-fp-border-soft" : ""}`}>
                          <span className="overflow-hidden text-ellipsis whitespace-nowrap pr-5 text-base font-semibold text-fp-heading">{item.title}</span>
                          <span className={`inline-flex w-fit items-center rounded-full px-3 py-1.5 text-sm font-bold ${type.textClass} ${type.bgClass}`}>{type.label}</span>
                          <span className={`inline-flex w-fit items-center rounded-full px-3 py-1.5 text-sm font-bold ${status.textClass} ${status.bgClass}`}>{status.label}</span>
                          <span className="font-mono text-sm font-semibold text-fp-muted">{format(new Date(item.createdAt), "MM.dd")}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-6 text-xl font-bold text-fp-heading">빠른 시작</h2>
          <div className="flex flex-col gap-4">
            {quickActions.map((item) => (
              <Link key={item.href} href={item.href} className="no-underline">
                <div className="flex cursor-pointer items-center justify-between gap-5 rounded-2xl border border-fp-border bg-fp-card-bg p-5 transition-colors hover:border-fp-primary-border hover:bg-fp-section-bg md:p-6">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.iconBg}`}>
                      {item.icon}
                    </div>
                    <div>
                      <p className="mb-1 text-base font-bold text-fp-heading">{item.label}</p>
                      <p className="text-sm font-medium text-fp-secondary md:text-base">{item.desc}</p>
                    </div>
                  </div>
                  <ArrowRight size={18} className="text-fp-muted" />
                </div>
              </Link>
            ))}
          </div>

          {creditsPct >= 80 && (
            <div className="mt-6 rounded-2xl border border-fp-primary-border bg-fp-card-bg px-6 py-5 shadow-card">
              <div className="mb-3 flex items-center gap-2.5">
                <Zap size={16} className="text-brand-500" />
                <span className="text-sm font-bold text-brand-500">크레딧 부족 알림</span>
              </div>
              <p className="mb-5 text-sm font-medium leading-relaxed text-fp-secondary md:text-base">크레딧이 {creditsPct}% 소진됐습니다. 플랜을 업그레이드하면 더 많은 콘텐츠를 만들 수 있습니다.</p>
              <Link href="/settings/billing" className="inline-flex h-10 items-center gap-2 rounded-2xl bg-brand-500 px-5 text-sm font-bold text-black no-underline transition-colors hover:bg-brand-600">
                플랜 업그레이드 <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <TrendingUp size={20} className="text-brand-500" />
            <h2 className="text-xl font-bold text-fp-heading">콘텐츠 퍼포먼스 플로우</h2>
          </div>
          <Link href="/analytics" className="inline-flex items-center gap-1.5 text-base font-semibold text-brand-500 no-underline hover:text-brand-600">
            상세 통계 <ArrowRight size={15} />
          </Link>
        </div>
        <div className="min-h-[260px] rounded-2xl border border-fp-border bg-fp-card-bg px-6 py-7 shadow-card md:px-8">
          <div className="mb-6 flex flex-wrap items-center gap-4">
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
            ).map((k) => (
              <div key={k.label} className={`flex items-center gap-2.5 rounded-full px-4 py-2.5 ${k.bgClass}`}>
                <span className="text-sm font-semibold text-fp-muted">{k.label}</span>
                <span className={`font-mono text-xl font-extrabold tabular-nums ${k.textClass}`}>{k.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <ContentFlowSankey data={sankeyData} showDummyIfEmpty={!hasFlowData} />
        </div>
      </section>

      {topPublishedWithChannels.length > 0 && (
        <section>
          <div className="mb-6 flex items-center gap-2.5">
            <Eye size={20} className="text-uv" />
            <h2 className="text-xl font-bold text-fp-heading">발행 콘텐츠 성과</h2>
          </div>
          <div className="overflow-hidden rounded-2xl border border-fp-border bg-fp-card-bg shadow-card">
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[minmax(0,1fr)_100px_90px_100px_100px_100px] border-b border-fp-border-soft bg-fp-section-bg px-7 py-4">
                  {["제목", "타입", "채널", "조회수", "클릭수", "발행일"].map((h) => (
                    <span key={h} className="font-mono text-sm font-bold text-fp-muted">{h}</span>
                  ))}
                </div>
                <div>
                  {topPublishedWithChannels.map((item, idx) => {
                    const type = TYPE_LABEL[item.type] ?? TYPE_LABEL.CAROUSEL;
                    const itemClicks = publishRecords
                      .filter((pr) => pr.contentId === item.id)
                      .reduce((sum, pr) => sum + (pr.clickCount ?? 0), 0);
                    return (
                      <div key={item.id} className={`grid grid-cols-[minmax(0,1fr)_100px_90px_100px_100px_100px] items-center px-7 py-5 transition-colors hover:bg-fp-section-bg ${idx !== topPublishedWithChannels.length - 1 ? "border-b border-fp-border-soft" : ""}`}>
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap pr-5 text-base font-semibold text-fp-heading">{item.title}</span>
                        <span className={`inline-flex w-fit items-center rounded-full px-3 py-1.5 text-sm font-bold ${type.textClass} ${type.bgClass}`}>{type.label}</span>
                        <span className="text-base font-semibold text-fp-body">{item.channels}개</span>
                        <span className="font-mono text-base font-bold text-brand-500 tabular-nums">{item.viewCount.toLocaleString()}</span>
                        <span className="font-mono text-base font-bold text-chart-orange tabular-nums">{itemClicks.toLocaleString()}</span>
                        <span className="font-mono text-sm font-semibold text-fp-muted">{item.publishedAt ? format(new Date(item.publishedAt), "MM.dd") : "-"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
