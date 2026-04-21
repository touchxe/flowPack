"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Zap, LayoutDashboard, Layers, FileText, Link as LinkIcon,
  CalendarDays, Share2, BarChart3, Settings, List,
  ChevronDown, ChevronLeft, ChevronRight,
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

/* ── 뱃지 스타일 — The Verge ── */
const BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  mint:   { bg: "rgba(60,255,208,0.15)", color: "#3cffd0" },
  uv:     { bg: "rgba(82,0,255,0.15)",   color: "#a78bfa" },
  orange: { bg: "rgba(255,159,67,0.15)", color: "#ff9f43" },
};

/* ── Props ── */
interface SidebarProps {
  usagePercent?: number;
  usageLabel?: string;
  planName?: string;
  className?: string;
  /** AppLayout에서 collapsed 상태를 공유하기 위한 콜백 */
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

  /* The Verge: Canvas Black 통일 */
  const SB = {
    bg:     "#131313",
    hover:  "#1e1e1e",
    active: "#2d2d2d",
    text:   "#ffffff",
    muted:  "#949494",
    border: "rgba(255,255,255,0.08)",
    accent: "#3cffd0",
  };

  return (
    <aside
      className={className}
      style={{
        width: collapsed ? 64 : 224,
        flexShrink: 0,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: SB.bg,
        borderRight: `1px solid ${SB.border}`,
        position: "sticky",
        top: 0,
        transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden",
        zIndex: 50,
      }}
    >
      {/* ── 로고 헤더 ── */}
      <div style={{
        height: 56, flexShrink: 0,
        display: "flex", alignItems: "center",
        padding: collapsed ? "0 16px" : "0 14px",
        borderBottom: `1px solid ${SB.border}`,
        justifyContent: collapsed ? "center" : "space-between",
        gap: 8,
      }}>
        {/* 로고 + 텍스트 */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: "rgba(60,255,208,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 0 1px rgba(60,255,208,0.3)",
          }}>
            <Zap size={15} color="#3cffd0" />
          </div>
          {!collapsed && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: SB.text, letterSpacing: "-0.01em", lineHeight: 1.1 }}>
                FlowPack
              </div>
              <div style={{ fontSize: 10, color: SB.muted, fontWeight: 500 }}>워크스페이스 관리</div>
            </div>
          )}
        </div>
        {/* 접기 버튼 */}
        <button
          onClick={() => handleCollapse(!collapsed)}
          style={{
            background: "none", border: "none", padding: 4,
            cursor: "pointer", color: SB.muted,
            borderRadius: 6, display: "flex", flexShrink: 0,
            transition: "color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = SB.text)}
          onMouseLeave={e => (e.currentTarget.style.color = SB.muted)}
          title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* ── 내비게이션 ── */}
      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "16px 14px" }}>

        {/* ── 홈 대시보드 ── */}
        {(() => {
          const homeActive = pathname === "/home";
          return (
            <Link href="/home" style={{ textDecoration: "none", display: "block", marginBottom: 8 }}>
              <div
                title={collapsed ? "홈 대시보드" : undefined}
                style={{
                  display: "flex", alignItems: "center",
                  gap: collapsed ? 0 : 10,
                  padding: collapsed ? "12px 0" : "10px 12px",
                  justifyContent: collapsed ? "center" : "flex-start",
                  borderRadius: 10, marginBottom: 0,
                  background: homeActive ? SB.active : "transparent",
                  transition: "all 0.15s",
                  cursor: "pointer",
                }}
                onMouseEnter={e => { if (!homeActive) e.currentTarget.style.background = SB.hover; }}
                onMouseLeave={e => { if (!homeActive) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ color: homeActive ? SB.accent : SB.muted, display: "flex", flexShrink: 0, transition: "color 0.12s" }}>
                  <LayoutDashboard size={16} />
                </span>
                {!collapsed && (
                  <span style={{ flex: 1, fontSize: 13, fontWeight: homeActive ? 700 : 500, color: homeActive ? SB.text : SB.muted, whiteSpace: "nowrap" }}>
                    홈 대시보드
                  </span>
                )}
              </div>
            </Link>
          );
        })()}

        {/* ── 구분선 ── */}
        <div style={{ height: 1, background: SB.border, margin: "4px 4px 12px" }} />

        {NAV_SECTIONS.map((section) => {
          const isOpen = openSections[section.title] !== false;
          return (
            <div key={section.title} style={{ marginBottom: 12 }}>
              {/* 섹션 헤더 */}
              {!collapsed && (
                <button
                  onClick={() => section.collapsible && toggleSection(section.title)}
                  style={{
                    width: "100%", background: "none", border: "none",
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "4px 8px 6px 6px", borderRadius: 6, cursor: section.collapsible ? "pointer" : "default",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: SB.accent, display: "flex", opacity: 0.8 }}>{section.icon}</span>
                  <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: SB.muted, textAlign: "left", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {section.title}
                  </span>
                  {section.collapsible && (
                    <span style={{ color: SB.muted, display: "flex", transition: "transform 0.2s", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)", opacity: 0.6 }}>
                      <ChevronDown size={12} />
                    </span>
                  )}
                </button>
              )}

              {/* 메뉴 아이템 */}
              {(!section.collapsible || isOpen) && section.items.map((item) => {
                const active = pathname === item.href ||
                  (item.href.length > 1 && pathname.startsWith(item.href + "/"));
                return (
                  <Link key={item.href} href={item.href} style={{ textDecoration: "none", display: "block" }}>
                    <div
                      title={collapsed ? item.label : undefined}
                      style={{
                        display: "flex", alignItems: "center",
                        gap: collapsed ? 0 : 10,
                        padding: collapsed ? "12px 0" : "10px 12px",
                        justifyContent: collapsed ? "center" : "flex-start",
                        borderRadius: 10, marginBottom: 2,
                        background: active ? SB.active : "transparent",
                        transition: "all 0.12s",
                        cursor: "pointer",
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = SB.hover; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                    >
                      <span style={{ color: active ? SB.accent : SB.muted, display: "flex", flexShrink: 0, transition: "color 0.12s" }}>
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 600 : 400, color: active ? SB.text : SB.muted, whiteSpace: "nowrap" }}>
                            {item.label}
                          </span>
                          {item.badge && (
                            <span style={{
                              fontSize: 10, fontWeight: 600,
                              padding: "2px 6px", borderRadius: 4,
                              background: BADGE_STYLES[item.badgeVariant ?? "mint"].bg,
                              color: BADGE_STYLES[item.badgeVariant ?? "mint"].color,
                            }}>
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
        <div style={{ padding: "8px 14px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          <Link href="/social-accounts" style={{ textDecoration: "none" }}>
            <button style={{
              width: "100%", border: `1px solid ${SB.border}`,
              background: "rgba(255,255,255,0.04)",
              borderRadius: 9, padding: "8px 12px",
              display: "flex", alignItems: "center", gap: 7,
              cursor: "pointer", transition: "background 0.12s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = SB.hover)}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            >
              <Share2 size={13} color={SB.accent} />
              <span style={{ fontSize: 12, fontWeight: 500, color: SB.muted }}>SNS 계정 연동·관리</span>
            </button>
          </Link>
          <button style={{
            width: "100%", border: "none",
            background: "linear-gradient(90deg,#3cffd0,#30d9b2)",
            borderRadius: 9, padding: "8px 12px",
            display: "flex", alignItems: "center", gap: 7,
            cursor: "pointer",
          }}>
            <Gift size={13} color="#131313" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#131313" }}>친구 초대하고 할인받기</span>
          </button>
        </div>
      )}

      {/* ── 사용자 정보 ── */}
      <div style={{
        borderTop: `1px solid ${SB.border}`,
        padding: collapsed ? "12px 0" : "14px 16px",
        display: "flex", flexDirection: "column", gap: 8,
        alignItems: collapsed ? "center" : "stretch",
      }}>
        {/* 플랜 정보 */}
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: SB.muted, fontWeight: 600 }}>
            <span style={{ color: SB.accent, fontWeight: 700 }}>{planName}</span>
            <span style={{ color: SB.border }}>|</span>
            <span>AI {usageLabel}</span>
          </div>
        )}

        {/* 아바타 행 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="로그아웃"
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "rgba(60,255,208,0.15)",
                border: "1px solid rgba(60,255,208,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 800, color: "#3cffd0" }}>{initials}</span>
            </div>
            {!collapsed && (
              <span style={{ fontSize: 13, fontWeight: 500, color: SB.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>
                {session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "사용자"}
              </span>
            )}
          </div>
          {!collapsed && (
            <div style={{ display: "flex", gap: 2 }}>
              <button style={{ background: "none", border: "none", padding: 4, cursor: "pointer", color: SB.muted, borderRadius: 6, display: "flex", transition: "color 0.12s" }}
                onMouseEnter={e => (e.currentTarget.style.color = SB.text)}
                onMouseLeave={e => (e.currentTarget.style.color = SB.muted)}>
                <MessageCircle size={15} />
              </button>
              <button style={{ background: "none", border: "none", padding: 4, cursor: "pointer", color: SB.muted, borderRadius: 6, display: "flex", transition: "color 0.12s" }}
                onMouseEnter={e => (e.currentTarget.style.color = SB.text)}
                onMouseLeave={e => (e.currentTarget.style.color = SB.muted)}>
                <Bell size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
