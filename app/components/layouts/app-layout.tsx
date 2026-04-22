import * as React from "react";
import { Sidebar } from "@/components/layouts/sidebar";
import { TopBar } from "@/components/layouts/top-bar";

interface AppLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
  /** 플랜 사용량 정보 */
  usage?: {
    used: number;
    total: number;
    planName: string;
  };
  notificationCount?: number;
}

export function AppLayout({
  children,
  pageTitle,
  usage,
  notificationCount,
}: AppLayoutProps): React.ReactElement {
  const usagePercent = usage
    ? Math.round((usage.used / usage.total) * 100)
    : 0;
  const usageLabel = usage
    ? `${usage.used}/${usage.total}건`
    : undefined;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--fp-page-bg)" }}>
      {/* 사이드바 — 데스크톱만 표시 */}
      <div className="hidden md:flex">
        <Sidebar
          usagePercent={usagePercent}
          usageLabel={usageLabel}
          planName={usage?.planName}
        />
      </div>

      {/* 메인 영역 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar pageTitle={pageTitle} notificationCount={notificationCount} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-6 py-5">{children}</div>
        </main>
      </div>

    </div>
  );
}
