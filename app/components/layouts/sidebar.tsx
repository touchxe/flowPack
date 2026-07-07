"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Zap, LayoutDashboard, Layers, FileText, Link as LinkIcon,
  CalendarDays, Share2, BarChart3, Settings, List,
  ChevronDown,
  MessageCircle, Bell, Image as ImageIcon,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";

/* ── 네비게이션 데이터 ── */
interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  badgeVariant?: "mint" | "uv" | "orange";
}
interface NavSection {
  title: string;
  icon?: React.ReactNode;
  items: NavItem[];
  collapsible?: boolean;
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "AI로 콘텐츠 제작",
    icon: <Zap size={14} />,
    collapsible: true,
    items: [
      { label: "카드뉴스 생성", href: "/carousel-lab", icon: <Layers size={17} />, badge: "추천", badgeVariant: "mint" },
      { label: "블로그 글 생성", href: "/ai/longform", icon: <FileText size={17} /> },
      { label: "URL → 콘텐츠", href: "/ai/bulk-link-to-post", icon: <LinkIcon size={17} /> },
      { label: "대량 기획", href: "/ai/bulk-generate", icon: <Layers size={17} />, badge: "Beta", badgeVariant: "uv" },
    ],
  },
  {
    title: "콘텐츠 관리",
    icon: <List size={14} />,
    collapsible: true,
    items: [
      { label: "콘텐츠 목록", href: "/contents", icon: <List size={17} /> },
      { label: "수정피드", href: "/review-feeds", icon: <MessageCircle size={17} /> },
      { label: "콘텐츠 캘린더", href: "/calendar", icon: <CalendarDays size={17} /> },
    ],
  },
];

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { label: "미디어 라이브러리", href: "/media", icon: <ImageIcon size={17} />, badge: "New", badgeVariant: "mint" },
  { label: "SNS 연동", href: "/social-accounts", icon: <Share2 size={17} /> },
  { label: "통계", href: "/analytics", icon: <BarChart3 size={17} /> },
  { label: "설정", href: "/settings", icon: <Settings size={17} /> },
];

/* ── Props ── */
interface SidebarProps {
  usagePercent?: number;
  usageLabel?: string;
  planName?: string;
  className?: string;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({
  usagePercent = 0,
  usageLabel = "0/10건",
  planName = "FREE",
  className,
  onCollapsedChange,
}: SidebarProps): React.ReactElement {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = React.useState(false);
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>(
    Object.fromEntries(NAV_SECTIONS.map((s) => [s.title, true]))
  );

  const handleCollapse = (val: boolean) => {
    setCollapsed(val);
    onCollapsedChange?.(val);
  };

  const toggleSection = (title: string) =>
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));

  /* 사용자 이니셜 */
  const initials = (session?.user?.name ?? session?.user?.email ?? "U")
    .slice(0, 2).toUpperCase();

  const renderNavItem = (item: NavItem) => {
    const active = pathname === item.href ||
      (item.href.length > 1 && pathname.startsWith(item.href + "/"));

    let badgeClass = "bg-fp-primary-subtle text-brand-500";
    if (item.badgeVariant === "uv") badgeClass = "bg-uv/15 text-uv";
    if (item.badgeVariant === "orange") badgeClass = "bg-chart-orange/15 text-chart-orange";

    return (
      <Link key={item.href} href={item.href} className="no-underline block">
        <div
          title={collapsed ? item.label : undefined}
          className={`mb-1 flex min-h-11 items-center rounded-xl transition-colors cursor-pointer ${
            collapsed ? "justify-center px-0 py-3" : "justify-start gap-3 px-3.5 py-3"
          } ${active ? "bg-sb-active" : "bg-transparent hover:bg-sb-hover"}`}
        >
          <span className={`flex shrink-0 transition-colors ${active ? "text-sb-accent" : "text-sb-muted"}`}>
            {item.icon}
          </span>
          {!collapsed && (
            <>
              <span className={`flex-1 whitespace-nowrap text-sm ${active ? "font-bold text-sb-text" : "font-medium text-sb-muted"}`}>
                {item.label}
              </span>
              {item.badge && (
                <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${badgeClass}`}>
                  {item.badge}
                </span>
              )}
            </>
          )}
        </div>
      </Link>
    );
  };

  return (
    <aside
      className={`${className || ""} sticky top-0 z-50 flex h-screen shrink-0 flex-col overflow-hidden border-r border-[color:var(--sb-border)] bg-sb-bg transition-[width] duration-200 ease-in-out ${collapsed ? "w-[72px]" : "w-[256px]"}`}
    >
      {/* ── 로고 헤더 ── */}
      <div className={`flex h-16 shrink-0 items-center border-b border-[color:var(--sb-border)] ${collapsed ? "justify-center px-4" : "justify-between gap-3 px-4"}`}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fp-primary-subtle shadow-glow">
            <Zap size={18} className="text-brand-500" />
          </div>
          {!collapsed && (
            <div>
              <div className="text-lg font-extrabold leading-tight text-sb-text">
                FlowPack
              </div>
              <div className="text-[11px] font-semibold text-sb-muted">워크스페이스 관리</div>
            </div>
          )}
        </div>
        {/* 접기 버튼 */}
        <button
          onClick={() => handleCollapse(!collapsed)}
          className="flex shrink-0 cursor-pointer rounded-lg border-none bg-transparent p-1.5 text-sb-muted transition-colors hover:bg-sb-hover hover:text-sb-text"
          title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* ── 내비게이션 ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-5">

        {/* ── 홈 대시보드 ── */}
        {(() => {
          const homeActive = pathname === "/home";
          return (
            <Link href="/home" className="mb-3 block no-underline">
              <div
                title={collapsed ? "홈 대시보드" : undefined}
                className={`flex min-h-11 items-center rounded-xl transition-colors cursor-pointer ${
                  collapsed ? "justify-center px-0 py-3" : "justify-start gap-3 px-3.5 py-3"
                } ${homeActive ? "bg-sb-active" : "bg-transparent hover:bg-sb-hover"}`}
              >
                <span className={`flex shrink-0 transition-colors ${homeActive ? "text-sb-accent" : "text-sb-muted"}`}>
                  <LayoutDashboard size={18} />
                </span>
                {!collapsed && (
                  <span className={`flex-1 whitespace-nowrap text-sm ${homeActive ? "font-bold text-sb-text" : "font-semibold text-sb-muted"}`}>
                    홈 대시보드
                  </span>
                )}
              </div>
            </Link>
          );
        })()}

        {/* ── 구분선 ── */}
        <div className="mx-1 mb-4 h-px bg-[color:var(--sb-border)]" />

        {NAV_SECTIONS.map((section) => {
          const isOpen = openSections[section.title] !== false;
          return (
            <div key={section.title} className="mb-5">
              {/* 섹션 헤더 */}
              {!collapsed && (
                <button
                  onClick={() => section.collapsible && toggleSection(section.title)}
                  className={`mb-2 flex w-full items-center gap-2 rounded-lg border-none bg-transparent px-2 py-1.5 ${section.collapsible ? "cursor-pointer hover:bg-sb-hover" : "cursor-default"}`}
                >
                  <span className="text-sb-accent flex opacity-80">{section.icon}</span>
                  <span className="flex-1 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-sb-muted">
                    {section.title}
                  </span>
                  {section.collapsible && (
                    <span className={`text-sb-muted flex transition-transform duration-200 opacity-60 ${isOpen ? "rotate-0" : "-rotate-90"}`}>
                      <ChevronDown size={14} />
                    </span>
                  )}
                </button>
              )}

              {/* 메뉴 아이템 */}
              {(!section.collapsible || isOpen) && section.items.map(renderNavItem)}
            </div>
          );
        })}
      </nav>

      {/* ── 하단 관리 메뉴 ── */}
      <div className={`border-t border-[color:var(--sb-border)] ${collapsed ? "px-2 py-3" : "px-4 py-4"}`}>
        {!collapsed && (
          <div className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-sb-muted">
            관리 도구
          </div>
        )}
        <div className="flex flex-col">
          {BOTTOM_NAV_ITEMS.map(renderNavItem)}
        </div>
      </div>

      {/* ── 사용자 정보 ── */}
      <div className={`flex flex-col gap-3 border-t border-[color:var(--sb-border)] ${collapsed ? "items-center px-0 py-4" : "items-stretch px-4 py-4"}`}>
        {/* 플랜 정보 */}
        {!collapsed && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-sb-muted">
            <span className="text-sb-accent font-bold">{planName}</span>
            <span className="text-[color:var(--sb-border)]">|</span>
            <span>AI {usageLabel}</span>
          </div>
        )}

        {/* 아바타 행 */}
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          <div className="flex items-center gap-2">
            {/* 아바타 — 브랜드 민트 단색 */}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="로그아웃"
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border-none bg-brand-500"
            >
              <span className="text-xs font-extrabold text-black">{initials}</span>
            </button>
            {!collapsed && (
              <span className="max-w-[130px] overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-sb-muted">
                {session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "사용자"}
              </span>
            )}
          </div>
          {!collapsed && (
            <div className="flex gap-0.5">
              <button className="flex cursor-pointer rounded-lg border-none bg-transparent p-1.5 text-sb-muted transition-colors hover:bg-sb-hover hover:text-sb-text">
                <MessageCircle size={17} />
              </button>
              <button className="flex cursor-pointer rounded-lg border-none bg-transparent p-1.5 text-sb-muted transition-colors hover:bg-sb-hover hover:text-sb-text">
                <Bell size={17} />
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
