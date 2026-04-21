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

  /* 플랜 체크 */
  const isFree = true; // TODO: session.user.plan === "FREE"

  return (
    <div style={{ position: "sticky", top: 0, zIndex: 40 }}>
      {/* ── 프로모션 배너 (FREE 플랜만) ── */}
      {isFree && !bannerDismissed && (
        <div style={{
          background: "linear-gradient(90deg, #1D4ED8 0%, #2563EB 100%)",
          padding: "0 20px",
          height: 40,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, justifyContent: "center" }}>
            <Zap size={13} color="#93C5FD" />
            <span style={{ fontSize: 12, fontWeight: 500, color: "#BFDBFE" }}>
              무료 플랜을 사용 중입니다 — 더 많은 기능을 사용해보세요
            </span>
            <Link href="/settings/billing" style={{ textDecoration: "none" }}>
              <button style={{
                background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: 6, padding: "3px 10px",
                fontSize: 11, fontWeight: 600, color: "#fff",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                transition: "background 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
              >
                유료 플랜 선택하기 <ChevronRight size={12} />
              </button>
            </Link>
          </div>
          <button
            onClick={() => setBannerDismissed(true)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", display: "flex", padding: 4, flexShrink: 0 }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── 메인 헤더 — Wellune 스타일 ── */}
      <header style={{
        height: 52, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px",
        background: "#ffffff",
        borderBottom: "1px solid #E2E8F0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        {/* 좌측: 브레드크럼 + 페이지 타이틀 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {parent && (
            <>
              <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 400 }}>{parent}</span>
              <ChevronRight size={13} color="#CBD5E1" />
            </>
          )}
          {title && (
            <h1 style={{ fontSize: 15, fontWeight: 600, color: "#1A2332", margin: 0, letterSpacing: "-0.01em" }}>
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
                background: "#3B82F6",
                border: "none", borderRadius: 7, padding: "6px 12px",
                fontSize: 12, fontWeight: 600, color: "#fff",
                cursor: "pointer", boxShadow: "0 1px 3px rgba(59,130,246,0.4)",
                transition: "background 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "#2563EB")}
                onMouseLeave={e => (e.currentTarget.style.background = "#3B82F6")}
              >
                <Zap size={12} /> 업그레이드
              </button>
            </Link>
          )}

          {/* 알림 버튼 */}
          <div style={{ position: "relative" }}>
            <button
              style={{
                width: 34, height: 34, borderRadius: 8,
                background: "none", border: "1px solid #E2E8F0",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                color: "#94A3B8", transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#F8FAFC"; e.currentTarget.style.color = "#3B82F6"; e.currentTarget.style.borderColor = "#CBD5E1"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#94A3B8"; e.currentTarget.style.borderColor = "#E2E8F0"; }}
            >
              <Bell size={15} />
            </button>
            {notificationCount && notificationCount > 0 && (
              <span style={{
                position: "absolute", top: -3, right: -3,
                width: 15, height: 15, borderRadius: "50%",
                background: "#EF4444", color: "#fff",
                fontSize: 9, fontWeight: 700,
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
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "4px 8px 4px 4px", borderRadius: 8,
                  background: "none", border: "1px solid #E2E8F0",
                  cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#F8FAFC"; e.currentTarget.style.borderColor = "#CBD5E1"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "#E2E8F0"; }}
              >
                <Avatar style={{ width: 26, height: 26 }}>
                  <AvatarImage src={user?.image || undefined} alt={displayName} />
                  <AvatarFallback style={{ background: "#3B82F6", color: "#fff", fontSize: 10, fontWeight: 700 }}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#1A2332", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {displayName}
                </span>
                <ChevronDown size={13} color="#94A3B8" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ width: 220 }}>
              <DropdownMenuLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1A2332" }}>{displayName}</span>
                  <span style={{ fontSize: 11, fontWeight: 400, color: "#94A3B8" }}>{user?.email}</span>
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
