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
        "flex flex-col items-center justify-center py-16 text-center",
        className
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[16px] bg-[#2d2d2d] text-[#949494]">
        {icon}
      </div>
      <p className="text-base font-medium text-white">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-[#949494]">
          {description}
        </p>
      )}
      {action && (
        <Button className="mt-5" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
