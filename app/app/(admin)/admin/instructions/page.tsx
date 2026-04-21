import { AdminInstructionsClient } from "./instructions-client";

export const metadata = {
  title: "시스템 지침 관리 — FlowPack Admin",
};

export default function AdminInstructionsPage() {
  return (
    <div className="flex flex-col h-full p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-100">
          시스템 지침 관리
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          AI 콘텐츠 생성 시 기본 적용되는 시스템 지침을 콘텐츠 유형별로 설정합니다.
        </p>
      </div>

      {/* 카드 */}
      <div className="flex-1 rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden flex flex-col min-h-0">
        <AdminInstructionsClient />
      </div>
    </div>
  );
}
