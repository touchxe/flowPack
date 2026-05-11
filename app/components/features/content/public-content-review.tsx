"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AlertCircle, FileText, Layers, Loader2, MessageSquare, Send } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

interface Slide {
  index?: number;
  title?: string;
  body?: string;
  imagePrompt?: string;
  imageUrl?: string;
}

interface ContentImage {
  id: string;
  url: string;
  altText: string | null;
  order: number;
}

interface Annotation {
  id: string;
  slideIndex: number;
  number: number;
  authorName: string | null;
  selectedText: string | null;
  body: string;
  createdAt: string;
}

interface PublicContent {
  id: string;
  title: string;
  type: string;
  body: string | null;
  slides: Slide[] | null;
  thumbnailUrl: string | null;
  images: ContentImage[];
  annotations: Annotation[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface PublicContentReviewProps {
  shareToken: string;
}

const COMMENT_HIGHLIGHT_CLASS = "fp-comment-selection-mark";

function getSlideImage(slide: Slide, images: ContentImage[], index: number): string | null {
  if (slide.imageUrl) return slide.imageUrl;
  const matchedImage = images.find((image) => image.order === index);
  if (matchedImage) return matchedImage.url;
  if (slide.imagePrompt?.startsWith("http")) return slide.imagePrompt;
  return null;
}

function groupAnnotationsBySlide(annotations: Annotation[]): Map<number, Annotation[]> {
  const grouped = new Map<number, Annotation[]>();
  annotations.forEach((annotation) => {
    const current = grouped.get(annotation.slideIndex) ?? [];
    grouped.set(annotation.slideIndex, [...current, annotation]);
  });
  return grouped;
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function unwrapHighlightElement(element: Element): void {
  const parent = element.parentNode;
  if (!parent) return;

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  parent.removeChild(element);
  parent.normalize();
}

function clearCommentHighlight(root?: HTMLElement | null, marker?: HTMLElement | null): void {
  if (marker?.isConnected) {
    unwrapHighlightElement(marker);
    return;
  }

  root?.querySelectorAll(`.${COMMENT_HIGHLIGHT_CLASS}`).forEach(unwrapHighlightElement);
}

function showCommentHighlight(range: Range, owner: HTMLElement): HTMLSpanElement | null {
  clearCommentHighlight(owner);

  try {
    const marker = document.createElement("span");
    marker.className = COMMENT_HIGHLIGHT_CLASS;
    marker.setAttribute("data-fp-comment-selection", "true");

    const fragment = range.extractContents();
    marker.appendChild(fragment);
    range.insertNode(marker);
    window.getSelection()?.removeAllRanges();

    return marker;
  } catch {
    return null;
  }
}

export function PublicContentReview({
  shareToken,
}: PublicContentReviewProps): React.ReactElement {
  const [content, setContent] = useState<PublicContent | null>(null);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [authorName, setAuthorName] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [selectedTextForComment, setSelectedTextForComment] = useState("");
  const [selectionBubble, setSelectionBubble] = useState<{ text: string; left: number; top: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const documentRef = useRef<HTMLElement>(null);
  const selectedHighlightRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    async function fetchContent(): Promise<void> {
      if (!shareToken) {
        setError("공유 토큰이 없는 링크입니다.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/public/content/${shareToken}`);
        const result = (await response.json()) as ApiResponse<PublicContent>;

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error ?? "공유 콘텐츠를 불러오지 못했습니다.");
        }

        setContent(result.data);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchContent();
  }, [shareToken]);

  useEffect(() => {
    return () => clearCommentHighlight(documentRef.current);
  }, []);

  const slides = useMemo<Slide[]>(() => {
    if (content?.slides && Array.isArray(content.slides) && content.slides.length > 0) {
      return content.slides;
    }

    if (content?.body && content.type !== "BLOG") {
      return [{ index: 0, title: content.title, body: htmlToText(content.body) }];
    }

    return [];
  }, [content]);

  const annotationsBySlide = useMemo(
    () => groupAnnotationsBySlide(content?.annotations ?? []),
    [content?.annotations]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!commentBody.trim() || !content) return;

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/public/content/${shareToken}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slideIndex: selectedSlideIndex,
          authorName: authorName.trim() || undefined,
          selectedText: selectedTextForComment || undefined,
          body: commentBody.trim(),
        }),
      });
      const result = (await response.json()) as ApiResponse<Annotation>;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error ?? "수정의견을 저장하지 못했습니다.");
      }

      setContent({
        ...content,
        annotations: [...content.annotations, result.data],
      });
      setCommentBody("");
      setSelectedTextForComment("");
      setSelectionBubble(null);
      clearCommentHighlight(documentRef.current, selectedHighlightRef.current);
      selectedHighlightRef.current = null;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDocumentMouseUp(): void {
    if (content?.type !== "BLOG") return;

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() ?? "";
    if (!selection || !selectedText || selection.rangeCount === 0) {
      setSelectionBubble(null);
      if (!selectedTextForComment) {
        clearCommentHighlight(documentRef.current, selectedHighlightRef.current);
        selectedHighlightRef.current = null;
      }
      return;
    }

    const range = selection.getRangeAt(0);
    const owner = documentRef.current;
    if (!owner || !owner.contains(range.commonAncestorContainer)) {
      setSelectionBubble(null);
      clearCommentHighlight(documentRef.current, selectedHighlightRef.current);
      selectedHighlightRef.current = null;
      return;
    }

    const marker = showCommentHighlight(range, owner);
    selectedHighlightRef.current = marker;

    const rect = marker?.getBoundingClientRect() ?? range.getBoundingClientRect();
    setSelectionBubble({
      text: selectedText.slice(0, 1000),
      left: Math.min(Math.max(rect.left + rect.width / 2 - 38, 12), window.innerWidth - 92),
      top: Math.max(rect.bottom + 8, 12),
    });
  }

  if (isLoading) {
    return (
      <div className="fp-public-shell fp-public-center">
        <div className="fp-loading">
          <Loader2 size={18} className="animate-spin" />
          콘텐츠를 불러오는 중...
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="fp-public-shell fp-public-center">
        <div className="fp-empty">
          <AlertCircle size={34} />
          <p>공유 콘텐츠를 볼 수 없습니다</p>
          <span>링크가 만료되었거나 공유가 중지되었습니다.</span>
        </div>
      </div>
    );
  }

  const isBlog = content.type === "BLOG";
  const selectedLabel = isBlog ? "문서 전체" : `${selectedSlideIndex + 1}번 영역`;
  const commentGuide = isBlog
    ? "본문 텍스트를 드래그한 뒤 댓글 버튼을 누르면 선택한 문장에 수정의견을 남길 수 있습니다."
    : "수정의견을 남길 영역의 버튼을 누르세요. 저장된 의견 번호는 이미지 우측 상단에 표시됩니다.";

  return (
    <main className="fp-public-shell">
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        .fp-public-shell { min-height:100vh; background:#F7F8FA; color:#111827; font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        .fp-public-center { display:flex; align-items:center; justify-content:center; padding:24px; }
        .fp-loading { display:flex; align-items:center; gap:8px; font-size:14px; color:#6B7280; }
        .fp-empty { width:100%; max-width:420px; border:1px solid #E5E7EB; background:#fff; border-radius:12px; padding:32px; text-align:center; color:#6B7280; box-shadow:0 12px 40px rgba(17,24,39,0.06); }
        .fp-empty p { margin:12px 0 4px; color:#111827; font-size:16px; font-weight:800; }
        .fp-empty span { font-size:13px; }
        .fp-topbar { position:sticky; top:0; z-index:20; background:#fff; border-bottom:1px solid #F3F4F6; padding:13px 24px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
        .fp-badge { display:inline-flex; align-items:center; gap:5px; height:24px; padding:0 9px; border-radius:7px; background:#EEF2FF; color:#4F46E5; font-size:11px; font-weight:800; }
        .fp-layout { max-width:1180px; margin:0 auto; padding:36px 24px 80px; display:grid; grid-template-columns:minmax(0,760px) 340px; gap:32px; align-items:start; }
        .fp-document { min-width:0; }
        .fp-title { font-size:32px; line-height:1.3; font-weight:900; margin:0 0 26px; color:#111827; }
        .fp-meta { display:flex; align-items:center; gap:10px; color:#9CA3AF; font-size:12px; margin-bottom:20px; }
        .fp-divider { border-top:1px solid #F3F4F6; padding-top:30px; }
        .fp-tiptap { font-size:15px; line-height:1.85; color:#1F2937; }
        .fp-tiptap strong { font-weight:700; color:#111827; }
        .fp-tiptap h1 { font-size:28px; font-weight:800; margin:32px 0 16px; color:#111827; border-bottom:2px solid #EEF2FF; padding-bottom:10px; }
        .fp-tiptap h2 { font-size:22px; font-weight:700; margin:28px 0 12px; color:#111827; }
        .fp-tiptap h3 { font-size:18px; font-weight:700; margin:24px 0 10px; color:#374151; }
        .fp-tiptap p { margin:0 0 16px; }
        .fp-tiptap ul,.fp-tiptap ol { margin:0 0 16px; padding-left:24px; }
        .fp-tiptap li { margin-bottom:6px; }
        .fp-tiptap blockquote { border-left:4px solid #4F46E5; background:#F8F7FF; padding:14px 18px; margin:16px 0; border-radius:0 8px 8px 0; color:#4338CA; font-weight:500; }
        .fp-tiptap img { max-width:100%; border-radius:12px; margin:16px 0; box-shadow:0 2px 12px rgba(0,0,0,0.08); }
        .fp-tiptap ::selection { background:#FACC15; color:#111827; text-shadow:none; }
        .fp-comment-selection-mark { background:#FACC15; color:#111827; text-decoration:underline 2px #D97706; text-decoration-skip-ink:none; border-radius:3px; box-shadow:0 0 0 2px rgba(250,204,21,0.34); }
        .fp-section { border-top:1px solid #E5E7EB; padding:30px 0; }
        .fp-section:first-child { border-top:0; padding-top:0; }
        .fp-section-head { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; margin-bottom:16px; }
        .fp-section-kicker { font-size:12px; font-weight:800; color:#4F46E5; margin-bottom:7px; }
        .fp-section-title { font-size:22px; line-height:1.35; font-weight:850; color:#111827; margin:0; }
        .fp-comment-btn { height:34px; padding:0 12px; border-radius:8px; border:1.5px solid #E5E7EB; background:#fff; color:#374151; display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:800; cursor:pointer; white-space:nowrap; }
        .fp-comment-btn:hover,.fp-comment-btn.active { border-color:#C7D2FE; color:#4F46E5; background:#F8F7FF; }
        .fp-selection-btn { position:fixed; z-index:50; height:32px; padding:0 10px; border-radius:8px; border:1px solid #C7D2FE; background:#fff; color:#4F46E5; box-shadow:0 8px 24px rgba(79,70,229,0.18); font-size:12px; font-weight:850; display:flex; align-items:center; gap:5px; cursor:pointer; }
        .fp-selected-quote { border-left:3px solid #C7D2FE; background:#F9FAFB; border-radius:8px; padding:9px 10px; color:#4B5563; font-size:12px; line-height:1.55; margin-bottom:12px; max-height:112px; overflow:auto; }
        .fp-section-body { display:grid; grid-template-columns:minmax(220px,320px) minmax(0,1fr); gap:22px; align-items:start; }
        .fp-image-wrap { position:relative; aspect-ratio:1 / 1; border-radius:12px; overflow:hidden; border:1px solid #E5E7EB; background:#F3F4F6; }
        .fp-image-empty { height:100%; display:flex; align-items:center; justify-content:center; text-align:center; padding:22px; color:#9CA3AF; font-size:13px; }
        .fp-markers { position:absolute; top:12px; right:12px; display:flex; flex-wrap:wrap; justify-content:flex-end; gap:6px; max-width:80%; }
        .fp-marker { min-width:28px; height:28px; padding:0 8px; border-radius:999px; background:#4F46E5; color:#fff; box-shadow:0 6px 18px rgba(79,70,229,0.28); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:900; }
        .fp-slide-text { white-space:pre-wrap; color:#1F2937; font-size:15px; line-height:1.8; margin:0; }
        .fp-aside { position:sticky; top:72px; display:flex; flex-direction:column; gap:14px; }
        .fp-panel { background:#fff; border:1px solid #E5E7EB; border-radius:12px; padding:16px; box-shadow:0 10px 28px rgba(17,24,39,0.04); }
        .fp-comment-panel,.fp-comment-form,.fp-comment-form * { color-scheme:light; }
        .fp-comment-panel { background:#fff !important; color:#111827 !important; }
        .fp-panel h2 { font-size:14px; font-weight:850; margin:0 0 12px; color:#111827; }
        .fp-comment-guide { display:flex; align-items:flex-start; gap:10px; background:#FFF7ED; border:2px solid #FDBA74; color:#9A3412; border-radius:12px; padding:13px 14px; font-size:13px; line-height:1.6; font-weight:850; margin:0 0 14px; box-shadow:0 10px 28px rgba(249,115,22,0.14); }
        .fp-comment-guide svg { flex:0 0 auto; margin-top:2px; color:#EA580C; stroke-width:3; }
        .fp-comment-guide span { display:block; }
        .fp-selected { background:#F9FAFB; border-radius:8px; padding:9px 10px; color:#6B7280; font-size:12px; margin-bottom:12px; }
        .fp-comment-form input.fp-input,.fp-comment-form textarea.fp-textarea,.fp-input,.fp-textarea { width:100%; border:1px solid #E5E7EB !important; border-radius:8px; background:#fff !important; background-color:#fff !important; background-image:none !important; color:#111827 !important; -webkit-text-fill-color:#111827 !important; caret-color:#4F46E5; color-scheme:light; font-size:13px; font-family:inherit; outline:none; appearance:none; -webkit-appearance:none; box-shadow:inset 0 0 0 1000px #fff; }
        .fp-input { height:38px; padding:0 11px; }
        .fp-textarea { min-height:122px; padding:10px 11px; resize:vertical; line-height:1.55; }
        .fp-input::placeholder,.fp-textarea::placeholder { color:#9CA3AF; opacity:1; }
        .fp-input:focus,.fp-textarea:focus { border-color:#C7D2FE !important; box-shadow:inset 0 0 0 1000px #fff, 0 0 0 3px rgba(79,70,229,0.10); }
        .fp-input:-webkit-autofill,.fp-textarea:-webkit-autofill { box-shadow:inset 0 0 0 1000px #fff !important; -webkit-text-fill-color:#111827 !important; caret-color:#4F46E5; }
        .fp-field { display:flex; flex-direction:column; gap:7px; margin-bottom:12px; }
        .fp-field label { font-size:12px; color:#374151; font-weight:750; }
        .fp-submit { width:100%; height:38px; border:0; border-radius:9px; background:#4F46E5; color:#fff; font-size:13px; font-weight:850; display:flex; align-items:center; justify-content:center; gap:7px; cursor:pointer; }
        .fp-submit:disabled { opacity:0.55; cursor:not-allowed; }
        .fp-error { color:#DC2626; font-size:12px; line-height:1.5; margin:0 0 12px; white-space:pre-wrap; }
        .fp-comment-list { display:flex; flex-direction:column; gap:10px; }
        .fp-comment-empty { background:#F9FAFB; border-radius:9px; color:#9CA3AF; font-size:13px; text-align:center; padding:24px 10px; }
        .fp-comment { width:100%; border:1px solid #E5E7EB; background:#fff; border-radius:10px; padding:12px; text-align:left; cursor:pointer; }
        .fp-comment:hover { border-color:#C7D2FE; }
        .fp-comment-top { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
        .fp-comment-body { font-size:13px; line-height:1.6; color:#1F2937; margin:0; }
        .fp-comment-meta { font-size:11px; color:#9CA3AF; margin-top:8px; }
        @media (max-width: 980px) {
          .fp-layout { grid-template-columns:1fr; padding:28px 18px 64px; }
          .fp-aside { position:static; }
        }
        @media (max-width: 680px) {
          .fp-topbar { padding:12px 16px; }
          .fp-title { font-size:26px; }
          .fp-section-body { grid-template-columns:1fr; }
          .fp-section-head { flex-direction:column; }
          .fp-comment-btn { width:100%; justify-content:center; }
        }
      `}</style>

      {selectionBubble && (
        <button
          type="button"
          className="fp-selection-btn"
          style={{ left: selectionBubble.left, top: selectionBubble.top }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setSelectedSlideIndex(0);
            setSelectedTextForComment(selectionBubble.text);
            setSelectionBubble(null);
          }}
        >
          <MessageSquare size={13} />
          댓글
        </button>
      )}

      <div className="fp-topbar">
        <div className="fp-badge">
          {isBlog ? <FileText size={12} /> : <Layers size={12} />}
          {isBlog ? "공유 문서" : "공유 콘텐츠"}
        </div>
        <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 700 }}>FlowPack</span>
      </div>

      <div className="fp-layout">
        <section className="fp-document">
          <div className="fp-meta">
            <span>{isBlog ? "문서 보기" : "일반 보기"}</span>
            <span>·</span>
            <span>링크가 있는 사람 모두 보기 가능</span>
          </div>
          <h1 className="fp-title">{content.title}</h1>

          {isBlog ? (
            <article className="fp-divider" ref={documentRef} onMouseUp={handleDocumentMouseUp}>
              <div className="fp-tiptap" dangerouslySetInnerHTML={{ __html: content.body ?? "" }} />
            </article>
          ) : slides.length === 0 ? (
            <div className="fp-empty">
              <Layers size={34} />
              <p>표시할 본문이 없습니다</p>
              <span>공유된 콘텐츠에 슬라이드나 본문이 없습니다.</span>
            </div>
          ) : (
            <div className="fp-divider">
              {slides.map((slide, index) => {
                const slideAnnotations = annotationsBySlide.get(index) ?? [];
                const imageUrl = getSlideImage(slide, content.images, index);

                return (
                  <article className="fp-section" key={`${slide.title ?? "section"}-${index}`}>
                    <div className="fp-section-head">
                      <div>
                        <p className="fp-section-kicker">{index + 1}</p>
                        <h2 className="fp-section-title">{slide.title || `${index + 1}번 영역`}</h2>
                      </div>
                      <button
                        className={`fp-comment-btn ${selectedSlideIndex === index ? "active" : ""}`}
                        type="button"
                        onClick={() => {
                          setSelectedSlideIndex(index);
                          setSelectedTextForComment("");
                          setSelectionBubble(null);
                          clearCommentHighlight(documentRef.current, selectedHighlightRef.current);
                          selectedHighlightRef.current = null;
                        }}
                      >
                        <MessageSquare size={14} />
                        수정의견
                      </button>
                    </div>

                    <div className="fp-section-body">
                      <div className="fp-image-wrap">
                        {imageUrl ? (
                          <Image
                            src={imageUrl}
                            alt={slide.title || `${index + 1}번 이미지`}
                            fill
                            sizes="(min-width: 980px) 320px, 100vw"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="fp-image-empty">이미지 미리보기가 없습니다</div>
                        )}

                        {slideAnnotations.length > 0 && (
                          <div className="fp-markers">
                            {slideAnnotations.map((annotation) => (
                              <span className="fp-marker" key={annotation.id}>{annotation.number}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      <p className="fp-slide-text">{slide.body || "본문이 없습니다."}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="fp-aside">
          <section className="fp-panel fp-comment-panel">
            <h2>수정의견 추가</h2>
            <div className="fp-comment-guide">
              <MessageSquare size={14} />
              <span>{commentGuide}</span>
            </div>
            <form className="fp-comment-form" onSubmit={handleSubmit}>
              <div className="fp-selected">선택된 영역: {selectedLabel}</div>
              {selectedTextForComment && (
                <div className="fp-selected-quote">
                  “{selectedTextForComment}”
                </div>
              )}
              <div className="fp-field">
                <label htmlFor="authorName">이름 <span style={{ color: "#9CA3AF", fontWeight: 650 }}>(선택)</span></label>
                <input
                  className="fp-input"
                  id="authorName"
                  style={{ backgroundColor: "#fff", color: "#111827" }}
                  value={authorName}
                  onChange={(event) => setAuthorName(event.target.value)}
                  placeholder="비워두면 익명으로 표시됩니다"
                  maxLength={40}
                />
              </div>
              <div className="fp-field">
                <label htmlFor="commentBody">수정의견</label>
                <textarea
                  className="fp-textarea"
                  id="commentBody"
                  style={{ backgroundColor: "#fff", color: "#111827" }}
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  placeholder="수정이 필요한 내용을 입력하세요"
                  maxLength={1000}
                />
              </div>
              {error && <p className="fp-error">{error}</p>}
              <button className="fp-submit" type="submit" disabled={isSubmitting || !commentBody.trim()}>
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {isSubmitting ? "저장 중..." : "의견 저장"}
              </button>
            </form>
          </section>

          <section className="fp-panel">
            <h2>수정의견 목록</h2>
            <div className="fp-comment-list">
              {content.annotations.length === 0 ? (
                <p className="fp-comment-empty">아직 등록된 수정의견이 없습니다.</p>
              ) : (
                content.annotations.map((annotation) => (
                  <button
                    className="fp-comment"
                    key={annotation.id}
                    type="button"
                    onClick={() => setSelectedSlideIndex(annotation.slideIndex)}
                  >
                    <div className="fp-comment-top">
                      <span className="fp-marker">{annotation.number}</span>
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                        {isBlog ? "문서 전체" : `${annotation.slideIndex + 1}번 영역`}
                      </span>
                    </div>
                    {annotation.selectedText && (
                      <p style={{ fontSize: 12, lineHeight: 1.55, color: "#6B7280", background: "#F9FAFB", borderLeft: "3px solid #C7D2FE", padding: "8px 10px", borderRadius: 6, marginBottom: 8 }}>
                        “{annotation.selectedText}”
                      </p>
                    )}
                    <p className="fp-comment-body">{annotation.body}</p>
                    <p className="fp-comment-meta">
                      {annotation.authorName || "익명"} · {formatRelativeTime(annotation.createdAt)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
