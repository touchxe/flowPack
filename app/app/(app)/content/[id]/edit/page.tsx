"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Save, Plus, Trash2, GripVertical, Image as ImageIcon, Share2,
  Loader2, Check, AlertCircle, Layers, ChevronLeft, FileText, X,
  Eye, Edit3, Columns, ImagePlus, Link as LinkIcon,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { ImageGenerationModal } from "@/components/features/content/image-generation-modal";
import { PublishModal } from "@/components/features/publish/publish-modal";
import { MarkdownToolbar } from "@/components/features/content/markdown-toolbar";
import { MarkdownPreview } from "@/components/features/content/markdown-preview";

interface Slide { index: number; title: string; body: string; imagePrompt?: string; }
interface ContentImage { id: string; url: string; altText?: string; order: number; }
interface ContentData {
  id: string; title: string; type: string;
  body?: string; slides: Slide[]; status: string;
  images?: ContentImage[];
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

type ViewMode = "edit" | "preview" | "split";

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
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [showImagePicker, setShowImagePicker] = useState(false);

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
      } catch (err) { setError(err instanceof Error ? err.message : "오류가 발생했습니다"); }
      finally { setIsLoading(false); }
    })();
  }, [contentId]);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach(file => {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const url = ev.target?.result as string;
        try {
          const res = await fetch(`/api/content/${contentId}/images`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ images: [{ url, altText: file.name, order: images.length }] }),
          });
          if (res.ok) {
            const data = await res.json();
            setImages(prev => [...prev, ...data.images]);
          }
        } catch { /* ignore */ }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
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

  // 에디터에 이미지 마크다운 삽입
  const insertImageToEditor = (img: ContentImage) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const text = ta.value;
    const insert = `\n![${img.altText || "image"}](${img.url})\n`;
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
      const payload = isBlog ? { title, body } : { title, slides };
      const res = await fetch(`/api/content/${contentId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "저장 중 오류가 발생했습니다"); }
      setSuccess("저장되었습니다!"); setTimeout(() => setSuccess(""), 3000);
    } catch (err) { setError(err instanceof Error ? err.message : "오류가 발생했습니다"); }
    finally { setIsSaving(false); }
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
              <button type="button" style={tabBtnStyle(viewMode === "split")} onClick={() => setViewMode("split")}><Columns size={13} /> 분할</button>
              <button type="button" style={tabBtnStyle(viewMode === "preview")} onClick={() => setViewMode("preview")}><Eye size={13} /> 미리보기</button>
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

      {/* ── 메인 영역 ──────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {isBlog ? (
          <>
            {/* ── 이미지 갤러리 바 ────────────────── */}
            <div style={{ padding: "10px 24px", background: "#FAFBFC", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, overflowX: "auto" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", whiteSpace: "nowrap" }}>이미지 ({images.length})</span>
              {images.map(img => (
                <div key={img.id} className="img-thumb-sm" title={`클릭하여 본문에 삽입: ${img.altText}`} onClick={() => insertImageToEditor(img)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.altText || ""} />
                  <button onClick={e => { e.stopPropagation(); removeImage(img.id); }}
                    style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                    <X size={8} color="#fff" />
                  </button>
                </div>
              ))}
              {/* 이미지 추가 버튼 */}
              <button type="button" onClick={() => fileInputRef.current?.click()}
                style={{ width: 64, height: 64, borderRadius: 8, border: "1.5px dashed #C7D2FE", background: "#F8F7FF", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, color: "#6366F1", flexShrink: 0 }}>
                <ImagePlus size={14} /><span style={{ fontSize: 9, fontWeight: 600 }}>추가</span>
              </button>
              <button type="button" onClick={() => setShowUrlInput(v => !v)}
                style={{ height: 28, padding: "0 8px", borderRadius: 6, background: showUrlInput ? "#EEF2FF" : "#F3F4F6", border: "1px solid #E5E7EB", color: "#6366F1", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
                <LinkIcon size={10} /> URL
              </button>
              {showUrlInput && (
                <>
                  <input style={{ ...inputBase, height: 28, padding: "0 10px", fontSize: 11, width: 220, flexShrink: 0 }}
                    placeholder="https://..." value={imageUrlInput} onChange={e => setImageUrlInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddImageUrl()} />
                  <button type="button" onClick={handleAddImageUrl}
                    style={{ height: 28, padding: "0 10px", borderRadius: 7, background: "#6366F1", border: "none", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>추가</button>
                </>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFileUpload} />
            </div>

            {/* ── 에디터 + 미리보기 패널 ──────────── */}
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: viewMode === "split" ? "1fr 1fr" : "1fr", minHeight: 0 }}>
              {/* 에디터 패널 */}
              {viewMode !== "preview" && (
                <div style={{ display: "flex", flexDirection: "column", borderRight: viewMode === "split" ? "1px solid #F3F4F6" : "none", minHeight: 0 }}>
                  <MarkdownToolbar
                    textareaRef={textareaRef}
                    onChange={setBody}
                    onInsertImage={() => setShowImagePicker(v => !v)}
                  />
                  {/* 이미지 선택 팝오버 */}
                  {showImagePicker && images.length > 0 && (
                    <div style={{ padding: "8px 12px", background: "#FAFBFC", borderBottom: "1px solid #F3F4F6", display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", alignSelf: "center" }}>클릭하여 삽입:</span>
                      {images.map(img => (
                        <div key={img.id} className="img-thumb-sm" style={{ width: 48, height: 48 }}
                          onClick={() => insertImageToEditor(img)}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt={img.altText || ""} />
                        </div>
                      ))}
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    className="edit-textarea"
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="마크다운으로 블로그 본문을 작성하세요..."
                    spellCheck={false}
                  />
                </div>
              )}

              {/* 미리보기 패널 */}
              {viewMode !== "edit" && (
                <div style={{ overflowY: "auto", background: "#FAFBFC", minHeight: 0 }}>
                  <div style={{ maxWidth: 720, margin: "0 auto", padding: "8px 0" }}>
                    <MarkdownPreview content={body} />
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
