import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The Verge 페이지 헤더
 * - h1: Space Grotesk 700, #ffffff
 * - description: #949494
 */
interface PageHeaderProps {
  title: string;
  description?: string;
  /** 오른쪽 액션 버튼 영역 */
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps): React.ReactElement {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 pb-6",
        className
      )}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-[#949494]">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
