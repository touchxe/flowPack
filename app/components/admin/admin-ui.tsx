import type { ComponentType, ReactNode } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

interface AdminPageHeaderProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  meta?: string;
  actions?: ReactNode;
}

export function AdminPageHeader({
  icon: Icon,
  title,
  description,
  meta,
  actions,
}: AdminPageHeaderProps): ReactNode {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-200">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h1 className="admin-page-title">{title}</h1>
          <p className="admin-page-description mt-1">{description}</p>
          {meta ? <p className="admin-meta mt-2">{meta}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

interface AdminPanelProps {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AdminPanel({ title, icon, children, className }: AdminPanelProps): ReactNode {
  return (
    <section className={cn("admin-card p-5", className)}>
      {title ? (
        <div className="mb-4 flex items-center gap-2">
          {icon ? <span className="text-cyan-200">{icon}</span> : null}
          <h2 className="admin-panel-title">{title}</h2>
        </div>
      ) : null}
      {children}
    </section>
  );
}

interface AdminMetricCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: ComponentType<{ className?: string }>;
  trend?: number | null;
  tone?: Tone;
}

export function AdminMetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  tone = "info",
}: AdminMetricCardProps): ReactNode {
  const toneClass = {
    neutral: "bg-slate-300/10 text-slate-200",
    info: "bg-cyan-300/10 text-cyan-200",
    success: "bg-emerald-300/10 text-emerald-300",
    warning: "bg-amber-300/10 text-amber-300",
    danger: "bg-rose-300/10 text-rose-300",
  }[tone];

  return (
    <section className="admin-card p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="admin-kpi-label">{title}</p>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", toneClass)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="admin-kpi-value">{typeof value === "number" ? value.toLocaleString() : value}</p>
      <div className="mt-2 flex items-center gap-2">
        <p className="admin-meta">{description}</p>
        {trend !== undefined && trend !== null ? (
          <span className={cn("admin-badge", trend > 0 ? "" : trend < 0 ? "" : "")} data-tone={trend > 0 ? "success" : trend < 0 ? "danger" : "neutral"}>
            {trend > 0 ? "+" : ""}{trend}%
          </span>
        ) : null}
      </div>
    </section>
  );
}

export function AdminBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }): ReactNode {
  return <span className="admin-badge" data-tone={tone}>{children}</span>;
}

export function AdminLoadingState({ label = "데이터를 불러오는 중입니다." }: { label?: string }): ReactNode {
  return (
    <div className="admin-loading" role="status" aria-live="polite">
      <Loader2 className="h-5 w-5 animate-spin text-cyan-200" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function AdminEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}): ReactNode {
  return (
    <div className="admin-empty">
      <AlertCircle className="h-6 w-6 text-cyan-200" aria-hidden="true" />
      <div>
        <strong className="block">{title}</strong>
        <p className="mt-1 text-sm">{description}</p>
      </div>
    </div>
  );
}
