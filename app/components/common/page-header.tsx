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
        "flex flex-col gap-4 pb-8 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold leading-tight text-fp-heading">
          {title}
        </h1>
        {description && (
          <p className="max-w-3xl text-base font-medium leading-relaxed text-fp-muted">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-3">{actions}</div>
      )}
    </div>
  );
}
