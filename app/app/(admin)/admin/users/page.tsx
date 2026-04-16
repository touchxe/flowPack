import AdminUsersClient from "./users-client";

// Admin 유저 관리 페이지 (서버 래퍼)
export const metadata = { title: "유저 관리 — FlowPack Admin" };

export default function AdminUsersPage() {
  return <AdminUsersClient />;
}
