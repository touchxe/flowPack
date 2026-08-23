import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Shield } from "lucide-react";

// Admin 섹션 레이아웃 — 서버 컴포넌트에서 role 재확인
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // 서버 사이드 이중 검증 (미들웨어 우회 방어)
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/home");
  }

  return (
    <div className="admin-shell flex min-h-screen overflow-hidden">
      <AdminSidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="admin-header sticky top-0 z-30 flex min-h-14 items-center justify-between border-b px-4 py-2 pl-16 sm:px-6 lg:pl-6">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-cyan-200" aria-hidden="true" />
            <span className="text-xs font-bold tracking-wide text-cyan-100">
              관리자 콘솔
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-56 truncate text-sm text-[var(--admin-text-muted)] sm:inline">{session.user.email}</span>
            <div className="admin-badge" data-tone="info">
              ADMIN
            </div>
          </div>
        </header>

        <main id="admin-main" className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
