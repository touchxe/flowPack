"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell, BookOpen, ChevronDown, ChevronRight, LogOut,
  Settings, User, Zap, X,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationDropdown } from "@/components/features/notification-dropdown";

/* 경로 → 브레드크럼 */
const PATH_META: Record<string, { title: string; parent?: string }> = {
  "/home":                   { title: "홈 대시보드" },
  "/carousel-lab":           { title: "카드뉴스 생성",  parent: "AI 콘텐츠 제작" },
  "/ai/longform":            { title: "블로그 글 생성",  parent: "AI 콘텐츠 제작" },
  "/ai/bulk-link-to-post":   { title: "URL → 콘텐츠",   parent: "AI 콘텐츠 제작" },
  "/ai/bulk-generate":       { title: "대량 기획",       parent: "AI 콘텐츠 제작" },
  "/contents":               { title: "콘텐츠 목록",     parent: "콘텐츠 관리" },
  "/review-feeds":           { title: "수정피드",        parent: "콘텐츠 관리" },
  "/calendar":               { title: "콘텐츠 캘린더",   parent: "콘텐츠 관리" },
  "/social-accounts":        { title: "SNS 연동",        parent: "콘텐츠 관리" },
  "/analytics":              { title: "통계",             parent: "콘텐츠 관리" },
  "/settings":               { title: "설정" },
  "/settings/profile":       { title: "프로필",           parent: "설정" },
  "/settings/instructions":  { title: "작성 지침",        parent: "설정" },
  "/settings/billing":       { title: "요금제",           parent: "설정" },
  "/settings/notifications": { title: "알림 설정",        parent: "설정" },
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
  const initials =
    user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "U";
  const displayName = user?.name || user?.email?.split("@")[0] || "사용자";

  const meta = PATH_META[pathname];
  const title = pageTitle || meta?.title || "";
  const parent = meta?.parent;

  const handleSignOut = () => signOut({ callbackUrl: "/login" });

  /* 플랜 체크 */
  const isFree = true; // TODO: session.user.plan === "FREE"

  return (
    <div className="sticky top-0 z-40">
      {/* ── 프로모션 배너 (FREE 플랜만) ─
          brand-500 민트 단색 배경 + 흰색 텍스트 → 라이트/다크 모두 고대비 보장
      ── */}
      {isFree && !bannerDismissed && (
        <div className="bg-brand-500 px-5 h-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 flex-1 justify-center">
            <Zap size={13} className="text-black/75" />
            <span className="text-xs font-semibold text-black">
              무료 플랜을 사용 중입니다 — 더 많은 기능을 사용해보세요
            </span>
            <Link href="/settings/billing" className="no-underline">
              <button className="bg-black/15 border border-black/25 rounded-md px-2.5 py-1 text-[11px] font-bold text-black cursor-pointer flex items-center gap-1 transition-colors hover:bg-black/25">
                유료 플랜 선택하기 <ChevronRight size={12} />
              </button>
            </Link>
          </div>
          <button
            onClick={() => setBannerDismissed(true)}
            className="bg-transparent border-none cursor-pointer text-black/50 flex p-1 shrink-0 hover:text-black/70 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── 메인 헤더 — 테마 반응형 ─────────────────────────── */}
      <header className="h-[52px] flex items-center justify-between px-6 bg-fp-card-bg border-b border-fp-border shadow-card">
        {/* 좌측: 브레드크럼 + 페이지 타이틀 */}
        <div className="flex items-center gap-1.5">
          {parent && (
            <>
              <span className="text-xs text-fp-muted font-normal">
                {parent}
              </span>
              <ChevronRight size={13} className="text-fp-border-strong" />
            </>
          )}
          {title && (
            <h1 className="text-[15px] font-semibold text-fp-heading m-0 tracking-[-0.01em]">
              {title}
            </h1>
          )}
        </div>

        {/* 우측: 업그레이드 CTA + 알림 + 유저 */}
        <div className="flex items-center gap-2">
          {/* 업그레이드 버튼 — brand-500 단색 */}
          {isFree && (
            <Link href="/settings/billing" className="no-underline">
              <button className="flex items-center gap-1.5 bg-brand-500 border-none rounded-[7px] px-3 py-1.5 text-xs font-bold text-black cursor-pointer transition-opacity hover:opacity-80">
                <Zap size={12} /> 업그레이드
              </button>
            </Link>
          )}

          {/* 알림 드롭다운 */}
          <NotificationDropdown />

          {/* 유저 드롭다운 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-[7px] p-[4px_8px_4px_4px] rounded-lg bg-transparent border border-fp-border cursor-pointer transition-all hover:bg-fp-section-bg hover:border-fp-border-strong">
                {/* 아바타 폴백 — brand-500 단색 */}
                <Avatar className="w-[26px] h-[26px]">
                  <AvatarImage src={user?.image || undefined} alt={displayName} />
                  <AvatarFallback className="bg-brand-500 text-black text-[10px] font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[13px] font-medium text-fp-heading max-w-[90px] overflow-hidden text-ellipsis whitespace-nowrap">
                  {displayName}
                </span>
                <ChevronDown size={13} className="text-fp-muted" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-[220px]">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-[1px]">
                  <span className="text-[13px] font-bold text-fp-heading">
                    {displayName}
                  </span>
                  <span className="text-[11px] font-normal text-fp-muted">
                    {user?.email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings/profile">
                  <User size={14} className="mr-2" /> 프로필
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/billing">
                  <span className="mr-2">💳</span> 요금제
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/instructions">
                  <BookOpen size={14} className="mr-2" /> 작성 지침
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/notifications">
                  <Bell size={14} className="mr-2" /> 알림 설정
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings size={14} className="mr-2" /> 설정
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-fp-error"
              >
                <LogOut size={14} className="mr-2" /> 로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </div>
  );
}
