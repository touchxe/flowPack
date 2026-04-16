"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Save, Plus, Trash2, GripVertical, Image as ImageIcon, Share2, Loader2, Check, AlertCircle, Layers, ChevronLeft } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useSession } from "next-auth/react";
import { ImageGenerationModal } from "@/components/features/content/image-generation-modal";
import { PublishModal } from "@/components/features/publish/publish-modal";

interface Slide { index: number; title: string; body: string; imagePrompt?: string; }
interface ContentData { id: string; title: string; type: string; slides: Slide[]; status: string; }

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

export default function ContentEditPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const contentId = params.id as string;

  const [content, setContent] = useState<ContentData | null>(null);
  const [title, setTitle] = useState("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState<number | null>(null);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/content/${contentId}`);
        if (!res.ok) throw new Error("콘텐츠를 찾을 수 없습니다");
        const data = await res.json();
        setContent(data.content); setTitle(data.content.title); setSlides(data.content.slides || []);
      } catch (err) { setError(err instanceof Error ? err.message : "오류가 발생했습니다"); }
      finally { setIsLoading(false); }
    })();
  }, [contentId]);

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
  const addSlide = () => setSlides([...slides, { index: slides.length, title: "", body: "", imagePrompt: "" }]);
  const deleteSlide = (i: number) => setSlides(slides.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, index: idx })));

  const handleSave = async () => {
    setIsSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch(`/api/content/${contentId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, slides }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "저장 중 오류가 발생했습니다"); }
      setSuccess("저장되었습니다!"); setTimeout(() => setSuccess(""), 3000);
    } catch (err) { setError(err instanceof Error ? err.message : "오류가 발생했습니다"); }
    finally { setIsSaving(false); }
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, flexDirection: "column", gap: 12 }}>
        <Loader2 size={28} color="#6366F1" className="animate-spin" />
        <p style={{ fontSize: 13, color: "#9CA3AF" }}>콘텐츠를 불러오는 중...</p>
      </div>
    );
  }

  if (!content) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 16 }}>
        <p style={{ fontSize: 14, color: "#9CA3AF" }}>콘텐츠를 찾을 수 없습니다</p>
        <Link href="/home" style={{ padding: "10px 20px", borderRadius: 10, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>홈으로</Link>
      </div>
    );
  }

  const st = STATUS_THEME[content.status] ?? STATUS_THEME.DRAFT;

  return (
    <div style={{ padding: "24px 28px" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        .slide-card { background:#fff; border:1.5px solid #E5E7EB; border-radius:14px; padding:18px; transition:all 0.15s; }
        .slide-card:hover { border-color:#C7D2FE; }
        .slide-input { padding:9px 13px; height:40px; }
        .slide-textarea { padding:10px 13px; min-height:80px; resize:vertical; }
        textarea:focus, input:focus { border-color:#6366F1 !important; box-shadow:0 0 0 3px rgba(99,102,241,0.10) !important; }
        .action-btn { display:inline-flex; align-items:center; gap:6px; height:40px; padding:0 18px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; transition:all 0.2s; }
      `}</style>

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <Link href="/contents" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#9CA3AF", textDecoration: "none", marginBottom: 6 }}>
            <ChevronLeft size={14} /> 콘텐츠 목록
          </Link>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>콘텐츠 편집</h1>
        </div>
        {/* 저장 + 배포 버튼 */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setIsPublishModalOpen(true)} className="action-btn"
            style={{ background: "#fff", border: "1.5px solid #E5E7EB", color: "#374151" }}>
            <Share2 size={14} /> 배포하기
          </button>
          <button onClick={handleSave} disabled={isSaving} className="action-btn"
            style={{ background: isSaving ? "#C7D2FE" : "linear-gradient(135deg,#6366F1,#8B5CF6)", border: "none", color: "#fff", boxShadow: isSaving ? "none" : "0 2px 8px rgba(99,102,241,0.3)" }}>
            {isSaving ? <><Loader2 size={13} className="animate-spin" /> 저장 중...</> : <><Save size={13} /> 저장</>}
          </button>
        </div>
      </div>

      {/* 알림 배너 */}
      {error && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#991B1B", fontSize: 13, fontWeight: 600 }}>
          <AlertCircle size={15} /> {error}
          <button onClick={() => setError("")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }}>×</button>
        </div>
      )}
      {success && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, background: "#ECFDF5", border: "1.5px solid #A7F3D0", color: "#065F46", fontSize: 13, fontWeight: 700 }}>
          <Check size={15} /> {success}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
        {/* 슬라이드 편집 영역 */}
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
                            {/* 드래그 핸들 */}
                            <div {...prov.dragHandleProps} style={{ display: "flex", alignItems: "flex-start", paddingTop: 8, color: "#D1D5DB", cursor: "grab" }}>
                              <GripVertical size={18} />
                            </div>

                            <div style={{ flex: 1 }}>
                              {/* 슬라이드 번호 + 삭제 */}
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color: "#6366F1", background: "#EEF2FF", padding: "3px 9px", borderRadius: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                  Slide {i + 1}
                                </span>
                                <button onClick={() => deleteSlide(i)}
                                  style={{ width: 28, height: 28, borderRadius: 7, background: "none", border: "1px solid #E5E7EB", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", transition: "all 0.15s" }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#FCA5A5"; (e.currentTarget as HTMLElement).style.color = "#EF4444"; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#E5E7EB"; (e.currentTarget as HTMLElement).style.color = "#9CA3AF"; }}>
                                  <Trash2 size={13} />
                                </button>
                              </div>

                              {/* 제목 */}
                              <div style={{ marginBottom: 10 }}>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 5 }}>제목</label>
                                <input style={{ ...inputBase, ...{ height: 40, padding: "0 13px" }, border: "1.5px solid #E5E7EB" }}
                                  value={slide.title} onChange={e => updateSlide(i, "title", e.target.value)} placeholder="슬라이드 제목을 입력하세요" />
                              </div>

                              {/* 본문 */}
                              <div style={{ marginBottom: 10 }}>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 5 }}>본문</label>
                                <textarea style={{ ...inputBase, ...{ padding: "10px 13px", minHeight: 80, resize: "vertical" as const, border: "1.5px solid #E5E7EB" } }}
                                  value={slide.body} onChange={e => updateSlide(i, "body", e.target.value)} placeholder="슬라이드 내용을 입력하세요" />
                              </div>

                              {/* 이미지 프롬프트 */}
                              <div>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                                  <label style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>이미지 프롬프트</label>
                                  <button type="button" onClick={() => { setSelectedSlideIndex(i); setIsImageModalOpen(true); }}
                                    style={{ height: 28, padding: "0 10px", borderRadius: 7, background: "#F5F3FF", border: "none", color: "#8B5CF6", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                                    <ImageIcon size={11} /> AI 이미지
                                  </button>
                                </div>
                                <input style={{ ...inputBase, ...{ height: 40, padding: "0 13px" }, border: "1.5px solid #E5E7EB" }}
                                  value={slide.imagePrompt || ""} onChange={e => updateSlide(i, "imagePrompt", e.target.value)} placeholder="DALL-E용 이미지 프롬프트" />
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
              <button onClick={addSlide} style={{ height: 36, padding: "0 18px", borderRadius: 9, background: "#EEF2FF", border: "none", color: "#6366F1", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                슬라이드 추가
              </button>
            </div>
          )}
        </div>

        {/* 사이드바 */}
        <div style={{ position: "sticky", top: 24, alignSelf: "flex-start", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* 기본 정보 */}
          <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16, padding: "18px 20px" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 14 }}>기본 정보</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>제목</label>
              <input style={{ ...inputBase, height: 40, padding: "0 13px", border: "1.5px solid #E5E7EB" }}
                value={title} onChange={e => setTitle(e.target.value)} placeholder="콘텐츠 제목을 입력하세요" />
            </div>
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

          {/* 액션 버튼 */}
          <button onClick={handleSave} disabled={isSaving}
            style={{ width: "100%", height: 44, borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: isSaving ? "not-allowed" : "pointer", border: "none", background: isSaving ? "#C7D2FE" : "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: isSaving ? "none" : "0 3px 10px rgba(99,102,241,0.3)" }}>
            {isSaving ? <><Loader2 size={15} className="animate-spin" /> 저장 중...</> : <><Save size={15} /> 변경 사항 저장</>}
          </button>
          <button onClick={() => setIsPublishModalOpen(true)}
            style={{ width: "100%", height: 44, borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Share2 size={15} /> 배포하기
          </button>
        </div>
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
