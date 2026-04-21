"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The Verge 레이블 — #e9e9e9, Space Grotesk
 */
const labelVariants = cva(
  "text-sm font-medium leading-none text-[#e9e9e9] peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
);

export function Label({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
  VariantProps<typeof labelVariants>): React.ReactElement {
  return (
    <LabelPrimitive.Root
      className={cn(labelVariants(), className)}
      {...props}
    />
  );
}
