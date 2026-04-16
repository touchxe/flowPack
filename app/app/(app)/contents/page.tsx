import { Suspense } from "react";
import ContentsClient from "./contents-client";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "콘텐츠 목록 | FlowPack",
  description: "생성된 모든 콘텐츠를 관리하세요.",
};

export default function ContentsPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300, color: "#9CA3AF", fontSize: 14 }}>
        목록을 불러오는 중...
      </div>
    }>
      <ContentsClient />
    </Suspense>
  );
}
