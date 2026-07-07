import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * The Verge 빈 상태
 * - Icon container: #2d2d2d (Surface Slate)
 * - Heading: #ffffff
 * - Description: #949494
 * - CTA: Jelly Mint pill button
 */
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps): React.ReactElement {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-20 text-center",
        className
      )}
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-fp-section-bg text-fp-muted">
        {icon}
      </div>
      <p className="text-lg font-bold text-fp-heading">{title}</p>
      {description && (
        <p className="mt-2 max-w-md text-base font-medium leading-relaxed text-fp-muted">
          {description}
        </p>
      )}
      {action && (
        <Button className="mt-6 h-11 px-6 text-sm font-bold" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
