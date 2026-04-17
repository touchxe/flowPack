"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell, ChevronDown, ChevronRight, LogOut,
  Settings, User, Zap, X,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/* 경로 → 브레드크럼 */
const PATH_META: Record<string, { title: string; parent?: string }> = {
  "/home":                 { title: "홈 대시보드" },
  "/carousel-lab":         { title: "카드뉴스 생성",  parent: "AI 콘텐츠 제작" },
  "/ai/longform":          { title: "블로그 글 생성",    parent: "AI 콘텐츠 제작" },
  "/ai/bulk-link-to-post": { title: "URL → 콘텐츠",  parent: "AI 콘텐츠 제작" },
  "/ai/bulk-generate":     { title: "대량 기획",      parent: "AI 콘텐츠 제작" },
  "/contents":             { title: "콘텐츠 목록",    parent: "콘텐츠 관리" },
  "/calendar":             { title: "콘텐츠 캘린더",  parent: "콘텐츠 관리" },
  "/social-accounts":      { title: "SNS 연동",       parent: "콘텐츠 관리" },
  "/analytics":            { title: "통계",            parent: "콘텐츠 관리" },
  "/settings":             { title: "설정" },
  "/settings/profile":     { title: "프로필",          parent: "설정" },
  "/settings/billing":     { title: "요금제",          parent: "설정" },
  "/settings/notifications": { title: "알림 설정",    parent: "설정" },
};

interface TopBarProps {
  pageTitle?: string;
  notificationCount?: number;
}

export function TopBar({ pageTitle, notificationCount }: TopBarProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const user = session?.user;
  const initials = (user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase() || user?.email?.[0]?.toUpperCase() || "U");
  const displayName = user?.name || user?.email?.split("@")[0] || "사용자";

  const meta = PATH_META[pathname];
  const title = pageTitle || meta?.title || "";
  const parent = meta?.parent;

  const handleSignOut = () => signOut({ callbackUrl: "/login" });

  /* 플랜 체크 (FREE 면 배너 표시) */
  const isFree = true; // TODO: session.user.plan === "FREE" 로 교체

  return (
    <div style={{ position: "sticky", top: 0, zIndex: 40 }}>
      {/* ── 프로모션 배너 (FREE 플랜만) ── */}
      {isFree && !bannerDismissed && (
        <div style={{
          background: "linear-gradient(90deg, #6366F1 0%, #8B5CF6 100%)",
          padding: "0 20px",
          height: 44,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, justifyContent: "center" }}>
            <Zap size={14} color="#E0E7FF" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
              무료 플랜을 사용 중입니다 — 더 많은 기능을 사용해보세요
            </span>
            <Link href="/settings/billing" style={{ textDecoration: "none" }}>
              <button style={{
                background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.35)",
                borderRadius: 8, padding: "4px 12px",
                fontSize: 12, fontWeight: 700, color: "#fff",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                transition: "background 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.28)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.18)")}
              >
                유료 플랜 선택하기 <ChevronRight size={13} />
              </button>
            </Link>
          </div>
          <button
            onClick={() => setBannerDismissed(true)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", display: "flex", padding: 4, flexShrink: 0 }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── 메인 헤더 ── */}
      <header style={{
        height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px",
        background: "#fff",
        borderBottom: "1px solid #F0F0F0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
      }}>
        {/* 좌측: 브레드크럼 + 페이지 타이틀 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {parent && (
            <>
              <span style={{ fontSize: 13, color: "#9CA3AF", fontWeight: 500 }}>{parent}</span>
              <ChevronRight size={14} color="#D1D5DB" />
            </>
          )}
          {title && (
            <h1 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0 }}>
              {title}
            </h1>
          )}
        </div>

        {/* 우측: 업그레이드 CTA + 알림 + 유저 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

          {/* 업그레이드 버튼 (FREE만) */}
          {isFree && (
            <Link href="/settings/billing" style={{ textDecoration: "none" }}>
              <button style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                border: "none", borderRadius: 9, padding: "6px 14px",
                fontSize: 12, fontWeight: 700, color: "#fff",
                cursor: "pointer", boxShadow: "0 2px 8px rgba(99,102,241,0.25)",
                transition: "opacity 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                <Zap size={13} /> 업그레이드
              </button>
            </Link>
          )}

          {/* 알림 버튼 */}
          <div style={{ position: "relative" }}>
            <button
              style={{
                width: 36, height: 36, borderRadius: 9,
                background: "none", border: "1px solid #F0F0F0",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                color: "#9CA3AF", transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#F9FAFB"; e.currentTarget.style.color = "#6366F1"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#9CA3AF"; }}
            >
              <Bell size={16} />
            </button>
            {notificationCount && notificationCount > 0 && (
              <span style={{
                position: "absolute", top: -4, right: -4,
                width: 17, height: 17, borderRadius: "50%",
                background: "#EF4444", color: "#fff",
                fontSize: 10, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "2px solid #fff",
              }}>
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </div>

          {/* 유저 드롭다운 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "4px 10px 4px 4px", borderRadius: 10,
                  background: "none", border: "1px solid #F0F0F0",
                  cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#F9FAFB")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                <Avatar style={{ width: 30, height: 30 }}>
                  <AvatarImage src={user?.image || undefined} alt={displayName} />
                  <AvatarFallback style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", fontSize: 11, fontWeight: 700 }}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {displayName}
                </span>
                <ChevronDown size={14} color="#9CA3AF" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ width: 220 }}>
              <DropdownMenuLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{displayName}</span>
                  <span style={{ fontSize: 11, fontWeight: 400, color: "#9CA3AF" }}>{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings/profile"><User size={14} className="mr-2" /> 프로필</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/billing"><span className="mr-2">💳</span> 요금제</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/notifications"><Bell size={14} className="mr-2" /> 알림 설정</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings"><Settings size={14} className="mr-2" /> 설정</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} style={{ color: "#EF4444" }}>
                <LogOut size={14} className="mr-2" /> 로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </div>
  );
}
