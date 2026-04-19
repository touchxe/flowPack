"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, Edit, Trash2, Calendar as CalendarIcon,
  RefreshCw, Plus, Layers, FileText, BarChart3, Clock,
  CheckCircle2, Eye, ChevronDown, AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { ContentTypeBadge, ContentStatusBadge } from "@/components/common/content-badge";

type Content = {
  id: string; title: string; type: string;
  status: string; scheduledAt: string | null; createdAt: string;
  thumbnailUrl?: string | null;
  images?: { url: string }[];
};

const STATUS_FILTERS = [
  { label: "전체",      value: "ALL",       icon: <BarChart3 size={13} /> },
  { label: "초안",      value: "DRAFT",     icon: <FileText size={13} /> },
  { label: "예약됨",    value: "SCHEDULED", icon: <Clock size={13} /> },
  { label: "발행 완료", value: "PUBLISHED", icon: <CheckCircle2 size={13} /> },
];

const typeMap: Record<string, "carousel" | "blog" | "video" | "bulk"> = {
  CAROUSEL: "carousel", BLOG: "blog", VIDEO: "video", BULK: "bulk", URL_TO_POST: "bulk",
};
const statusMap: Record<string, "complete" | "draft" | "scheduled" | "archived"> = {
  PUBLISHED: "complete", DRAFT: "draft", SCHEDULED: "scheduled", ARCHIVED: "archived",
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  CAROUSEL:    <Layers size={18} color="#6366F1" />,
  BLOG:        <FileText size={18} color="#059669" />,
  VIDEO:       <BarChart3 size={18} color="#D97706" />,
  BULK:        <Layers size={18} color="#8B5CF6" />,
  URL_TO_POST: <FileText size={18} color="#3B82F6" />,
};
const TYPE_BG: Record<string, string> = {
  CAROUSEL: "#EEF2FF", BLOG: "#ECFDF5", VIDEO: "#FFF7ED",
  BULK: "#F5F3FF", URL_TO_POST: "#F0F9FF",
};

// 콘텐츠의 실제 썸네일 URL 반환
function getThumbnail(c: Content): string | null {
  if (c.thumbnailUrl) return c.thumbnailUrl;
  if (c.images && c.images.length > 0) return c.images[0].url;
  return null;
}

export default function ContentsClient() {
  const router = useRouter();
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  // 선택
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // 삭제 확인 모달
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; label: string } | null>(null);

  useEffect(() => { fetchContents(); }, []);

  const fetchContents = async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const res = await fetch("/api/contents?all=true");
      if (res.ok) { const d = await res.json(); setContents(d.contents || []); }
    } catch {}
    finally { setLoading(false); }
  };

  const filtered = contents
    .filter(c => selectedStatus === "ALL" ? true : c.status === selectedStatus)
    .filter(c => c.title.toLowerCase().includes(search.toLowerCase()));

  // ── 선택 관리 ──
  const allVisible = filtered.map(c => c.id);
  const isAllSelected = allVisible.length > 0 && allVisible.every(id => selected.has(id));
  const isIndeterminate = allVisible.some(id => selected.has(id)) && !isAllSelected;

  const toggleAll = () => {
    if (isAllSelected) {
      setSelected(prev => { const s = new Set(prev); allVisible.forEach(id => s.delete(id)); return s; });
    } else {
      setSelected(prev => new Set([...prev, ...allVisible]));
    }
  };
  const toggleOne = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  // ── 단건 삭제 ──
  const confirmDelete = (ids: string[], label: string) => {
    setDeleteError("");
    setDeleteTarget({ ids, label });
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setBulkDeleting(true);
    setDeleteError("");
    try {
      let res: Response;
      if (deleteTarget.ids.length === 1) {
        res = await fetch(`/api/content/${deleteTarget.ids[0]}`, { method: "DELETE" });
      } else {
        res = await fetch("/api/contents", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: deleteTarget.ids }),
        });
      }
      if (res.ok) {
        setContents(prev => prev.filter(c => !deleteTarget.ids.includes(c.id)));
        setSelected(prev => { const s = new Set(prev); deleteTarget.ids.forEach(id => s.delete(id)); return s; });
        setDeleteTarget(null);
      } else {
        const d = await res.json();
        setDeleteError(d.error || "삭제에 실패했습니다.");
      }
    } catch { setDeleteError("오류가 발생했습니다."); }
    finally { setBulkDeleting(false); }
  };

  const selectedCount = [...selected].filter(id => allVisible.includes(id) || contents.some(c => c.id === id)).length;

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1100, margin: "0 auto" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        .filter-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:9999px; font-size:13px; font-weight:600; cursor:pointer; border:1.5px solid transparent; transition:all 0.15s; }
        .filter-btn.active { background:linear-gradient(135deg,#6366F1,#8B5CF6); color:#fff; box-shadow:0 2px 8px rgba(99,102,241,0.3); }
        .filter-btn:not(.active) { background:#fff; color:#6B7280; border-color:#E5E7EB; }
        .filter-btn:not(.active):hover { border-color:#C7D2FE; color:#6366F1; }
        .search-input { width:240px; height:38px; padding:0 14px 0 36px; border:1.5px solid #E5E7EB; border-radius:10px; font-size:13px; color:#111827; background:#fff; outline:none; transition:all 0.2s; box-sizing:border-box; }
        .search-input:focus { border-color:#6366F1; box-shadow:0 0 0 3px rgba(99,102,241,0.1); }
        .new-btn { display:inline-flex; align-items:center; gap:7px; height:38px; padding:0 18px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; border:none; background:linear-gradient(135deg,#6366F1,#8B5CF6); color:#fff; text-decoration:none; box-shadow:0 2px 8px rgba(99,102,241,0.3); transition:all 0.2s; }
        .new-btn:hover { transform:translateY(-1px); box-shadow:0 6px 16px rgba(99,102,241,0.4); }
        .refresh-btn { width:38px; height:38px; border-radius:10px; background:#fff; border:1.5px solid #E5E7EB; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#9CA3AF; transition:all 0.15s; }
        .refresh-btn:hover { border-color:#C7D2FE; color:#6366F1; }
        .list-row { display:grid; grid-template-columns:40px 56px 1fr 100px 90px 120px 120px; align-items:center; gap:12px; padding:10px 16px; border-bottom:1px solid #F3F4F6; transition:background 0.1s; }
        .list-row:hover { background:#F9FAFB; }
        .list-row.selected { background:#F5F3FF; }
        .list-header { display:grid; grid-template-columns:40px 56px 1fr 100px 90px 120px 120px; align-items:center; gap:12px; padding:8px 16px; background:#F9FAFB; border-bottom:2px solid #E5E7EB; border-top:1px solid #E5E7EB; border-radius:12px 12px 0 0; }
        .icon-btn { width:30px; height:30px; border-radius:7px; border:none; background:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#9CA3AF; transition:all 0.12s; }
        .icon-btn:hover { background:#F3F4F6; color:#374151; }
        .icon-btn.danger:hover { background:#FEF2F2; color:#EF4444; }
        .bulk-bar { display:flex; align-items:center; gap:10px; padding:10px 16px; background:#EEF2FF; border-radius:10px; margin-bottom:12px; animation:slideDown 0.2s ease; }
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      `}</style>

      {/* 페이지 헤더 */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, marginBottom: 4 }}>콘텐츠 목록</h1>
          <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>초안부터 발행 완료까지 한 곳에서 관리하세요.</p>
        </div>
        <Link href="/carousel-lab" className="new-btn">
          <Plus size={15} /> 새 콘텐츠
        </Link>
      </div>

      {/* KPI 요약 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "전체",      value: contents.length,                                       color: "#6366F1", bg: "#EEF2FF" },
          { label: "초안",      value: contents.filter(c => c.status === "DRAFT").length,      color: "#9CA3AF", bg: "#F9FAFB" },
          { label: "예약됨",    value: contents.filter(c => c.status === "SCHEDULED").length,  color: "#D97706", bg: "#FFF7ED" },
          { label: "발행 완료", value: contents.filter(c => c.status === "PUBLISHED").length,  color: "#059669", bg: "#ECFDF5" },
        ].map((k, i) => (
          <div key={i} style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 12, padding: "14px 16px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{k.label}</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: k.color, margin: 0 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* 툴바 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, background: "#fff", padding: "12px 16px", borderRadius: 14, border: "1.5px solid #E5E7EB" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {STATUS_FILTERS.map(f => (
            <button key={f.value} className={`filter-btn${selectedStatus === f.value ? " active" : ""}`} onClick={() => setSelectedStatus(f.value)}>
              {f.icon} {f.label}
              <span style={{ fontSize: 11, opacity: 0.75, marginLeft: 2 }}>
                {f.value === "ALL" ? contents.length : contents.filter(c => c.status === f.value).length}
              </span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <Search size={14} color="#9CA3AF" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input className="search-input" type="text" placeholder="콘텐츠 검색..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="refresh-btn" onClick={fetchContents} title="새로고침">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* 선택 일괄 작업 바 */}
      {selected.size > 0 && (
        <div className="bulk-bar">
          <span style={{ fontSize: 13, fontWeight: 700, color: "#6366F1" }}>{selected.size}개 선택됨</span>
          <button
            onClick={() => confirmDelete([...selected], `${selected.size}개 콘텐츠`)}
            style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 14px", borderRadius: 8, border: "none", background: "#EF4444", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <Trash2 size={13} /> 선택 삭제
          </button>
          <button onClick={() => setSelected(new Set())}
            style={{ display: "flex", alignItems: "center", gap: 4, height: 32, padding: "0 10px", borderRadius: 8, border: "1.5px solid #C7D2FE", background: "#fff", color: "#6366F1", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            선택 해제
          </button>
          {deleteError && (
            <span style={{ fontSize: 12, color: "#EF4444", display: "flex", alignItems: "center", gap: 5 }}>
              <AlertCircle size={13} /> {deleteError}
            </span>
          )}
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 260, gap: 12 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366F1", animation: `bounce 0.8s ${i*0.15}s infinite ease-in-out` }} />)}
          </div>
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>콘텐츠 목록을 불러오는 중...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "72px 0", border: "1.5px dashed #E5E7EB", borderRadius: 16, background: "#FAFAFA" }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Search size={28} color="#6366F1" />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 6 }}>표시할 콘텐츠가 없습니다</h3>
          <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 20 }}>검색 조건을 변경하거나 새 콘텐츠를 만들어보세요.</p>
          <Link href="/carousel-lab" className="new-btn"><Plus size={14} /> 새 콘텐츠 만들기</Link>
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
          {/* 테이블 헤더 */}
          <div className="list-header">
            {/* 전체 선택 체크박스 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={el => { if (el) el.indeterminate = isIndeterminate; }}
                onChange={toggleAll}
                style={{ width: 16, height: 16, accentColor: "#6366F1", cursor: "pointer" }}
              />
            </div>
            <div /> {/* 썸네일 */}
            <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>제목</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>유형</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>상태</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>생성일</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>작업</span>
          </div>

          {/* 목록 행 */}
          {filtered.map(content => {
            const thumb = getThumbnail(content);
            const isChecked = selected.has(content.id);
            return (
              <div key={content.id} className={`list-row${isChecked ? " selected" : ""}`}>
                {/* 체크박스 */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleOne(content.id)}
                    style={{ width: 16, height: 16, accentColor: "#6366F1", cursor: "pointer" }}
                  />
                </div>

                {/* 썸네일 */}
                <div style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: TYPE_BG[content.type] || "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #F3F4F6" }}>
                  {thumb ? (
                    <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    TYPE_ICON[content.type] || <FileText size={18} color="#9CA3AF" />
                  )}
                </div>

                {/* 제목 */}
                <div style={{ minWidth: 0 }}>
                  <Link href={`/content/${content.id}/edit`} style={{ textDecoration: "none" }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.4 }}>
                      {content.title}
                    </p>
                  </Link>
                  {content.scheduledAt && (
                    <div style={{ fontSize: 11, color: "#6366F1", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                      <CalendarIcon size={10} />
                      {format(new Date(content.scheduledAt), "MM.dd HH:mm", { locale: ko })} 예약
                    </div>
                  )}
                </div>

                {/* 유형 */}
                <div>
                  <ContentTypeBadge type={typeMap[content.type] || "blog"} />
                </div>

                {/* 상태 */}
                <div>
                  <ContentStatusBadge status={statusMap[content.status] || "draft"} />
                </div>

                {/* 생성일 */}
                <span style={{ fontSize: 12, color: "#9CA3AF", whiteSpace: "nowrap" }}>
                  {format(new Date(content.createdAt), "yyyy.MM.dd", { locale: ko })}
                </span>

                {/* 액션 */}
                <div style={{ display: "flex", gap: 4 }}>
                  <button className="icon-btn" title="미리보기" onClick={() => router.push(`/content/${content.id}/view`)}>
                    <Eye size={15} />
                  </button>
                  <button className="icon-btn" title="편집" onClick={() => router.push(`/content/${content.id}/edit`)}>
                    <Edit size={15} />
                  </button>
                  <button className="icon-btn danger" title="삭제" onClick={() => confirmDelete([content.id], `"${content.title.slice(0, 20)}..."`)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 삭제 확인 모달 ── */}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", width: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Trash2 size={22} color="#EF4444" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 8 }}>콘텐츠 삭제</h3>
            <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6, marginBottom: 20 }}>
              <strong>{deleteTarget.label}</strong>을(를) 삭제하면 복구할 수 없습니다.<br />계속하시겠습니까?
            </p>
            {deleteError && (
              <div style={{ padding: "10px 12px", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FECACA", fontSize: 13, color: "#DC2626", marginBottom: 16 }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setDeleteTarget(null); setDeleteError(""); }}
                style={{ flex: 1, height: 42, borderRadius: 10, border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                취소
              </button>
              <button onClick={executeDelete} disabled={bulkDeleting}
                style={{ flex: 1, height: 42, borderRadius: 10, border: "none", background: "#EF4444", color: "#fff", fontSize: 14, fontWeight: 700, cursor: bulkDeleting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: bulkDeleting ? 0.7 : 1 }}>
                <Trash2 size={14} /> {bulkDeleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
