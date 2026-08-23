"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, RefreshCw, Search, ShieldAlert, Users } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { AdminBadge, AdminEmptyState, AdminPageHeader } from "@/components/admin/admin-ui";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface User {
  id: string;
  name: string | null;
  email: string;
  plan: string;
  role: string;
  isBlocked: boolean;
  creditsUsed: number;
  creditsTotal: number;
  createdAt: string;
}

const PLAN_TONE: Record<string, "neutral" | "info" | "success" | "warning"> = { FREE: "neutral", STARTER: "info", PRO: "success", ENTERPRISE: "warning" };
const PLAN_TABS = ["ALL", "FREE", "STARTER", "PRO", "ENTERPRISE"];

export default function AdminUsersClient() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState("ALL");
  const [sort, setSort] = useState("createdAt_desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [blockTarget, setBlockTarget] = useState<User | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, plan: plan === "ALL" ? "" : plan, page: String(page), sort });
      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) throw new Error("사용자 목록을 불러오지 못했습니다.");
      const data = await response.json();
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "사용자 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [page, plan, q, sort]);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);
  useEffect(() => {
    const debounce = window.setTimeout(() => { setQ(searchInput); setPage(1); }, 400);
    return () => window.clearTimeout(debounce);
  }, [searchInput]);

  const updateBlockStatus = async () => {
    if (!blockTarget) return;
    setUpdating(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${blockTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBlocked: !blockTarget.isBlocked }),
      });
      if (!response.ok) throw new Error(blockTarget.isBlocked ? "정지 해제에 실패했습니다." : "계정 정지에 실패했습니다.");
      setBlockTarget(null);
      await fetchUsers();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "상태 변경에 실패했습니다.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="admin-page-content">
      <AdminPageHeader
        icon={Users}
        title="유저 관리"
        description="가입자 상태, 플랜, 크레딧 사용량을 확인하고 필요한 조치를 수행합니다."
        meta={`총 ${total.toLocaleString()}명`}
        actions={<button type="button" onClick={() => void fetchUsers()} className="admin-button-secondary" disabled={loading}><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />새로고침</button>}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1" aria-label="플랜 필터">
          {PLAN_TABS.map((item) => <button key={item} type="button" data-active={plan === item} className="admin-filter-tab" onClick={() => { setPlan(item); setPage(1); }}>{item === "ALL" ? "전체" : item}</button>)}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative block sm:w-80"><span className="sr-only">이름 또는 이메일 검색</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-text-muted)]" aria-hidden="true" /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="이름 또는 이메일 검색" className="admin-input" /></label>
          <select aria-label="정렬 기준" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} className="admin-select"><option value="createdAt_desc">가입일 최신순</option><option value="createdAt_asc">가입일 오래된순</option><option value="credits_desc">크레딧 많은순</option></select>
        </div>
      </div>

      {error ? <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-rose-300/25 bg-rose-300/10 px-4 py-3 text-sm text-rose-200" role="alert"><span>{error}</span><button type="button" onClick={() => void fetchUsers()} className="underline underline-offset-2">다시 시도</button></div> : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <caption className="sr-only">FlowPack 사용자 목록</caption>
          <thead><tr>{["유저", "플랜", "크레딧", "상태", "가입일", "작업"].map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead>
          <tbody>
            {loading ? Array.from({ length: 6 }).map((_, index) => <tr key={index}><td colSpan={6}><div className="admin-skeleton h-8 w-full" /></td></tr>) : null}
            {!loading && users.length === 0 ? <tr><td colSpan={6}><AdminEmptyState title="검색 결과가 없습니다" description="검색어 또는 플랜 필터를 조정해 보세요." /></td></tr> : null}
            {!loading && users.map((user) => {
              const creditPercent = Math.min(100, (user.creditsUsed / Math.max(1, user.creditsTotal)) * 100);
              return <tr key={user.id}>
                <td><div className="flex min-w-48 items-center gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-300/10 text-xs font-bold text-cyan-100">{(user.name ?? user.email)[0].toUpperCase()}</div><div className="min-w-0"><p className="truncate font-semibold text-[var(--admin-text)]">{user.name ?? "이름 미입력"}</p><p className="truncate text-xs text-[var(--admin-text-muted)]">{user.email}</p></div></div></td>
                <td><div className="flex items-center gap-1"><AdminBadge tone={PLAN_TONE[user.plan] ?? "neutral"}>{user.plan}</AdminBadge>{user.role === "ADMIN" ? <AdminBadge tone="danger">ADMIN</AdminBadge> : null}</div></td>
                <td><div className="w-24"><p className="admin-meta mb-1">{user.creditsUsed.toLocaleString()} / {user.creditsTotal.toLocaleString()}</p><div className="h-1.5 overflow-hidden rounded-full bg-[var(--admin-border)]"><div className="h-full rounded-full bg-cyan-300" style={{ width: `${creditPercent}%` }} /></div></div></td>
                <td><button type="button" onClick={() => setBlockTarget(user)} className="admin-badge transition-opacity hover:opacity-80" data-tone={user.isBlocked ? "danger" : "success"} aria-label={`${user.email} ${user.isBlocked ? "정지 해제" : "정지"}`}>{user.isBlocked ? <Ban className="h-3 w-3" aria-hidden="true" /> : <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}{user.isBlocked ? "정지됨" : "활성"}</button></td>
                <td className="whitespace-nowrap text-xs text-[var(--admin-text-muted)]">{format(new Date(user.createdAt), "yyyy.MM.dd", { locale: ko })}</td>
                <td><button type="button" onClick={() => router.push(`/admin/users/${user.id}`)} className="admin-button-secondary min-h-8 px-2.5 text-xs"><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />상세</button></td>
              </tr>;
            })}
          </tbody>
        </table>

        {totalPages > 1 ? <div className="flex items-center justify-between border-t border-[var(--admin-border)] px-4 py-3"><p className="admin-meta">{(page - 1) * 20 + 1}–{Math.min(page * 20, total)} / {total.toLocaleString()}명</p><div className="flex items-center gap-1"><button type="button" className="admin-icon-button min-h-8 min-w-8" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} aria-label="이전 페이지"><ChevronLeft className="h-4 w-4" /></button><span className="admin-meta px-2">{page} / {totalPages}</span><button type="button" className="admin-icon-button min-h-8 min-w-8" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} aria-label="다음 페이지"><ChevronRight className="h-4 w-4" /></button></div></div> : null}
      </div>

      <Dialog open={Boolean(blockTarget)} onOpenChange={(open) => { if (!open && !updating) setBlockTarget(null); }}>
        <DialogContent className="admin-dialog max-w-md rounded-xl bg-[var(--admin-surface)]">
          <DialogHeader><div className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg bg-rose-300/10 text-rose-300"><ShieldAlert className="h-4 w-4" /></div><DialogTitle className="text-[var(--admin-text)]">{blockTarget?.isBlocked ? "계정 정지를 해제할까요?" : "계정을 정지할까요?"}</DialogTitle><DialogDescription className="leading-6 text-[var(--admin-text-secondary)]">{blockTarget?.isBlocked ? "정지를 해제하면 사용자가 다시 로그인하고 서비스를 이용할 수 있습니다." : "정지된 사용자는 로그인과 주요 서비스 이용이 제한됩니다. 대상 이메일을 확인한 뒤 진행하세요."}<span className="mt-2 block break-all font-medium text-[var(--admin-text)]">{blockTarget?.email}</span></DialogDescription></DialogHeader>
          <DialogFooter><button type="button" onClick={() => setBlockTarget(null)} className="admin-button-secondary" disabled={updating}>취소</button><button type="button" onClick={() => void updateBlockStatus()} className={blockTarget?.isBlocked ? "admin-button-primary" : "admin-button-danger"} disabled={updating}>{updating ? "처리 중" : blockTarget?.isBlocked ? "정지 해제" : "계정 정지"}</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
