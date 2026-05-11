"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Save, Plus, Trash2, GripVertical, Image as ImageIcon, Share2,
  Loader2, Check, AlertCircle, Layers, ChevronLeft, X, Sparkles,
  Copy, ChevronDown, ImagePlus, MousePointerClick, MessageSquare, Send,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { ImageGenerationModal } from "@/components/features/content/image-generation-modal";
import { PublishModal } from "@/components/features/publish/publish-modal";
import { TiptapEditor, insertImageToTiptap } from "@/components/features/content/tiptap-editor";
import type { useEditor } from "@tiptap/react";
import { optimizeFileImage } from "@/lib/image-optimize";

interface Slide { index: number; title: string; body: string; imagePrompt?: string; }
interface ContentImage { id: string; url: string; altText?: string; order: number; }
interface EditAnnotation {
  id: string;
  slideIndex: number;
  number: number;
  authorName: string | null;
  selectedText: string | null;
  body: string;
  createdAt: string;
}
interface ContentData {
  id: string; title: string; type: string;
  body?: string; slides: Slide[]; status: string;
  images?: ContentImage[];
  keywords?: string; industry?: string; scheduledAt?: string;
}

const STATUS_THEME: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:     { label: "초안",     color: "var(--fp-muted)",    bg: "var(--fp-inactive-bg)" },
  SCHEDULED: { label: "예약됨",   color: "var(--fp-warning)", bg: "var(--fp-warning-bg)" },
  PUBLISHED: { label: "발행 완료", color: "var(--fp-success)", bg: "var(--fp-success-bg)" },
  ARCHIVED:  { label: "보관됨",   color: "var(--fp-muted)",    bg: "var(--fp-inactive-bg)" },
};

const inputBase: React.CSSProperties = {
  width: "100%", border: "1.5px solid var(--fp-border)", borderRadius: 10,
  fontSize: 13, color: "var(--fp-heading)", background: "var(--fp-card-bg)", outline: "none",
  transition: "all 0.2s", boxSizing: "border-box",
};

export default function ContentEditPage() {
  const params  = useParams();
  const router  = useRouter();
  const contentId = params.id as string;

  // Tiptap 에디터 ref (이미지 삽입 등 명령 사용)
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);

  const [content, setContent]   = useState<ContentData | null>(null);
  const [title, setTitle]       = useState("");
  const [body, setBody]         = useState("");  // HTML 문자열
  const [slides, setSlides]     = useState<Slide[]>([]);
  const [images, setImages]     = useState<ContentImage[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [isSaving, setIsSaving]     = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState("");
  const [isImageModalOpen, setIsImageModalOpen]   = useState(false);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState<number | null>(null);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");
  const [isCopyingShareLink, setIsCopyingShareLink] = useState(false);
  const [imageTab, setImageTab] = useState<"upload" | "gallery" | "url" | "medialib">("upload");
  const [isDragOver, setIsDragOver] = useState(false);
  const [clickStats, setClickStats] = useState<{ total: number } | null>(null);
  const [annotations, setAnnotations] = useState<EditAnnotation[]>([]);
  const [selectedTextForComment, setSelectedTextForComment] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState(false);

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

      // 클릭 통계 비동기 로드
      fetch(`/api/content/${contentId}/publishes`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.publishes) {
            const total = data.publishes.reduce((s: number, p: any) => s + (p.clickCount ?? 0), 0);
            if (total > 0) setClickStats({ total });
          }
        })
        .catch(() => {});

      fetch(`/api/content/${contentId}/annotations`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (Array.isArray(data?.data)) setAnnotations(data.data);
        })
        .catch(() => {});
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
        // 미디어 라이브러리에도 동기화 (Blob 토큰 있을 때만, 실패해도 무시)
        try {
          const fd = new FormData();
          fd.append("file", file);
          fetch("/api/media/upload", { method: "POST", body: fd }).catch(() => {});
        } catch { /* 무시 */ }
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

  // Tiptap 에디터에 이미지 삽입
  const insertImageToEditor = (img: ContentImage) => {
    // base64는 서빙 API URL로 변환
    const imgUrl = img.url.startsWith("data:")
      ? `/api/content/${contentId}/images/${img.id}/serve`
      : img.url;
    insertImageToTiptap(editorRef.current, imgUrl, img.altText || "image");
    setShowImagePicker(false);
  };

  // 드래그앤드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    if (!files.length) return;
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    const fakeEv = { target: { files: dt.files } } as unknown as React.ChangeEvent<HTMLInputElement>;
    await handleFileUpload(fakeEv);
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

  // ── 복사 (클립보드) — Tiptap HTML 직접 사용 ──
  const handleCopyMarkdown = async () => {
    try {
      // Tiptap getText()로 순수 텍스트 추출
      const text = editorRef.current?.getText() ?? body;
      await navigator.clipboard.writeText(`${title}\n\n${text}`);
      setCopyMsg("텍스트 복사됨!"); setShowCopyMenu(false);
      setTimeout(() => setCopyMsg(""), 2500);
    } catch { setCopyMsg("복사 실패"); }
  };

  const handleCopyHtml = async () => {
    try {
      // Tiptap getHTML()로 완성된 HTML
      const editorHtml = editorRef.current?.getHTML() ?? body;
      const html = `<h1>${title}</h1>\n${editorHtml}`;
      const blob = new Blob([html], { type: "text/html" });
      const plain = new Blob([`${title}\n\n${editorRef.current?.getText() ?? ""}`], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": blob, "text/plain": plain }),
      ]);
      setCopyMsg("HTML 복사됨! 다른 에디터에 붙여넣기 하세요."); setShowCopyMenu(false);
      setTimeout(() => setCopyMsg(""), 3000);
    } catch {
      const editorHtml = editorRef.current?.getHTML() ?? body;
      await navigator.clipboard.writeText(`<h1>${title}</h1>\n${editorHtml}`);
      setCopyMsg("HTML 복사됨!"); setShowCopyMenu(false);
      setTimeout(() => setCopyMsg(""), 2500);
    }
  };

  const handleCopyShareLink = async () => {
    setIsCopyingShareLink(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/content/${contentId}/share`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "공유 링크를 만들지 못했습니다");
      }

      await navigator.clipboard.writeText(data.data.shareUrl);
      setSuccess("공유 링크가 복사되었습니다!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "공유 링크 복사 중 오류가 발생했습니다");
    } finally {
      setIsCopyingShareLink(false);
    }
  };

  const openTextComment = (selectedText: string) => {
    setSelectedTextForComment(selectedText);
    setCommentBody("");
    setError("");
    setIsCommentModalOpen(true);
  };

  const saveTextComment = async () => {
    if (!commentBody.trim()) return;

    setIsSavingComment(true);
    setError("");
    try {
      const res = await fetch(`/api/content/${contentId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slideIndex: 0,
          selectedText: selectedTextForComment,
          body: commentBody.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success || !data.data) {
        throw new Error(data.error || "댓글을 저장하지 못했습니다");
      }

      setAnnotations(prev => [...prev, data.data as EditAnnotation]);
      setIsCommentModalOpen(false);
      setSelectedTextForComment("");
      setCommentBody("");
      setSuccess("댓글이 추가되었습니다.");
      setTimeout(() => setSuccess(""), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "댓글 저장 중 오류가 발생했습니다");
    } finally {
      setIsSavingComment(false);
    }
  };


  // ── 로딩/에러 ──────────────────────────────
  if (isLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, flexDirection: "column", gap: 12 }}>
      <Loader2 size={28} color="var(--brand-500)" className="animate-spin" />
      <p style={{ fontSize: 13, color: "#9CA3AF" }}>콘텐츠를 불러오는 중...</p>
    </div>
  );

  if (!content) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 16 }}>
      <p style={{ fontSize: 14, color: "var(--fp-muted)" }}>콘텐츠를 찾을 수 없습니다</p>
      <Link href="/home" style={{ padding: "10px 20px", borderRadius: 10, background: "var(--brand-gradient)", color: "#000", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>홈으로</Link>
    </div>
  );

  const st = STATUS_THEME[content.status] ?? STATUS_THEME.DRAFT;
  const isBlog = content.type === "BLOG";

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        .slide-card { background:var(--fp-card-bg); border:1.5px solid var(--fp-border); border-radius:14px; padding:18px; transition:all 0.15s; }
        .slide-card:hover { border-color:var(--fp-primary-subtle); }
        textarea:focus, input:focus { border-color:var(--brand-500) !important; box-shadow:0 0 0 3px var(--fp-primary-subtle) !important; }
        .edit-textarea { width:100%; height:100%; padding:20px 24px; border:none; font-size:14px; line-height:1.9; color:var(--fp-body); background:var(--fp-card-bg); outline:none; resize:none; box-sizing:border-box; font-family:'Fira Code','Menlo','Pretendard Variable',monospace; }
        .edit-textarea:focus { box-shadow:none !important; }
        .img-thumb-sm { position:relative; width:64px; height:64px; border-radius:8px; overflow:hidden; border:1.5px solid var(--fp-border); flex-shrink:0; cursor:pointer; transition:all 0.12s; }
        .img-thumb-sm:hover { border-color:var(--brand-500); transform:scale(1.05); }
        .img-thumb-sm img { width:100%; height:100%; object-fit:cover; display:block; }
        .edit-image-number { position:absolute; top:6px; right:6px; min-width:24px; height:24px; padding:0 7px; border-radius:999px; background:rgba(17,24,39,0.46); color:#fff; backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:900; line-height:1; box-shadow:0 6px 16px rgba(17,24,39,0.18); pointer-events:none; z-index:2; }
        .annotation-panel { width:320px; flex-shrink:0; border-left:1px solid #F3F4F6; background:#FAFBFC; display:flex; flex-direction:column; }
        .annotation-card { width:100%; text-align:left; border:1px solid #E5E7EB; background:#fff; border-radius:10px; padding:12px; cursor:pointer; }
        .annotation-card:hover { border-color:#C7D2FE; }
        .comment-modal-backdrop { position:fixed; inset:0; z-index:260; background:rgba(17,24,39,0.42); display:flex; align-items:center; justify-content:center; padding:24px; }
        .comment-modal { width:100%; max-width:460px; background:#fff; border-radius:14px; box-shadow:0 24px 80px rgba(17,24,39,0.24); border:1px solid #E5E7EB; overflow:hidden; }
      `}</style>

      {/* ── 상단 헤더바 ─────────────────────────── */}
      <div style={{ padding: "12px 24px", background: "var(--fp-card-bg)", borderBottom: "1px solid var(--fp-border-soft)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/contents" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--fp-muted)", textDecoration: "none" }}>
            <ChevronLeft size={14} /> 목록
          </Link>
          <div style={{ width: 1, height: 20, background: "var(--fp-border)" }} />
          <input
            style={{ fontSize: 16, fontWeight: 700, color: "var(--fp-heading)", border: "none", outline: "none", background: "transparent", minWidth: 200 }}
            value={title} onChange={e => setTitle(e.target.value)} placeholder="콘텐츠 제목"
          />
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: st.bg, color: st.color }}>{st.label}</span>
          {clickStats && clickStats.total > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "var(--fp-warning-bg)", color: "var(--fp-warning)" }}>
              <MousePointerClick size={11} /> {clickStats.total.toLocaleString()}클릭
            </span>
          )}
          {isBlog && (
            <span style={{ fontSize: 11, color: "var(--fp-muted)" }}>
              {(editorRef.current?.getText().length ?? body.length).toLocaleString()}자
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* 뷰어로 이동 (미리보기 탭 대신) */}
          {isBlog && (
            <Link href={`/content/${contentId}/view`}
              style={{ height: 32, padding: "0 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "1.5px solid var(--fp-border)", background: "var(--fp-card-bg)", color: "var(--fp-body)", display: "flex", alignItems: "center", gap: 5, textDecoration: "none" }}>
              👁 미리보기
            </Link>
          )}
          <button onClick={handleCopyShareLink} disabled={isCopyingShareLink}
            style={{ height: 32, padding: "0 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: isCopyingShareLink ? "not-allowed" : "pointer", border: "1.5px solid var(--fp-border)", background: "var(--fp-card-bg)", color: "var(--fp-body)", display: "flex", alignItems: "center", gap: 5 }}>
            <Copy size={12} /> {isCopyingShareLink ? "복사 중" : "링크 복사"}
          </button>
          <button onClick={handleSave} disabled={isSaving}
            style={{ height: 36, padding: "0 16px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: isSaving ? "not-allowed" : "pointer", border: "none", background: isSaving ? "var(--fp-border)" : "var(--brand-gradient)", color: "#000", display: "flex", alignItems: "center", gap: 5, boxShadow: "var(--fp-shadow-glow)" }}>
            {isSaving ? <><Loader2 size={12} className="animate-spin" /> 저장 중</> : <><Save size={12} /> 저장</>}
          </button>
        </div>
      </div>

      {/* 알림 */}
      {(error || success) && (
        <div style={{ padding: "0 24px" }}>
          {error && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, display: "flex", alignItems: "center", gap: 8, background: "var(--fp-error-bg)", border: `1px solid var(--fp-error-border)`, color: "var(--fp-error-text)", fontSize: 13, fontWeight: 600 }}>
              <AlertCircle size={14} /> {error}
              <button onClick={() => setError("")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }}>×</button>
            </div>
          )}
          {success && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, display: "flex", alignItems: "center", gap: 8, background: "var(--fp-success-bg)", border: `1px solid var(--fp-success-border)`, color: "var(--fp-success-text)", fontSize: 13, fontWeight: 700 }}>
              <Check size={14} /> {success}
            </div>
          )}
        </div>
      )}

      {/* 복사 완료 토스트 */}
      {copyMsg && (
        <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: "var(--fp-card-bg)", border: "1px solid var(--fp-border)", color: "var(--fp-heading)", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 100, boxShadow: "var(--fp-shadow-lg)", display: "flex", alignItems: "center", gap: 8 }}>
          <Check size={14} color="var(--fp-success)" /> {copyMsg}
        </div>
      )}

      {/* ── 메인 영역 ──────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {isBlog ? (
          <>
            {/* ── Tiptap 에디터 ──────────────────── */}
            <div style={{ flex: 1, display: "flex", minHeight: 0, position: "relative" }}>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, position: "relative" }}>
                <TiptapEditor
                  content={body}
                  onChange={setBody}
                  onInsertImage={() => setShowImagePicker(v => !v)}
                  onTextCommentRequest={openTextComment}
                  editorRef={editorRef}
                  minHeight={520}
                />

                {/* ── 이미지 삽입 모달 (Centered Overlay) ── */}
                {showImagePicker && (
                  <div
                    style={{
                      position: "fixed", inset: 0, zIndex: 200,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)",
                    }}
                    onClick={e => { if (e.target === e.currentTarget) setShowImagePicker(false); }}
                  >
                    <div style={{
                      width: "min(800px, 95vw)", background: "#fff",
                      borderRadius: 18, boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
                      overflow: "hidden", display: "flex", flexDirection: "column",
                      maxHeight: "88vh",
                    }}>
                      {/* 모달 헤더 */}
                      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                        <div style={{ display: "flex", gap: 0, background: "#F3F4F6", borderRadius: 10, padding: 3 }}>
                          {(["upload", "gallery", "medialib", "url"] as const).map(tab => (
                            <button key={tab} type="button"
                              onClick={() => setImageTab(tab)}
                              style={{
                                padding: "7px 16px", borderRadius: 8, border: "none", fontSize: 13,
                                fontWeight: 700, cursor: "pointer",
                                background: imageTab === tab ? "#fff" : "transparent",
                                color: imageTab === tab ? "var(--brand-500)" : "#9CA3AF",
                                boxShadow: imageTab === tab ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                                transition: "all 0.15s",
                              }}>
                              {tab === "upload" ? "📁 업로드" : tab === "gallery" ? `🖼 이 글 이미지(${images.length})` : tab === "medialib" ? "📚 라이브러리" : "🔗 URL"}
                            </button>
                          ))}
                        </div>
                        <button type="button" onClick={() => setShowImagePicker(false)}
                          style={{ width: 32, height: 32, borderRadius: 8, background: "#F9FAFB", border: "1px solid #E5E7EB", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <X size={15} color="#6B7280" />
                        </button>
                      </div>

                      {/* 모달 바디 */}
                      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

                        {/* 업로드 탭 */}
                        {imageTab === "upload" && (
                          <div style={{ padding: 24 }}>
                            <div
                              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                              onClick={() => fileInputRef.current?.click()}
                              style={{
                                border: `2px dashed ${isDragOver ? "var(--brand-500)" : "#C7D2FE"}`,
                                borderRadius: 14, padding: "60px 32px", textAlign: "center",
                                cursor: "pointer",
                                background: isDragOver ? "#F0EFFE" : "#F8F7FF",
                                transition: "all 0.15s",
                              }}>
                              <ImagePlus size={48} color={isDragOver ? "var(--brand-500)" : "#C7D2FE"} style={{ margin: "0 auto 16px", display: "block" }} />
                              <p style={{ fontSize: 16, fontWeight: 700, color: isDragOver ? "var(--brand-500)" : "#374151", marginBottom: 6 }}>
                                {isDragOver ? "여기에 놓으세요!" : "클릭하거나 드래그하여 업로드"}
                              </p>
                              <p style={{ fontSize: 13, color: "#9CA3AF" }}>PNG, JPG, WEBP 지원 • 최대 10MB</p>
                            </div>
                          </div>
                        )}

                        {/* 이 글 이미지 탭 */}
                        {imageTab === "gallery" && (
                          <div style={{ padding: "16px 20px", flex: 1, overflowY: "auto" }}>
                            {images.length === 0 ? (
                              <div style={{ textAlign: "center", padding: "48px 0", color: "#9CA3AF" }}>
                                <ImagePlus size={32} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
                                <p style={{ fontSize: 13, marginBottom: 8 }}>이 글에 업로드된 이미지가 없습니다.</p>
                                <button type="button" onClick={() => setImageTab("upload")}
                                  style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-500)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>업로드 탭으로 이동</button>
                              </div>
                            ) : (
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
                                {images.map((img, imageIndex) => (
                                  <div key={img.id}
                                    style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", border: "2px solid #E5E7EB", cursor: "pointer", transition: "all 0.12s" }}
                                    onClick={() => { insertImageToEditor(img); setShowImagePicker(false); }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--brand-500)"}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "#E5E7EB"}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={img.url.startsWith("data:") ? `/api/content/${contentId}/images/${img.id}/serve` : img.url} alt={img.altText || ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                    <span className="edit-image-number">{imageIndex + 1}</span>
                                    <button type="button" onClick={e => { e.stopPropagation(); removeImage(img.id); }}
                                      style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.65)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                                      <X size={10} color="#fff" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* URL 탭 */}
                        {imageTab === "url" && (
                          <div style={{ padding: 24 }}>
                            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>외부 이미지 URL을 입력하면 본문에 삽입됩니다.</p>
                            <div style={{ display: "flex", gap: 8 }}>
                              <input
                                style={{ flex: 1, height: 42, padding: "0 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, outline: "none", color: "#111827" }}
                                placeholder="https://example.com/image.jpg"
                                value={imageUrlInput} onChange={e => setImageUrlInput(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && handleAddImageUrl()} />
                              <button type="button" onClick={handleAddImageUrl}
                                style={{ height: 42, padding: "0 20px", borderRadius: 10, background: "linear-gradient(135deg,var(--brand-500),var(--brand-500))", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>추가</button>
                            </div>
                          </div>
                        )}

                        {/* 미디어 라이브러리 탭 */}
                        {imageTab === "medialib" && (
                          <MediaLibPicker onSelect={(url, alt) => {
                            insertImageToTiptap(editorRef.current, url, alt);
                            setShowImagePicker(false);
                          }} />
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFileUpload} />
              </div>

              <aside className="annotation-panel">
                <div style={{ padding: "16px 18px", borderBottom: "1px solid #F3F4F6" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    <MessageSquare size={14} color="var(--brand-500)" /> 댓글
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>{annotations.length}</span>
                  </h3>
                  <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>본문 텍스트를 드래그하면 댓글을 추가할 수 있습니다.</p>
                </div>
                <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
                  {annotations.length === 0 ? (
                    <div style={{ padding: "28px 12px", textAlign: "center", color: "#9CA3AF", fontSize: 12, background: "#fff", border: "1px dashed #E5E7EB", borderRadius: 10 }}>
                      아직 댓글이 없습니다.
                    </div>
                  ) : annotations.map(annotation => (
                    <button className="annotation-card" key={annotation.id} type="button">
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ minWidth: 24, height: 24, borderRadius: 999, background: "var(--brand-500)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>
                          {annotation.number}
                        </span>
                        <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>{annotation.authorName || "작성자"}</span>
                      </div>
                      {annotation.selectedText && (
                        <p style={{ fontSize: 12, lineHeight: 1.55, color: "#6B7280", background: "#F9FAFB", borderLeft: "3px solid #C7D2FE", padding: "8px 10px", borderRadius: 6, marginBottom: 8 }}>
                          “{annotation.selectedText}”
                        </p>
                      )}
                      <p style={{ fontSize: 13, lineHeight: 1.6, color: "#111827", margin: 0 }}>{annotation.body}</p>
                    </button>
                  ))}
                </div>
              </aside>
            </div>

            {/* ── 메타데이터 패널 ──────────────────── */}
            <div style={{ borderTop: "1px solid #F3F4F6", background: "#fff", padding: "14px 20px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showMetaPanel ? 14 : 0 }}>
                <button type="button" onClick={() => setShowMetaPanel(v => !v)}
                  style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: 0, color: "#374151", fontSize: 13, fontWeight: 700 }}>
                  <span style={{ transform: showMetaPanel ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", display: "inline-block" }}>▶</span>
                  SEO 및 발행 설정
                </button>
                {isGenMeta && <span style={{ fontSize: 11, color: "var(--brand-500)", display: "flex", alignItems: "center", gap: 4 }}><Loader2 size={12} className="animate-spin" /> AI 분석 중...</span>}
              </div>

              {showMetaPanel && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  {/* 키워드 */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>키워드</span>
                      <button type="button" onClick={() => generateMetadata()}
                        style={{ height: 22, padding: "0 8px", borderRadius: 5, background: "linear-gradient(135deg,var(--brand-500),var(--brand-500))", border: "none", color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                        <Sparkles size={9} /> AI 추천
                      </button>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                      {keywords.map((kw, idx) => (
                        <span key={idx} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 6, background: "#EEF2FF", color: "var(--brand-500)", fontSize: 11, fontWeight: 600, border: "1px solid #C7D2FE" }}>
                          {kw}
                          <button type="button" onClick={() => removeKeyword(idx)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--brand-500)", display: "flex" }}><X size={9} /></button>
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
                    <Layers size={16} color="var(--brand-500)" /> 슬라이드 목록
                    <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>({slides.length}개)</span>
                  </h2>
                  <button onClick={addSlide} style={{ height: 36, padding: "0 14px", borderRadius: 9, background: "#EEF2FF", border: "none", color: "var(--brand-500)", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
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
                                style={{ ...prov.draggableProps.style, boxShadow: snap.isDragging ? "0 8px 24px var(--fp-primary-subtle)" : "none", borderColor: snap.isDragging ? "#C7D2FE" : "#E5E7EB" }}>
                                <div style={{ display: "flex", gap: 12 }}>
                                  <div {...prov.dragHandleProps} style={{ display: "flex", alignItems: "flex-start", paddingTop: 8, color: "#D1D5DB", cursor: "grab" }}>
                                    <GripVertical size={18} />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                      <span style={{ fontSize: 11, fontWeight: 800, color: "var(--brand-500)", background: "#EEF2FF", padding: "3px 9px", borderRadius: 6 }}>Slide {i + 1}</span>
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
                                          style={{ height: 28, padding: "0 10px", borderRadius: 7, background: "#F5F3FF", border: "none", color: "var(--brand-500)", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
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
                    <button onClick={addSlide} style={{ height: 36, padding: "0 18px", borderRadius: 9, background: "#EEF2FF", border: "none", color: "var(--brand-500)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>슬라이드 추가</button>
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
                      <p style={{ fontSize: 20, fontWeight: 800, color: "var(--brand-500)", margin: 0 }}>{slides.length}</p>
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

      {isCommentModalOpen && (
        <div className="comment-modal-backdrop" onClick={() => setIsCommentModalOpen(false)}>
          <div className="comment-modal" onClick={event => event.stopPropagation()}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: 0 }}>댓글 추가</h3>
                <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>선택한 텍스트에 수정 의견을 남깁니다.</p>
              </div>
              <button type="button" onClick={() => setIsCommentModalOpen(false)}
                style={{ width: 32, height: 32, borderRadius: 8, background: "#F9FAFB", border: "1px solid #E5E7EB", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={15} color="#6B7280" />
              </button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ background: "#F9FAFB", borderLeft: "3px solid #C7D2FE", padding: "10px 12px", borderRadius: 8, marginBottom: 14, color: "#374151", fontSize: 13, lineHeight: 1.55, maxHeight: 120, overflowY: "auto" }}>
                “{selectedTextForComment}”
              </div>
              <textarea
                value={commentBody}
                onChange={event => setCommentBody(event.target.value)}
                placeholder="댓글을 입력하세요"
                maxLength={1000}
                autoFocus
                style={{ ...inputBase, minHeight: 120, padding: "12px 13px", resize: "vertical" as const, border: "1.5px solid #E5E7EB", marginBottom: 14 }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" onClick={() => setIsCommentModalOpen(false)}
                  style={{ height: 36, padding: "0 14px", borderRadius: 9, background: "#F3F4F6", border: "none", color: "#6B7280", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  취소
                </button>
                <button type="button" onClick={saveTextComment} disabled={isSavingComment || !commentBody.trim()}
                  style={{ height: 36, padding: "0 16px", borderRadius: 9, background: "var(--brand-500)", border: "none", color: "#fff", fontSize: 13, fontWeight: 800, cursor: isSavingComment || !commentBody.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, opacity: isSavingComment || !commentBody.trim() ? 0.55 : 1 }}>
                  {isSavingComment ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MediaLibPicker — 이미지 선택 모달 내 "라이브러리" 탭
   Vercel Blob MediaFile + 모든 콘텐츠 이미지(serve URL)를 통합 표시
══════════════════════════════════════════════════════════════ */
type MediaItem = { id: string; url: string; name: string; alt?: string | null; source: "blob" | "content"; contentTitle?: string; };

function MediaLibPicker({ onSelect }: { onSelect: (url: string, alt: string) => void }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "blob" | "content">("all");

  useEffect(() => {
    setLoading(true);
    // 두 소스를 병렬로 조회
    Promise.all([
      fetch("/api/media?type=IMAGE&limit=100&sort=date")
        .then(r => r.ok ? r.json() : { files: [] })
        .then(d => (d.files || []).map((f: { id: string; url: string; name: string; alt?: string }) => ({
          id: `blob-${f.id}`, url: f.url, name: f.name, alt: f.alt, source: "blob" as const,
        }))),
      fetch("/api/media/content-images")
        .then(r => r.ok ? r.json() : { images: [] })
        .then(d => (d.images || []).map((img: { id: string; url: string; name: string; alt: string; contentTitle: string }) => ({
          id: `content-${img.id}`, url: img.url, name: img.name, alt: img.alt,
          source: "content" as const, contentTitle: img.contentTitle,
        }))),
    ])
      .then(([blobItems, contentItems]) => {
        // 중복 제거 후 날짜 최신 순 병합
        const merged = [...blobItems, ...contentItems];
        setItems(merged);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = items
    .filter(f => sourceFilter === "all" || f.source === sourceFilter)
    .filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  const blobCount = items.filter(f => f.source === "blob").length;
  const contentCount = items.filter(f => f.source === "content").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* 툴바 */}
      <div style={{ padding: "12px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
        <input
          placeholder="이미지 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, height: 36, padding: "0 12px", border: "1.5px solid #E5E7EB", borderRadius: 9, fontSize: 13, outline: "none", color: "#111827", background: "#fff" }}
        />
        <div style={{ display: "flex", gap: 0, background: "#F3F4F6", borderRadius: 8, padding: 2, flexShrink: 0 }}>
          {(["all", "blob", "content"] as const).map(s => (
            <button key={s} type="button"
              onClick={() => setSourceFilter(s)}
              style={{ padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: sourceFilter === s ? "#fff" : "transparent", color: sourceFilter === s ? "var(--brand-500)" : "#9CA3AF", boxShadow: sourceFilter === s ? "0 1px 3px rgba(0,0,0,0.1)" : "none", transition: "all 0.12s" }}>
              {s === "all" ? `전체(${items.length})` : s === "blob" ? `라이브러리(${blobCount})` : `콘텐츠(${contentCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* 이미지 그리드 */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#9CA3AF", fontSize: 13 }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#9CA3AF" }}>
            <p style={{ fontSize: 13, marginBottom: 8 }}>
              {items.length === 0 ? "업로드된 이미지가 없습니다." : "검색 결과가 없습니다."}
            </p>
            {items.length === 0 && (
              <a href="/media" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--brand-500)", fontWeight: 700, textDecoration: "underline" }}>
                미디어 라이브러리에서 업로드하기 →
              </a>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
            {filtered.map((f, imageIndex) => (
              <div key={f.id}
                onClick={() => onSelect(f.url, f.alt || f.name)}
                title={f.contentTitle ? `${f.name}\n(${f.contentTitle})` : f.name}
                style={{
                  position: "relative", aspectRatio: "1", borderRadius: 10,
                  overflow: "hidden", border: "2px solid #E5E7EB",
                  cursor: "pointer", transition: "all 0.12s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--brand-500)";
                  (e.currentTarget as HTMLElement).style.transform = "scale(1.03)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#E5E7EB";
                  (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={f.alt || f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <span className="edit-image-number">{imageIndex + 1}</span>
                {/* 소스 배지 */}
                <span style={{
                  position: "absolute", bottom: 3, left: 3,
                  fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
                  background: f.source === "blob" ? "var(--fp-primary-subtle)" : "rgba(16,185,129,0.85)",
                  color: "#fff",
                }}>
                  {f.source === "blob" ? "Blob" : "글"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 푸터 */}
      <div style={{ padding: "10px 20px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: "#9CA3AF" }}>총 {filtered.length}개 표시</span>
        <a href="/media" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--brand-500)", fontWeight: 600, textDecoration: "none" }}>미디어 라이브러리 관리 →</a>
      </div>
    </div>
  );
}
