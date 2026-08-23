"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Brain,
  CreditCard,
  FileText,
  LayoutDashboard,
  Menu,
  Megaphone,
  Settings,
  Shield,
  Users,
  Wallet,
  BookOpen,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    label: "서비스 관리",
    items: [
      { href: "/admin", label: "대시보드", icon: LayoutDashboard, exact: true },
      { href: "/admin/users", label: "유저 관리", icon: Users },
      { href: "/admin/contents", label: "콘텐츠 관리", icon: FileText },
      { href: "/admin/subscriptions", label: "구독 관리", icon: CreditCard },
    ],
  },
  {
    label: "운영 도구",
    items: [
      { href: "/admin/payments", label: "결제 관리", icon: Wallet },
      { href: "/admin/ai-usage", label: "AI 사용량", icon: Brain },
      { href: "/admin/notices", label: "공지사항", icon: Megaphone },
      { href: "/admin/instructions", label: "시스템 지침", icon: BookOpen },
      { href: "/admin/settings", label: "시스템 설정", icon: Settings },
    ],
  },
];

function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="관리자 메뉴" className="flex-1 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group) => (
        <section key={group.label} className="mb-5">
          <h2 className="admin-sidebar-label mb-2 px-3 text-[11px] font-bold tracking-wide">
            {group.label}
          </h2>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={isActive}
                  onClick={onNavigate}
                  className="admin-sidebar-link flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

export function AdminSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <>
      <aside className="admin-sidebar hidden h-screen w-64 shrink-0 flex-col border-r lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-[var(--admin-border)] px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-200">
            <Shield className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-bold tracking-wide text-[var(--admin-text)]">FlowPack</p>
            <p className="text-[11px] font-medium text-[var(--admin-text-muted)]">관리자 콘솔</p>
          </div>
        </div>
        <AdminNavigation />
        <div className="border-t border-[var(--admin-border)] p-3">
          <Link href="/home" className="admin-sidebar-link flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            앱으로 돌아가기
          </Link>
        </div>
      </aside>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="관리자 메뉴 열기"
        aria-expanded={mobileOpen}
        className="admin-mobile-trigger fixed left-3 top-2.5 z-40 flex h-9 w-9 items-center justify-center rounded-lg lg:hidden"
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className={cn("fixed inset-0 z-50 lg:hidden", mobileOpen ? "block" : "hidden")} role="dialog" aria-modal="true" aria-label="관리자 메뉴">
        <button type="button" aria-label="메뉴 닫기" className="absolute inset-0 bg-slate-950/70" onClick={() => setMobileOpen(false)} />
        <aside className="admin-sidebar relative flex h-full w-72 flex-col border-r shadow-2xl">
          <div className="flex h-16 items-center justify-between border-b border-[var(--admin-border)] px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-200">
                <Shield className="h-4 w-4" aria-hidden="true" />
              </div>
              <span className="text-sm font-bold text-[var(--admin-text)]">관리자 콘솔</span>
            </div>
            <button type="button" onClick={() => setMobileOpen(false)} aria-label="메뉴 닫기" className="admin-icon-button">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <AdminNavigation onNavigate={() => setMobileOpen(false)} />
          <div className="border-t border-[var(--admin-border)] p-3">
            <Link href="/home" onClick={() => setMobileOpen(false)} className="admin-sidebar-link flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              앱으로 돌아가기
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
