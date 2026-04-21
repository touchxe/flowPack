import { AdminInstructionsClient } from "./instructions-client";

export const metadata = {
  title: "시스템 지침 관리 — FlowPack Admin",
};

export default function AdminInstructionsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "24px" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>
          시스템 지침 관리
        </h1>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: "4px 0 0" }}>
          AI 콘텐츠 생성 시 기본 적용되는 시스템 지침을 콘텐츠 유형별로 설정합니다.
        </p>
      </div>

      {/* 카드 */}
      <div style={{
        flex: 1,
        background: "#fff",
        borderRadius: 12,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}>
        <AdminInstructionsClient />
      </div>
    </div>
  );
}
