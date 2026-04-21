import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The Verge 배지 시스템
 * - Pill Tag: 20px radius, Space Mono UPPERCASE, 1.5px tracking
 * - Accent 배지는 saturated color fill (mint, UV, etc.)
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-[20px] border px-2.5 py-0.5 text-xs font-semibold font-mono uppercase tracking-[1.5px] transition-colors focus:outline-none focus:ring-1 focus:ring-[#3cffd0]",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#3cffd0] text-black",
        secondary:
          "border-transparent bg-[#5200ff]/90 text-white",
        destructive:
          "border-transparent bg-[#5200ff] text-white",
        outline: "text-white border-white/20",
        /* 콘텐츠 상태 배지 */
        complete:
          "border-[#3cffd0]/30 bg-[#3cffd0]/10 text-[#3cffd0]",
        draft:
          "border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fbbf24]",
        scheduled:
          "border-[#3860be]/30 bg-[#3860be]/10 text-[#3860be]",
        archived:
          "border-white/10 bg-white/5 text-[#949494]",
        /* 콘텐츠 타입 배지 */
        carousel:
          "border-[#3cffd0]/30 bg-[#3cffd0]/10 text-[#3cffd0]",
        blog:
          "border-[#5200ff]/30 bg-[#5200ff]/10 text-[#a78bfa]",
        video:
          "border-[#ff6b9d]/30 bg-[#ff6b9d]/10 text-[#ff6b9d]",
        /* 기타 */
        beta:
          "border-[#3cffd0]/20 bg-[#3cffd0]/8 text-[#3cffd0]",
        recommend:
          "border-[#ff9f43]/30 bg-[#ff9f43]/10 text-[#ff9f43]",
        success:
          "border-transparent bg-[#3cffd0]/15 text-[#3cffd0]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps): React.ReactElement {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { badgeVariants };
