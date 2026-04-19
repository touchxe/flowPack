"use client";

import { useState, useEffect, useRef, useCallback, DragEvent } from "react";
import {
  Upload, Trash2, Copy, Check, Search, RefreshCw,
  Image as ImageIcon, Music, FileText, X, AlertCircle,
  ChevronLeft, ChevronRight, Tag, HardDrive, LayoutGrid, List,
} from "lucide-react";

/* ── 타입 ── */
type MediaType = "IMAGE" | "AUDIO" | "DOCUMENT";
type MediaFile = {
  id: string; name: string; url: string; blobKey: string;
  mimeType: string; mediaType: MediaType; size: number;
  width?: number | null; height?: number | null; duration?: number | null;
  alt?: string | null; tags?: string | null; createdAt: string;
};

/* ── 상수 ── */
const PAGE_SIZE = 24;
const PLAN_LIMITS: Record<string, number> = {
  FREE: 100 * 1024 * 1024,
  STARTER: 1024 * 1024 * 1024,
  PRO: 10 * 1024 * 1024 * 1024,
};
const TYPE_FILTERS = [
  { label: "전체",   value: "ALL" },
  { label: "이미지", value: "IMAGE" },
  { label: "오디오", value: "AUDIO" },
  { label: "문서",   value: "DOCUMENT" },
];

/* ── 유틸 ── */
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
function fmtDuration(sec?: number | null) {
  if (!sec) return "";
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function typeIcon(t: MediaType, size = 20) {
  if (t === "IMAGE")    return <ImageIcon size={size} color="#6366F1" />;
  if (t === "AUDIO")    return <Music size={size} color="#059669" />;
  return <FileText size={size} color="#D97706" />;
}
function typeColor(t: MediaType) {
  if (t === "IMAGE")    return "#EEF2FF";
  if (t === "AUDIO")    return "#ECFDF5";
  return "#FFF7ED";
}

/* ══════════════════════════════════════════════════════
   메인 컴포넌트
══════════════════════════════════════════════════════ */
export default function MediaClient() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [usageBytes, setUsageBytes] = useState(0);

  const [typeFilter, setTypeFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("date");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // 선택
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // 상세 패널
  const [detail, setDetail] = useState<MediaFile | null>(null);
  const [editAlt, setEditAlt] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState("");
  const [savingDetail, setSavingDetail] = useState(false);

  // 업로드
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<{ name: string; progress: number; error?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 삭제 모달
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 복사
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /* ── 데이터 로드 ── */
  const load = useCallback(async (page = currentPage) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        type: typeFilter, search, sort,
        page: String(page), limit: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/media?${qs}`);
      if (!res.ok) return;
      const d = await res.json();
      setFiles(d.files);
      setTotal(d.total);
      setTotalPages(d.totalPages);
      setUsageBytes(d.usageBytes);
      setCurrentPage(page);
    } finally { setLoading(false); }
  }, [typeFilter, search, sort, currentPage]);

  useEffect(() => { load(1); }, [typeFilter, search, sort]); // eslint-disable-line

  /* ── 업로드 ── */
  const uploadFiles = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList).slice(0, 10);
    setUploads(arr.map(f => ({ name: f.name, progress: 0 })));

    const results = await Promise.allSettled(arr.map(async (file, i) => {
      const fd = new FormData();
      fd.append("file", file);
      setUploads(prev => prev.map((u, idx) => idx === i ? { ...u, progress: 30 } : u));
      const res = await fetch("/api/media/upload", { method: "POST", body: fd });
      setUploads(prev => prev.map((u, idx) => idx === i ? { ...u, progress: 80 } : u));
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "업로드 실패");
      }
      setUploads(prev => prev.map((u, idx) => idx === i ? { ...u, progress: 100 } : u));
      return (await res.json()).file as MediaFile;
    }));

    results.forEach((r, i) => {
      if (r.status === "rejected") {
        setUploads(prev => prev.map((u, idx) => idx === i ? { ...u, error: r.reason.message } : u));
      }
    });

    const newFiles = results.filter(r => r.status === "fulfilled").map(r => (r as PromiseFulfilledResult<MediaFile>).value);
    if (newFiles.length > 0) {
      setFiles(prev => [...newFiles, ...prev]);
      setTotal(t => t + newFiles.length);
    }

    setTimeout(() => setUploads([]), 2500);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false);
    const dt = e.dataTransfer;
    if (dt.files.length) uploadFiles(dt.files);
  };

  /* ── 단건/일괄 삭제 ── */
  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        deleteTarget.ids.length === 1 ? `/api/media/${deleteTarget.ids[0]}` : "/api/media",
        {
          method: "DELETE",
          ...(deleteTarget.ids.length > 1 ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: deleteTarget.ids }),
          } : {}),
        }
      );
      if (res.ok) {
        setFiles(prev => prev.filter(f => !deleteTarget.ids.includes(f.id)));
        setTotal(t => t - deleteTarget.ids.length);
        setSelected(new Set());
        if (detail && deleteTarget.ids.includes(detail.id)) setDetail(null);
        setDeleteTarget(null);
      }
    } finally { setDeleting(false); }
  };

  /* ── 상세 패널 저장 ── */
  const saveDetail = async () => {
    if (!detail) return;
    setSavingDetail(true);
    const res = await fetch(`/api/media/${detail.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alt: editAlt, tags: editTags }),
    });
    if (res.ok) {
      const { file } = await res.json();
      setFiles(prev => prev.map(f => f.id === file.id ? file : f));
      setDetail(file);
    }
    setSavingDetail(false);
  };

  const openDetail = (f: MediaFile) => {
    setDetail(f);
    setEditAlt(f.alt ?? "");
    setEditTags(f.tags ? JSON.parse(f.tags) : []);
    setEditTagInput("");
  };

  const copyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  /* ── 선택 ── */
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  /* ── 페이지네이션 ── */
  const goPage = (p: number) => load(p);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
      acc.push(p); return acc;
    }, []);

  /* ── 렌더 ── */
  const planLimitLabel = (() => {
    // 실제 플랜 정보를 세션에서 가져오기 어려우므로 usage 기준으로 표시
    const pct = Math.min(100, (usageBytes / PLAN_LIMITS.FREE) * 100).toFixed(1);
    return { pct: parseFloat(pct), label: `${fmtSize(usageBytes)} 사용됨` };
  })();

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, background: "#F7F8FA" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; box-sizing:border-box; }
        .filter-btn { display:inline-flex; align-items:center; gap:5px; padding:6px 14px; border-radius:9999px; font-size:13px; font-weight:600; cursor:pointer; border:1.5px solid transparent; transition:all 0.15s; font-family:inherit; }
        .filter-btn.active { background:linear-gradient(135deg,#6366F1,#8B5CF6); color:#fff; }
        .filter-btn:not(.active) { background:#fff; color:#6B7280; border-color:#E5E7EB; }
        .filter-btn:not(.active):hover { border-color:#C7D2FE; color:#6366F1; }
        .search-input { height:36px; padding:0 12px 0 34px; border:1.5px solid #E5E7EB; border-radius:9px; font-size:13px; color:#111827 !important; background:#fff !important; outline:none; width:200px; font-family:inherit; }
        .search-input:focus { border-color:#6366F1; box-shadow:0 0 0 3px rgba(99,102,241,0.1); }
        .upload-btn { display:inline-flex; align-items:center; gap:6px; height:36px; padding:0 16px; border-radius:9px; font-size:13px; font-weight:700; cursor:pointer; border:none; background:linear-gradient(135deg,#6366F1,#8B5CF6); color:#fff; font-family:inherit; transition:all 0.2s; }
        .upload-btn:hover { transform:translateY(-1px); box-shadow:0 6px 16px rgba(99,102,241,0.35); }
        .grid-item { position:relative; border-radius:12px; overflow:hidden; border:2px solid transparent; cursor:pointer; transition:all 0.15s; background:#fff; }
        .grid-item:hover { border-color:#C7D2FE; transform:translateY(-2px); box-shadow:0 4px 16px rgba(0,0,0,0.08); }
        .grid-item.selected { border-color:#6366F1; box-shadow:0 0 0 3px rgba(99,102,241,0.15); }
        .grid-item .cb { position:absolute; top:8px; left:8px; width:18px; height:18px; border-radius:5px; background:rgba(255,255,255,0.9); border:1.5px solid #D1D5DB; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.1s; cursor:pointer; z-index:2; }
        .grid-item:hover .cb, .grid-item.selected .cb { opacity:1; }
        .grid-item.selected .cb { background:#6366F1; border-color:#6366F1; }
        .icon-btn { width:30px; height:30px; border-radius:7px; border:none; background:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#9CA3AF; transition:all 0.12s; font-family:inherit; }
        .icon-btn:hover { background:#F3F4F6; color:#374151; }
        .icon-btn.danger:hover { background:#FEF2F2; color:#EF4444; }
        .pag-btn { min-width:32px; height:32px; padding:0 6px; border-radius:7px; border:1.5px solid #E5E7EB; background:#fff !important; color:#374151 !important; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s; font-family:inherit; }
        .pag-btn:hover:not(:disabled) { border-color:#C7D2FE; color:#6366F1 !important; }
        .pag-btn.active { background:linear-gradient(135deg,#6366F1,#8B5CF6) !important; color:#fff !important; border-color:transparent; }
        .pag-btn:disabled { opacity:0.35; cursor:not-allowed; }
        .detail-input { width:100%; border:1.5px solid #E5E7EB; border-radius:8px; padding:8px 10px; font-size:13px; color:#111827 !important; background:#fff !important; outline:none; font-family:inherit; resize:none; }
        .detail-input:focus { border-color:#6366F1; box-shadow:0 0 0 3px rgba(99,102,241,0.1); }
        .tag-chip { display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:9999px; background:#EEF2FF; color:#6366F1; font-size:11px; font-weight:600; }
        .list-row { display:grid; grid-template-columns:40px 48px 1fr 80px 100px 80px 100px; align-items:center; gap:10px; padding:10px 14px; border-bottom:1px solid #F3F4F6; cursor:pointer; transition:background 0.1s; }
        .list-row:hover { background:#F9FAFB; }
        .list-row.selected { background:#F5F3FF; }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
      `}</style>

      {/* ════════════ 좌측 메인 영역 ════════════ */}
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "24px 20px 24px 28px" }}>

        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, marginBottom: 4 }}>미디어 라이브러리</h1>
            <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>이미지, 오디오 파일을 업로드하고 관리하세요.</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {selected.size > 0 && (
              <button onClick={() => setDeleteTarget({ ids: [...selected], label: `${selected.size}개 파일` })}
                style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", borderRadius: 9, border: "none", background: "#EF4444", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <Trash2 size={13} /> {selected.size}개 삭제
              </button>
            )}
            <button className="upload-btn" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} /> 업로드
            </button>
            <input ref={fileInputRef} type="file" multiple accept="image/*,audio/*,.pdf" style={{ display: "none" }} onChange={e => e.target.files && uploadFiles(e.target.files)} />
          </div>
        </div>

        {/* 사용량 게이지 */}
        <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
          <HardDrive size={16} color="#6366F1" />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{planLimitLabel.label}</span>
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>FREE 플랜 100 MB</span>
            </div>
            <div style={{ height: 6, background: "#F3F4F6", borderRadius: 9999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${planLimitLabel.pct}%`, background: planLimitLabel.pct > 85 ? "#EF4444" : "linear-gradient(90deg,#6366F1,#8B5CF6)", borderRadius: 9999, transition: "width 0.4s" }} />
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: planLimitLabel.pct > 85 ? "#EF4444" : "#6366F1" }}>{planLimitLabel.pct.toFixed(0)}%</span>
        </div>

        {/* 툴바 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {TYPE_FILTERS.map(f => (
              <button key={f.value} className={`filter-btn${typeFilter === f.value ? " active" : ""}`} onClick={() => { setTypeFilter(f.value); setCurrentPage(1); }}>
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <Search size={13} color="#9CA3AF" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input className="search-input" placeholder="파일명 검색..." value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} />
            </div>
            <select value={sort} onChange={e => setSort(e.target.value)}
              style={{ height: 36, padding: "0 10px", border: "1.5px solid #E5E7EB", borderRadius: 9, fontSize: 13, color: "#374151", background: "#fff", fontFamily: "inherit", cursor: "pointer" }}>
              <option value="date">최신순</option>
              <option value="name">이름순</option>
              <option value="size">크기순</option>
            </select>
            <button onClick={() => setViewMode(v => v === "grid" ? "list" : "grid")}
              style={{ width: 36, height: 36, border: "1.5px solid #E5E7EB", borderRadius: 9, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280" }}>
              {viewMode === "grid" ? <List size={15} /> : <LayoutGrid size={15} />}
            </button>
            <button onClick={() => load(1)} style={{ width: 36, height: 36, border: "1.5px solid #E5E7EB", borderRadius: 9, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280" }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* 드래그 앤 드롭 업로드 영역 */}
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? "#6366F1" : "#D1D5DB"}`,
            borderRadius: 14,
            padding: "20px",
            textAlign: "center",
            cursor: "pointer",
            background: isDragging ? "#F5F3FF" : "#FAFAFA",
            transition: "all 0.2s",
            marginBottom: 16,
          }}>
          <Upload size={22} color={isDragging ? "#6366F1" : "#9CA3AF"} style={{ margin: "0 auto 8px" }} />
          <p style={{ fontSize: 13, color: isDragging ? "#6366F1" : "#9CA3AF", margin: 0, fontWeight: 600 }}>
            파일을 드래그하거나 클릭해서 업로드 (이미지·오디오·PDF, 최대 10개)
          </p>
        </div>

        {/* 업로드 진행 */}
        {uploads.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {uploads.map((u, i) => (
              <div key={i} style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>{u.name}</span>
                  {u.error ? <span style={{ fontSize: 12, color: "#EF4444" }}>{u.error}</span> : <span style={{ fontSize: 12, color: "#6366F1", fontWeight: 700 }}>{u.progress}%</span>}
                </div>
                <div style={{ height: 4, background: "#F3F4F6", borderRadius: 9999 }}>
                  <div style={{ height: "100%", width: `${u.progress}%`, background: u.error ? "#EF4444" : "linear-gradient(90deg,#6366F1,#8B5CF6)", borderRadius: 9999, transition: "width 0.3s" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 파일 그리드 / 목록 */}
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, gap: 8 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366F1", animation: `bounce 0.8s ${i*0.15}s infinite` }} />)}
          </div>
        ) : files.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 0", color: "#9CA3AF" }}>
            <ImageIcon size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>파일이 없습니다</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>위 업로드 영역으로 파일을 추가해보세요.</p>
          </div>
        ) : viewMode === "grid" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12, marginBottom: 16 }}>
            {files.map(f => (
              <div key={f.id} className={`grid-item${selected.has(f.id) ? " selected" : ""}`}
                onClick={() => openDetail(f)}>
                {/* 체크박스 */}
                <div className="cb" onClick={e => toggleSelect(f.id, e)}>
                  {selected.has(f.id) && <Check size={11} color="#fff" />}
                </div>
                {/* 썸네일 */}
                <div style={{ height: 120, background: typeColor(f.mediaType), display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {f.mediaType === "IMAGE" ? (
                    <img src={f.url} alt={f.alt ?? f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    typeIcon(f.mediaType, 32)
                  )}
                </div>
                {/* 정보 */}
                <div style={{ padding: "8px 10px" }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</p>
                  <p style={{ fontSize: 11, color: "#9CA3AF", margin: "2px 0 0" }}>{fmtSize(f.size)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // 목록형
          <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "40px 48px 1fr 80px 100px 80px 100px", gap: 10, padding: "8px 14px", background: "#F9FAFB", borderBottom: "2px solid #E5E7EB" }}>
              {["","","파일명","유형","크기","업로드일","작업"].map((h,i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" }}>{h}</span>
              ))}
            </div>
            {files.map(f => (
              <div key={f.id} className={`list-row${selected.has(f.id) ? " selected" : ""}`} onClick={() => openDetail(f)}>
                <div onClick={e => toggleSelect(f.id, e)} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <input type="checkbox" checked={selected.has(f.id)} onChange={() => {}} style={{ width: 15, height: 15, accentColor: "#6366F1" }} />
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: typeColor(f.mediaType), display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {f.mediaType === "IMAGE" ? <img src={f.url} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : typeIcon(f.mediaType, 20)}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                <span style={{ fontSize: 12, color: "#6B7280" }}>{f.mediaType}</span>
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>{fmtSize(f.size)}</span>
                <span style={{ fontSize: 12, color: "#9CA3AF", whiteSpace: "nowrap" }}>{new Date(f.createdAt).toLocaleDateString("ko")}</span>
                <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                  <button className="icon-btn" onClick={() => copyUrl(f.id, f.url)} title="URL 복사">
                    {copiedId === f.id ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                  </button>
                  <button className="icon-btn danger" onClick={() => setDeleteTarget({ ids: [f.id], label: f.name })} title="삭제">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 2px" }}>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>총 {total.toLocaleString()}개</span>
            <div style={{ display: "flex", gap: 4 }}>
              <button className="pag-btn" onClick={() => goPage(1)} disabled={currentPage === 1}>«</button>
              <button className="pag-btn" onClick={() => goPage(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={13} /></button>
              {pageNumbers.map((p, i) => typeof p === "string"
                ? <span key={`e${i}`} style={{ padding: "0 4px", color: "#9CA3AF" }}>…</span>
                : <button key={p} className={`pag-btn${currentPage === p ? " active" : ""}`} onClick={() => goPage(p)}>{p}</button>
              )}
              <button className="pag-btn" onClick={() => goPage(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight size={13} /></button>
              <button className="pag-btn" onClick={() => goPage(totalPages)} disabled={currentPage === totalPages}>»</button>
            </div>
          </div>
        )}
      </div>

      {/* ════════════ 우측 상세 패널 ════════════ */}
      {detail && (
        <div style={{ width: 280, borderLeft: "1.5px solid #E5E7EB", background: "#fff", overflowY: "auto", padding: "20px 18px", animation: "fadeIn 0.2s ease", flexShrink: 0 }}>
          {/* 닫기 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>파일 정보</span>
            <button onClick={() => setDetail(null)} className="icon-btn"><X size={15} /></button>
          </div>

          {/* 미리보기 */}
          <div style={{ borderRadius: 12, overflow: "hidden", background: typeColor(detail.mediaType), marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 140 }}>
            {detail.mediaType === "IMAGE" ? (
              <img src={detail.url} alt={detail.alt ?? detail.name} style={{ maxWidth: "100%", maxHeight: 180, objectFit: "contain" }} />
            ) : detail.mediaType === "AUDIO" ? (
              <div style={{ padding: "16px", width: "100%" }}>
                {typeIcon("AUDIO", 36)}
                <audio controls src={detail.url} style={{ width: "100%", marginTop: 10 }} />
              </div>
            ) : (
              <div style={{ padding: 24 }}>{typeIcon("DOCUMENT", 36)}</div>
            )}
          </div>

          {/* 파일 메타 */}
          <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 14, display: "flex", flexDirection: "column", gap: 4 }}>
            <div><strong>파일명:</strong> {detail.name}</div>
            <div><strong>크기:</strong> {fmtSize(detail.size)}</div>
            {detail.width && <div><strong>해상도:</strong> {detail.width}×{detail.height}</div>}
            {detail.duration && <div><strong>길이:</strong> {fmtDuration(detail.duration)}</div>}
            <div><strong>업로드:</strong> {new Date(detail.createdAt).toLocaleDateString("ko")}</div>
          </div>

          {/* URL 복사 */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 5 }}>URL</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input readOnly value={detail.url}
                style={{ flex: 1, fontSize: 11, border: "1.5px solid #E5E7EB", borderRadius: 7, padding: "6px 8px", color: "#374151", background: "#F9FAFB", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} />
              <button onClick={() => copyUrl(detail.id, detail.url)} className="icon-btn" style={{ border: "1.5px solid #E5E7EB", borderRadius: 7, width: 32, height: 32, flexShrink: 0 }}>
                {copiedId === detail.id ? <Check size={13} color="#059669" /> : <Copy size={13} />}
              </button>
            </div>
          </div>

          {/* Alt 텍스트 */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 5 }}>Alt 텍스트 (SEO)</label>
            <textarea className="detail-input" rows={2} value={editAlt} onChange={e => setEditAlt(e.target.value)} placeholder="이미지 대체 텍스트..." />
          </div>

          {/* 태그 */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 5 }}>
              <Tag size={11} style={{ display: "inline", verticalAlign: "-1px", marginRight: 3 }} />태그
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 7 }}>
              {editTags.map(tag => (
                <span key={tag} className="tag-chip">
                  {tag}
                  <button onClick={() => setEditTags(prev => prev.filter(t => t !== tag))} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, color: "#6366F1" }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              <input className="detail-input" style={{ flex: 1 }} value={editTagInput}
                onChange={e => setEditTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && editTagInput.trim()) { setEditTags(p => [...new Set([...p, editTagInput.trim()])]); setEditTagInput(""); } }}
                placeholder="태그 입력 후 Enter" />
            </div>
          </div>

          {/* 저장 / 삭제 */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={saveDetail} disabled={savingDetail}
              style={{ flex: 1, height: 38, borderRadius: 9, border: "none", background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: savingDetail ? 0.7 : 1 }}>
              {savingDetail ? "저장 중..." : "저장"}
            </button>
            <button onClick={() => setDeleteTarget({ ids: [detail.id], label: detail.name })}
              style={{ height: 38, padding: "0 14px", borderRadius: 9, border: "1.5px solid #FECACA", background: "#FEF2F2", color: "#EF4444", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ════════════ 삭제 확인 모달 ════════════ */}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", width: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <Trash2 size={22} color="#EF4444" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 6 }}>파일 삭제</h3>
            <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 20, lineHeight: 1.6 }}>
              <strong>{deleteTarget.label}</strong>을(를) 삭제하면 복구할 수 없습니다.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)}
                style={{ flex: 1, height: 42, borderRadius: 10, border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>취소</button>
              <button onClick={executeDelete} disabled={deleting}
                style={{ flex: 1, height: 42, borderRadius: 10, border: "none", background: "#EF4444", color: "#fff", fontSize: 14, fontWeight: 700, cursor: deleting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: deleting ? 0.7 : 1, fontFamily: "inherit" }}>
                <Trash2 size={14} /> {deleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
