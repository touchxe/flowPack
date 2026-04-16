"use client";

import { useEffect, useState } from "react";
import { Wallet, TrendingUp, AlertTriangle, RotateCcw, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

// ─── 타입 ────────────────────────────────────────────
interface Payment {
  id: string;
  orderId: string;
  amount: number;
  status: string;
  method: string | null;
  cardInfo: string | null;
  tossPaymentKey: string | null;
  failureCode: string | null;
  failureMsg: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  user: { email: string; name: string | null; plan: string };
}

interface PaymentsData {
  payments: Payment[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  kpi: {
    monthTotal: number;
    successRate: number;
    monthRefunded: number;
    monthSuccess: number;
    monthFailed: number;
    totalAll: number;
  };
}

// ─── 상태 뱃지 ──────────────────────────────────────
const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  SUCCESS:  { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "성공" },
  FAILED:   { bg: "bg-red-500/15",     text: "text-red-400",     label: "실패" },
  REFUNDED: { bg: "bg-yellow-500/15",  text: "text-yellow-400",  label: "환불" },
  CANCELED: { bg: "bg-slate-500/15",   text: "text-slate-400",   label: "취소" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.CANCELED;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "SUCCESS" ? "bg-emerald-400" : status === "FAILED" ? "bg-red-400" : status === "REFUNDED" ? "bg-yellow-400" : "bg-slate-400"}`} />
      {s.label}
    </span>
  );
}

// ─── KPI 카드 ────────────────────────────────────────
function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-[10px] font-bold tracking-widest text-slate-600 uppercase mb-2">{label}</p>
      <p className={`text-2xl font-extrabold ${accent}`}>{value}</p>
      <p className="text-[11px] text-slate-500 mt-1">{sub}</p>
    </div>
  );
}

// ─── 메인 ────────────────────────────────────────────
export default function PaymentsClient() {
  const [data, setData] = useState<PaymentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [refundingId, setRefundingId] = useState<string | null>(null);

  const fetchData = async (p: number, status: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (status) params.set("status", status);
    const res = await fetch(`/api/admin/payments?${params}`);
    if (!res.ok) { setLoading(false); return; }
    const json = await res.json();
    if (!json?.payments) { setLoading(false); return; }
    setData(json);
    setLoading(false);
  };

  useEffect(() => { fetchData(page, statusFilter); }, [page, statusFilter]);

  // 환불 처리
  const handleRefund = async (id: string) => {
    if (!confirm("정말 환불 처리하시겠습니까?")) return;
    setRefundingId(id);
    await fetch(`/api/admin/payments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "refund", reason: "관리자 수동 환불" }),
    });
    setRefundingId(null);
    fetchData(page, statusFilter);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-indigo-500" />
      </div>
    );
  }

  if (!data) {
    return <div className="flex items-center justify-center h-64 text-slate-500">데이터를 불러올 수 없습니다</div>;
  }

  const { payments, pagination, kpi } = data;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-slate-100">결제 관리</h1>
        <p className="text-sm text-slate-500 mt-1">Toss Payments 결제 이력 및 환불 처리</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          label="이번 달 결제액"
          value={`₩${kpi.monthTotal.toLocaleString()}`}
          sub={`누적 ₩${kpi.totalAll.toLocaleString()}`}
          accent="text-emerald-400"
        />
        <KpiCard
          label="결제 성공률"
          value={`${kpi.successRate}%`}
          sub={`성공 ${kpi.monthSuccess}건 / 실패 ${kpi.monthFailed}건`}
          accent="text-blue-400"
        />
        <KpiCard
          label="환불 건수"
          value={`${kpi.monthRefunded}건`}
          sub="이번 달 환불"
          accent="text-yellow-400"
        />
        <KpiCard
          label="전체 결제 건수"
          value={`${pagination.total}건`}
          sub="누적 결제 이력"
          accent="text-slate-300"
        />
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
          <Search className="h-4 w-4 text-slate-500" />
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-transparent text-sm text-slate-300 outline-none"
          >
            <option value="">전체 상태</option>
            <option value="SUCCESS">성공</option>
            <option value="FAILED">실패</option>
            <option value="REFUNDED">환불</option>
            <option value="CANCELED">취소</option>
          </select>
        </div>
      </div>

      {/* 테이블 */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-600 uppercase">주문번호</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-600 uppercase">유저</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-600 uppercase">금액</th>
              <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-600 uppercase">상태</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-600 uppercase">결제방법</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-600 uppercase">결제일</th>
              <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-600 uppercase">액션</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-600">
                  <Wallet className="h-8 w-8 mx-auto mb-2 text-slate-700" />
                  결제 내역이 없습니다
                </td>
              </tr>
            ) : payments.map(p => (
              <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3 text-xs font-mono text-slate-400">{p.orderId.slice(0, 16)}...</td>
                <td className="px-4 py-3">
                  <p className="text-slate-200 text-xs truncate max-w-[140px]">{p.user.name ?? p.user.email}</p>
                  <p className="text-[10px] text-slate-600">{p.user.email}</p>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-200">₩{p.amount.toLocaleString()}</td>
                <td className="px-4 py-3 text-center"><StatusBadge status={p.status} /></td>
                <td className="px-4 py-3 text-xs text-slate-400">{p.method ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {p.paidAt ? format(new Date(p.paidAt), "yyyy.MM.dd HH:mm") : format(new Date(p.createdAt), "yyyy.MM.dd HH:mm")}
                </td>
                <td className="px-4 py-3 text-center">
                  {p.status === "SUCCESS" && (
                    <button
                      onClick={() => handleRefund(p.id)}
                      disabled={refundingId === p.id}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="h-3 w-3" />
                      {refundingId === p.id ? "처리중..." : "환불"}
                    </button>
                  )}
                  {p.status === "FAILED" && p.failureMsg && (
                    <span className="text-[10px] text-red-400" title={p.failureMsg}>
                      <AlertTriangle className="h-3.5 w-3.5 inline" />
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-400 hover:bg-slate-700 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-slate-400">
            {page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-400 hover:bg-slate-700 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
