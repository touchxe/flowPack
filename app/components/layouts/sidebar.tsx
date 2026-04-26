"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Zap, LayoutDashboard, Layers, FileText, Link as LinkIcon,
  CalendarDays, Share2, BarChart3, Settings, List,
  ChevronDown,
  Gift, MessageCircle, Bell, BookOpen, Image as ImageIcon,
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
    icon: <Zap size={12} />,
    collapsible: true,
    items: [
      { label: "카드뉴스 생성",  href: "/carousel-lab",        icon: <Layers size={15} />,  badge: "추천", badgeVariant: "mint" },
      { label: "블로그 글 생성",    href: "/ai/longform",          icon: <FileText size={15} /> },
      { label: "URL → 콘텐츠",  href: "/ai/bulk-link-to-post", icon: <LinkIcon size={15} /> },
      { label: "대량 기획",     href: "/ai/bulk-generate",     icon: <Layers size={15} />,  badge: "Beta", badgeVariant: "uv" },
      { label: "작성 지침",     href: "/instructions",         icon: <BookOpen size={15} /> },
    ],
  },
  {
    title: "콘텐츠 관리",
    icon: <List size={12} />,
    collapsible: true,
    items: [
      { label: "콘텐츠 목록",       href: "/contents",         icon: <List size={15} /> },
      { label: "미디어 라이브러리", href: "/media",            icon: <ImageIcon size={15} />, badge: "New", badgeVariant: "mint" },
      { label: "콘텐츠 캘린더",     href: "/calendar",         icon: <CalendarDays size={15} /> },
      { label: "SNS 연동",          href: "/social-accounts",  icon: <Share2 size={15} /> },
      { label: "통계",              href: "/analytics",        icon: <BarChart3 size={15} /> },
      { label: "설정",              href: "/settings",         icon: <Settings size={15} /> },
    ],
  },
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

  return (
    <aside
      className={`${className || ""} flex flex-col shrink-0 h-screen bg-sb-bg border-r border-[color:var(--sb-border)] sticky top-0 overflow-hidden z-50 transition-[width] duration-200 ease-in-out ${collapsed ? "w-16" : "w-[224px]"}`}
    >
      {/* ── 로고 헤더 ── */}
      <div className={`h-14 shrink-0 flex items-center border-b border-[color:var(--sb-border)] ${collapsed ? "px-4 justify-center" : "px-3.5 justify-between gap-2"}`}>
        <div className="flex items-center gap-[9px] min-w-0">
          <div className="w-8 h-8 rounded-[9px] shrink-0 bg-fp-primary-subtle flex items-center justify-center shadow-glow">
            <Zap size={15} className="text-brand-500" />
          </div>
          {!collapsed && (
            <div>
              <div className="text-[15px] font-extrabold text-sb-text tracking-[-0.01em] leading-tight">
                FlowPack
              </div>
              <div className="text-[10px] text-sb-muted font-medium">워크스페이스 관리</div>
            </div>
          )}
        </div>
        {/* 접기 버튼 */}
        <button
          onClick={() => handleCollapse(!collapsed)}
          className="bg-transparent border-none p-1 cursor-pointer text-sb-muted rounded-md flex shrink-0 transition-colors hover:text-sb-text"
          title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* ── 내비게이션 ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-[16px_14px]">

        {/* ── 홈 대시보드 ── */}
        {(() => {
          const homeActive = pathname === "/home";
          return (
            <Link href="/home" className="no-underline block mb-2">
              <div
                title={collapsed ? "홈 대시보드" : undefined}
                className={`flex items-center rounded-[10px] mb-0 transition-colors cursor-pointer ${
                  collapsed ? "gap-0 py-3 justify-center" : "gap-2.5 px-3 py-2.5 justify-start"
                } ${homeActive ? "bg-sb-active" : "bg-transparent hover:bg-sb-hover"}`}
              >
                <span className={`flex shrink-0 transition-colors ${homeActive ? "text-sb-accent" : "text-sb-muted"}`}>
                  <LayoutDashboard size={16} />
                </span>
                {!collapsed && (
                  <span className={`flex-1 text-[13px] whitespace-nowrap ${homeActive ? "font-bold text-sb-text" : "font-medium text-sb-muted"}`}>
                    홈 대시보드
                  </span>
                )}
              </div>
            </Link>
          );
        })()}

        {/* ── 구분선 ── */}
        <div className="h-[1px] bg-[color:var(--sb-border)] m-[4px_4px_12px]" />

        {NAV_SECTIONS.map((section) => {
          const isOpen = openSections[section.title] !== false;
          return (
            <div key={section.title} className="mb-3">
              {/* 섹션 헤더 */}
              {!collapsed && (
                <button
                  onClick={() => section.collapsible && toggleSection(section.title)}
                  className={`w-full bg-transparent border-none flex items-center gap-1.5 p-[4px_8px_6px_6px] rounded-md mb-1 ${section.collapsible ? "cursor-pointer" : "cursor-default"}`}
                >
                  <span className="text-sb-accent flex opacity-80">{section.icon}</span>
                  <span className="flex-1 text-[10px] font-bold text-sb-muted text-left tracking-[0.08em] uppercase">
                    {section.title}
                  </span>
                  {section.collapsible && (
                    <span className={`text-sb-muted flex transition-transform duration-200 opacity-60 ${isOpen ? "rotate-0" : "-rotate-90"}`}>
                      <ChevronDown size={12} />
                    </span>
                  )}
                </button>
              )}

              {/* 메뉴 아이템 */}
              {(!section.collapsible || isOpen) && section.items.map((item) => {
                const active = pathname === item.href ||
                  (item.href.length > 1 && pathname.startsWith(item.href + "/"));
                
                // 뱃지 클래스 매핑
                let badgeClass = "bg-fp-primary-subtle text-brand-500";
                if (item.badgeVariant === "uv") badgeClass = "bg-uv/15 text-uv";
                if (item.badgeVariant === "orange") badgeClass = "bg-chart-orange/15 text-chart-orange";

                return (
                  <Link key={item.href} href={item.href} className="no-underline block">
                    <div
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center rounded-[10px] mb-0.5 transition-colors cursor-pointer ${
                        collapsed ? "gap-0 py-3 justify-center" : "gap-2.5 px-3 py-2.5 justify-start"
                      } ${active ? "bg-sb-active" : "bg-transparent hover:bg-sb-hover"}`}
                    >
                      <span className={`flex shrink-0 transition-colors ${active ? "text-sb-accent" : "text-sb-muted"}`}>
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <>
                          <span className={`flex-1 text-[13px] whitespace-nowrap ${active ? "font-semibold text-sb-text" : "font-normal text-sb-muted"}`}>
                            {item.label}
                          </span>
                          {item.badge && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeClass}`}>
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* ── 하단 CTA (펼쳐진 상태만) ── */}
      {!collapsed && (
        <div className="p-[8px_14px_12px] flex flex-col gap-1.5">
          <Link href="/social-accounts" className="no-underline">
            <button className="w-full border border-[color:var(--sb-border)] bg-transparent rounded-[9px] px-3 py-2 flex items-center gap-[7px] cursor-pointer transition-colors hover:bg-sb-hover">
              <Share2 size={13} className="text-sb-accent" />
              <span className="text-xs font-medium text-sb-muted">SNS 계정 연동·관리</span>
            </button>
          </Link>
          {/* 친구 초대 버튼 — 브랜드 민트 단색 */}
          <button className="w-full border-none bg-brand-500 rounded-[9px] px-3 py-2 flex items-center gap-[7px] cursor-pointer hover:opacity-90 transition-opacity">
            <Gift size={13} className="text-black" />
            <span className="text-xs font-semibold text-black">친구 초대하고 할인받기</span>
          </button>
        </div>
      )}

      {/* ── 사용자 정보 ── */}
      <div className={`border-t border-[color:var(--sb-border)] flex flex-col gap-2 ${collapsed ? "py-3 px-0 items-center" : "py-3.5 px-4 items-stretch"}`}>
        {/* 플랜 정보 */}
        {!collapsed && (
          <div className="flex items-center gap-[5px] text-[11px] text-sb-muted font-semibold">
            <span className="text-sb-accent font-bold">{planName}</span>
            <span className="text-[color:var(--sb-border)]">|</span>
            <span>AI {usageLabel}</span>
          </div>
        )}

        {/* 아바타 행 */}
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          <div className="flex items-center gap-2">
            {/* 아바타 — 브랜드 민트 단색 */}
            <div
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="로그아웃"
              className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center cursor-pointer shrink-0"
            >
              <span className="text-[11px] font-extrabold text-black">{initials}</span>
            </div>
            {!collapsed && (
              <span className="text-[13px] font-medium text-sb-muted overflow-hidden text-ellipsis whitespace-nowrap max-w-[100px]">
                {session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "사용자"}
              </span>
            )}
          </div>
          {!collapsed && (
            <div className="flex gap-0.5">
              <button className="bg-transparent border-none p-1 cursor-pointer text-sb-muted rounded-md flex transition-colors hover:text-sb-text">
                <MessageCircle size={15} />
              </button>
              <button className="bg-transparent border-none p-1 cursor-pointer text-sb-muted rounded-md flex transition-colors hover:text-sb-text">
                <Bell size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
