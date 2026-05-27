/**
 * 콘텐츠 뷰어 페이지 — 방문자 관점의 블로그 보기
 * /content/[id]/view
 */
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronDown, ChevronLeft, ChevronRight, Edit3, Loader2, AlertCircle, FileText, Layers, Calendar,
  Share2, CheckCircle2, XCircle, Clock, ExternalLink, Globe,
  Trash2, Copy, Check, Link2, MessageSquare,
} from "lucide-react";
import { PublishModal } from "@/components/features/publish/publish-modal";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface Slide { index: number; title: string; body: string; imagePrompt?: string; }
interface ContentAnnotation {
  id: string;
  slideIndex: number;
  number: number;
  authorName: string | null;
  selectedText: string | null;
  body: string;
  createdAt: string;
}
interface ContentImage {
  id: string;
  url: string;
  altText?: string | null;
}
interface ContentData {
  id: string; title: string; type: string;
  body?: string; slides: Slide[]; status: string;
  createdAt: string; scheduledAt?: string;
  annotations?: ContentAnnotation[];
  images?: ContentImage[];
}

interface PublishRecord {
  id: string;
  platform: string;
  accountName?: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  platformPostUrl?: string;
  errorMessage?: string;
  clickCount?: number;
  trackingUrl?: string;
  publishedAt?: string;
  createdAt: string;
}

interface DebugInfo {
  status?: number;
  contentId?: string;
  userId?: string;
  ownerId?: string;
  reason?: string;
  message?: string;
}

const TYPE_LABEL: Record<string, string> = {
  BLOG: "블로그", CAROUSEL: "카드뉴스", VIDEO: "영상", BULK: "대량", URL_TO_POST: "URL 변환",
};

const PLATFORM_LABEL: Record<string, string> = {
  WORDPRESS: "WordPress", NAVER_BLOG: "네이버 블로그",
  INSTAGRAM: "Instagram", FACEBOOK: "Facebook",
  TWITTER: "Twitter/X", LINKEDIN: "LinkedIn",
};

const PLATFORM_COLOR: Record<string, string> = {
  WORDPRESS: "#21759B", NAVER_BLOG: "#03C75A",
  INSTAGRAM: "#E4405F", FACEBOOK: "#1877F2",
  TWITTER: "#1DA1F2", LINKEDIN: "#0A66C2",
};

const REVIEW_MARK_CLASS = "view-annotation-highlight";
const VIDEO_ALT_PREFIX = "flowpack-video:";

function parseVideoAlt(altText?: string | null): { url: string } | null {
  if (!altText?.startsWith(VIDEO_ALT_PREFIX)) return null;

  try {
    const parsed = JSON.parse(altText.slice(VIDEO_ALT_PREFIX.length)) as { url?: unknown };
    return typeof parsed.url === "string" && parsed.url ? { url: parsed.url } : null;
  } catch {
    return null;
  }
}

function normalizeUrl(value: string): string {
  try {
    return new URL(value, window.location.origin).href;
  } catch {
    return value;
  }
}

function getVideoHrefFromImageElement(image: HTMLImageElement, images: ContentImage[], contentId: string): string | null {
  const imageSrc = normalizeUrl(image.currentSrc || image.src);

  for (const contentImage of images) {
    const videoMeta = parseVideoAlt(contentImage.altText);
    if (!videoMeta) continue;

    const imageUrl = normalizeUrl(contentImage.url);
    const serveUrl = normalizeUrl(`/api/content/${contentId}/images/${contentImage.id}/serve`);

    if (
      imageSrc === imageUrl ||
      imageSrc === serveUrl ||
      imageSrc.includes(`/api/content/${contentId}/images/${contentImage.id}/serve`)
    ) {
      return videoMeta.url;
    }
  }

  return null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clearReviewHighlights(root: HTMLElement) {
  root.querySelectorAll(`.${REVIEW_MARK_CLASS}`).forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;

    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
    parent.normalize();
  });
}

function findTextRange(root: HTMLElement, selectedText: string) {
  const target = selectedText.trim();
  if (!target) return null;

  const parts: { node: Text; start: number; end: number }[] = [];
  const normalizedParts: { node: Text; offset: number }[] = [];
  let fullText = "";
  let normalizedText = "";
  let previousWasSpace = false;
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        return node.textContent?.trim()
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    },
  );

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const text = node.textContent ?? "";
    const start = fullText.length;
    fullText += text;
    parts.push({ node, start, end: fullText.length });

    for (let offset = 0; offset < text.length; offset += 1) {
      const char = text[offset];
      if (/\s/.test(char)) {
        if (previousWasSpace) continue;
        normalizedText += " ";
        normalizedParts.push({ node, offset });
        previousWasSpace = true;
      } else {
        normalizedText += char;
        normalizedParts.push({ node, offset });
        previousWasSpace = false;
      }
    }
  }

  const startIndex = fullText.indexOf(target);
  if (startIndex >= 0) {
    const endIndex = startIndex + target.length;
    const startPart = parts.find((part) => part.start <= startIndex && part.end >= startIndex);
    const endPart = parts.find((part) => part.start < endIndex && part.end >= endIndex);
    if (!startPart || !endPart) return null;

    const range = document.createRange();
    range.setStart(startPart.node, startIndex - startPart.start);
    range.setEnd(endPart.node, endIndex - endPart.start);
    return range;
  }

  const normalizedTarget = target.replace(/\s+/g, " ");
  const normalizedStartIndex = normalizedText.indexOf(normalizedTarget);
  if (normalizedStartIndex < 0) return null;

  const normalizedEndIndex = normalizedStartIndex + normalizedTarget.length - 1;
  const startPart = normalizedParts[normalizedStartIndex];
  const endPart = normalizedParts[normalizedEndIndex];
  if (!startPart || !endPart) return null;

  const range = document.createRange();
  range.setStart(startPart.node, startPart.offset);
  range.setEnd(endPart.node, endPart.offset + 1);
  return range;
}

function highlightReviewText(root: HTMLElement, selectedText: string) {
  clearReviewHighlights(root);

  const range = findTextRange(root, selectedText);
  if (!range) return null;

  const mark = document.createElement("mark");
  mark.className = REVIEW_MARK_CLASS;

  try {
    range.surroundContents(mark);
  } catch {
    const fragment = range.extractContents();
    mark.appendChild(fragment);
    range.insertNode(mark);
  }

  return mark;
}

async function readJsonObject(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};

  try {
    const data = JSON.parse(text);
    return data && typeof data === "object" ? data as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export default function ContentViewPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.id as string;

  const [content, setContent] = useState<ContentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDebug, setIsDebug] = useState(false);
  const [isDebugReady, setIsDebugReady] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  // 배포 모달
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  // 배포 기록
  const [publishes, setPublishes] = useState<PublishRecord[]>([]);
  const [loadingPublishes, setLoadingPublishes] = useState(false);
  const [showPublishes, setShowPublishes] = useState(false);

  // 삭제
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // 클립보드 복사
  const [copied, setCopied] = useState(false);

  // 링크 복사
  const [linkCopied, setLinkCopied] = useState(false);
  const [isCopyingShareLink, setIsCopyingShareLink] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [openAnnotationId, setOpenAnnotationId] = useState<string | null>(null);
  const [isReviewPanelOpen, setIsReviewPanelOpen] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);

  // 이전/다음 글
  const [prevId, setPrevId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);

  useEffect(() => {
    setIsDebug(new URLSearchParams(window.location.search).get("debug") === "1");
    setIsDebugReady(true);
  }, []);

  useEffect(() => {
    if (!isDebugReady) return;

    (async () => {
      try {
        setDebugInfo(null);
        // 현재 콘텐츠 로드
        const res = await fetch(`/api/content/${contentId}${isDebug ? "?debug=1" : ""}`, { credentials: "include" });
        const data = await readJsonObject(res);
        if (data.debug && typeof data.debug === "object") {
          setDebugInfo(data.debug as DebugInfo);
        }
        if (!res.ok) {
          throw new Error(typeof data.error === "string" ? data.error : "콘텐츠를 찾을 수 없습니다");
        }

        if (!data.content) {
          throw new Error("콘텐츠를 찾을 수 없습니다");
        }

        setContent(data.content as ContentData);

        // 이전/다음 글 계산 (목록 전체 로드 — createdAt 내림차순)
        const listRes = await fetch("/api/contents?all=true", { credentials: "include" });
        if (listRes.ok) {
          const listData = await readJsonObject(listRes);
          const contents = Array.isArray(listData.contents) ? listData.contents : [];
          const ids = contents
            .filter((item): item is { id: string } => (
              typeof item === "object" &&
              item !== null &&
              "id" in item &&
              typeof item.id === "string"
            ))
            .map((c) => c.id);
          const idx = ids.indexOf(contentId);
          if (idx !== -1) {
            setPrevId(idx > 0 ? ids[idx - 1] : null);          // 더 최신 글
            setNextId(idx < ids.length - 1 ? ids[idx + 1] : null); // 더 오래된 글
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "오류가 발생했습니다");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [contentId, isDebug, isDebugReady]);

  useEffect(() => {
    setSelectedAnnotationId(null);
    setOpenAnnotationId(null);
    if (bodyRef.current) clearReviewHighlights(bodyRef.current);
  }, [contentId]);

  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;

    root.querySelectorAll<HTMLAnchorElement>(".tiptap-video-link").forEach((anchor) => {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    });

    const handleVideoThumbClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;

      const anchor = event.target.closest<HTMLAnchorElement>(".tiptap-video-link");
      const target = event.target.closest<HTMLElement>("[data-link-href]");
      const image = event.target.closest<HTMLImageElement>("img");
      const href =
        anchor?.href ||
        target?.dataset.linkHref ||
        (image ? getVideoHrefFromImageElement(image, content?.images ?? [], contentId) : null);
      if (!href) return;

      event.preventDefault();
      event.stopPropagation();
      window.open(href, "_blank", "noopener,noreferrer");
    };

    root.addEventListener("click", handleVideoThumbClick, true);
    return () => root.removeEventListener("click", handleVideoThumbClick, true);
  }, [content?.body, content?.images, contentId]);

  useEffect(() => {
    const annotations = content?.annotations ?? [];

    setOpenAnnotationId((currentId) => {
      if (annotations.length === 0) return null;
      if (currentId && annotations.some((annotation) => annotation.id === currentId)) {
        return currentId;
      }

      return annotations[0].id;
    });
  }, [content?.annotations]);

  // 배포 기록 불러오기
  const loadPublishes = async () => {
    if (publishes.length > 0) { setShowPublishes(v => !v); return; }
    setLoadingPublishes(true); setShowPublishes(true);
    try {
      const res = await fetch(`/api/content/${contentId}/publishes`, { credentials: "include" });
      if (res.ok) {
        const data = await readJsonObject(res);
        setPublishes(Array.isArray(data.publishes) ? data.publishes as PublishRecord[] : []);
      }
    } catch { /* ignore */ }
    finally { setLoadingPublishes(false); }
  };

  // 삭제
  const handleDelete = async () => {
    setIsDeleting(true); setDeleteError("");
    try {
      const res = await fetch(`/api/content/${contentId}`, { method: "DELETE" });
      if (res.ok) { router.push("/contents"); return; }
      const d = await res.json();
      setDeleteError(d.error || "삭제에 실패했습니다.");
    } catch { setDeleteError("오류가 발생했습니다."); }
    finally { setIsDeleting(false); }
  };

  // 클립보드 복사
  const handleCopy = async () => {
    if (!content) return;
    const plainBody = content.type === "BLOG"
      ? (document.querySelector(".tiptap-view")?.textContent ?? content.body ?? "")
      : (content.slides ?? []).map((s, i) => `[${i + 1}] ${s.title}\n${s.body}`).join("\n\n");
    const plain = `${content.title}\n\n${plainBody}`;
    const html = content.type === "BLOG"
      ? `<h1>${escapeHtml(content.title)}</h1>\n${content.body ?? ""}`
      : [
          `<h1>${escapeHtml(content.title)}</h1>`,
          ...(content.slides ?? []).map((slide, index) => (
            `<section><h2>${index + 1}. ${escapeHtml(slide.title)}</h2><p>${escapeHtml(slide.body).replace(/\n/g, "<br />")}</p></section>`
          )),
        ].join("\n");

    try {
      if ("ClipboardItem" in window && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plain);
      }
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch {
      await navigator.clipboard.writeText(plain);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyShareLink = async () => {
    setIsCopyingShareLink(true);
    setError("");

    try {
      const res = await fetch(`/api/content/${contentId}/share${isDebug ? "?debug=1" : ""}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await readJsonObject(res);

      if (!res.ok || typeof data.data !== "object" || data.data === null || !("shareUrl" in data.data)) {
        const message = typeof data.error === "string" ? data.error : "공유 링크를 만들지 못했습니다";
        const debug = data.debug && typeof data.debug === "object"
          ? `\n${JSON.stringify(data.debug, null, 2)}`
          : "";
        throw new Error(`${message}${isDebug ? debug : ""}`);
      }

      const shareUrl = (data.data as { shareUrl?: unknown }).shareUrl;
      if (typeof shareUrl !== "string") {
        throw new Error("공유 링크를 만들지 못했습니다");
      }

      await navigator.clipboard.writeText(shareUrl);
      setShareUrl(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "공유 링크 복사 중 오류가 발생했습니다");
    } finally {
      setIsCopyingShareLink(false);
    }
  };

  const handleSelectAnnotation = (annotation: ContentAnnotation) => {
    setSelectedAnnotationId(annotation.id);

    if (!isBlog) {
      setActiveSlide(annotation.slideIndex);
      requestAnimationFrame(() => {
        document.getElementById("content-slide-stage")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }

    if (!bodyRef.current) return;

    if (!annotation.selectedText) {
      clearReviewHighlights(bodyRef.current);
      bodyRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    requestAnimationFrame(() => {
      if (!bodyRef.current || !annotation.selectedText) return;
      const mark = highlightReviewText(bodyRef.current, annotation.selectedText);
      (mark ?? bodyRef.current).scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const handleToggleAnnotation = (annotation: ContentAnnotation) => {
    handleSelectAnnotation(annotation);
    setOpenAnnotationId((currentId) => currentId === annotation.id ? null : annotation.id);
  };

  if (isLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 12 }}>
      <Loader2 size={28} color="var(--brand-500)" className="animate-spin" />
      <p style={{ fontSize: 14, color: "#9CA3AF" }}>불러오는 중...</p>
    </div>
  );

  if (error || !content) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 12 }}>
      <AlertCircle size={28} color="#EF4444" />
      <p style={{ fontSize: 14, color: "#EF4444" }}>{error || "콘텐츠를 찾을 수 없습니다"}</p>
      {isDebug && (
        <pre style={{ maxWidth: 720, width: "90%", whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#111827", color: "#E5E7EB", borderRadius: 10, padding: 16, fontSize: 12, lineHeight: 1.6 }}>
          {JSON.stringify({
            page: "/content/[id]/view",
            api: `/api/content/${contentId}?debug=1`,
            contentId,
            debug: debugInfo,
          }, null, 2)}
        </pre>
      )}
      <Link href="/contents" style={{ fontSize: 13, color: "var(--brand-500)" }}>← 목록으로</Link>
    </div>
  );

  const isBlog = content.type === "BLOG";
  const slides = content.slides || [];
  const annotations = content.annotations ?? [];
  const activeSlideHasSelectedReview = annotations.some(
    (annotation) => annotation.id === selectedAnnotationId && annotation.slideIndex === activeSlide,
  );
  const charCount = content.body ? content.body.replace(/<[^>]+>/g, "").trim().length : 0;

  return (
    <div style={{ minHeight: "100%", background: "#F7F8FA" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        .view-back { display:inline-flex; align-items:center; gap:4px; font-size:13px; color:#9CA3AF; text-decoration:none; transition:color 0.15s; }
        .view-back:hover { color:var(--brand-500); }
        .edit-link { display:inline-flex; align-items:center; gap:6px; height:36px; padding:0 16px; border-radius:9px; font-size:13px; font-weight:700; background:linear-gradient(135deg,var(--brand-500),var(--brand-500)); color:#fff; text-decoration:none; box-shadow:0 2px 8px var(--fp-primary-subtle); transition:all 0.2s; }
        .edit-link:hover { transform:translateY(-1px); box-shadow:0 6px 16px var(--fp-primary-subtle); }
        .deploy-btn { height:36px; padding:0 14px; border-radius:9px; font-size:13px; font-weight:700; cursor:pointer; border:1.5px solid #E5E7EB; background:#fff; color:#374151; display:flex; align-items:center; gap:6px; transition:all 0.15s; font-family:inherit; }
        .deploy-btn:hover { border-color:#C7D2FE; color:var(--brand-500); }
        .slide-dot { width:8px; height:8px; border-radius:50%; cursor:pointer; transition:all 0.15s; border:none; }
        .slide-nav { height:36px; padding:0 16px; border-radius:9px; font-size:13px; font-weight:600; cursor:pointer; border:1.5px solid #E5E7EB; background:#fff; color:#374151; transition:all 0.15s; display:flex; align-items:center; gap:4px; font-family:inherit; }
        .slide-nav:hover:not(:disabled) { border-color:#C7D2FE; color:var(--brand-500); }
        .slide-nav:disabled { opacity:0.35; cursor:not-allowed; }
        .pub-btn { height:34px; padding:0 12px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; border:1.5px solid #E5E7EB; background:#fff; color:#374151; display:flex; align-items:center; gap:6px; transition:all 0.15s; font-family:inherit; }
        .pub-btn:hover { border-color:#C7D2FE; color:var(--brand-500); }
        .share-modal-backdrop { position:fixed; inset:0; background:rgba(17,24,39,0.42); z-index:90; display:flex; align-items:center; justify-content:center; padding:24px; }
        .share-modal { width:100%; max-width:480px; background:#fff; border-radius:14px; box-shadow:0 24px 80px rgba(17,24,39,0.24); border:1px solid #E5E7EB; overflow:hidden; }
        .share-modal-head { padding:20px 22px 16px; border-bottom:1px solid #F3F4F6; display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .share-close { width:32px; height:32px; border-radius:8px; border:1px solid #E5E7EB; background:#fff; cursor:pointer; color:#6B7280; font-size:18px; line-height:1; }
        .share-row { display:flex; align-items:center; gap:12px; padding:16px; border:1.5px solid #E5E7EB; border-radius:10px; background:#F9FAFB; }
        .share-icon { width:38px; height:38px; border-radius:10px; background:#EEF2FF; color:var(--brand-500); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .share-copy-row { display:flex; gap:8px; margin-top:14px; }
        .share-url { flex:1; min-width:0; height:36px; border:1px solid #E5E7EB; border-radius:8px; background:#F9FAFB; padding:0 10px; color:#6B7280; font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:center; }
        .del-btn { height:34px; padding:0 12px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; border:1.5px solid #FECACA; background:#FEF2F2; color:#DC2626; display:flex; align-items:center; gap:6px; transition:all 0.15s; font-family:inherit; }
        .del-btn:hover { background:#FEE2E2; border-color:#FCA5A5; }
        .content-nav-btn { display:inline-flex; align-items:center; gap:6px; height:40px; padding:0 16px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:1.5px solid #E5E7EB; background:#fff; color:#374151; text-decoration:none; transition:all 0.15s; font-family:inherit; }
        .content-nav-btn:hover { border-color:#C7D2FE; color:var(--brand-500); background:#F8F7FF; }
        .content-nav-btn:disabled,.content-nav-btn.disabled { opacity:0.35; pointer-events:none; }
        .view-layout { max-width:1180px; margin:0 auto; padding:40px 24px 80px; display:grid; grid-template-columns:minmax(0,760px) 340px; gap:32px; align-items:start; }
        .view-main { min-width:0; }
        .review-panel { position:sticky; top:76px; background:#fff; border:1px solid #E5E7EB; border-radius:14px; padding:16px; box-shadow:0 12px 34px rgba(17,24,39,0.06); }
        .review-panel-toggle { width:100%; border:0; background:transparent; padding:0; display:flex; align-items:flex-start; justify-content:space-between; gap:10px; text-align:left; cursor:pointer; font-family:inherit; }
        .review-panel-toggle:hover .review-panel-title { color:var(--brand-500); }
        .review-panel-head { min-width:0; display:flex; flex-direction:column; gap:5px; margin-bottom:12px; }
        .review-panel-title { display:flex; align-items:center; gap:7px; color:#111827; font-size:14px; font-weight:850; }
        .review-panel-desc { color:#6B7280; font-size:12px; line-height:1.5; margin:0; }
        .review-panel-actions { display:flex; align-items:center; gap:8px; flex:0 0 auto; }
        .review-count { min-width:24px; height:24px; padding:0 8px; border-radius:999px; background:#EEF2FF; color:var(--brand-500); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:900; }
        .review-panel-chevron { color:#9CA3AF; transition:transform 0.16s ease; margin-top:4px; }
        .review-panel.collapsed .review-panel-chevron { transform:rotate(-90deg); }
        .review-panel.collapsed { padding-bottom:14px; }
        .review-panel.collapsed .review-panel-head { margin-bottom:0; }
        .review-empty { background:#F9FAFB; border:1px dashed #E5E7EB; border-radius:10px; padding:24px 12px; color:#9CA3AF; text-align:center; font-size:13px; line-height:1.55; }
        .review-list { display:flex; flex-direction:column; gap:10px; max-height:calc(100vh - 160px); overflow:auto; padding-right:2px; }
        .review-card { width:100%; border:1px solid #E5E7EB; background:#fff; border-radius:10px; overflow:hidden; transition:all 0.16s ease; }
        .review-card:hover { border-color:#FACC15; }
        .review-card.active { border-color:#F59E0B; box-shadow:0 0 0 3px rgba(250,204,21,0.22); }
        .review-card-top { width:100%; border:0; background:#fff; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:12px; text-align:left; cursor:pointer; font-family:inherit; }
        .review-card-top:hover,.review-card.active .review-card-top { background:#FFFBEB; }
        .review-card-head { display:flex; align-items:center; gap:8px; min-width:0; }
        .review-card-title { min-width:0; display:flex; flex-direction:column; gap:2px; }
        .review-summary { color:#111827; font-size:12px; font-weight:850; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:190px; }
        .review-chevron { color:#9CA3AF; flex:0 0 auto; transition:transform 0.16s ease; }
        .review-card.open .review-chevron { transform:rotate(180deg); color:#4F46E5; }
        .review-content { border-top:1px solid #F3F4F6; padding:12px; background:#fff; }
        .review-number { min-width:28px; height:28px; padding:0 8px; border-radius:999px; background:#4F46E5; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:900; }
        .review-target { font-size:11px; color:#9CA3AF; font-weight:700; }
        .review-quote { border-left:3px solid #FACC15; background:#FFFBEB; border-radius:8px; padding:8px 10px; color:#713F12; font-size:12px; line-height:1.55; margin:0 0 8px; max-height:96px; overflow:auto; }
        .review-body { color:#1F2937; font-size:13px; line-height:1.6; margin:0; white-space:pre-wrap; }
        .review-meta { color:#9CA3AF; font-size:11px; margin-top:8px; }
        .view-annotation-highlight { background:#FACC15; color:#111827; border-radius:4px; padding:1px 3px; box-shadow:0 0 0 3px rgba(250,204,21,0.3); }
        .slide-review-highlight { outline:4px solid #FACC15; box-shadow:0 0 0 7px rgba(250,204,21,0.22), 0 20px 60px var(--fp-primary-subtle) !important; }
        /* tiptap 타이포그래피 */
        .tiptap-view { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; font-size:15px; line-height:1.85; color:#1F2937; }
        .tiptap-view strong { font-weight:700; color:#111827; }
        .tiptap-view em { font-style:italic; }
        .tiptap-view h1 { font-size:28px; font-weight:800; margin:32px 0 16px; color:#111827; border-bottom:2px solid #EEF2FF; padding-bottom:10px; }
        .tiptap-view h2 { font-size:22px; font-weight:700; margin:28px 0 12px; color:#111827; }
        .tiptap-view h3 { font-size:18px; font-weight:700; margin:24px 0 10px; color:#374151; }
        .tiptap-view h4 { font-size:15px; font-weight:700; margin:20px 0 8px; color:#374151; }
        .tiptap-view ul,.tiptap-view ol { margin:0 0 16px; padding-left:24px; }
        .tiptap-view li { margin-bottom:6px; }
        .tiptap-view blockquote { border-left:4px solid var(--brand-500); background:#F8F7FF; padding:14px 18px; margin:16px 0; border-radius:0 8px 8px 0; color:var(--brand-600); font-weight:500; }
        .tiptap-view code { background:#F3F4F6; padding:2px 7px; border-radius:5px; font-size:13px; font-family:'Fira Code','Menlo',monospace; color:var(--brand-500); }
        .tiptap-view pre { background:#1F2937; color:#E5E7EB; padding:16px 20px; border-radius:10px; overflow-x:auto; margin:16px 0; }
        .tiptap-view pre code { background:none; color:inherit; padding:0; font-size:13px; }
        .tiptap-view a { color:var(--brand-500); text-decoration:underline; text-underline-offset:3px; }
        .tiptap-view img { max-width:100%; border-radius:12px; margin:16px 0; box-shadow:0 2px 12px rgba(0,0,0,0.08); }
        .tiptap-view .tiptap-video-link,.tiptap-view .tiptap-video-thumb { position:relative; display:inline-block; max-width:100%; line-height:0; text-decoration:none!important; }
        .tiptap-view .tiptap-video-link { margin:16px 0; }
        .tiptap-view .tiptap-video-link img { margin:0; }
        .tiptap-view .tiptap-video-play { position:absolute; left:50%; top:50%; width:54px; height:54px; border-radius:999px; background:rgba(17,24,39,0.72); transform:translate(-50%,-50%); box-shadow:0 12px 30px rgba(17,24,39,0.26); pointer-events:none; }
        .tiptap-view .tiptap-video-play::before { content:""; position:absolute; left:22px; top:17px; width:0; height:0; border-top:10px solid transparent; border-bottom:10px solid transparent; border-left:16px solid #fff; }
        .tiptap-view hr { border:none; border-top:2px solid #F3F4F6; margin:28px 0; }
        .tiptap-view p { margin:0 0 16px; }
        .tiptap-view table { width:100%; border-collapse:collapse; margin:16px 0; }
        .tiptap-view th,.tiptap-view td { border:1px solid #E5E7EB; padding:10px 14px; font-size:14px; }
        .tiptap-view th { background:#F9FAFB; font-weight:700; }
        @media (max-width: 1080px) {
          .view-layout { grid-template-columns:1fr; max-width:820px; }
          .review-panel { position:static; }
          .review-list { max-height:none; }
        }
      `}</style>

      {/* ── 상단 바 ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #F3F4F6", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/contents" className="view-back"><ChevronLeft size={14} /> 목록</Link>
          <div style={{ width: 1, height: 18, background: "#E5E7EB" }} />
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#EEF2FF", color: "var(--brand-500)" }}>
            {isBlog
              ? <FileText size={11} style={{ display: "inline", verticalAlign: "-2px", marginRight: 3 }} />
              : <Layers size={11} style={{ display: "inline", verticalAlign: "-2px", marginRight: 3 }} />}
            {TYPE_LABEL[content.type] || content.type}
          </span>
          {content.createdAt && (
            <span style={{ fontSize: 12, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar size={11} />
              {format(new Date(content.createdAt), "yyyy. MM. dd", { locale: ko })}
            </span>
          )}
          {/* 글자 수 배지 (블로그) */}
          {isBlog && charCount > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", background: "#F3F4F6", padding: "3px 8px", borderRadius: 6 }}>
              약 {charCount.toLocaleString()}자
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* 공유 */}
          <button className="pub-btn" onClick={() => setIsShareModalOpen(true)} title="공유">
            <Share2 size={13} />
            공유
          </button>

          {/* 본문 복사 */}
          <button className="pub-btn" onClick={handleCopy} title="본문 전체 복사">
            {copied ? <Check size={13} color="#059669" /> : <Copy size={13} />}
            {copied ? "복사됨" : "복사"}
          </button>

          {/* 배포 기록 */}
          <button className="pub-btn" onClick={loadPublishes}>
            <Globe size={13} /> 배포 기록
            {publishes.length > 0 && (
              <span style={{ background: "var(--brand-500)", color: "#fff", fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 9999 }}>
                {publishes.length}
              </span>
            )}
          </button>

          {/* 배포 */}
          <button className="deploy-btn" onClick={() => setIsPublishModalOpen(true)}>
            <Share2 size={13} /> 배포
          </button>

          {/* 편집 */}
          <Link href={`/content/${contentId}/edit`} className="edit-link">
            <Edit3 size={13} /> 편집하기
          </Link>

          {/* 삭제 */}
          <button className="del-btn" onClick={() => { setDeleteError(""); setShowDeleteModal(true); }}>
            <Trash2 size={13} /> 삭제
          </button>
        </div>
      </div>

      {/* 배포 기록 패널 */}
      {showPublishes && (
        <div style={{ background: "#fff", borderBottom: "1px solid #F3F4F6", padding: "16px 24px" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Globe size={13} color="var(--brand-500)" /> SNS 배포 기록
          </h3>
          {loadingPublishes ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9CA3AF", fontSize: 13 }}>
              <Loader2 size={14} className="animate-spin" /> 불러오는 중...
            </div>
          ) : publishes.length === 0 ? (
            <p style={{ fontSize: 13, color: "#9CA3AF" }}>아직 배포 기록이 없습니다.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {publishes.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, border: "1.5px solid #E5E7EB", background: p.status === "SUCCESS" ? "#F0FDF4" : p.status === "FAILED" ? "#FEF2F2" : "#F9FAFB" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: PLATFORM_COLOR[p.platform] || "#9CA3AF", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{PLATFORM_LABEL[p.platform] || p.platform}</span>
                      {p.status === "SUCCESS" && <CheckCircle2 size={12} color="#059669" />}
                      {p.status === "FAILED" && <XCircle size={12} color="#DC2626" />}
                      {p.status === "PENDING" && <Clock size={12} color="#D97706" />}
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                      {p.publishedAt
                        ? format(new Date(p.publishedAt), "yyyy.MM.dd HH:mm", { locale: ko })
                        : format(new Date(p.createdAt), "yyyy.MM.dd HH:mm", { locale: ko })}
                    </div>
                    {p.errorMessage && (
                      <div style={{ fontSize: 11, color: "#DC2626", marginTop: 2 }}>{p.errorMessage.slice(0, 40)}</div>
                    )}
                  </div>

                  {/* 클릭 통계 뱃지 */}
                  {p.status === "SUCCESS" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 8, background: "#EEF2FF", flexShrink: 0 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "var(--brand-500)" }}>{p.clickCount ?? 0}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "var(--brand-500)" }}>클릭</span>
                    </div>
                  )}

                  {/* 추적 URL 복사 */}
                  {p.trackingUrl && p.status === "SUCCESS" && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(p.trackingUrl!);
                        alert(`추적 URL이 복사되었습니다:\n${p.trackingUrl}`);
                      }}
                      title={`추적 URL: ${p.trackingUrl}`}
                      style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #E5E7EB", background: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "var(--brand-500)", display: "flex", alignItems: "center", gap: 4, flexShrink: 0, fontFamily: "inherit" }}>
                      <Link2 size={11} /> 추적 URL
                    </button>
                  )}

                  {p.platformPostUrl && (
                    <a href={p.platformPostUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand-500)", display: "flex", alignItems: "center", flexShrink: 0 }}>
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 본문 ── */}
      <div className="view-layout">
        <main className="view-main">
        {isBlog ? (
          <article>
            <h1 style={{ fontSize: 32, fontWeight: 900, color: "#111827", lineHeight: 1.3, marginBottom: 32, letterSpacing: "-0.02em" }}>
              {content.title}
            </h1>
            <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 32 }}>
              <div ref={bodyRef} className="tiptap-view" dangerouslySetInnerHTML={{ __html: content.body ?? "" }} />
            </div>
          </article>
        ) : (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#111827", marginBottom: 24, textAlign: "center" }}>
              {content.title}
            </h1>

            {slides.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#9CA3AF" }}>
                <Layers size={32} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
                <p>슬라이드가 없습니다.</p>
              </div>
            ) : (
              <>
                <div id="content-slide-stage" className={activeSlideHasSelectedReview ? "slide-review-highlight" : ""} style={{ background: "linear-gradient(135deg,var(--brand-500),var(--brand-500))", borderRadius: 20, padding: "48px 40px", color: "#fff", minHeight: 320, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center", boxShadow: "0 20px 60px var(--fp-primary-subtle)", position: "relative" }}>
                  <span style={{ position: "absolute", top: 16, right: 20, fontSize: 11, fontWeight: 700, opacity: 0.6 }}>
                    {activeSlide + 1} / {slides.length}
                  </span>
                  <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 20, lineHeight: 1.3 }}>
                    {slides[activeSlide]?.title || ""}
                  </h2>
                  <p style={{ fontSize: 16, lineHeight: 1.8, opacity: 0.9 }}>
                    {slides[activeSlide]?.body || ""}
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 20 }}>
                  <button className="slide-nav" onClick={() => setActiveSlide(p => p - 1)} disabled={activeSlide === 0}>← 이전</button>
                  <div style={{ display: "flex", gap: 6 }}>
                    {slides.map((_, i) => (
                      <button key={i} className="slide-dot"
                        style={{ background: i === activeSlide ? "var(--brand-500)" : "#E5E7EB", transform: i === activeSlide ? "scale(1.3)" : "scale(1)" }}
                        onClick={() => setActiveSlide(i)} />
                    ))}
                  </div>
                  <button className="slide-nav" onClick={() => setActiveSlide(p => p + 1)} disabled={activeSlide === slides.length - 1}>다음 →</button>
                </div>

                <div style={{ marginTop: 32 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>전체 슬라이드</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {slides.map((slide, i) => (
                      <div key={i} onClick={() => setActiveSlide(i)}
                        style={{ padding: "14px 18px", borderRadius: 12, background: i === activeSlide ? "#EEF2FF" : "#fff", border: `1.5px solid ${i === activeSlide ? "#C7D2FE" : "#E5E7EB"}`, cursor: "pointer", transition: "all 0.15s" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: "var(--brand-500)", background: "#EEF2FF", padding: "2px 8px", borderRadius: 5, flexShrink: 0 }}>{i + 1}</span>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 2 }}>{slide.title}</p>
                            <p style={{ fontSize: 12, color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 500 }}>{slide.body}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── 이전/다음 글 네비게이션 ── */}
        {(prevId || nextId) && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 48, paddingTop: 24, borderTop: "1px solid #F3F4F6", gap: 12 }}>
            {/* 이전 글 (더 최신) */}
            {prevId ? (
              <button className="content-nav-btn" onClick={() => router.push(`/content/${prevId}/view`)} style={{ maxWidth: "45%" }}>
                <ChevronLeft size={15} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>이전 글</span>
              </button>
            ) : <div />}

            <Link href="/contents" style={{ fontSize: 12, color: "#9CA3AF", textDecoration: "none", whiteSpace: "nowrap", padding: "0 8px" }}>목록으로</Link>

            {/* 다음 글 (더 오래된) */}
            {nextId ? (
              <button className="content-nav-btn" onClick={() => router.push(`/content/${nextId}/view`)} style={{ maxWidth: "45%" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>다음 글</span>
                <ChevronRight size={15} />
              </button>
            ) : <div />}
          </div>
        )}
        </main>

        <aside className={`review-panel${isReviewPanelOpen ? "" : " collapsed"}`}>
          <button
            className="review-panel-toggle"
            type="button"
            aria-expanded={isReviewPanelOpen}
            aria-controls="review-request-list"
            onClick={() => setIsReviewPanelOpen((open) => !open)}
          >
            <div className="review-panel-head">
              <h2 className="review-panel-title">
                <MessageSquare size={15} color="var(--brand-500)" />
                수정요청 목록
              </h2>
              <p className="review-panel-desc">
                검토자가 남긴 수정요청을 펼쳐 확인하고, 선택한 요청 위치로 바로 이동할 수 있습니다.
              </p>
            </div>
            <span className="review-panel-actions">
              <span className="review-count">{annotations.length}</span>
              <ChevronDown className="review-panel-chevron" size={17} aria-hidden="true" />
            </span>
          </button>

          {isReviewPanelOpen && annotations.length === 0 ? (
            <p id="review-request-list" className="review-empty">아직 등록된 수정요청이 없습니다.</p>
          ) : isReviewPanelOpen ? (
            <div id="review-request-list" className="review-list">
              {annotations.map((annotation) => {
                const isOpen = openAnnotationId === annotation.id;
                const summary = annotation.body || annotation.selectedText || "수정요청";

                return (
                  <article
                    className={`review-card${selectedAnnotationId === annotation.id ? " active" : ""}${isOpen ? " open" : ""}`}
                    key={annotation.id}
                  >
                    <button
                      className="review-card-top"
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => handleToggleAnnotation(annotation)}
                    >
                      <div className="review-card-head">
                        <span className="review-number">{annotation.number}</span>
                        <div className="review-card-title">
                          <span className="review-target">
                            {isBlog ? "문서 전체" : `${annotation.slideIndex + 1}번 영역`}
                          </span>
                          <span className="review-summary">{summary}</span>
                        </div>
                      </div>
                      <ChevronDown className="review-chevron" size={16} aria-hidden="true" />
                    </button>
                    {isOpen && (
                      <div className="review-content">
                        {annotation.selectedText && (
                          <p className="review-quote">&ldquo;{annotation.selectedText}&rdquo;</p>
                        )}
                        <p className="review-body">{annotation.body}</p>
                        <p className="review-meta">
                          {annotation.authorName || "익명"} · {format(new Date(annotation.createdAt), "yyyy.MM.dd HH:mm", { locale: ko })}
                        </p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : null}
        </aside>
      </div>

      <PublishModal
        open={isPublishModalOpen}
        onOpenChange={setIsPublishModalOpen}
        contentId={contentId}
        contentTitle={content.title}
      />

      {isShareModalOpen && (
        <div className="share-modal-backdrop" onClick={() => setIsShareModalOpen(false)}>
          <div className="share-modal" onClick={(event) => event.stopPropagation()}>
            <div className="share-modal-head">
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: "#111827", marginBottom: 4 }}>전체 공유</h3>
                <p style={{ fontSize: 12, color: "#6B7280" }}>공유 문서 보기 화면을 비회원도 열람할 수 있습니다.</p>
              </div>
              <button className="share-close" type="button" onClick={() => setIsShareModalOpen(false)} aria-label="닫기">×</button>
            </div>
            <div style={{ padding: 22 }}>
              <div className="share-row">
                <div className="share-icon"><Globe size={18} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "#111827", marginBottom: 3 }}>링크가 있는 사람 모두</p>
                  <p style={{ fontSize: 12, color: "#6B7280" }}>공유 링크를 가진 사용자는 로그인 없이 볼 수 있습니다.</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#059669", background: "#ECFDF5", padding: "4px 8px", borderRadius: 999 }}>보기 가능</span>
              </div>
              <div className="share-copy-row">
                <div className="share-url">{shareUrl || "공유 링크를 만들려면 링크 복사를 누르세요"}</div>
                <button className="pub-btn" onClick={handleCopyShareLink} disabled={isCopyingShareLink}>
                  {linkCopied ? <Check size={13} color="#059669" /> : <Link2 size={13} />}
                  {isCopyingShareLink ? "생성 중" : linkCopied ? "복사됨" : "링크 복사"}
                </button>
              </div>
              {error && (
                <p style={{ marginTop: 12, fontSize: 12, color: "#DC2626", whiteSpace: "pre-wrap" }}>{error}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 확인 모달 ── */}
      {showDeleteModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", width: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Trash2 size={22} color="#EF4444" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 8 }}>콘텐츠 삭제</h3>
            <p style={{ fontSize: 14, color: "#374151", fontWeight: 600, marginBottom: 4 }}>
              &ldquo;{content.title.slice(0, 30)}{content.title.length > 30 ? "..." : ""}&rdquo;
            </p>
            <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 20 }}>삭제하면 복구할 수 없습니다. 계속하시겠습니까?</p>
            {deleteError && (
              <div style={{ padding: "10px 12px", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FECACA", fontSize: 13, color: "#DC2626", marginBottom: 16 }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowDeleteModal(false)}
                style={{ flex: 1, height: 42, borderRadius: 10, border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                취소
              </button>
              <button onClick={handleDelete} disabled={isDeleting}
                style={{ flex: 1, height: 42, borderRadius: 10, border: "none", background: "#EF4444", color: "#fff", fontSize: 14, fontWeight: 700, cursor: isDeleting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: isDeleting ? 0.7 : 1, fontFamily: "inherit" }}>
                <Trash2 size={14} /> {isDeleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
