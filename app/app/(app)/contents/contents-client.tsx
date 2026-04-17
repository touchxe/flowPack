"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search, MoreHorizontal, Edit, Trash2, Calendar as CalendarIcon,
  RefreshCw, Plus, Layers, FileText, BarChart3, Clock, CheckCircle2, Eye,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContentTypeBadge, ContentStatusBadge } from "@/components/common/content-badge";

type Content = {
  id: string; title: string; type: string;
  status: string; scheduledAt: string | null; createdAt: string;
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

// 타입별 아이콘/컬러 매핑
const TYPE_THEME: Record<string, { bg: string; icon: React.ReactNode }> = {
  CAROUSEL:    { bg: "linear-gradient(135deg,#EEF2FF,#E0E7FF)", icon: <Layers size={28} color="#6366F1" /> },
  BLOG:        { bg: "linear-gradient(135deg,#ECFDF5,#D1FAE5)", icon: <FileText size={28} color="#059669" /> },
  VIDEO:       { bg: "linear-gradient(135deg,#FFF7ED,#FED7AA)", icon: <BarChart3 size={28} color="#D97706" /> },
  BULK:        { bg: "linear-gradient(135deg,#F5F3FF,#EDE9FE)", icon: <Layers size={28} color="#8B5CF6" /> },
  URL_TO_POST: { bg: "linear-gradient(135deg,#F0F9FF,#DBEAFE)", icon: <FileText size={28} color="#3B82F6" /> },
};

export default function ContentsClient() {
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  useEffect(() => { fetchContents(); }, []);

  const fetchContents = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contents?all=true");
      if (res.ok) { const d = await res.json(); setContents(d.contents || []); }
    } catch {}
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 이 콘텐츠를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/content/${id}`, { method: "DELETE" });
      if (res.ok) setContents(prev => prev.filter(c => c.id !== id));
      else alert("콘텐츠 삭제에 실패했습니다.");
    } catch { alert("오류가 발생했습니다."); }
  };

  const filtered = contents
    .filter(c => selectedStatus === "ALL" ? true : c.status === selectedStatus)
    .filter(c => c.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div style={{ padding: "24px 28px" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        .filter-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:9999px; font-size:13px; font-weight:600; cursor:pointer; border:1.5px solid transparent; transition:all 0.15s; }
        .filter-btn.active { background:linear-gradient(135deg,#6366F1,#8B5CF6); color:#fff; border-color:transparent; box-shadow:0 2px 8px rgba(99,102,241,0.3); }
        .filter-btn:not(.active) { background:#fff; color:#6B7280; border-color:#E5E7EB; }
        .filter-btn:not(.active):hover { border-color:#C7D2FE; color:#6366F1; }
        .search-input { width:240px; height:38px; padding:0 14px 0 36px; border:1.5px solid #E5E7EB; border-radius:10px; font-size:13px; color:#111827; background:#fff; outline:none; transition:all 0.2s; }
        .search-input:focus { border-color:#6366F1; box-shadow:0 0 0 3px rgba(99,102,241,0.1); }
        .content-card { background:#fff; border:1.5px solid #E5E7EB; border-radius:16px; overflow:hidden; transition:all 0.2s; display:flex; flex-direction:column; }
        .content-card:hover { border-color:#C7D2FE; box-shadow:0 8px 24px rgba(99,102,241,0.10); transform:translateY(-2px); }
        .new-btn { display:inline-flex; align-items:center; gap:7px; height:38px; padding:0 18px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; border:none; background:linear-gradient(135deg,#6366F1,#8B5CF6); color:#fff; text-decoration:none; box-shadow:0 2px 8px rgba(99,102,241,0.3); transition:all 0.2s; }
        .new-btn:hover { transform:translateY(-1px); box-shadow:0 6px 16px rgba(99,102,241,0.4); }
        .refresh-btn { width:38px; height:38px; border-radius:10px; background:#fff; border:1.5px solid #E5E7EB; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#9CA3AF; transition:all 0.15s; }
        .refresh-btn:hover { border-color:#C7D2FE; color:#6366F1; }
        .card-action-btn { flex:1; height:32px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px; text-decoration:none; transition:all 0.15s; border:1.5px solid transparent; }
        .card-action-view { background:#F0F9FF; color:#0369A1; border-color:#BAE6FD; }
        .card-action-view:hover { background:#DBEAFE; border-color:#93C5FD; }
        .card-action-edit { background:linear-gradient(135deg,#6366F1,#8B5CF6); color:#fff; border-color:transparent; box-shadow:0 2px 6px rgba(99,102,241,0.3); }
        .card-action-edit:hover { box-shadow:0 4px 12px rgba(99,102,241,0.4); transform:translateY(-1px); }
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
          { label: "전체",      value: contents.length,                                          color: "#6366F1", bg: "#EEF2FF" },
          { label: "초안",      value: contents.filter(c => c.status === "DRAFT").length,        color: "#9CA3AF", bg: "#F9FAFB" },
          { label: "예약됨",    value: contents.filter(c => c.status === "SCHEDULED").length,    color: "#D97706", bg: "#FFF7ED" },
          { label: "발행 완료", value: contents.filter(c => c.status === "PUBLISHED").length,    color: "#059669", bg: "#ECFDF5" },
        ].map((k, i) => (
          <div key={i} style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 12, padding: "14px 16px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{k.label}</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: k.color, margin: 0 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* 툴바 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, background: "#fff", padding: "12px 16px", borderRadius: 14, border: "1.5px solid #E5E7EB" }}>
        {/* 필터 탭 */}
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

        {/* 검색 + 새로고침 */}
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

      {/* 콘텐츠 목록 */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 12 }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {filtered.map(content => {
            const theme = TYPE_THEME[content.type] || TYPE_THEME.CAROUSEL;
            return (
              <div key={content.id} className="content-card">
                {/* 썸네일 영역 */}
                <div style={{ height: 120, background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  {theme.icon}
                </div>

                {/* 카드 내용 */}
                <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column" }}>
                  {/* 상태 + 메뉴 */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <ContentStatusBadge status={statusMap[content.status] || "draft"} />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button style={{ width: 28, height: 28, borderRadius: 7, background: "none", border: "1px solid #E5E7EB", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF" }}>
                          <MoreHorizontal size={15} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/content/${content.id}/edit`} style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
                            <Edit size={14} className="mr-2" /> 편집
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(content.id)} style={{ color: "#DC2626", cursor: "pointer" }}>
                          <Trash2 size={14} className="mr-2" /> 삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* 제목 */}
                  <Link href={`/content/${content.id}/edit`} style={{ textDecoration: "none" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", lineHeight: 1.4, marginBottom: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {content.title}
                    </h3>
                  </Link>

                  {/* 메타 정보 */}
                  <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid #F3F4F6", display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: 11, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontWeight: 600, minWidth: 40 }}>생성:</span>
                      {format(new Date(content.createdAt), "yyyy. MM. dd", { locale: ko })}
                    </div>
                    {content.scheduledAt && (
                      <div style={{ fontSize: 11, color: "#6366F1", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                        <CalendarIcon size={11} />
                        {format(new Date(content.scheduledAt), "yyyy. MM. dd HH:mm", { locale: ko })} 예약
                      </div>
                    )}
                  </div>

                  {/* ── 보기 / 편집 버튼 ── */}
                  <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid #F3F4F6" }}>
                    <Link href={`/content/${content.id}/view`} className="card-action-btn card-action-view">
                      <Eye size={12} /> 보기
                    </Link>
                    <Link href={`/content/${content.id}/edit`} className="card-action-btn card-action-edit">
                      <Edit size={12} /> 편집
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }`}</style>
    </div>
  );
}
