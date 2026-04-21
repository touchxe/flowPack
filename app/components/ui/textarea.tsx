import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * The Verge 텍스트에리어
 * - #131313 bg, 1px #949494 border, 2px radius (typewriter feel)
 * - Focus: border → #3cffd0
 */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-sm border border-[#949494] bg-[#131313] px-3 py-2 text-base text-white ring-offset-[#131313] placeholder:text-[#949494] focus-visible:outline-none focus-visible:border-[#3cffd0] focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-colors duration-150",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
