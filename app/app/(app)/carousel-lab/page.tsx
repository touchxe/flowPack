"use client";

import { useState, useEffect } from "react";
import {
  Zap, Loader2, Image as ImageIcon, RotateCw, Save,
  AlertCircle, Download, Check, Sparkles, Send, Layers, X
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "next-auth/react";
import { ImageGenerationModal } from "@/components/features/content/image-generation-modal";
import { PublishModal } from "@/components/features/publish/publish-modal";
import { SchedulePicker } from "@/components/features/content/schedule-picker";

interface Slide { index: number; title: string; body: string; imagePrompt?: string; imageUrl?: string; }
interface UserCredits { creditsTotal: number; creditsUsed: number; availableCredits: number; }

const TONES = [
  { value: "formal",   label: "격식체" },
  { value: "casual",   label: "캐주얼" },
  { value: "friendly", label: "친근한" },
];
const STYLES = [
  { value: "informative",  label: "정보전달" },
  { value: "promotional",  label: "홍보성" },
  { value: "educational",  label: "교육적" },
  { value: "entertaining", label: "재미있는" },
];

export default function CarouselLabPage() {
  const { data: session } = useSession();
  const [topic, setTopic] = useState("");
  const [industry, setIndustry] = useState("");
  const [tone, setTone] = useState("friendly");
  const [style, setStyle] = useState("promotional");
  const [slideCount, setSlideCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [generatedSlides, setGeneratedSlides] = useState<Slide[]>([]);
  const [contentId, setContentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [userCredits, setUserCredits] = useState<UserCredits>({ creditsTotal: 10, creditsUsed: 0, availableCredits: 10 });
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState<number | null>(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string | undefined>(undefined);

  useEffect(() => { fetchUserCredits(); }, []);

  const fetchUserCredits = async () => {
    try {
      const res = await fetch("/api/user/me");
      if (res.ok) { const d = await res.json(); setUserCredits({ creditsTotal: d.user.creditsTotal, creditsUsed: d.user.creditsUsed, availableCredits: d.user.availableCredits }); }
    } catch {}
  };

  const handleGenerate = async () => {
    if (!topic.trim()) { setError("주제를 입력해주세요."); return; }
    setIsGenerating(true); setError(""); setGeneratedSlides([]); setContentId(null); setStatusMessage("AI가 콘텐츠를 생성 중입니다...");
    try {
      const response = await fetch("/api/generate/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, industry: industry || undefined, tone, style, slideCount }),
      });
      if (response.status === 401) { setError("로그인이 필요합니다."); setIsGenerating(false); return; }
      if (response.status === 402) { setShowCreditModal(true); setIsGenerating(false); return; }
      if (!response.ok) { const d = await response.json(); setError(d.error || "생성 중 오류가 발생했습니다."); setIsGenerating(false); return; }
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      if (!reader) throw new Error("Response body is null");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value, { stream: true }).split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "status") setStatusMessage(data.message);
              else if (data.type === "chunk") { fullContent += data.content; setStatusMessage(`생성 중...`); }
              else if (data.type === "done") {
                if (data.slides && Array.isArray(data.slides)) setGeneratedSlides(data.slides);
                else { const m = fullContent.match(/\{[\s\S]*\}/); if (m) { try { const p = JSON.parse(m[0]); setGeneratedSlides(p.slides || []); } catch { setError("슬라이드 파싱에 실패했습니다."); } } }
                setContentId(data.contentId); setStatusMessage("생성이 완료되었습니다!");
              } else if (data.type === "error") setError(data.message);
            } catch {}
          }
        }
      }
    } catch { setError("요청 중 오류가 발생했습니다."); }
    finally { setIsGenerating(false); }
  };

  const handleRegenerate = () => { setGeneratedSlides([]); setContentId(null); handleGenerate(); };

  const handleExportPdf = async () => {
    if (!generatedSlides.length) return;
    try { const { exportCarouselAsPdf, downloadBlob } = await import("@/lib/carousel-export"); const blob = await exportCarouselAsPdf(generatedSlides); downloadBlob(blob, `carousel-${Date.now()}.pdf`); }
    catch { setError("PDF 내보내기에 실패했습니다"); }
  };

  const handleSave = () => { if (contentId) { setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000); } };
  const openImageModal = (i: number) => { setSelectedSlideIndex(i); setImageModalOpen(true); };
  const handleImageGenerated = (imageUrl: string, revisedPrompt?: string) => {
    if (selectedSlideIndex !== null) {
      setGeneratedSlides(prev => prev.map((s, i) => i === selectedSlideIndex ? { ...s, imageUrl, imagePrompt: revisedPrompt || s.imagePrompt } : s));
      setSelectedSlideIndex(null);
    }
  };

  const pc = Math.round((userCredits.availableCredits / userCredits.creditsTotal) * 100);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#F7F8FA" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        .cl-input { width:100%; padding:10px 14px; border:1.5px solid #E5E7EB; border-radius:10px; font-size:14px; color:#111827; background:#fff; outline:none; transition:all 0.2s; box-sizing:border-box; resize:none; }
        .cl-input:focus { border-color:var(--brand-500); box-shadow:0 0 0 3px var(--fp-primary-subtle); }
        .cl-input:disabled { background:#F9FAFB; color:#9CA3AF; }
        .seg-btn { flex:1; padding:9px 4px; border-radius:9px; font-size:12px; font-weight:600; cursor:pointer; border:1.5px solid #E5E7EB; background:#fff; color:#374151; transition:all 0.15s; text-align:center; }
        .seg-btn.active { border-color:var(--brand-500); background:#EEF2FF; color:var(--brand-500); }
        .seg-btn:hover:not(.active) { border-color:#C7D2FE; }
        .gen-btn { width:100%; height:48px; border-radius:12px; font-size:15px; font-weight:700; cursor:pointer; border:none; background:linear-gradient(135deg,var(--brand-500),var(--brand-500)); color:#fff; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.25s; box-shadow:0 4px 14px var(--fp-primary-subtle); }
        .gen-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 8px 20px var(--fp-primary-subtle); }
        .gen-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .slide-card { background:#fff; border:1.5px solid #E5E7EB; border-radius:14px; padding:16px; margin-bottom:12px; transition:all 0.15s; }
        .slide-card:hover { border-color:#C7D2FE; box-shadow:0 4px 12px var(--fp-primary-subtle); }
        .action-btn { height:38px; border-radius:9px; font-size:13px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:6px; transition:all 0.15s; padding:0 14px; }
      `}</style>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", flex: 1, minHeight: 0 }}>
        {/* ── 왼쪽: 파라미터 패널 ─── */}
        <div style={{ background: "#fff", borderRight: "1px solid #F3F4F6", display: "flex", flexDirection: "column", overflowY: "auto" }}>
          {/* 헤더 */}
          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,var(--brand-500),var(--brand-500))", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Layers size={17} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 15, fontWeight: 800, color: "#111827", margin: 0 }}>카드뉴스 생성</h1>
              <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>AI 슬라이드 자동 제작</p>
            </div>
          </div>

          {/* 크레딧 */}
          <div style={{ margin: "14px 16px 0", padding: "12px 14px", borderRadius: 12, background: pc < 30 ? "#FFF7ED" : "#EEF2FF", border: `1px solid ${pc < 30 ? "#FED7AA" : "#C7D2FE"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: pc < 30 ? "#D97706" : "var(--brand-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>크레딧</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: pc < 30 ? "#D97706" : "var(--brand-500)" }}>{userCredits.availableCredits} / {userCredits.creditsTotal}</span>
            </div>
            <div style={{ height: 5, background: "#E5E7EB", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pc}%`, background: pc < 30 ? "linear-gradient(90deg,#F59E0B,#D97706)" : "linear-gradient(90deg,var(--brand-500),var(--brand-500))", transition: "width 0.4s", borderRadius: 3 }} />
            </div>
          </div>

          {/* 폼 */}
          <div style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
            {/* 주제 */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>주제 <span style={{ color: "#EF4444" }}>*</span></label>
              <textarea className="cl-input" rows={3} placeholder="예: 당사 신상품을 소개합니다" value={topic} onChange={e => setTopic(e.target.value)} disabled={isGenerating} />
            </div>

            {/* 업종 */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>업종</label>
              <Select value={industry} onValueChange={setIndustry} disabled={isGenerating}>
                <SelectTrigger style={{ height: 40, borderRadius: 10, fontSize: 14 }}><SelectValue placeholder="업종 선택 (선택)" /></SelectTrigger>
                <SelectContent>
                  {[["food","음식점"],["fashion","패션/의류"],["beauty","뷰티/미용"],["tech","IT/기술"],["education","교육"],["healthcare","의료/건강"],["finance","금융/보험"],["realestate","부동산"],["travel","여행/호텔"],["entertainment","엔터테인먼트"],["other","기타"]].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* 톤 */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>톤</label>
              <div style={{ display: "flex", gap: 6 }}>
                {TONES.map(t => <button key={t.value} className={`seg-btn${tone === t.value ? " active" : ""}`} onClick={() => setTone(t.value)} disabled={isGenerating}>{t.label}</button>)}
              </div>
            </div>

            {/* 스타일 */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>스타일</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {STYLES.map(s => <button key={s.value} className={`seg-btn${style === s.value ? " active" : ""}`} onClick={() => setStyle(s.value)} disabled={isGenerating}>{s.label}</button>)}
              </div>
            </div>

            {/* 슬라이드 수 */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>슬라이드 수: <span style={{ color: "var(--brand-500)" }}>{slideCount}장</span></label>
              <div style={{ position: "relative" }}>
                <input type="range" min={3} max={10} value={slideCount} onChange={e => setSlideCount(parseInt(e.target.value))} disabled={isGenerating} style={{ width: "100%", accentColor: "var(--brand-500)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                  <span>3장</span><span>10장</span>
                </div>
              </div>
            </div>

            {/* 에러 */}
            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", fontSize: 13, color: "#DC2626" }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
              </div>
            )}

            {/* 예약 */}
            <SchedulePicker value={scheduledAt} onChange={setScheduledAt} disabled={isGenerating} />

            {/* 생성 버튼 */}
            <button className="gen-btn" onClick={handleGenerate} disabled={isGenerating || userCredits.availableCredits < 1}>
              {isGenerating ? <><Loader2 size={16} className="animate-spin" /> {statusMessage || "생성 중..."}</> : <><Sparkles size={16} /> 카드뉴스 생성하기</>}
            </button>
          </div>
        </div>

        {/* ── 오른쪽: 미리보기 ────────── */}
        <div style={{ display: "flex", flexDirection: "column", overflowY: "auto" }}>
          {/* 미리보기 헤더 */}
          <div style={{ padding: "16px 24px", background: "#fff", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>슬라이드 미리보기</span>
              {generatedSlides.length > 0 && (
                <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 9999, background: "#EEF2FF", color: "var(--brand-500)", fontWeight: 600 }}>
                  {generatedSlides.length}장
                </span>
              )}
            </div>
            {generatedSlides.length > 0 && (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="action-btn" onClick={handleRegenerate} style={{ border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151" }}>
                  <RotateCw size={13} /> 재생성
                </button>
                <button className="action-btn" onClick={handleExportPdf} style={{ border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151" }}>
                  <Download size={13} /> PDF
                </button>
                <button className="action-btn" onClick={handleSave} disabled={!contentId} style={{ border: "1.5px solid #E5E7EB", background: saveSuccess ? "#ECFDF5" : "#fff", color: saveSuccess ? "#059669" : "#374151" }}>
                  {saveSuccess ? <><Check size={13} /> 저장됨</> : <><Save size={13} /> 저장</>}
                </button>
                <button className="action-btn" onClick={() => setPublishModalOpen(true)} disabled={!contentId}
                  style={{ border: "none", background: "linear-gradient(135deg,var(--brand-500),var(--brand-500))", color: "#fff", boxShadow: "0 2px 8px var(--fp-primary-subtle)" }}>
                  <Send size={13} /> 배포
                </button>
              </div>
            )}
          </div>

          {/* 슬라이드 목록 */}
          <div style={{ flex: 1, padding: "20px 24px", overflowY: "auto" }}>
            {generatedSlides.length > 0 ? (
              <div style={{ maxWidth: 680, margin: "0 auto" }}>
                {generatedSlides.map((slide, i) => (
                  <div key={i} className="slide-card">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>SLIDE {i + 1}</span>
                      {slide.imageUrl ? (
                        <img src={slide.imageUrl} alt={`Slide ${i+1}`} style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }} />
                      ) : slide.imagePrompt ? (
                        <button onClick={() => openImageModal(i)}
                          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, background: "#EEF2FF", border: "1px solid #C7D2FE", color: "var(--brand-500)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          <Sparkles size={12} /> 이미지 생성
                        </button>
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <ImageIcon size={18} color="#D1D5DB" />
                        </div>
                      )}
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 8 }}>{slide.title}</h3>
                    <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>{slide.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center" }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, boxShadow: "0 4px 12px var(--fp-primary-subtle)" }}>
                  <Layers size={32} color="var(--brand-500)" />
                </div>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
                  {isGenerating ? "AI가 슬라이드를 생성하고 있어요..." : "카드뉴스 미리보기"}
                </p>
                <p style={{ fontSize: 14, color: "#9CA3AF" }}>
                  {isGenerating ? "잠시만 기다려주세요." : "왼쪽 패널에서 주제를 입력하고\n생성 버튼을 클릭하세요."}
                </p>
                {isGenerating && (
                  <div style={{ marginTop: 20, display: "flex", gap: 6 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--brand-500)", animation: `bounce 0.8s ${i*0.15}s infinite ease-in-out` }} />)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 크레딧 부족 모달 */}
      {showCreditModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "32px", maxWidth: 400, width: "90%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <AlertCircle size={28} color="#EF4444" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 8 }}>크레딧 부족</h3>
            <p style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 24 }}>생성에 필요한 크레딧이 부족합니다. 크레딧을 충전해주세요.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button style={{ height: 46, borderRadius: 10, fontWeight: 700, fontSize: 14, border: "none", background: "linear-gradient(135deg,var(--brand-500),var(--brand-500))", color: "#fff", cursor: "pointer" }}>크레딧 구매</button>
              <button onClick={() => setShowCreditModal(false)} style={{ height: 46, borderRadius: 10, fontWeight: 600, fontSize: 14, border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151", cursor: "pointer" }}>닫기</button>
            </div>
          </div>
        </div>
      )}

      <ImageGenerationModal isOpen={imageModalOpen} onClose={() => { setImageModalOpen(false); setSelectedSlideIndex(null); }} onImageGenerated={handleImageGenerated} contentId={contentId || undefined} />
      <PublishModal open={publishModalOpen} onOpenChange={setPublishModalOpen} contentId={contentId || ""} contentTitle={topic || "카드뉴스"} defaultScheduledAt={scheduledAt} />

      <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }`}</style>
    </div>
  );
}
