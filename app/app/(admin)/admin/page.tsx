import { LayoutDashboard } from "lucide-react";
import AdminDashboardClient from "./dashboard-client";

export default function AdminDashboardPage() {
  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-5 w-5 text-slate-400" />
          <h1 className="text-xl font-bold text-slate-100">대시보드</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">서비스 현황을 실시간으로 확인하세요</p>
      </div>

      {/* KPI + 차트 + 피드 */}
      <AdminDashboardClient />
    </div>
  );
}
