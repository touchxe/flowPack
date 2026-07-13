"use client";

// Admin 구독 관리 페이지
import { useEffect, useState } from "react";
import { CreditCard, RefreshCw, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

// ─── 타입 ──────────────────────────────────────────────────────
interface Subscription {
  id: string;
  plan: string;
  billingCycle: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  canceledAt: string | null;
  createdAt: string;
  tossBillingKey: string | null;
  user: { email: string; name: string | null };
}

interface Summary {
  mrrByPlan: Record<string, { count: number; mrr: number }>;
  totalMrr: number;
  activeCount: number;
}

// ─── 배지 ──────────────────────────────────────────────────────
function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    FREE: "bg-slate-700 text-slate-300",
    STARTER: "bg-blue-500/20 text-blue-400",
    PRO: "bg-purple-500/20 text-purple-400",
    ENTERPRISE: "bg-amber-500/20 text-amber-400",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${colors[plan] ?? "bg-slate-700 text-slate-300"}`}>
      {plan}
    </span>
  );
}

function SubStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { cls: string; label: string }> = {
    ACTIVE:    { cls: "bg-emerald-500/20 text-emerald-400", label: "활성" },
    CANCELED:  { cls: "bg-red-500/20 text-red-400",         label: "취소" },
    EXPIRED:   { cls: "bg-slate-700 text-slate-500",        label: "만료" },
    PENDING:   { cls: "bg-yellow-500/20 text-yellow-400",   label: "대기" },
  };
  const { cls, label } = cfg[status] ?? { cls: "bg-slate-700 text-slate-400", label: status };
  return <span className={`rounded px-2 py-0.5 text-xs font-bold ${cls}`}>{label}</span>;
}

// ─── 메인 ──────────────────────────────────────────────────────
export default function AdminSubscriptionsClient() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const fetchData = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/subscriptions");
    const data = await res.json();
    setSubscriptions(data.subscriptions ?? []);
    setSummary(data.summary ?? null);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = statusFilter === "ALL"
    ? subscriptions
    : subscriptions.filter((s) => s.status === statusFilter);

  const PLAN_LABELS: Record<string, string> = {
    STARTER: "스타터",
    PRO: "프로",
    ENTERPRISE: "엔터프라이즈",
  };
  const PLAN_PRICE: Record<string, number> = {
    STARTER: 199000,
    PRO: 499000,
    ENTERPRISE: 0,
  };

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">구독 관리</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            활성 구독 {summary?.activeCount ?? "-"}건
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 border border-slate-700 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          새로고침
        </button>
      </div>

      {/* MRR 요약 카드 */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 총 MRR */}
          <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 p-5 sm:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">예상 MRR</p>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-emerald-400">
              ₩{summary.totalMrr.toLocaleString()}
            </p>
            <p className="text-xs text-slate-600 mt-1">월 반복 수익</p>
          </div>

          {/* 플랜별 MRR */}
          {["STARTER", "PRO"].map((planKey) => {
            const data = summary.mrrByPlan[planKey];
            return (
              <div key={planKey} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex items-center justify-between mb-2">
                  <PlanBadge plan={planKey} />
                  <span className="text-xs text-slate-500">
                    {data?.count ?? 0}명
                  </span>
                </div>
                <p className="text-2xl font-bold text-slate-100">
                  ₩{(data?.mrr ?? 0).toLocaleString()}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  ₩{PLAN_PRICE[planKey].toLocaleString()} × {data?.count ?? 0}명
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* 상태 필터 */}
      <div className="flex gap-1.5">
        {["ALL", "ACTIVE", "CANCELED", "EXPIRED", "PENDING"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === s
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {s === "ALL" ? "전체" : s === "ACTIVE" ? "활성" : s === "CANCELED" ? "취소" : s === "EXPIRED" ? "만료" : "대기"}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">유저</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">플랜</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">주기</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">상태</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">기간</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">결제키</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-600 border-t-blue-500" />
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-slate-600 text-sm">
                  구독 데이터 없음
                </td>
              </tr>
            ) : (
              filtered.map((sub) => (
                <tr key={sub.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                  {/* 유저 */}
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-200 truncate max-w-[160px]">
                      {sub.user.name ?? "—"}
                    </p>
                    <p className="text-xs text-slate-500 truncate max-w-[160px]">{sub.user.email}</p>
                  </td>

                  {/* 플랜 */}
                  <td className="px-4 py-3"><PlanBadge plan={sub.plan} /></td>

                  {/* 주기 */}
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {sub.billingCycle === "YEARLY" ? "연간" : "월간"}
                  </td>

                  {/* 상태 */}
                  <td className="px-4 py-3"><SubStatusBadge status={sub.status} /></td>

                  {/* 기간 */}
                  <td className="px-4 py-3 text-xs text-slate-400">
                    <p>{format(new Date(sub.currentPeriodStart), "yy.MM.dd")}</p>
                    <p className="text-slate-600">~ {format(new Date(sub.currentPeriodEnd), "yy.MM.dd")}</p>
                  </td>

                  {/* Toss 결제키 */}
                  <td className="px-4 py-3">
                    {sub.tossBillingKey ? (
                      <span className="rounded bg-slate-800 px-2 py-1 font-mono text-[10px] text-slate-400">
                        ****{sub.tossBillingKey.slice(-4)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-700">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
