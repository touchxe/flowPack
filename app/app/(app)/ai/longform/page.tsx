"use client";

import { useState, useRef } from "react";
import {
  FileText, Loader2, AlertCircle, X, Sparkles,
  Send, Edit3, ImagePlus, Link as LinkIcon,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SchedulePicker } from "@/components/features/content/schedule-picker";
import { PublishModal } from "@/components/features/publish/publish-modal";
import { useRouter } from "next/navigation";

const TONES = [
  { value: "formal",   label: "격식체",  desc: "전문적/공식적" },
  { value: "casual",   label: "캐주얼",  desc: "편안하고 자연스러운" },
  { value: "friendly", label: "친근한",  desc: "따뜻하고 대화체" },
];

const LENGTHS = [
  { value: "short",  label: "짧은 글",  desc: "약 500단어" },
  { value: "medium", label: "중간 길이", desc: "약 1000단어" },
  { value: "long",   label: "긴 글",    desc: "약 1500단어" },
];

export default function LongformPage() {
  const router = useRouter();
  const [topic, setTopic]       = useState("");
  const [keywords, setKeywords] = useState("");
  const [length, setLength]     = useState("medium");
  const [tone, setTone]         = useState("friendly");
  const [industry, setIndustry] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [error, setError]       = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [contentId, setContentId] = useState<string | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const [scheduledAt, setScheduledAt] = useState<string | undefined>(undefined);
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  // ── 이미지 ──────────────────────────────────────────────
  const [images, setImages]         = useState<{ url: string; name: string }[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const url = ev.target?.result as string;
        setImages(prev => [...prev, { url, name: file.name }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleAddUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;
    setImages(prev => [...prev, { url: trimmed, name: trimmed.split("/").pop() || "image" }]);
    setImageUrlInput("");
    setShowUrlInput(false);
  };

  const removeImage = (idx: number) =>
    setImages(prev => prev.filter((_, i) => i !== idx));

  // 생성 완료 후 이미지 API 저장
  const saveImages = async (cId: string) => {
    if (!images.length) return;
    try {
      await fetch(`/api/content/${cId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: images.map((img, i) => ({ url: img.url, altText: img.name, order: i })),
        }),
      });
    } catch { /* 이미지 저장 실패는 무시 */ }
  };

  const handleGenerate = async () => {
    if (!topic.trim()) { setError("주제를 입력해주세요"); return; }
    setIsGenerating(true); setError(""); setGeneratedContent(""); setWordCount(0); setContentId(null);
    try {
      const keywordList = keywords.split(",").map(k => k.trim()).filter(Boolean);
      const res = await fetch("/api/generate/longform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, keywords: keywordList.length ? keywordList : undefined, length, tone, industry: industry || undefined }),
      });
      if (res.status === 401) { setError("로그인이 필요합니다"); return; }
      if (res.status === 402) { setError("크레딧이 부족합니다"); return; }
      if (!res.ok) { const d = await res.json(); setError(d.error || "생성 중 오류가 발생했습니다"); return; }

      const reader = res.body!.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let full = ""; let cId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "chunk")     { full += data.content; setGeneratedContent(full); }
            else if (data.type === "done") { cId = data.contentId; setContentId(data.contentId); setWordCount(data.wordCount); }
            else if (data.type === "error") setError(data.message);
          } catch { /* ignore */ }
        }
      }
      if (cId) await saveImages(cId);
    } catch { setError("요청 중 오류가 발생했습니다"); }
    finally { setIsGenerating(false); }
  };

  const handleCancel = () => {
    readerRef.current?.cancel();
    readerRef.current = null;
    setIsGenerating(false);
  };

  // ── 렌더 ────────────────────────────────────────────────
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#F7F8FA" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        .lf-input { width:100%; padding:10px 14px; border:1.5px solid #E5E7EB; border-radius:10px; font-size:14px; color:#111827; background:#fff; outline:none; transition:border-color 0.2s,box-shadow 0.2s; box-sizing:border-box; resize:none; }
        .lf-input:focus { border-color:#6366F1; box-shadow:0 0 0 3px rgba(99,102,241,0.10); }
        .lf-input:disabled { background:#F9FAFB; color:#9CA3AF; }
        .lf-seg-btn { flex:1; padding:10px 8px; border-radius:10px; font-size:12px; font-weight:600; cursor:pointer; border:1.5px solid #E5E7EB; background:#fff; color:#374151; transition:all 0.15s; text-align:center; }
        .lf-seg-btn.active { border-color:#6366F1; background:#EEF2FF; color:#6366F1; }
        .lf-seg-btn:hover:not(.active) { border-color:#C7D2FE; background:#F8F7FF; }
        .gen-btn { width:100%; height:48px; border-radius:12px; font-size:15px; font-weight:700; cursor:pointer; border:none; background:linear-gradient(135deg,#6366F1,#8B5CF6); color:#fff; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.25s; box-shadow:0 4px 14px rgba(99,102,241,0.35); }
        .gen-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 8px 20px rgba(99,102,241,0.4); }
        .gen-btn:disabled { opacity:0.7; cursor:not-allowed; }
        .cancel-btn { flex:1; height:48px; border-radius:12px; font-size:14px; font-weight:600; cursor:pointer; border:1.5px solid #E5E7EB; background:#fff; color:#374151; display:flex; align-items:center; justify-content:center; gap:6px; }
        .cancel-btn:hover { border-color:#EF4444; color:#EF4444; }
        .action-btn { flex:1; height:42px; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; transition:all 0.15s; }
        .img-thumb { position:relative; width:72px; height:72px; border-radius:10px; overflow:hidden; border:1.5px solid #E5E7EB; flex-shrink:0; background:#F3F4F6; }
        .img-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
        .img-del { position:absolute; top:3px; right:3px; width:18px; height:18px; border-radius:50%; background:rgba(0,0,0,0.55); border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; }
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      `}</style>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", flex: 1, minHeight: 0 }}>

        {/* ── 왼쪽 패널 ───────────────────────────────────── */}
        <div style={{ background: "#fff", borderRight: "1px solid #F3F4F6", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {/* 헤더 */}
          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #F3F4F6" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileText size={17} color="#fff" />
              </div>
              <div>
                <h1 style={{ fontSize: 15, fontWeight: 800, color: "#111827", margin: 0 }}>블로그 생성</h1>
                <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>SEO 최적화 장문 포스트</p>
              </div>
            </div>
          </div>

          {/* 폼 */}
          <div style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column", gap: 18, overflowY: "auto" }}>

            {/* 주제 */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>주제 <span style={{ color: "#EF4444" }}>*</span></label>
              <textarea className="lf-input" rows={3} placeholder="예: 스타트업의 효과적인 SNS 마케팅 전략" value={topic} onChange={e => setTopic(e.target.value)} disabled={isGenerating} />
            </div>

            {/* 키워드 */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                키워드 <span style={{ fontSize: 10, fontWeight: 500, color: "#9CA3AF", textTransform: "none" }}>(쉼표로 구분)</span>
              </label>
              <input className="lf-input" style={{ height: 40 }} placeholder="스타트업, 마케팅, SNS" value={keywords} onChange={e => setKeywords(e.target.value)} disabled={isGenerating} />
            </div>

            {/* ── 이미지 섹션 ─────────────────────────────── */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  이미지 {images.length > 0 && <span style={{ fontSize: 10, fontWeight: 500, color: "#9CA3AF", textTransform: "none" }}>({images.length}개)</span>}
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={() => setShowUrlInput(v => !v)}
                    style={{ height: 28, padding: "0 10px", borderRadius: 7, background: showUrlInput ? "#EEF2FF" : "#F9FAFB", border: "1px solid #E5E7EB", color: "#6366F1", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                    <LinkIcon size={11} /> URL
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    style={{ height: 28, padding: "0 10px", borderRadius: 7, background: "#F9FAFB", border: "1px solid #E5E7EB", color: "#374151", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                    <ImagePlus size={11} /> 업로드
                  </button>
                </div>
              </div>

              {/* URL 입력 */}
              {showUrlInput && (
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <input className="lf-input" style={{ height: 36, flex: 1, fontSize: 12 }}
                    placeholder="https://example.com/image.jpg"
                    value={imageUrlInput} onChange={e => setImageUrlInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddUrl()} />
                  <button type="button" onClick={handleAddUrl}
                    style={{ height: 36, padding: "0 12px", borderRadius: 10, background: "#6366F1", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                    추가
                  </button>
                </div>
              )}

              {/* 썸네일 그리드 or 드롭존 */}
              {images.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {images.map((img, idx) => (
                    <div key={idx} className="img-thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={img.name} />
                      <button className="img-del" type="button" onClick={() => removeImage(idx)}>
                        <X size={10} color="#fff" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    style={{ width: 72, height: 72, borderRadius: 10, border: "1.5px dashed #C7D2FE", background: "#F8F7FF", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: "#6366F1" }}>
                    <ImagePlus size={16} /><span style={{ fontSize: 10, fontWeight: 600 }}>추가</span>
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  style={{ width: "100%", padding: "20px 0", borderRadius: 10, border: "1.5px dashed #E5E7EB", background: "#F9FAFB", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "#9CA3AF", transition: "all 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#C7D2FE"; (e.currentTarget as HTMLElement).style.background = "#F8F7FF"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#E5E7EB"; (e.currentTarget as HTMLElement).style.background = "#F9FAFB"; }}>
                  <ImagePlus size={20} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>이미지를 업로드하거나 URL을 입력하세요</span>
                </button>
              )}

              <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFileUpload} />
            </div>

            {/* 길이 */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>글 길이</label>
              <div style={{ display: "flex", gap: 8 }}>
                {LENGTHS.map(l => (
                  <button key={l.value} className={`lf-seg-btn${length === l.value ? " active" : ""}`} onClick={() => setLength(l.value)} disabled={isGenerating}>
                    <div style={{ fontWeight: 700 }}>{l.label}</div>
                    <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.7 }}>{l.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 톤 */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>톤</label>
              <div style={{ display: "flex", gap: 8 }}>
                {TONES.map(t => (
                  <button key={t.value} className={`lf-seg-btn${tone === t.value ? " active" : ""}`} onClick={() => setTone(t.value)} disabled={isGenerating}>
                    <div style={{ fontWeight: 700 }}>{t.label}</div>
                    <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.7 }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 업종 */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>업종</label>
              <Select value={industry} onValueChange={setIndustry} disabled={isGenerating}>
                <SelectTrigger style={{ height: 40, borderRadius: 10, fontSize: 14 }}>
                  <SelectValue placeholder="업종 선택 (선택)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tech">IT/기술</SelectItem>
                  <SelectItem value="finance">금융</SelectItem>
                  <SelectItem value="education">교육</SelectItem>
                  <SelectItem value="healthcare">의료</SelectItem>
                  <SelectItem value="retail">도소매</SelectItem>
                  <SelectItem value="other">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 에러 */}
            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", fontSize: 13, color: "#DC2626" }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
              </div>
            )}

            {/* 예약 발행 */}
            <SchedulePicker value={scheduledAt} onChange={setScheduledAt} disabled={isGenerating} />

            {/* 버튼 */}
            {isGenerating ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="cancel-btn" onClick={handleCancel}><X size={15} /> 취소</button>
                <button className="gen-btn" style={{ flex: 2 }} disabled>
                  <Loader2 size={16} className="animate-spin" /> 생성 중...
                </button>
              </div>
            ) : (
              <button className="gen-btn" onClick={handleGenerate}>
                <Sparkles size={16} /> 블로그 생성하기
              </button>
            )}
          </div>
        </div>

        {/* ── 오른쪽: 미리보기 ─────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", overflowY: "auto" }}>
          {/* 미리보기 헤더 */}
          <div style={{ padding: "16px 24px", background: "#fff", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>미리보기</span>
              {wordCount > 0 && <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 9999, background: "#EEF2FF", color: "#6366F1", fontWeight: 600 }}>약 {wordCount.toLocaleString()} 단어</span>}
              {images.length > 0 && <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 9999, background: "#FDF2FF", color: "#8B5CF6", fontWeight: 600 }}>이미지 {images.length}개 첨부됨</span>}
            </div>
            {contentId && (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="action-btn" onClick={() => router.push(`/content/${contentId}/edit`)}
                  style={{ border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151", padding: "0 16px" }}>
                  <Edit3 size={14} /> 편집
                </button>
                <button className="action-btn" onClick={() => setPublishModalOpen(true)}
                  style={{ border: "none", background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", padding: "0 20px", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}>
                  <Send size={14} /> 배포하기
                </button>
              </div>
            )}
          </div>

          {/* 내용 */}
          <div style={{ flex: 1, padding: "24px", overflowY: "auto" }}>
            {generatedContent ? (
              <div style={{ maxWidth: 720, margin: "0 auto" }}>
                {/* 첨부 이미지 그리드 */}
                {images.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12, marginBottom: 24 }}>
                    {images.map((img, idx) => (
                      <div key={idx} style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={img.name} style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
                      </div>
                    ))}
                  </div>
                )}
                {/* 본문 */}
                <div style={{ background: "#fff", borderRadius: 16, padding: "36px 40px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", border: "1px solid #F3F4F6" }}>
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.8, color: "#374151", fontFamily: "inherit", margin: 0 }}>
                    {generatedContent}
                    {isGenerating && <span style={{ display: "inline-block", width: 2, height: 16, background: "#6366F1", marginLeft: 2, animation: "blink 1s infinite" }}>|</span>}
                  </pre>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center" }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <FileText size={32} color="#6366F1" />
                </div>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
                  {isGenerating ? "AI가 블로그를 작성하고 있어요..." : "블로그 미리보기"}
                </p>
                <p style={{ fontSize: 14, color: "#9CA3AF", lineHeight: 1.6 }}>
                  {isGenerating ? "잠시 기다려주세요. 곧 내용이 나타납니다." : "왼쪽 패널에서 주제를 입력하고\n생성 버튼을 클릭하세요."}
                </p>
                {isGenerating && (
                  <div style={{ marginTop: 20, display: "flex", gap: 6 }}>
                    {[0, 1, 2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366F1", animation: `bounce 0.8s ${i * 0.15}s infinite` }} />)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <PublishModal open={publishModalOpen} onOpenChange={setPublishModalOpen} contentId={contentId || ""} contentTitle={topic || "블로그"} defaultScheduledAt={scheduledAt} />
    </div>
  );
}
