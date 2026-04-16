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
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Admin 사이드바 */}
      <AdminSidebar />

      {/* 메인 컨텐츠 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Admin 헤더 */}
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-red-400" />
            <span className="text-xs font-bold tracking-widest text-red-400 uppercase">
              관리자 모드
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">{session.user.email}</span>
            <div className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-400 uppercase tracking-wider">
              ADMIN
            </div>
          </div>
        </header>

        {/* 페이지 컨텐츠 */}
        <main className="flex-1 overflow-auto bg-slate-950 text-slate-100">
          {children}
        </main>
      </div>
    </div>
  );
}
