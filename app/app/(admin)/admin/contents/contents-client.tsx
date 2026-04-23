"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search, ChevronLeft, ChevronRight, Trash2, RefreshCw,
  AlertTriangle, CheckCircle, FileText, X, Eye,
  Bot, MessageSquare, Clock, Cpu, Hash,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

/* ── 타입 ── */
interface Content {
  id: string; title: string; type: string; status: string; createdAt: string;
  user: { email: string };
}
interface ContentDetail extends Content {
  body?: string; slides?: string; aiPrompt?: string;
  aiProvider?: string; aiModel?: string; aiLog?: string;
  tone?: string; style?: string; industry?: string; keywords?: string;
  user: { email: string; name?: string };
}

const TYPE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  CAROUSEL:    { label: "카드뉴스", color: "var(--fp-primary-subtle0)", bg: "rgba(var(--brand-rgb), 0.13)" },
  BLOG:        { label: "블로그",   color: "#34D399", bg: "#10b98120" },
  VIDEO:       { label: "영상",     color: "#FCD34D", bg: "#F59E0B20" },
  BULK:        { label: "대량",     color: "#F87171", bg: "#ef444420" },
  URL_TO_POST: { label: "URL변환",  color: "var(--fp-primary-subtle0)", bg: "rgba(6, 182, 212, 0.13)" },
};
const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:     { label: "초안", color: "#64748B", bg: "#1E293B" },
  SCHEDULED: { label: "예약", color: "#FCD34D", bg: "#F59E0B20" },
  PUBLISHED: { label: "발행", color: "#34D399", bg: "#10b98120" },
  ARCHIVED:  { label: "보관", color: "#475569", bg: "#0F1929" },
};
const TYPE_TABS = ["ALL", "CAROUSEL", "BLOG", "VIDEO", "BULK", "URL_TO_POST"];
const STATUS_TABS = ["ALL", "DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"];

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ fontSize: 10, fontWeight: 800, color, background: bg, padding: "2px 7px", borderRadius: 5 }}>{label}</span>;
}

function DeleteDialog({ title, onConfirm, onCancel }: { title: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div style={{ width: "100%", maxWidth: 360, background: "#0F172A", border: "1px solid #1E293B", borderRadius: 16, padding: "24px", boxShadow: "0 24px 48px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#ef444420", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertTriangle size={17} color="#ef4444" />
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9", margin: 0 }}>콘텐츠 삭제</h3>
        </div>
        <p style={{ fontSize: 13, color: "#64748B", marginBottom: 6 }}>다음 콘텐츠를 영구 삭제합니까?</p>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#CBD5E1", marginBottom: 20, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{title}"</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, height: 40, borderRadius: 9, border: "1px solid #1E293B", background: "none", color: "#64748B", fontSize: 13, cursor: "pointer" }}>취소</button>
          <button onClick={onConfirm} style={{ flex: 1, height: 40, borderRadius: 9, border: "none", background: "#ef4444", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>삭제</button>
        </div>
      </div>
    </div>
  );
}

/* ── AI 로그 상세 패널 ── */
function AILogPanel({ detail, onClose }: { detail: ContentDetail; onClose: () => void }) {
  let aiLog: Record<string, unknown> | null = null;
  try { if (detail.aiLog) aiLog = JSON.parse(detail.aiLog); } catch { /* */ }

  const messages = (aiLog?.messages as Array<{ role: string; content: string }>) ?? [];
  const response = (aiLog?.response as string) ?? "";
  const timestamp = (aiLog?.timestamp as string) ?? "";
  const sourceUrl = (aiLog?.sourceUrl as string) ?? "";

  const SectionTitle = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, marginTop: 16 }}>
      <Icon size={13} color="var(--fp-primary-subtle0)" />
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fp-primary-subtle0)", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{label}</span>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "flex-end", zIndex: 50 }}
      onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 560, height: "100%", background: "#0B1120", borderLeft: "1px solid #1E293B", display: "flex", flexDirection: "column", overflow: "hidden" }}
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #1E293B", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(var(--brand-rgb), 0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bot size={15} color="var(--fp-primary-subtle0)" />
            </div>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", margin: 0 }}>AI 생성 로그</h2>
              <p style={{ fontSize: 11, color: "#475569", margin: 0 }}>콘텐츠 생성 시 사용된 프롬프트 및 응답</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* 본문 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 24px" }}>

          {/* 기본 정보 */}
          <SectionTitle icon={FileText} label="콘텐츠 정보" />
          <div style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <InfoRow label="제목" value={detail.title} />
              <InfoRow label="타입" value={TYPE_CFG[detail.type]?.label ?? detail.type} />
              <InfoRow label="상태" value={STATUS_CFG[detail.status]?.label ?? detail.status} />
              <InfoRow label="작성자" value={detail.user?.email ?? "-"} />
              <InfoRow label="생성일" value={format(new Date(detail.createdAt), "yyyy.MM.dd HH:mm", { locale: ko })} />
              {detail.tone && <InfoRow label="톤" value={detail.tone} />}
              {detail.industry && <InfoRow label="업종" value={detail.industry} />}
            </div>
          </div>

          {/* AI Provider 정보 */}
          <SectionTitle icon={Cpu} label="AI 제공사 / 모델" />
          <div style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 10, padding: "12px 14px", display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 10, color: "#475569" }}>Provider</span>
              <p style={{ fontSize: 13, fontWeight: 600, color: detail.aiProvider ? "#34D399" : "#475569", margin: "2px 0 0" }}>
                {detail.aiProvider || "미기록"}
              </p>
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 10, color: "#475569" }}>Model</span>
              <p style={{ fontSize: 13, fontWeight: 600, color: detail.aiModel ? "var(--fp-primary-subtle0)" : "#475569", margin: "2px 0 0" }}>
                {detail.aiModel || "미기록"}
              </p>
            </div>
            {timestamp && (
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 10, color: "#475569" }}>생성 시각</span>
                <p style={{ fontSize: 11, color: "#64748B", margin: "2px 0 0" }}>
                  {format(new Date(timestamp), "HH:mm:ss", { locale: ko })}
                </p>
              </div>
            )}
          </div>

          {sourceUrl && (
            <>
              <SectionTitle icon={Hash} label="소스 URL" />
              <div style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 10, padding: "10px 14px" }}>
                <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: "var(--fp-primary-subtle0)", wordBreak: "break-all" }}>{sourceUrl}</a>
              </div>
            </>
          )}

          {/* 프롬프트 메시지 */}
          <SectionTitle icon={MessageSquare} label="AI 프롬프트 (Messages)" />
          {messages.length > 0 ? messages.map((msg, i) => (
            <div key={i} style={{
              background: msg.role === "system" ? "#1E293B" : "#0F172A",
              border: "1px solid #1E293B",
              borderRadius: 10, padding: "10px 14px", marginBottom: 6,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{
                  fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 4,
                  background: msg.role === "system" ? "rgba(var(--brand-rgb), 0.19)" : "#10b98130",
                  color: msg.role === "system" ? "var(--fp-primary-subtle0)" : "#34D399",
                  textTransform: "uppercase" as const,
                }}>{msg.role}</span>
              </div>
              <pre style={{
                fontSize: 12, color: "#CBD5E1", lineHeight: 1.6, margin: 0,
                whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit",
              }}>{msg.content}</pre>
            </div>
          )) : (
            <p style={{ fontSize: 12, color: "#334155", padding: "12px 0" }}>프롬프트 로그가 없습니다</p>
          )}

          {/* AI 응답 */}
          <SectionTitle icon={Bot} label="AI 응답 (Response)" />
          {response ? (
            <div style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 10, padding: "12px 14px" }}>
              <pre style={{
                fontSize: 12, color: "#94A3B8", lineHeight: 1.6, margin: 0,
                whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit",
                maxHeight: 400, overflow: "auto",
              }}>{response}</pre>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "#334155", padding: "12px 0" }}>응답 로그가 없습니다</p>
          )}

          {/* aiPrompt (레거시) */}
          {detail.aiPrompt && (
            <>
              <SectionTitle icon={Clock} label="aiPrompt (레거시)" />
              <div style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 10, padding: "12px 14px" }}>
                <pre style={{ fontSize: 12, color: "#64748B", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                  {detail.aiPrompt}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ fontSize: 10, color: "#475569" }}>{label}</span>
      <p style={{ fontSize: 12, fontWeight: 600, color: "#CBD5E1", margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════ */

export default function AdminContentsClient() {
  const [contents, setContents] = useState<Content[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Content | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  /* 상세보기 */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchContents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ q, type: type === "ALL" ? "" : type, status: status === "ALL" ? "" : status, page: String(page) });
    const res = await fetch(`/api/admin/contents?${params}`);
    const data = await res.json();
    setContents(data.contents ?? []); setTotal(data.total ?? 0); setTotalPages(data.totalPages ?? 1);
    setLoading(false);
  }, [q, type, status, page]);

  useEffect(() => { fetchContents(); }, [fetchContents]);
  useEffect(() => {
    const t = setTimeout(() => { setQ(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  /* 상세 로드 */
  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/contents/${id}`);
      if (res.ok) setDetail(await res.json());
    } catch { /* */ }
    finally { setDetailLoading(false); }
  };
  const closeDetail = () => { setSelectedId(null); setDetail(null); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/admin/contents/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null); setToast("삭제되었습니다"); setTimeout(() => setToast(null), 2000); fetchContents();
  };

  const TH: React.CSSProperties = { padding: "10px 16px", textAlign: "left" as const, fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase" as const, letterSpacing: "0.07em", borderBottom: "1px solid #1E293B" };

  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* 토스트 */}
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 50, display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, background: "#10b98120", border: "1px solid #10b98140", color: "#34D399", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
          <CheckCircle size={14} /> {toast}
        </div>
      )}
      {deleteTarget && <DeleteDialog title={deleteTarget.title} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />}
      {selectedId && detail && <AILogPanel detail={detail} onClose={closeDetail} />}

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#10b98120", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileText size={17} color="#34D399" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: "#F1F5F9", margin: 0 }}>콘텐츠 관리</h1>
            <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>총 {total.toLocaleString()}개</p>
          </div>
        </div>
        <button onClick={fetchContents} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "1px solid #1E293B", background: "none", color: "#64748B", fontSize: 12, cursor: "pointer" }}>
          <RefreshCw size={13} /> 새로고침
        </button>
      </div>

      {/* 타입 탭 */}
      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
        {TYPE_TABS.map(t => (
          <button key={t} onClick={() => { setType(t); setPage(1); }}
            style={{ padding: "6px 12px", borderRadius: 8, border: type === t ? "1px solid var(--fp-primary-subtle0)" : "1px solid transparent", background: type === t ? "rgba(var(--brand-rgb), 0.08)" : "none", color: type === t ? "var(--fp-primary-subtle0)" : "#64748B", fontSize: 12, fontWeight: type === t ? 700 : 500, cursor: "pointer", transition: "all 0.15s" }}>
            {t === "ALL" ? "전체" : (TYPE_CFG[t]?.label ?? t)}
          </button>
        ))}
      </div>

      {/* 상태 탭 */}
      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
        {STATUS_TABS.map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }}
            style={{ padding: "6px 12px", borderRadius: 8, border: status === s ? "1px solid var(--fp-primary-subtle0)" : "1px solid transparent", background: status === s ? "rgba(var(--brand-rgb), 0.08)" : "none", color: status === s ? "var(--fp-primary-subtle0)" : "#64748B", fontSize: 12, fontWeight: status === s ? 700 : 500, cursor: "pointer", transition: "all 0.15s" }}>
            {s === "ALL" ? "전체 상태" : (STATUS_CFG[s]?.label ?? s)}
          </button>
        ))}
      </div>

      {/* 검색 */}
      <div style={{ position: "relative", maxWidth: 360 }}>
        <Search size={14} color="#475569" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
        <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="제목 또는 이메일 검색..."
          style={{ width: "100%", height: 38, paddingLeft: 36, paddingRight: 12, border: "1px solid #1E293B", borderRadius: 9, background: "#0F172A", color: "#CBD5E1", fontSize: 13, outline: "none", boxSizing: "border-box" as const }}
          onFocus={e => (e.target.style.borderColor = "var(--fp-primary-subtle0)")} onBlur={e => (e.target.style.borderColor = "#1E293B")} />
      </div>

      {/* 테이블 */}
      <div style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#0B1120" }}>
              {["제목", "작성자", "타입", "상태", "AI", "생성일", "작업"].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: "60px 0" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", border: "3px solid #1E293B", borderTopColor: "var(--fp-primary-subtle0)", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
              </td></tr>
            ) : contents.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: "60px 0", color: "#334155", fontSize: 13 }}>검색 결과 없음</td></tr>
            ) : contents.map(c => {
              const tc = TYPE_CFG[c.type] ?? { label: c.type, color: "#64748B", bg: "#1E293B" };
              const sc = STATUS_CFG[c.status] ?? { label: c.status, color: "#64748B", bg: "#1E293B" };
              return (
                <tr key={c.id} style={{ borderBottom: "1px solid #1E293B50", transition: "background 0.15s", cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#ffffff05")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  onClick={() => openDetail(c.id)}>
                  <td style={{ padding: "12px 16px", maxWidth: 220 }}>
                    <p style={{ fontSize: 13, color: "#CBD5E1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{c.title}</p>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 11, color: "#475569", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.user.email}</td>
                  <td style={{ padding: "12px 16px" }}><Badge label={tc.label} color={tc.color} bg={tc.bg} /></td>
                  <td style={{ padding: "12px 16px" }}><Badge label={sc.label} color={sc.color} bg={sc.bg} /></td>
                  <td style={{ padding: "12px 16px" }}>
                    <button onClick={(e) => { e.stopPropagation(); openDetail(c.id); }}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(var(--brand-rgb), 0.19)", background: "none", color: "var(--fp-primary-subtle0)", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                      <Eye size={10} /> 로그
                    </button>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#475569" }}>{format(new Date(c.createdAt), "yyyy.MM.dd", { locale: ko })}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, border: "1px solid #ef444430", background: "none", color: "#ef4444", fontSize: 11, cursor: "pointer", transition: "all 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#ef444415")}
                      onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                      <Trash2 size={11} /> 삭제
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #1E293B", padding: "10px 16px" }}>
            <p style={{ fontSize: 11, color: "#475569" }}>{(page - 1) * 20 + 1}–{Math.min(page * 20, total)} / {total}개</p>
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
