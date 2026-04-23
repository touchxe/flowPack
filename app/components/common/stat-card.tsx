import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

/**
 * The Verge 스탯 카드
 * - Dark card: #131313 bg + 1px hairline + 20px radius
 * - Icon bg: mint tint (var(--fp-primary-subtle))
 * - Value: #ffffff
 * - Trend: var(--brand-500) 양수, var(--uv) 음수
 */
interface StatCardProps {
  title: string;
  value: number | string;
  /** 단위 (예: "건", "회", "%") */
  unit?: string;
  /** 부제목 (예: "/ 10건") */
  subtitle?: string;
  /** 추세 수치 (양수 = 상승, 음수 = 하락) */
  trend?: number;
  trendLabel?: string;
  icon: React.ReactNode;
  iconBgClassName?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  unit,
  subtitle,
  trend,
  trendLabel,
  icon,
  iconBgClassName,
  className,
}: StatCardProps): React.ReactElement {
  const isPositive = trend !== undefined && trend > 0;
  const isNegative = trend !== undefined && trend < 0;

  return (
    <Card className={cn("transition-colors hover:border-white/25", className)}>
      <CardContent className="p-5">
        <div
          className={cn(
            "mb-3 flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--brand-500)]/10 text-[var(--brand-500)]",
            iconBgClassName
          )}
        >
          {icon}
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-white">
            {typeof value === "number" ? formatNumber(value) : value}
          </span>
          {unit && (
            <span className="text-sm text-[#949494]">{unit}</span>
          )}
          {subtitle && (
            <span className="text-sm text-[#949494]">{subtitle}</span>
          )}
        </div>

        <p className="mt-1 text-sm text-[#949494]">{title}</p>

        {trend !== undefined && (
          <div
            className={cn(
              "mt-2 flex items-center gap-1 text-xs font-medium",
              isPositive && "text-[var(--brand-500)]",
              isNegative && "text-[var(--uv)]",
              !isPositive && !isNegative && "text-[#949494]"
            )}
          >
            {isPositive && <TrendingUp className="h-3.5 w-3.5" />}
            {isNegative && <TrendingDown className="h-3.5 w-3.5" />}
            {!isPositive && !isNegative && <Minus className="h-3.5 w-3.5" />}
            <span>
              {trend > 0 ? "+" : ""}
              {trend}%{trendLabel ? ` ${trendLabel}` : ""}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
