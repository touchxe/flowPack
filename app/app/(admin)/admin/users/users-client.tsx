"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronLeft, ChevronRight, Ban, CheckCircle, ExternalLink, RefreshCw, Users } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface User {
  id: string; name: string | null; email: string; plan: string; role: string;
  isBlocked: boolean; creditsUsed: number; creditsTotal: number; createdAt: string;
}

const PLAN_COLOR: Record<string, { color: string; bg: string }> = {
  FREE:       { color: "#94A3B8", bg: "#1E293B" },
  STARTER:    { color: "var(--brand-400)", bg: "rgba(var(--brand-rgb), 0.13)" },
  PRO:        { color: "var(--brand-300)", bg: "rgba(6, 182, 212, 0.13)" },
  ENTERPRISE: { color: "#FCD34D", bg: "#F59E0B20" },
};
const PLAN_TABS = ["ALL", "FREE", "STARTER", "PRO", "ENTERPRISE"];

function PlanBadge({ plan }: { plan: string }) {
  const { color, bg } = PLAN_COLOR[plan] ?? { color: "#94A3B8", bg: "#1E293B" };
  return <span style={{ fontSize: 10, fontWeight: 800, color, background: bg, padding: "2px 7px", borderRadius: 5, textTransform: "uppercase" as const }}>{plan}</span>;
}

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
  const [searchInput, setSearchInput] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ q, plan: plan === "ALL" ? "" : plan, page: String(page), sort });
    const res = await fetch(`/api/admin/users?${params}`);
    const data = await res.json();
    setUsers(data.users ?? []); setTotal(data.total ?? 0); setTotalPages(data.totalPages ?? 1);
    setLoading(false);
  }, [q, plan, page, sort]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => {
    const t = setTimeout(() => { setQ(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const toggleBlock = async (id: string, current: boolean) => {
    await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isBlocked: !current }) });
    fetchUsers();
  };

  const TH: React.CSSProperties = { padding: "10px 16px", textAlign: "left" as const, fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase" as const, letterSpacing: "0.07em", borderBottom: "1px solid #1E293B" };

  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(var(--brand-rgb), 0.13)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users size={17} color="var(--brand-400)" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: "#F1F5F9", margin: 0 }}>유저 관리</h1>
            <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>총 {total.toLocaleString()}명</p>
          </div>
        </div>
        <button onClick={fetchUsers} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "1px solid #1E293B", background: "none", color: "#64748B", fontSize: 12, cursor: "pointer" }}>
          <RefreshCw size={13} /> 새로고침
        </button>
      </div>

      {/* 플랜 탭 */}
      <div style={{ display: "flex", gap: 4 }}>
        {PLAN_TABS.map(p => (
          <button key={p} onClick={() => { setPlan(p); setPage(1); }}
            style={{ padding: "6px 14px", borderRadius: 8, border: plan === p ? "1px solid var(--brand-500)" : "1px solid transparent", background: plan === p ? "rgba(var(--brand-rgb), 0.08)" : "none", color: plan === p ? "var(--brand-400)" : "#64748B", fontSize: 12, fontWeight: plan === p ? 700 : 500, cursor: "pointer", transition: "all 0.15s" }}>
            {p}
          </button>
        ))}
      </div>

      {/* 검색 + 정렬 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <Search size={14} color="#475569" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="이름 또는 이메일 검색..."
            style={{ width: "100%", height: 38, paddingLeft: 36, paddingRight: 12, border: "1px solid #1E293B", borderRadius: 9, background: "#0F172A", color: "#CBD5E1", fontSize: 13, outline: "none", boxSizing: "border-box" as const }}
            onFocus={e => (e.target.style.borderColor = "var(--brand-500)")} onBlur={e => (e.target.style.borderColor = "#1E293B")} />
        </div>
        <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}
          style={{ height: 38, padding: "0 12px", borderRadius: 9, border: "1px solid #1E293B", background: "#0F172A", color: "#94A3B8", fontSize: 12, outline: "none", cursor: "pointer" }}>
          <option value="createdAt_desc">가입일 최신순</option>
          <option value="createdAt_asc">가입일 오래된순</option>
          <option value="credits_desc">크레딧 많은순</option>
        </select>
      </div>

      {/* 테이블 */}
      <div style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#0B1120" }}>
              {["유저", "플랜", "크레딧", "상태", "가입일", "작업"].map(h => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: "60px 0" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", border: "3px solid #1E293B", borderTopColor: "var(--brand-500)", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
              </td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: "60px 0", color: "#334155", fontSize: 13 }}>검색 결과가 없습니다</td></tr>
            ) : users.map(user => (
              <tr key={user.id} style={{ borderBottom: "1px solid #1E293B50", transition: "background 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#ffffff05")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                {/* 유저 */}
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(var(--brand-rgb), 0.13)", border: "1.5px solid rgba(var(--brand-rgb), 0.19)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "var(--brand-400)", flexShrink: 0 }}>
                      {(user.name ?? user.email)[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#E2E8F0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>{user.name ?? "—"}</p>
                      <p style={{ fontSize: 11, color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>{user.email}</p>
                    </div>
                  </div>
                </td>
                {/* 플랜 */}
                <td style={{ padding: "12px 16px" }}>
                  <PlanBadge plan={user.plan} />
                  {user.role === "ADMIN" && <span style={{ marginLeft: 5, fontSize: 9, fontWeight: 800, color: "#ef4444", background: "#ef444420", padding: "2px 6px", borderRadius: 4 }}>ADMIN</span>}
                </td>
                {/* 크레딧 */}
                <td style={{ padding: "12px 16px" }}>
                  <p style={{ fontSize: 12, color: "#94A3B8", marginBottom: 4 }}>{user.creditsUsed}/{user.creditsTotal}</p>
                  <div style={{ width: 80, height: 4, borderRadius: 2, background: "#1E293B", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, (user.creditsUsed / Math.max(1, user.creditsTotal)) * 100)}%`, background: "linear-gradient(90deg,var(--brand-500),var(--brand-500))", borderRadius: 2 }} />
                  </div>
                </td>
                {/* 상태 */}
                <td style={{ padding: "12px 16px" }}>
                  <button onClick={() => toggleBlock(user.id, user.isBlocked)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, background: user.isBlocked ? "#ef444420" : "#10b98120", color: user.isBlocked ? "#ef4444" : "#10b981", transition: "all 0.15s" }}>
                    {user.isBlocked ? <><Ban size={11} /> 정지</> : <><CheckCircle size={11} /> 활성</>}
                  </button>
                </td>
                {/* 가입일 */}
                <td style={{ padding: "12px 16px", fontSize: 12, color: "#475569" }}>
                  {format(new Date(user.createdAt), "yyyy.MM.dd", { locale: ko })}
                </td>
                {/* 작업 */}
                <td style={{ padding: "12px 16px" }}>
                  <button onClick={() => router.push(`/admin/users/${user.id}`)}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, border: "1px solid #1E293B", background: "none", color: "#64748B", fontSize: 11, cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--brand-500)"; (e.currentTarget as HTMLElement).style.color = "var(--brand-400)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1E293B"; (e.currentTarget as HTMLElement).style.color = "#64748B"; }}>
                    <ExternalLink size={11} /> 상세
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #1E293B", padding: "10px 16px" }}>
            <p style={{ fontSize: 11, color: "#475569" }}>{(page - 1) * 20 + 1}–{Math.min(page * 20, total)} / {total}명</p>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: 6, borderRadius: 6, border: "none", background: "none", color: "#475569", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.3 : 1 }}>
                <ChevronLeft size={15} />
              </button>
              <span style={{ fontSize: 11, color: "#475569", padding: "0 8px" }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: 6, borderRadius: 6, border: "none", background: "none", color: "#475569", cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.3 : 1 }}>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
