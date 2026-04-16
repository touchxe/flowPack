"use client";

// Admin 유저 상세 페이지
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, User, Mail, Calendar, Shield,
  CreditCard, ToggleLeft, ToggleRight, Save,
  FileText, CheckCircle, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

// ─── 타입 ──────────────────────────────────────────────────────
interface UserDetail {
  id: string;
  name: string | null;
  email: string;
  plan: string;
  role: string;
  isBlocked: boolean;
  creditsUsed: number;
  creditsTotal: number;
  createdAt: string;
  updatedAt: string;
  contents: {
    id: string;
    title: string;
    type: string;
    status: string;
    createdAt: string;
  }[];
  subscriptions: {
    id: string;
    plan: string;
    billingCycle: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  }[];
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

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { cls: string; label: string }> = {
    DRAFT: { cls: "bg-slate-700 text-slate-400", label: "초안" },
    SCHEDULED: { cls: "bg-yellow-500/20 text-yellow-400", label: "예약" },
    PUBLISHED: { cls: "bg-emerald-500/20 text-emerald-400", label: "발행" },
    ARCHIVED: { cls: "bg-slate-700 text-slate-500", label: "보관" },
  };
  const { cls, label } = cfg[status] ?? { cls: "bg-slate-700 text-slate-400", label: status };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${cls}`}>{label}</span>
  );
}

// ─── 메인 ──────────────────────────────────────────────────────
export default function AdminUserDetailClient() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // 편집 상태
  const [plan, setPlan] = useState("");
  const [creditsAdjust, setCreditsAdjust] = useState(0);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setUser(data);
        setPlan(data.plan);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  // 저장 핸들러
  const handleSave = async () => {
    setSaving(true);
    const body: Record<string, unknown> = { plan };
    if (creditsAdjust !== 0) body.creditsAdjust = creditsAdjust;

    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const updated = await res.json();
    setUser((prev) => prev ? { ...prev, ...updated } : prev);
    setCreditsAdjust(0);
    setSaving(false);
    setToast("저장되었습니다");
    setTimeout(() => setToast(null), 2000);
  };

  // 정지 토글
  const toggleBlock = async () => {
    if (!user) return;
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBlocked: !user.isBlocked }),
    });
    const updated = await res.json();
    setUser((prev) => prev ? { ...prev, ...updated } : prev);
    setToast(updated.isBlocked ? "계정이 정지되었습니다" : "계정이 활성화되었습니다");
    setTimeout(() => setToast(null), 2000);
  };

  // 역할 토글
  const toggleRole = async () => {
    if (!user) return;
    const newRole = user.role === "ADMIN" ? "USER" : "ADMIN";
    if (newRole === "ADMIN" && !confirm("이 유저를 관리자로 승격합니까?")) return;
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    const updated = await res.json();
    setUser((prev) => prev ? { ...prev, ...updated } : prev);
    setToast(`역할이 ${newRole}로 변경되었습니다`);
    setTimeout(() => setToast(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-blue-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="h-8 w-8 text-slate-600" />
        <p className="text-slate-500">유저를 찾을 수 없습니다</p>
      </div>
    );
  }

  const contentTypeLabels: Record<string, string> = {
    CAROUSEL: "카드뉴스", BLOG: "블로그", VIDEO: "영상",
    BULK: "대량", URL_TO_POST: "URL변환",
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* 토스트 */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-emerald-900 border border-emerald-700 px-4 py-2.5 text-sm text-emerald-300 shadow-lg">
          <CheckCircle className="h-4 w-4" />
          {toast}
        </div>
      )}

      {/* 뒤로가기 + 헤더 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 border border-slate-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          돌아가기
        </button>
        <h1 className="text-xl font-bold text-slate-100">유저 상세</h1>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* 왼쪽: 프로필 */}
        <div className="xl:col-span-1 space-y-4">
          {/* 프로필 카드 */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
            {/* 아바타 */}
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-lg font-bold text-white uppercase">
                {(user.name ?? user.email)[0]}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-100">{user.name ?? "—"}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <PlanBadge plan={user.plan} />
                  {user.role === "ADMIN" && (
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-400">ADMIN</span>
                  )}
                </div>
              </div>
            </div>

            {/* 정보 목록 */}
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span>가입: {format(new Date(user.createdAt), "yyyy.MM.dd", { locale: ko })}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <CreditCard className="h-4 w-4 flex-shrink-0" />
                <span>크레딧: {user.creditsUsed}/{user.creditsTotal}</span>
              </div>
            </div>

            {/* 크레딧 바 */}
            <div className="h-2 w-full rounded-full bg-slate-700">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all"
                style={{ width: `${Math.min(100, (user.creditsUsed / Math.max(1, user.creditsTotal)) * 100)}%` }}
              />
            </div>
          </div>

          {/* 편집 패널 */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-5">
            <h3 className="text-sm font-semibold text-slate-300">편집</h3>

            {/* 플랜 변경 */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500 font-medium">플랜</label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="FREE">FREE</option>
                <option value="STARTER">STARTER</option>
                <option value="PRO">PRO</option>
                <option value="ENTERPRISE">ENTERPRISE</option>
              </select>
            </div>

            {/* 크레딧 조정 */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500 font-medium">
                크레딧 조정 (현재 잔여: {user.creditsTotal - user.creditsUsed})
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCreditsAdjust((v) => v - 10)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  -10
                </button>
                <div className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-center text-sm font-medium text-slate-200">
                  {creditsAdjust >= 0 ? "+" : ""}{creditsAdjust}
                </div>
                <button
                  onClick={() => setCreditsAdjust((v) => v + 10)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  +10
                </button>
              </div>
              <p className="text-[10px] text-slate-600">
                적용 후: {user.creditsTotal + creditsAdjust}개 (사용: {user.creditsUsed})
              </p>
            </div>

            {/* 저장 버튼 */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4" />
              {saving ? "저장 중..." : "저장"}
            </button>

            {/* 구분선 */}
            <div className="border-t border-slate-800" />

            {/* 계정 정지 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">계정 정지</p>
                <p className="text-xs text-slate-500">
                  {user.isBlocked ? "현재 정지 상태" : "현재 활성 상태"}
                </p>
              </div>
              <button onClick={toggleBlock} className="text-slate-400 hover:text-slate-200 transition-colors">
                {user.isBlocked
                  ? <ToggleRight className="h-8 w-8 text-red-400" />
                  : <ToggleLeft className="h-8 w-8 text-slate-500" />
                }
              </button>
            </div>

            {/* 역할 변경 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">관리자 역할</p>
                <p className="text-xs text-slate-500">
                  {user.role === "ADMIN" ? "현재 ADMIN" : "현재 USER"}
                </p>
              </div>
              <button onClick={toggleRole} className="text-slate-400 hover:text-slate-200 transition-colors">
                {user.role === "ADMIN"
                  ? <ToggleRight className="h-8 w-8 text-red-400" />
                  : <ToggleLeft className="h-8 w-8 text-slate-500" />
                }
              </button>
            </div>
          </div>
        </div>

        {/* 오른쪽: 콘텐츠 목록 */}
        <div className="xl:col-span-2 space-y-4">
          {/* 구독 정보 */}
          {user.subscriptions.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">구독 정보</h3>
              {user.subscriptions.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <PlanBadge plan={sub.plan} />
                    <span className="text-slate-400 text-xs">{sub.billingCycle === "YEARLY" ? "연간" : "월간"}</span>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-medium ${sub.status === "ACTIVE" ? "text-emerald-400" : "text-slate-500"}`}>
                      {sub.status}
                    </p>
                    <p className="text-[10px] text-slate-600">
                      {format(new Date(sub.currentPeriodStart), "yyyy.MM.dd")}
                      {" ~ "}
                      {format(new Date(sub.currentPeriodEnd), "yyyy.MM.dd")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 최근 콘텐츠 */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <div className="border-b border-slate-800 px-5 py-3">
              <h3 className="text-sm font-semibold text-slate-300">
                최근 콘텐츠 ({user.contents.length}개)
              </h3>
            </div>
            {user.contents.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-slate-600 text-sm">
                <FileText className="h-6 w-6 mr-2" />
                생성된 콘텐츠 없음
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="px-4 py-2.5 text-left text-xs text-slate-500 font-semibold uppercase">제목</th>
                    <th className="px-4 py-2.5 text-left text-xs text-slate-500 font-semibold uppercase">타입</th>
                    <th className="px-4 py-2.5 text-left text-xs text-slate-500 font-semibold uppercase">상태</th>
                    <th className="px-4 py-2.5 text-left text-xs text-slate-500 font-semibold uppercase">날짜</th>
                  </tr>
                </thead>
                <tbody>
                  {user.contents.map((c) => (
                    <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2.5 text-slate-200 max-w-[200px] truncate">
                        {c.title}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-400">
                        {contentTypeLabels[c.type] ?? c.type}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {format(new Date(c.createdAt), "yyyy.MM.dd")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
