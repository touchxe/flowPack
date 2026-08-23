import { LayoutDashboard } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import AdminDashboardClient from "./dashboard-client";

export default function AdminDashboardPage() {
  return (
    <div className="admin-page-content">
      <AdminPageHeader
        icon={LayoutDashboard}
        title="운영 대시보드"
        description="사용자, 구독, 콘텐츠 흐름을 한 화면에서 확인합니다."
      />
      <AdminDashboardClient />
    </div>
  );
}
