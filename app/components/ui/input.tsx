import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The Verge 인풋
 * - #131313 bg, 1px #949494 border, 2px radius (typewriter feel)
 * - Focus: border → var(--brand-500) (jelly mint)
 * - Text: #ffffff, placeholder: #949494
 */
export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, type, ...props }: InputProps): React.ReactElement {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-sm border border-[#949494] bg-[#131313] px-3 py-2 text-sm text-white ring-offset-[#131313]",
        "placeholder:text-[#949494]",
        "focus-visible:outline-none focus-visible:border-[var(--brand-500)] focus-visible:ring-0",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "transition-colors duration-150",
        className
      )}
      {...props}
    />
  );
}
