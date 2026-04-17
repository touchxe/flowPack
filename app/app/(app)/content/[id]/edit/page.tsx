"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Save, Plus, Trash2, GripVertical, Image as ImageIcon, Share2,
  Loader2, Check, AlertCircle, Layers, ChevronLeft, FileText, X,
  Eye, Edit3, ImagePlus, Link as LinkIcon, Sparkles,
  Copy, ChevronDown, Images,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { ImageGenerationModal } from "@/components/features/content/image-generation-modal";
import { PublishModal } from "@/components/features/publish/publish-modal";
import { MarkdownToolbar } from "@/components/features/content/markdown-toolbar";
import { MarkdownPreview } from "@/components/features/content/markdown-preview";
import { optimizeFileImage } from "@/lib/image-optimize";

interface Slide { index: number; title: string; body: string; imagePrompt?: string; }
interface ContentImage { id: string; url: string; altText?: string; order: number; }
interface ContentData {
  id: string; title: string; type: string;
  body?: string; slides: Slide[]; status: string;
  images?: ContentImage[];
  keywords?: string; industry?: string; scheduledAt?: string;
}

const STATUS_THEME: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:     { label: "초안",     color: "#9CA3AF", bg: "#F3F4F6" },
  SCHEDULED: { label: "예약됨",   color: "#D97706", bg: "#FFF7ED" },
  PUBLISHED: { label: "발행 완료", color: "#059669", bg: "#ECFDF5" },
  ARCHIVED:  { label: "보관됨",   color: "#6B7280", bg: "#F9FAFB" },
};

const inputBase: React.CSSProperties = {
  width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 10,
  fontSize: 13, color: "#111827", background: "#fff", outline: "none",
  transition: "all 0.2s", boxSizing: "border-box",
};

type ViewMode = "edit" | "preview";

export default function ContentEditPage() {
  const params  = useParams();
  const router  = useRouter();
  const contentId = params.id as string;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [content, setContent]   = useState<ContentData | null>(null);
  const [title, setTitle]       = useState("");
  const [body, setBody]         = useState("");
  const [slides, setSlides]     = useState<Slide[]>([]);
  const [images, setImages]     = useState<ContentImage[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [isSaving, setIsSaving]     = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState("");
  const [isImageModalOpen, setIsImageModalOpen]   = useState(false);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState<number | null>(null);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");

  // 메타데이터
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput]   = useState("");
  const [industry, setIndustry] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [isGenMeta, setIsGenMeta] = useState(false);
  const [showMetaPanel, setShowMetaPanel] = useState(true);

  // 이미지 업로드 관련
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/content/${contentId}`);
        if (!res.ok) throw new Error("콘텐츠를 찾을 수 없습니다");
        const data = await res.json();
        const c: ContentData = data.content;
        setContent(c);
        setTitle(c.title);
        setBody(c.body ?? "");
        setSlides(c.slides ?? []);
        setImages(c.images ?? []);
        // 메타데이터 로드
        if (c.keywords) {
          try { setKeywords(JSON.parse(c.keywords)); } catch { /* ignore */ }
        }
        if (c.industry) setIndustry(c.industry);
        if (c.scheduledAt) setScheduledAt(new Date(c.scheduledAt).toISOString().slice(0, 16));
        // 키워드/업종이 없으면 AI 추천 자동 호출
        if (!c.keywords && !c.industry && c.body) {
          generateMetadata(c.id);
        }
      } catch (err) { setError(err instanceof Error ? err.message : "오류가 발생했습니다"); }
      finally { setIsLoading(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId]);

  // AI 메타데이터 추천
  const generateMetadata = async (cId?: string) => {
    setIsGenMeta(true);
    try {
      const res = await fetch("/api/generate/metadata", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId: cId || contentId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.keywords?.length) setKeywords(data.keywords);
        if (data.industry) setIndustry(data.industry);
      }
    } catch { /* ignore */ }
    finally { setIsGenMeta(false); }
  };

  const addKeyword = (kw: string) => {
    const t = kw.trim();
    if (t && !keywords.includes(t)) setKeywords(prev => [...prev, t]);
  };
  const removeKeyword = (idx: number) => setKeywords(prev => prev.filter((_, i) => i !== idx));

  // ── 슬라이드 편집 ──────────────────────────
  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const arr = Array.from(slides);
    const [rm] = arr.splice(result.source.index, 1);
    arr.splice(result.destination.index, 0, rm);
    setSlides(arr.map((s, i) => ({ ...s, index: i })));
  }, [slides]);

  const updateSlide = (i: number, field: keyof Slide, val: string) => {
    const ns = [...slides]; ns[i] = { ...ns[i], [field]: val }; setSlides(ns);
  };
  const addSlide    = () => setSlides([...slides, { index: slides.length, title: "", body: "", imagePrompt: "" }]);
  const deleteSlide = (i: number) => setSlides(slides.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, index: idx })));

  // ── 이미지 관리 ─────────────────────────────
  const removeImage = async (imgId: string) => {
    try {
      await fetch(`/api/content/${contentId}/images/${imgId}`, { method: "DELETE" });
      setImages(prev => prev.filter(i => i.id !== imgId));
    } catch { /* 무시 */ }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    for (const file of files) {
      try {
        // Canvas API로 자동 최적화 (최대 1200px, WebP, 80% 품질)
        const optimized = await optimizeFileImage(file, { maxWidth: 1200, quality: 0.8 });
        const res = await fetch(`/api/content/${contentId}/images`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images: [{ url: optimized.dataUrl, altText: optimized.name, order: images.length }] }),
        });
        if (res.ok) {
          const data = await res.json();
          setImages(prev => [...prev, ...data.images]);
        }
      } catch { /* ignore */ }
    }
  };

  const handleAddImageUrl = async () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(`/api/content/${contentId}/images`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: [{ url: trimmed, altText: "image", order: images.length }] }),
      });
      if (res.ok) {
        const data = await res.json();
        setImages(prev => [...prev, ...data.images]);
      }
    } catch { /* ignore */ }
    setImageUrlInput(""); setShowUrlInput(false);
  };

  // 에디터에 이미지 마크다운 삽입 (짧은 서빙 URL 사용)
  const insertImageToEditor = (img: ContentImage) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const text = ta.value;
    // base64 대신 이미지 서빙 API URL 사용
    const imgUrl = img.url.startsWith("data:") 
      ? `/api/content/${contentId}/images/${img.id}/serve`
      : img.url;
    const alt = img.altText || "image";
    const insert = `\n![${alt}](${imgUrl})\n`;
    const newText = text.slice(0, pos) + insert + text.slice(pos);
    setBody(newText);
    setShowImagePicker(false);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(pos + insert.length, pos + insert.length);
    }, 50);
  };

  // ── 저장 ────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true); setError(""); setSuccess("");
    try {
      const isBlog = content?.type === "BLOG";
      const payload: Record<string, unknown> = isBlog ? { title, body } : { title, slides };
      // 메타데이터 포함
      if (keywords.length > 0) payload.keywords = JSON.stringify(keywords);
      if (industry) payload.industry = industry;
      if (scheduledAt) payload.scheduledAt = new Date(scheduledAt).toISOString();
      const res = await fetch(`/api/content/${contentId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "저장 중 오류가 발생했습니다"); }
      setSuccess("저장되었습니다!"); setTimeout(() => setSuccess(""), 3000);
    } catch (err) { setError(err instanceof Error ? err.message : "오류가 발생했습니다"); }
    finally { setIsSaving(false); }
  };

  // ── 복사 (클립보드) ─────────────────────────
  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(`# ${title}\n\n${body}`);
      setCopyMsg("마크다운 복사됨!"); setShowCopyMenu(false);
      setTimeout(() => setCopyMsg(""), 2500);
    } catch { setCopyMsg("복사 실패"); }
  };

  const handleCopyHtml = async () => {
    try {
      const { marked } = await import("marked");
      const html = `<h1>${title}</h1>\n${await marked.parse(body)}`;
      const blob = new Blob([html], { type: "text/html" });
      const plain = new Blob([`${title}\n\n${body}`], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": blob, "text/plain": plain }),
      ]);
      setCopyMsg("HTML 복사됨! 다른 에디터에 붙여넣기 하세요."); setShowCopyMenu(false);
      setTimeout(() => setCopyMsg(""), 3000);
    } catch {
      // ClipboardItem 미지원 브라우저 대비
      const { marked } = await import("marked");
      const html = `<h1>${title}</h1>\n${await marked.parse(body)}`;
      await navigator.clipboard.writeText(html);
      setCopyMsg("HTML 복사됨!"); setShowCopyMenu(false);
      setTimeout(() => setCopyMsg(""), 2500);
    }
  };


  // ── 로딩/에러 ──────────────────────────────
  if (isLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, flexDirection: "column", gap: 12 }}>
      <Loader2 size={28} color="#6366F1" className="animate-spin" />
      <p style={{ fontSize: 13, color: "#9CA3AF" }}>콘텐츠를 불러오는 중...</p>
    </div>
  );

  if (!content) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 16 }}>
      <p style={{ fontSize: 14, color: "#9CA3AF" }}>콘텐츠를 찾을 수 없습니다</p>
      <Link href="/home" style={{ padding: "10px 20px", borderRadius: 10, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>홈으로</Link>
    </div>
  );

  const st = STATUS_THEME[content.status] ?? STATUS_THEME.DRAFT;
  const isBlog = content.type === "BLOG";

  // ── 뷰 모드 탭 ─────────────────────────────
  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    height: 32, padding: "0 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
    cursor: "pointer", border: "none", display: "flex", alignItems: "center", gap: 5,
    background: active ? "#EEF2FF" : "transparent",
    color: active ? "#6366F1" : "#9CA3AF",
    transition: "all 0.15s",
  });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        .slide-card { background:#fff; border:1.5px solid #E5E7EB; border-radius:14px; padding:18px; transition:all 0.15s; }
        .slide-card:hover { border-color:#C7D2FE; }
        textarea:focus, input:focus { border-color:#6366F1 !important; box-shadow:0 0 0 3px rgba(99,102,241,0.10) !important; }
        .edit-textarea { width:100%; height:100%; padding:20px 24px; border:none; font-size:14px; line-height:1.9; color:#374151; background:#fff; outline:none; resize:none; box-sizing:border-box; font-family:'Fira Code','Menlo','Pretendard Variable',monospace; }
        .edit-textarea:focus { box-shadow:none !important; }
        .img-thumb-sm { position:relative; width:64px; height:64px; border-radius:8px; overflow:hidden; border:1.5px solid #E5E7EB; flex-shrink:0; cursor:pointer; transition:all 0.12s; }
        .img-thumb-sm:hover { border-color:#6366F1; transform:scale(1.05); }
        .img-thumb-sm img { width:100%; height:100%; object-fit:cover; display:block; }
      `}</style>

      {/* ── 상단 헤더바 ─────────────────────────── */}
      <div style={{ padding: "12px 24px", background: "#fff", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/contents" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#9CA3AF", textDecoration: "none" }}>
            <ChevronLeft size={14} /> 목록
          </Link>
          <div style={{ width: 1, height: 20, background: "#E5E7EB" }} />
          <input
            style={{ fontSize: 16, fontWeight: 700, color: "#111827", border: "none", outline: "none", background: "transparent", minWidth: 200 }}
            value={title} onChange={e => setTitle(e.target.value)} placeholder="콘텐츠 제목"
          />
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: st.bg, color: st.color }}>{st.label}</span>
          {isBlog && <span style={{ fontSize: 11, color: "#9CA3AF" }}>{body.length.toLocaleString()}자</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isBlog && (
            <div style={{ display: "flex", background: "#F3F4F6", borderRadius: 8, padding: 2, gap: 2 }}>
              <button type="button" style={tabBtnStyle(viewMode === "edit")} onClick={() => setViewMode("edit")}><Edit3 size={13} /> 편집</button>
              <button type="button" style={tabBtnStyle(viewMode === "preview")} onClick={() => setViewMode("preview")}><Eye size={13} /> 미리보기</button>
            </div>
          )}
          {/* 복사 드롭다운 */}
          {isBlog && (
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowCopyMenu(v => !v)}
                style={{ height: 36, padding: "0 12px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151", display: "flex", alignItems: "center", gap: 5 }}>
                <Copy size={13} /> 복사 <ChevronDown size={11} />
              </button>
              {showCopyMenu && (
                <div style={{ position: "absolute", top: 42, right: 0, width: 200, background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, overflow: "hidden" }}>
                  <button onClick={handleCopyMarkdown}
                    style={{ width: "100%", padding: "10px 14px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", flexDirection: "column", gap: 2 }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#F9FAFB")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                    <span>📄 마크다운 복사</span>
                    <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 400 }}>원본 마크다운 형식</span>
                  </button>
                  <div style={{ height: 1, background: "#F3F4F6" }} />
                  <button onClick={handleCopyHtml}
                    style={{ width: "100%", padding: "10px 14px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", flexDirection: "column", gap: 2 }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#F9FAFB")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                    <span>🌐 HTML 복사 (서식 유지)</span>
                    <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 400 }}>네이버·Notion 등에 붙여넣기</span>
                  </button>
                </div>
              )}
            </div>
          )}
          <button onClick={() => setIsPublishModalOpen(true)}
            style={{ height: 36, padding: "0 14px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151", display: "flex", alignItems: "center", gap: 5 }}>
            <Share2 size={13} /> 배포
          </button>
          <button onClick={handleSave} disabled={isSaving}
            style={{ height: 36, padding: "0 16px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: isSaving ? "not-allowed" : "pointer", border: "none", background: isSaving ? "#C7D2FE" : "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", display: "flex", alignItems: "center", gap: 5, boxShadow: "0 2px 6px rgba(99,102,241,0.3)" }}>
            {isSaving ? <><Loader2 size={12} className="animate-spin" /> 저장 중</> : <><Save size={12} /> 저장</>}
          </button>
        </div>
      </div>

      {/* 알림 */}
      {(error || success) && (
        <div style={{ padding: "0 24px" }}>
          {error && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, display: "flex", alignItems: "center", gap: 8, background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", fontSize: 13, fontWeight: 600 }}>
              <AlertCircle size={14} /> {error}
              <button onClick={() => setError("")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }}>×</button>
            </div>
          )}
          {success && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, display: "flex", alignItems: "center", gap: 8, background: "#ECFDF5", border: "1px solid #A7F3D0", color: "#065F46", fontSize: 13, fontWeight: 700 }}>
              <Check size={14} /> {success}
            </div>
          )}
        </div>
      )}

      {/* 복사 완료 토스트 */}
      {copyMsg && (
        <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: "#1F2937", color: "#fff", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 100, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 8 }}>
          <Check size={14} color="#34D399" /> {copyMsg}
        </div>
      )}

      {/* ── 메인 영역 ──────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {isBlog ? (
          <>
            {/* ── 에디터 + 미리보기 패널 ──────────── */}
            <div style={{ flex: 1, display: "flex", minHeight: 0, position: "relative" }}>
              {/* 에디터 패널 */}
              {viewMode === "edit" && (
                <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, position: "relative" }}>
                  <MarkdownToolbar
                    textareaRef={textareaRef}
                    onChange={setBody}
                    onInsertImage={() => setShowImagePicker(v => !v)}
                  />
                  {/* ── 이미지 팝오버 (개선) ── */}
                  {showImagePicker && (
                    <div style={{ position: "absolute", top: 44, left: 12, zIndex: 40, width: 320, background: "#fff", border: "1.5px solid #C7D2FE", borderRadius: 12, boxShadow: "0 8px 24px rgba(99,102,241,0.15)", overflow: "hidden" }}>
                      <div style={{ padding: "10px 14px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>
                          <Images size={13} color="#6366F1" /> 이미지 삽입
                        </span>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="button" onClick={() => fileInputRef.current?.click()}
                            style={{ height: 26, padding: "0 10px", borderRadius: 6, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", border: "none", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                            <ImagePlus size={10} /> 파일 업로드
                          </button>
                          <button type="button" onClick={() => setShowImagePicker(false)}
                            style={{ width: 26, height: 26, borderRadius: 6, background: "none", border: "1px solid #E5E7EB", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <X size={12} color="#9CA3AF" />
                          </button>
                        </div>
                      </div>
                      {/* URL 입력 */}
                      <div style={{ padding: "8px 12px", borderBottom: "1px solid #F3F4F6", display: "flex", gap: 6 }}>
                        <input style={{ flex: 1, height: 30, padding: "0 10px", border: "1.5px solid #E5E7EB", borderRadius: 7, fontSize: 12, outline: "none" }}
                          placeholder="이미지 URL 입력 후 Enter"
                          value={imageUrlInput} onChange={e => setImageUrlInput(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && handleAddImageUrl()} />
                        <button type="button" onClick={handleAddImageUrl}
                          style={{ height: 30, padding: "0 10px", borderRadius: 7, background: "#6366F1", border: "none", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>추가</button>
                      </div>
                      {/* 기존 이미지 목록 */}
                      <div style={{ padding: "8px 12px", maxHeight: 180, overflowY: "auto" }}>
                        {images.length === 0 ? (
                          <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "16px 0" }}>업로드된 이미지가 없습니다.<br />위 버튼으로 추가하세요.</p>
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                            {images.map(img => (
                              <div key={img.id} style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: "1.5px solid #E5E7EB", cursor: "pointer", transition: "all 0.12s" }}
                                onClick={() => { insertImageToEditor(img); setShowImagePicker(false); }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "#6366F1"}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "#E5E7EB"}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img.url} alt={img.altText || ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                <button type="button" onClick={e => { e.stopPropagation(); removeImage(img.id); }}
                                  style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                                  <X size={8} color="#fff" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    className="edit-textarea"
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="마크다운으로 블로그 본문을 작성하세요..."
                    spellCheck={false}
                    style={{ minHeight: 520 }}
                  />
                  <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFileUpload} />
                </div>
              )}

              {/* 미리보기 패널 */}
              {viewMode === "preview" && (
                <div style={{ flex: 1, overflowY: "auto", background: "#FAFBFC", minHeight: 0 }}>
                  <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", marginBottom: 8 }}>{title}</h1>
                    <MarkdownPreview content={body} />
                  </div>
                </div>
              )}
            </div>

            {/* ── 메타데이터 패널 ──────────────────── */}
            <div style={{ borderTop: "1px solid #F3F4F6", background: "#fff", padding: "14px 20px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showMetaPanel ? 14 : 0 }}>
                <button type="button" onClick={() => setShowMetaPanel(v => !v)}
                  style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: 0, color: "#374151", fontSize: 13, fontWeight: 700 }}>
                  <span style={{ transform: showMetaPanel ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", display: "inline-block" }}>▶</span>
                  SEO 및 발행 설정
                </button>
                {isGenMeta && <span style={{ fontSize: 11, color: "#6366F1", display: "flex", alignItems: "center", gap: 4 }}><Loader2 size={12} className="animate-spin" /> AI 분석 중...</span>}
              </div>

              {showMetaPanel && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  {/* 키워드 */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>키워드</span>
                      <button type="button" onClick={() => generateMetadata()}
                        style={{ height: 22, padding: "0 8px", borderRadius: 5, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", border: "none", color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                        <Sparkles size={9} /> AI 추천
                      </button>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                      {keywords.map((kw, idx) => (
                        <span key={idx} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 6, background: "#EEF2FF", color: "#6366F1", fontSize: 11, fontWeight: 600, border: "1px solid #C7D2FE" }}>
                          {kw}
                          <button type="button" onClick={() => removeKeyword(idx)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#6366F1", display: "flex" }}><X size={9} /></button>
                        </span>
                      ))}
                    </div>
                    <input style={{ ...inputBase, height: 30, padding: "0 10px", fontSize: 11 }}
                      placeholder="키워드 입력 후 Enter"
                      value={kwInput} onChange={e => setKwInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addKeyword(kwInput); setKwInput(""); } }} />
                  </div>

                  {/* 업종 */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>업종</span>
                    <select
                      value={industry} onChange={e => setIndustry(e.target.value)}
                      style={{ ...inputBase, height: 34, padding: "0 10px", fontSize: 12, cursor: "pointer", appearance: "auto" as never }}>
                      <option value="">선택하세요</option>
                      <option value="tech">IT/기술</option>
                      <option value="finance">금융</option>
                      <option value="education">교육</option>
                      <option value="healthcare">의료</option>
                      <option value="retail">도소매</option>
                      <option value="religion">종교/비영리</option>
                      <option value="marketing">마케팅</option>
                      <option value="lifestyle">라이프스타일</option>
                      <option value="food">음식/요리</option>
                      <option value="travel">여행</option>
                      <option value="other">기타</option>
                    </select>
                    {industry && (
                      <p style={{ fontSize: 10, color: "#9CA3AF", marginTop: 6 }}>
                        {isGenMeta ? "분석 중..." : "AI가 추천한 업종입니다. 변경할 수 있습니다."}
                      </p>
                    )}
                  </div>

                  {/* 발행 일정 */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>발행 일정</span>
                    <input type="datetime-local"
                      value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                      style={{ ...inputBase, height: 34, padding: "0 10px", fontSize: 12, cursor: "pointer" }} />
                    {scheduledAt && (
                      <button type="button" onClick={() => setScheduledAt("")}
                        style={{ marginTop: 6, background: "none", border: "none", fontSize: 10, color: "#EF4444", cursor: "pointer", textDecoration: "underline" }}>
                        일정 취소
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* ── CAROUSEL 타입 기존 UI ──────────────── */
          <div style={{ padding: "24px 28px", overflowY: "auto", flex: 1 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: 7 }}>
                    <Layers size={16} color="#6366F1" /> 슬라이드 목록
                    <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>({slides.length}개)</span>
                  </h2>
                  <button onClick={addSlide} style={{ height: 36, padding: "0 14px", borderRadius: 9, background: "#EEF2FF", border: "none", color: "#6366F1", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                    <Plus size={14} /> 슬라이드 추가
                  </button>
                </div>

                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="slides">
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {slides.map((slide, i) => (
                          <Draggable key={i} draggableId={`slide-${i}`} index={i}>
                            {(prov, snap) => (
                              <div ref={prov.innerRef} {...prov.draggableProps}
                                className="slide-card"
                                style={{ ...prov.draggableProps.style, boxShadow: snap.isDragging ? "0 8px 24px rgba(99,102,241,0.15)" : "none", borderColor: snap.isDragging ? "#C7D2FE" : "#E5E7EB" }}>
                                <div style={{ display: "flex", gap: 12 }}>
                                  <div {...prov.dragHandleProps} style={{ display: "flex", alignItems: "flex-start", paddingTop: 8, color: "#D1D5DB", cursor: "grab" }}>
                                    <GripVertical size={18} />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                      <span style={{ fontSize: 11, fontWeight: 800, color: "#6366F1", background: "#EEF2FF", padding: "3px 9px", borderRadius: 6 }}>Slide {i + 1}</span>
                                      <button onClick={() => deleteSlide(i)}
                                        style={{ width: 28, height: 28, borderRadius: 7, background: "none", border: "1px solid #E5E7EB", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF" }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#FCA5A5"; (e.currentTarget as HTMLElement).style.color = "#EF4444"; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#E5E7EB"; (e.currentTarget as HTMLElement).style.color = "#9CA3AF"; }}>
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                    <div style={{ marginBottom: 10 }}>
                                      <label style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 5 }}>제목</label>
                                      <input style={{ ...inputBase, height: 40, padding: "0 13px", border: "1.5px solid #E5E7EB" }}
                                        value={slide.title} onChange={e => updateSlide(i, "title", e.target.value)} placeholder="슬라이드 제목" />
                                    </div>
                                    <div style={{ marginBottom: 10 }}>
                                      <label style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 5 }}>본문</label>
                                      <textarea style={{ ...inputBase, padding: "10px 13px", minHeight: 80, resize: "vertical" as const, border: "1.5px solid #E5E7EB" }}
                                        value={slide.body} onChange={e => updateSlide(i, "body", e.target.value)} placeholder="슬라이드 내용" />
                                    </div>
                                    <div>
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                                        <label style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>이미지 프롬프트</label>
                                        <button type="button" onClick={() => { setSelectedSlideIndex(i); setIsImageModalOpen(true); }}
                                          style={{ height: 28, padding: "0 10px", borderRadius: 7, background: "#F5F3FF", border: "none", color: "#8B5CF6", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                                          <ImageIcon size={11} /> AI 이미지
                                        </button>
                                      </div>
                                      <input style={{ ...inputBase, height: 40, padding: "0 13px", border: "1.5px solid #E5E7EB" }}
                                        value={slide.imagePrompt || ""} onChange={e => updateSlide(i, "imagePrompt", e.target.value)} placeholder="DALL-E 프롬프트" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>

                {slides.length === 0 && (
                  <div style={{ textAlign: "center", padding: "60px 0", border: "1.5px dashed #E5E7EB", borderRadius: 14, color: "#9CA3AF" }}>
                    <Layers size={28} style={{ margin: "0 auto 10px", display: "block", opacity: 0.35 }} />
                    <p style={{ fontSize: 13, marginBottom: 12 }}>슬라이드가 없습니다</p>
                    <button onClick={addSlide} style={{ height: 36, padding: "0 18px", borderRadius: 9, background: "#EEF2FF", border: "none", color: "#6366F1", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>슬라이드 추가</button>
                  </div>
                )}
              </div>

              {/* 사이드바 */}
              <div style={{ position: "sticky", top: 24, alignSelf: "flex-start", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16, padding: "18px 20px" }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 14 }}>기본 정보</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 12px" }}>
                      <p style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, marginBottom: 3 }}>슬라이드</p>
                      <p style={{ fontSize: 20, fontWeight: 800, color: "#6366F1", margin: 0 }}>{slides.length}</p>
                    </div>
                    <div style={{ borderRadius: 10, padding: "10px 12px", background: st.bg }}>
                      <p style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, marginBottom: 3 }}>상태</p>
                      <p style={{ fontSize: 13, fontWeight: 800, color: st.color, margin: 0 }}>{st.label}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ImageGenerationModal
        isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)}
        onImageGenerated={(url, revised) => { if (selectedSlideIndex !== null) updateSlide(selectedSlideIndex, "imagePrompt", revised || url); }}
        contentId={contentId}
      />
      <PublishModal open={isPublishModalOpen} onOpenChange={setIsPublishModalOpen} contentId={contentId} contentTitle={title} />
    </div>
  );
}
