import { cn } from "@/lib/utils";

/**
 * The Verge 스켈레톤 — #2d2d2d pulse
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-[#2d2d2d]", className)}
      {...props}
    />
  );
}
