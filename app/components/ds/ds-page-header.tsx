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
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="m-0 text-3xl font-extrabold leading-tight text-fp-heading">
          {title}
        </h1>
        {desc && (
          <p className="m-0 mt-2 max-w-3xl text-base font-medium leading-relaxed text-fp-muted">{desc}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-3">
          {actions}
        </div>
      )}
    </div>
  );
}
