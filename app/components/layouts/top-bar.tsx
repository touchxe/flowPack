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
        <div className="flex h-11 items-center justify-between gap-4 bg-brand-500 px-6">
          <div className="flex flex-1 items-center justify-center gap-3">
            <Zap size={15} className="text-black/75" />
            <span className="text-sm font-semibold text-black">
              무료 플랜을 사용 중입니다 — 더 많은 기능을 사용해보세요
            </span>
            <Link href="/settings/billing" className="no-underline">
              <button className="flex cursor-pointer items-center gap-1 rounded-lg border border-black/25 bg-black/15 px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-black/25">
                유료 플랜 선택하기 <ChevronRight size={13} />
              </button>
            </Link>
          </div>
          <button
            onClick={() => setBannerDismissed(true)}
            className="flex shrink-0 cursor-pointer rounded-lg border-none bg-transparent p-1.5 text-black/50 transition-colors hover:bg-black/10 hover:text-black/70"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── 메인 헤더 — 테마 반응형 ─────────────────────────── */}
      <header className="flex h-16 items-center justify-between border-b border-fp-border bg-fp-card-bg px-8 shadow-card">
        {/* 좌측: 브레드크럼 + 페이지 타이틀 */}
        <div className="flex items-center gap-2">
          {parent && (
            <>
              <span className="text-sm font-medium text-fp-muted">
                {parent}
              </span>
              <ChevronRight size={15} className="text-fp-border-strong" />
            </>
          )}
          {title && (
            <h1 className="m-0 text-lg font-bold text-fp-heading">
              {title}
            </h1>
          )}
        </div>

        {/* 우측: 업그레이드 CTA + 알림 + 유저 */}
        <div className="flex items-center gap-3">
          {/* 업그레이드 버튼 — brand-500 단색 */}
          {isFree && (
            <Link href="/settings/billing" className="no-underline">
              <button className="flex h-9 cursor-pointer items-center gap-2 rounded-xl border-none bg-brand-500 px-4 text-sm font-bold text-black transition-opacity hover:opacity-80">
                <Zap size={14} /> 업그레이드
              </button>
            </Link>
          )}

          {/* 알림 드롭다운 */}
          <NotificationDropdown />

          {/* 유저 드롭다운 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex cursor-pointer items-center gap-2 rounded-xl border border-fp-border bg-transparent py-1.5 pl-1.5 pr-3 transition-all hover:border-fp-border-strong hover:bg-fp-section-bg">
                {/* 아바타 폴백 — brand-500 단색 */}
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.image || undefined} alt={displayName} />
                  <AvatarFallback className="bg-brand-500 text-xs font-bold text-black">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-fp-heading">
                  {displayName}
                </span>
                <ChevronDown size={15} className="text-fp-muted" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-[240px]">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-fp-heading">
                    {displayName}
                  </span>
                  <span className="text-xs font-normal text-fp-muted">
                    {user?.email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings/profile">
                  <User size={15} className="mr-2" /> 프로필
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/billing">
                  <span className="mr-2">💳</span> 요금제
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/instructions">
                  <BookOpen size={15} className="mr-2" /> 작성 지침
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/notifications">
                  <Bell size={15} className="mr-2" /> 알림 설정
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings size={15} className="mr-2" /> 설정
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-fp-error"
              >
                <LogOut size={15} className="mr-2" /> 로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </div>
  );
}
