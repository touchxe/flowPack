"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Megaphone, Trash2, Edit2, Eye, EyeOff, CheckCircle, X } from "lucide-react";
import { format } from "date-fns";

// ─── 타입 ────────────────────────────────────────────
interface Notice {
  id: string;
  title: string;
  body: string;
  type: string;
  targetPlan: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  MAINTENANCE: { bg: "bg-red-500/15",    text: "text-red-400",    label: "점검" },
  FEATURE:     { bg: "bg-blue-500/15",   text: "text-blue-400",   label: "기능" },
  MARKETING:   { bg: "bg-purple-500/15", text: "text-purple-400", label: "마케팅" },
  URGENT:      { bg: "bg-orange-500/15", text: "text-orange-400", label: "긴급" },
};

function TypeBadge({ type }: { type: string }) {
  const s = TYPE_STYLES[type] ?? TYPE_STYLES.FEATURE;
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

// ─── 모달 ────────────────────────────────────────────
function NoticeModal({ notice, onClose, onSave }: {
  notice: Partial<Notice> | null;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = useState(notice?.title ?? "");
  const [body, setBody] = useState(notice?.body ?? "");
  const [type, setType] = useState(notice?.type ?? "FEATURE");
  const [targetPlan, setTargetPlan] = useState(notice?.targetPlan ?? "");
  const [isPublished, setIsPublished] = useState(notice?.isPublished ?? false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    await onSave({
      title: title.trim(),
      body: body.trim(),
      type,
      targetPlan: targetPlan || null,
      isPublished,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h3 className="text-sm font-bold text-slate-200">
            {notice?.id ? "공지 수정" : "공지 작성"}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-slate-500 font-medium">제목</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
              placeholder="공지 제목"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium">내용</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none resize-none"
              placeholder="공지 내용을 입력하세요..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">유형</label>
              <select value={type} onChange={e => setType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
              >
                <option value="FEATURE">기능 안내</option>
                <option value="MAINTENANCE">서비스 점검</option>
                <option value="MARKETING">마케팅</option>
                <option value="URGENT">긴급</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">대상 플랜</label>
              <select value={targetPlan} onChange={e => setTargetPlan(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">전체</option>
                <option value="FREE">FREE</option>
                <option value="STARTER">STARTER</option>
                <option value="PRO">PRO</option>
                <option value="ENTERPRISE">ENTERPRISE</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-300">즉시 게시</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-4">
          <button onClick={onClose} className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-400 hover:bg-slate-700 transition-colors">
            취소
          </button>
          <button onClick={handleSubmit} disabled={saving || !title.trim() || !body.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {saving ? "저장 중..." : notice?.id ? "수정" : "등록"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 ────────────────────────────────────────────
export default function NoticesClient() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Partial<Notice> | null | "new">(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchNotices = useCallback(async () => {
    const res = await fetch("/api/admin/notices");
    const data = await res.json();
    setNotices(data.notices ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  // 등록
  const handleCreate = async (data: Record<string, unknown>) => {
    await fetch("/api/admin/notices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setModal(null);
    showToast("공지가 등록되었습니다");
    fetchNotices();
  };

  // 수정
  const handleUpdate = async (data: Record<string, unknown>) => {
    const id = (modal as Notice)?.id;
    if (!id) return;
    await fetch(`/api/admin/notices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setModal(null);
    showToast("공지가 수정되었습니다");
    fetchNotices();
  };

  // 삭제
  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await fetch(`/api/admin/notices/${id}`, { method: "DELETE" });
    showToast("공지가 삭제되었습니다");
    fetchNotices();
  };

  // 게시 토글
  const handleToggle = async (notice: Notice) => {
    await fetch(`/api/admin/notices/${notice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !notice.isPublished }),
    });
    showToast(notice.isPublished ? "게시 취소됨" : "게시 완료");
    fetchNotices();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-indigo-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* 토스트 */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-emerald-900 border border-emerald-700 px-4 py-2.5 text-sm text-emerald-300 shadow-lg">
          <CheckCircle className="h-4 w-4" />{toast}
        </div>
      )}

      {/* 모달 */}
      {modal !== null && (
        <NoticeModal
          notice={modal === "new" ? {} : (modal as Notice)}
          onClose={() => setModal(null)}
          onSave={modal === "new" ? handleCreate : handleUpdate}
        />
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">공지사항</h1>
          <p className="text-sm text-slate-500 mt-1">서비스 점검, 기능 안내, 마케팅 공지 관리</p>
        </div>
        <button
          onClick={() => setModal("new")}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          공지 작성
        </button>
      </div>

      {/* 테이블 */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-600 uppercase">유형</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-600 uppercase">제목</th>
              <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-600 uppercase">대상</th>
              <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-600 uppercase">게시</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-600 uppercase">등록일</th>
              <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-600 uppercase">액션</th>
            </tr>
          </thead>
          <tbody>
            {notices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-600">
                  <Megaphone className="h-8 w-8 mx-auto mb-2 text-slate-700" />
                  등록된 공지가 없습니다
                </td>
              </tr>
            ) : notices.map(n => (
              <tr key={n.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3"><TypeBadge type={n.type} /></td>
                <td className="px-4 py-3 text-slate-200 max-w-[250px] truncate">{n.title}</td>
                <td className="px-4 py-3 text-center text-xs text-slate-400">{n.targetPlan ?? "전체"}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleToggle(n)} className="transition-colors">
                    {n.isPublished
                      ? <Eye className="h-4 w-4 text-emerald-400" />
                      : <EyeOff className="h-4 w-4 text-slate-600" />
                    }
                  </button>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{format(new Date(n.createdAt), "yyyy.MM.dd")}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setModal(n)} className="rounded p-1.5 text-slate-500 hover:bg-slate-700 hover:text-slate-300 transition-colors">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(n.id)} className="rounded p-1.5 text-slate-500 hover:bg-red-500/15 hover:text-red-400 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
