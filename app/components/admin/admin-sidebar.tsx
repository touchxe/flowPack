"use client";

// Admin 전용 사이드바
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, FileText, CreditCard,
  Wallet, Brain, Megaphone, Settings,
  ArrowLeft, Shield, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

// 메뉴 그룹 — 서비스 관리 / 운영 도구
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

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 flex-col bg-slate-900 text-slate-100">
      {/* 로고 영역 */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-700">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20">
          <Shield className="h-4 w-4 text-red-400" />
        </div>
        <div>
          <p className="text-xs font-bold tracking-widest text-slate-300 uppercase">FlowPack</p>
          <p className="text-[10px] text-red-400 font-semibold tracking-wider uppercase">Admin</p>
        </div>
      </div>

      {/* 메뉴 그룹 */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-2 text-[10px] font-bold tracking-widest text-slate-600 uppercase">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-slate-700 text-white"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* 하단: 앱으로 돌아가기 */}
      <div className="border-t border-slate-700 px-3 py-4">
        <Link
          href="/home"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          앱으로 돌아가기
        </Link>
      </div>
    </aside>
  );
}
