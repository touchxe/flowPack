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
      <CardContent className="p-6 md:p-7">
        <div
          className={cn(
            "mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--brand-500)]/10 text-[var(--brand-500)]",
            iconBgClassName
          )}
        >
          {icon}
        </div>

        <div className="flex items-baseline gap-1">
          <span className="font-mono text-4xl font-extrabold leading-none text-fp-heading tabular-nums">
            {typeof value === "number" ? formatNumber(value) : value}
          </span>
          {unit && (
            <span className="text-lg font-semibold text-fp-muted">{unit}</span>
          )}
          {subtitle && (
            <span className="text-lg font-semibold text-fp-muted">{subtitle}</span>
          )}
        </div>

        <p className="mt-3 text-base font-semibold text-fp-muted">{title}</p>

        {trend !== undefined && (
          <div
            className={cn(
              "mt-3 flex items-center gap-1.5 text-sm font-semibold",
              isPositive && "text-[var(--brand-500)]",
              isNegative && "text-[var(--uv)]",
              !isPositive && !isNegative && "text-fp-muted"
            )}
          >
            {isPositive && <TrendingUp className="h-4 w-4" />}
            {isNegative && <TrendingDown className="h-4 w-4" />}
            {!isPositive && !isNegative && <Minus className="h-4 w-4" />}
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
