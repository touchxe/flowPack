"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Zap, LayoutDashboard, Layers, FileText, Link as LinkIcon,
  CalendarDays, Share2, BarChart3, Settings, List,
  ChevronDown, ChevronLeft, ChevronRight,
  Gift, UserCircle2, MessageCircle, Bell,
} from "lucide-react";

/* ── 네비게이션 데이터 ── */
interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  badgeVariant?: "indigo" | "violet" | "orange";
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
    icon: <Zap size={13} />,
    collapsible: true,
    items: [
      { label: "카드뉴스 생성",  href: "/carousel-lab",        icon: <Layers size={15} />,  badge: "추천", badgeVariant: "indigo" },
      { label: "블로그 글 생성",    href: "/ai/longform",          icon: <FileText size={15} /> },
      { label: "URL → 콘텐츠",  href: "/ai/bulk-link-to-post", icon: <LinkIcon size={15} /> },
      { label: "대량 기획",     href: "/ai/bulk-generate",     icon: <Layers size={15} />,  badge: "Beta", badgeVariant: "violet" },
    ],
  },
  {
    title: "콘텐츠 관리",
    icon: <List size={13} />,
    items: [
      { label: "홈 대시보드",    href: "/home",             icon: <LayoutDashboard size={15} /> },
      { label: "콘텐츠 목록",    href: "/contents",         icon: <List size={15} /> },
      { label: "콘텐츠 캘린더",  href: "/calendar",         icon: <CalendarDays size={15} /> },
      { label: "SNS 연동",       href: "/social-accounts",  icon: <Share2 size={15} /> },
      { label: "통계",           href: "/analytics",        icon: <BarChart3 size={15} /> },
      { label: "설정",           href: "/settings",         icon: <Settings size={15} /> },
    ],
  },
];

/* ── 뱃지 ── */
const BADGE_STYLES: Record<string, React.CSSProperties> = {
  indigo: { background: "#EEF2FF", color: "#6366F1" },
  violet: { background: "#F5F3FF", color: "#8B5CF6" },
  orange: { background: "#FFF7ED", color: "#F97316" },
};

/* ── Props ── */
interface SidebarProps {
  usagePercent?: number;
  usageLabel?: string;
  planName?: string;
  className?: string;
}

export function Sidebar({
  usagePercent = 0,
  usageLabel = "0/10건",
  planName = "FREE",
  className,
}: SidebarProps): React.ReactElement {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = React.useState(false);
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>(
    Object.fromEntries(NAV_SECTIONS.map((s) => [s.title, true]))
  );

  const toggleSection = (title: string) =>
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));

  /* 사용자 이니셜 */
  const initials = (session?.user?.name ?? session?.user?.email ?? "U")
    .slice(0, 2).toUpperCase();

  return (
    <aside
      className={className}
      style={{
        width: collapsed ? 64 : 220,
        flexShrink: 0,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        borderRight: "1px solid #F0F0F0",
        position: "sticky",
        top: 0,
        transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden",
      }}
    >
      {/* ── 로고 헤더 ── */}
      <div style={{
        height: 56, flexShrink: 0,
        display: "flex", alignItems: "center",
        padding: collapsed ? "0 16px" : "0 14px",
        borderBottom: "1px solid #F0F0F0",
        justifyContent: collapsed ? "center" : "space-between",
        gap: 8,
      }}>
        {/* 로고 + 텍스트 */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: "linear-gradient(135deg,#6366F1,#8B5CF6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(99,102,241,0.28)",
          }}>
            <Zap size={15} color="#fff" />
          </div>
          {!collapsed && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", letterSpacing: "-0.01em", lineHeight: 1.1 }}>
                FlowPack
              </div>
              <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 500 }}>워크스페이스 관리</div>
            </div>
          )}
        </div>
        {/* 접기 버튼 */}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            style={{ background: "none", border: "none", padding: 4, cursor: "pointer", color: "#C4C9D4", borderRadius: 6, display: "flex", flexShrink: 0 }}
            title="사이드바 접기"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            style={{ position: "absolute", right: -12, top: 18, background: "#fff", border: "1px solid #E5E7EB", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", zIndex: 10 }}
            title="사이드바 펼치기"
          >
            <ChevronRight size={13} color="#9CA3AF" />
          </button>
        )}
      </div>

      {/* ── 내비게이션 ── */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "10px 8px" }}>
        {NAV_SECTIONS.map((section) => {
          const isOpen = openSections[section.title] !== false;
          return (
            <div key={section.title} style={{ marginBottom: 6 }}>
              {/* 섹션 헤더 */}
              {!collapsed && (
                <button
                  onClick={() => section.collapsible && toggleSection(section.title)}
                  style={{
                    width: "100%", background: "none", border: "none",
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "5px 8px 5px 6px", borderRadius: 6, cursor: "pointer",
                    marginBottom: 2,
                  }}
                >
                  <span style={{ color: "#6366F1", display: "flex" }}>{section.icon}</span>
                  <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "#6366F1", textAlign: "left", letterSpacing: "0.01em" }}>
                    {section.title}
                  </span>
                  {section.collapsible && (
                    <span style={{ color: "#C4C9D4", display: "flex", transition: "transform 0.2s", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}>
                      <ChevronDown size={13} />
                    </span>
                  )}
                </button>
              )}

              {/* 메뉴 아이템 */}
              {(!section.collapsible || isOpen) && section.items.map((item) => {
                const active = pathname === item.href || (item.href !== "/home" && pathname.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href} style={{ textDecoration: "none", display: "block" }}>
                    <div
                      title={collapsed ? item.label : undefined}
                      style={{
                        display: "flex", alignItems: "center",
                        gap: collapsed ? 0 : 8,
                        padding: collapsed ? "8px 0" : "7px 10px",
                        justifyContent: collapsed ? "center" : "flex-start",
                        borderRadius: 8, marginBottom: 1,
                        background: active ? "#EEF2FF" : "transparent",
                        transition: "background 0.12s",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#F9FAFB"; }}
                      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                    >
                      <span style={{ color: active ? "#6366F1" : "#9CA3AF", display: "flex", flexShrink: 0, transition: "color 0.12s" }}>
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? "#6366F1" : "#374151", whiteSpace: "nowrap" }}>
                            {item.label}
                          </span>
                          {item.badge && (
                            <span style={{
                              fontSize: 10, fontWeight: 700,
                              padding: "2px 6px", borderRadius: 4,
                              ...BADGE_STYLES[item.badgeVariant ?? "indigo"],
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

              {/* 섹션 구분선 */}
              {!collapsed && (
                <div style={{ height: 1, background: "#F3F4F6", margin: "8px 4px 4px" }} />
              )}
            </div>
          );
        })}
      </nav>

      {/* ── 하단 CTA 버튼 ── */}
      {!collapsed && (
        <div style={{ padding: "10px 10px 6px", display: "flex", flexDirection: "column", gap: 6 }}>
          {/* SNS 연동 */}
          <Link href="/social-accounts" style={{ textDecoration: "none" }}>
            <button style={{
              width: "100%", border: "1px solid #E5E7EB", background: "#fff",
              borderRadius: 10, padding: "9px 12px",
              display: "flex", alignItems: "center", gap: 7,
              cursor: "pointer", transition: "background 0.12s",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              <Share2 size={14} color="#6366F1" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>SNS 계정 연동·관리</span>
            </button>
          </Link>
          {/* 친구 초대 */}
          <button style={{
            width: "100%", border: "none",
            background: "linear-gradient(90deg,#F97316,#FB923C)",
            borderRadius: 10, padding: "9px 12px",
            display: "flex", alignItems: "center", gap: 7,
            cursor: "pointer", boxShadow: "0 2px 8px rgba(249,115,22,0.2)",
          }}>
            <Gift size={14} color="#fff" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>친구 초대하고 할인받기</span>
          </button>
        </div>
      )}

      {/* ── 플랜 정보 + 아바타 ── */}
      <div style={{
        borderTop: "1px solid #F0F0F0",
        padding: collapsed ? "10px 0" : "10px 12px",
        display: "flex", flexDirection: "column", gap: 8,
        alignItems: collapsed ? "center" : "stretch",
      }}>
        {/* 플랜 정보 한 줄 */}
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>
            <span style={{ color: "#6366F1", fontWeight: 700 }}>{planName}</span>
            <span style={{ color: "#E5E7EB" }}>|</span>
            <span>AI {usageLabel}</span>
            <span style={{ color: "#E5E7EB" }}>|</span>
            <span>SNS 관리</span>
          </div>
        )}

        {/* 아바타 행 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between" }}>
          {/* 아바타 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              onClick={() => signOut({ callbackUrl: `${window.location.origin}/login` })}
              title="로그아웃"
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "linear-gradient(135deg,#6366F1,#8B5CF6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>{initials}</span>
            </div>
            {!collapsed && (
              <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>
                {session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "사용자"}
              </span>
            )}
          </div>
          {/* 우측 아이콘 */}
          {!collapsed && (
            <div style={{ display: "flex", gap: 2 }}>
              <button style={{ background: "none", border: "none", padding: 5, cursor: "pointer", color: "#9CA3AF", borderRadius: 6, display: "flex" }}>
                <MessageCircle size={15} />
              </button>
              <button style={{ background: "none", border: "none", padding: 5, cursor: "pointer", color: "#9CA3AF", borderRadius: 6, display: "flex" }}>
                <Bell size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
