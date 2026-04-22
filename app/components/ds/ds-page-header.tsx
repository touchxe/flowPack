/**
 * DsPageHeader — 대시보드 공통 페이지 헤더
 * 제목 + 설명 텍스트. 하드코딩 색상 없이 CSS 변수 참조.
 */
import type { ReactNode } from "react";

interface DsPageHeaderProps {
  title: string;
  desc?: string;
  /** 우측 액션 영역 */
  actions?: ReactNode;
}

export function DsPageHeader({ title, desc, actions }: DsPageHeaderProps) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--fp-heading)", margin: 0, marginBottom: desc ? 4 : 0 }}>
          {title}
        </h1>
        {desc && (
          <p style={{ fontSize: 13, color: "var(--fp-muted)", margin: 0 }}>{desc}</p>
        )}
      </div>
      {actions && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
}
