"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Zap,
  LayoutDashboard,
  Layers,
  FileText,
  Link as LinkIcon,
  CalendarDays,
  Share2,
  BarChart3,
  Settings,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "콘텐츠 제작",
    items: [
      { label: "홈 대시보드", href: "/home", icon: <LayoutDashboard className="h-4 w-4" /> },
      { label: "카드뉴스 생성", href: "/carousel-lab", icon: <Layers className="h-4 w-4" /> },
      { label: "블로그 생성", href: "/ai/longform", icon: <FileText className="h-4 w-4" /> },
      { label: "URL→콘텐츠", href: "/ai/bulk-link-to-post", icon: <LinkIcon className="h-4 w-4" /> },
      { label: "대량 기획", href: "/ai/bulk-generate", icon: <Layers className="h-4 w-4" /> },
    ],
  },
  {
    title: "관리",
    items: [
      { label: "콘텐츠 캘린더", href: "/calendar", icon: <CalendarDays className="h-4 w-4" /> },
      { label: "SNS 연동", href: "/social-accounts", icon: <Share2 className="h-4 w-4" /> },
      { label: "통계", href: "/analytics", icon: <BarChart3 className="h-4 w-4" /> },
    ],
  },
  {
    title: "계정",
    items: [
      { label: "설정", href: "/settings", icon: <Settings className="h-4 w-4" /> },
    ],
  },
];

interface SidebarProps {
  /** 이번 달 사용량 (0~100 %) */
  usagePercent?: number;
  usageLabel?: string;
  planName?: string;
  className?: string;
}

export function Sidebar({
  usagePercent = 0,
  usageLabel = "0/10건",
  planName = "무료 플랜",
  className,
}: SidebarProps): React.ReactElement {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-screen w-60 flex-col border-r border-border bg-background",
        className
      )}
    >
      {/* 로고 */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Zap className="h-4 w-4" />
        </div>
        <span className="text-[15px] font-bold text-foreground">FlowPack</span>
      </div>

      {/* 내비게이션 */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-2">
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </p>
            {section.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/home" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <Badge variant="beta" className="py-0 px-1.5 text-[10px]">
                      {item.badge}
                    </Badge>
                  )}
                  {isActive && (
                    <ChevronRight className="h-3.5 w-3.5 text-primary" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* 플랜 사용량 */}
      <div className="border-t border-border p-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{planName}</span>
          <span className="font-medium text-primary">{usageLabel}</span>
        </div>
        <Progress value={usagePercent} className="h-1.5" />
        <p className="mt-2 text-[11px] text-muted-foreground">
          {usagePercent >= 80
            ? "용량 부족 — 업그레이드 권장"
            : "콘텐츠 크레딧 사용량"}
        </p>
      </div>
    </aside>
  );
}
