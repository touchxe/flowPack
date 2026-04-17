/**
 * 콘텐츠 뷰어 페이지 — 방문자 관점의 블로그 보기
 * /content/[id]/view
 */
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, Edit3, Loader2, AlertCircle, FileText, Layers, Calendar,
  Share2, CheckCircle2, XCircle, Clock, ExternalLink, Globe,
} from "lucide-react";
import { MarkdownPreview } from "@/components/features/content/markdown-preview";
import { PublishModal } from "@/components/features/publish/publish-modal";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface Slide { index: number; title: string; body: string; imagePrompt?: string; }
interface ContentData {
  id: string; title: string; type: string;
  body?: string; slides: Slide[]; status: string;
  createdAt: string; scheduledAt?: string;
}

interface PublishRecord {
  id: string;
  platform: string;
  accountName?: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  platformPostUrl?: string;
  errorMessage?: string;
  publishedAt?: string;
  createdAt: string;
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

export default function ContentViewPage() {
  const params = useParams();
  const contentId = params.id as string;

  const [content, setContent] = useState<ContentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);

  // 배포 모달
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  // 배포 기록
  const [publishes, setPublishes] = useState<PublishRecord[]>([]);
  const [loadingPublishes, setLoadingPublishes] = useState(false);
  const [showPublishes, setShowPublishes] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/content/${contentId}`);
        if (!res.ok) throw new Error("콘텐츠를 찾을 수 없습니다");
        const data = await res.json();
        setContent(data.content);
      } catch (err) {
        setError(err instanceof Error ? err.message : "오류가 발생했습니다");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [contentId]);

  // 배포 기록 불러오기
  const loadPublishes = async () => {
    if (publishes.length > 0) { setShowPublishes(v => !v); return; }
    setLoadingPublishes(true); setShowPublishes(true);
    try {
      const res = await fetch(`/api/content/${contentId}/publishes`);
      if (res.ok) { const data = await res.json(); setPublishes(data.publishes); }
    } catch { /* ignore */ }
    finally { setLoadingPublishes(false); }
  };

  if (isLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 12 }}>
      <Loader2 size={28} color="#6366F1" className="animate-spin" />
      <p style={{ fontSize: 14, color: "#9CA3AF" }}>불러오는 중...</p>
    </div>
  );

  if (error || !content) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 12 }}>
      <AlertCircle size={28} color="#EF4444" />
      <p style={{ fontSize: 14, color: "#EF4444" }}>{error || "콘텐츠를 찾을 수 없습니다"}</p>
      <Link href="/contents" style={{ fontSize: 13, color: "#6366F1" }}>← 목록으로</Link>
    </div>
  );

  const isBlog = content.type === "BLOG";
  const slides = content.slides || [];

  return (
    <div style={{ minHeight: "100%", background: "#F7F8FA" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        .view-back { display:inline-flex; align-items:center; gap:4px; font-size:13px; color:#9CA3AF; text-decoration:none; transition:color 0.15s; }
        .view-back:hover { color:#6366F1; }
        .edit-link { display:inline-flex; align-items:center; gap:6px; height:36px; padding:0 16px; border-radius:9px; font-size:13px; font-weight:700; background:linear-gradient(135deg,#6366F1,#8B5CF6); color:#fff; text-decoration:none; box-shadow:0 2px 8px rgba(99,102,241,0.3); transition:all 0.2s; }
        .edit-link:hover { transform:translateY(-1px); box-shadow:0 6px 16px rgba(99,102,241,0.4); }
        .deploy-btn { height:36px; padding:0 14px; border-radius:9px; font-size:13px; font-weight:700; cursor:pointer; border:1.5px solid #E5E7EB; background:#fff; color:#374151; display:flex; align-items:center; gap:6px; transition:all 0.15s; }
        .deploy-btn:hover { border-color:#C7D2FE; color:#6366F1; }
        .slide-dot { width:8px; height:8px; border-radius:50%; cursor:pointer; transition:all 0.15s; border:none; }
        .slide-nav { height:36px; padding:0 16px; border-radius:9px; font-size:13px; font-weight:600; cursor:pointer; border:1.5px solid #E5E7EB; background:#fff; color:#374151; transition:all 0.15s; display:flex; align-items:center; gap:4px; }
        .slide-nav:hover:not(:disabled) { border-color:#C7D2FE; color:#6366F1; }
        .slide-nav:disabled { opacity:0.35; cursor:not-allowed; }
        .pub-btn { height:34px; padding:0 14px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; border:1.5px solid #E5E7EB; background:#fff; color:#374151; display:flex; align-items:center; gap:6px; transition:all 0.15s; }
        .pub-btn:hover { border-color:#C7D2FE; color:#6366F1; }
      `}</style>


      {/* 상단 바 */}
      <div style={{ background: "#fff", borderBottom: "1px solid #F3F4F6", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/contents" className="view-back"><ChevronLeft size={14} /> 목록</Link>
          <div style={{ width: 1, height: 18, background: "#E5E7EB" }} />
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#EEF2FF", color: "#6366F1" }}>
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
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* 배포 기록 버튼 */}
          <button className="pub-btn" onClick={loadPublishes}>
            <Globe size={13} />
            배포 기록
            {publishes.length > 0 && (
              <span style={{ background: "#6366F1", color: "#fff", fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 9999 }}>
                {publishes.length}
              </span>
            )}
          </button>

          {/* 배포 버튼 — 편집 화면과 동일한 PublishModal */}
          <button className="deploy-btn" onClick={() => setIsPublishModalOpen(true)}>
            <Share2 size={13} /> 배포
          </button>

          <Link href={`/content/${contentId}/edit`} className="edit-link">
            <Edit3 size={13} /> 편집하기
          </Link>
        </div>
      </div>

      {/* 배포 기록 패널 */}
      {showPublishes && (
        <div style={{ background: "#fff", borderBottom: "1px solid #F3F4F6", padding: "16px 24px" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Globe size={13} color="#6366F1" /> SNS 배포 기록
          </h3>
          {loadingPublishes ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9CA3AF", fontSize: 13 }}>
              <Loader2 size={14} className="animate-spin" /> 불러오는 중...
            </div>
          ) : publishes.length === 0 ? (
            <p style={{ fontSize: 13, color: "#9CA3AF" }}>아직 배포 기록이 없습니다.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {publishes.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E5E7EB", background: p.status === "SUCCESS" ? "#F0FDF4" : p.status === "FAILED" ? "#FEF2F2" : "#F9FAFB", minWidth: 200 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: PLATFORM_COLOR[p.platform] || "#9CA3AF", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
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
                  {p.platformPostUrl && (
                    <a href={p.platformPostUrl} target="_blank" rel="noopener noreferrer"
                      style={{ color: "#6366F1", display: "flex", alignItems: "center" }}>
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" }}>
        {isBlog ? (
          /* ─── 블로그 뷰어 ─────────────────────── */
          <article>
            <h1 style={{ fontSize: 32, fontWeight: 900, color: "#111827", lineHeight: 1.3, marginBottom: 32, letterSpacing: "-0.02em" }}>
              {content.title}
            </h1>
            <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 32 }}>
              <MarkdownPreview content={content.body ?? ""} />
            </div>
          </article>
        ) : (
          /* ─── 카드뉴스 뷰어 ───────────────────── */
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
                {/* 슬라이드 카드 */}
                <div style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)", borderRadius: 20, padding: "48px 40px", color: "#fff", minHeight: 320, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center", boxShadow: "0 20px 60px rgba(99,102,241,0.35)", position: "relative" }}>
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

                {/* 네비게이션 */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 20 }}>
                  <button className="slide-nav" onClick={() => setActiveSlide(p => p - 1)} disabled={activeSlide === 0}>← 이전</button>
                  <div style={{ display: "flex", gap: 6 }}>
                    {slides.map((_, i) => (
                      <button key={i} className="slide-dot"
                        style={{ background: i === activeSlide ? "#6366F1" : "#E5E7EB", transform: i === activeSlide ? "scale(1.3)" : "scale(1)" }}
                        onClick={() => setActiveSlide(i)} />
                    ))}
                  </div>
                  <button className="slide-nav" onClick={() => setActiveSlide(p => p + 1)} disabled={activeSlide === slides.length - 1}>다음 →</button>
                </div>

                {/* 전체 슬라이드 목록 */}
                <div style={{ marginTop: 32 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>전체 슬라이드</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {slides.map((slide, i) => (
                      <div key={i} onClick={() => setActiveSlide(i)}
                        style={{ padding: "14px 18px", borderRadius: 12, background: i === activeSlide ? "#EEF2FF" : "#fff", border: `1.5px solid ${i === activeSlide ? "#C7D2FE" : "#E5E7EB"}`, cursor: "pointer", transition: "all 0.15s" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: "#6366F1", background: "#EEF2FF", padding: "2px 8px", borderRadius: 5, flexShrink: 0 }}>{i + 1}</span>
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
      </div>

      <PublishModal
        open={isPublishModalOpen}
        onOpenChange={setIsPublishModalOpen}
        contentId={contentId}
        contentTitle={content.title}
      />
    </div>
  );
}
