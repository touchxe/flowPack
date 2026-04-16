import { PublicHeader } from "@/components/layouts/public-header";
import { PublicFooter } from "@/components/layouts/public-footer";

/**
 * 공개(랜딩/마케팅) 페이지 공용 레이아웃 템플릿
 * - PublicHeader: 상단 네비게이션 (스티키, 현재 경로 하이라이트)
 * - PublicFooter: 하단 다크 푸터 (링크 컬럼 + SNS)
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#fff" }}>
      <PublicHeader />
      <main style={{ flex: 1 }}>{children}</main>
      <PublicFooter />
    </div>
  );
}
