import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The Verge 버튼 시스템
 * - Primary: Jelly Mint pill (#3cffd0, black text, 24px radius)
 * - Secondary: Dark Slate pill (#2d2d2d, #e9e9e9 text)
 * - Outline: Mint border pill (transparent bg, mint border, 40px radius)
 * - Ghost: transparent, hover → Surface Slate
 * - Destructive: Ultraviolet
 * - Link: mint underline
 * - Accent: Ultraviolet fill
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#1eaedb] focus-visible:border-[#0500ff] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[#3cffd0] text-black font-semibold rounded-[24px] hover:bg-white/20 hover:text-black hover:shadow-[0_0_0_1px_#c2c2c2] active:bg-[rgba(140,140,140,0.87)] active:opacity-50",
        destructive:
          "bg-[#5200ff] text-white rounded-[24px] shadow-sm hover:bg-[#5200ff]/80",
        outline:
          "border border-[#3cffd0] bg-transparent text-[#3cffd0] rounded-[40px] hover:bg-[#3cffd0] hover:text-black font-mono uppercase tracking-[1.5px] text-xs",
        secondary:
          "bg-[#2d2d2d] text-[#e9e9e9] rounded-[24px] hover:bg-white/20 hover:text-black hover:shadow-[0_0_0_1px_#c2c2c2]",
        ghost: "hover:bg-[#2d2d2d] hover:text-white rounded-[20px]",
        link: "text-[#3cffd0] underline-offset-4 hover:underline hover:text-[#3860be]",
        accent:
          "bg-[#5200ff]/90 text-white rounded-[30px] hover:bg-[#5200ff]",
      },
      size: {
        default: "h-10 px-6 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-11 px-8 text-base",
        icon: "h-10 w-10 rounded-[20px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps): React.ReactElement {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { buttonVariants };
