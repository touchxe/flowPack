"use client";

import { useState, useRef, useEffect } from "react";
import {
  FileText, Loader2, AlertCircle, X, Sparkles,
  Send, Edit3, ImagePlus, Link as LinkIcon,
  BookOpen, Save, ChevronDown, Star, Trash2,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SchedulePicker } from "@/components/features/content/schedule-picker";
import { PublishModal } from "@/components/features/publish/publish-modal";
import { MarkdownPreview } from "@/components/features/content/markdown-preview";
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

interface SavedInstruction {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
}

export default function LongformPage() {
  const router = useRouter();
  const [topic, setTopic]       = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput]   = useState("");
  const [length, setLength]     = useState("medium");
  const [tone, setTone]         = useState("friendly");
  const [industry, setIndustry] = useState("");
  const [instructions, setInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [error, setError]       = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [contentId, setContentId] = useState<string | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const [scheduledAt, setScheduledAt] = useState<string | undefined>(undefined);
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  // ── 이미지 ──────────────────────────────────
  const [images, setImages]         = useState<{ url: string; name: string }[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 지침 프리셋 ────────────────────────────
  const [savedInstructions, setSavedInstructions] = useState<SavedInstruction[]>([]);
  const [showInstructionSave, setShowInstructionSave] = useState(false);
  const [instructionName, setInstructionName] = useState("");
  const [showSavedList, setShowSavedList] = useState(false);

  // ── AI 키워드 ──────────────────────────────
  const [isGenKw, setIsGenKw] = useState(false);

  // 저장된 지침 불러오기
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user/instructions");
        if (res.ok) {
          const data = await res.json();
          setSavedInstructions(data.instructions);
          // 기본 지침 자동 적용
          const def = data.instructions.find((i: SavedInstruction) => i.isDefault);
          if (def && !instructions) setInstructions(def.content);
        }
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 이미지
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
    setImageUrlInput(""); setShowUrlInput(false);
  };
  const removeImage = (idx: number) => setImages(prev => prev.filter((_, i) => i !== idx));

  const saveImages = async (cId: string) => {
    if (!images.length) return;
    try {
      await fetch(`/api/content/${cId}/images`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: images.map((img, i) => ({ url: img.url, altText: img.name, order: i })) }),
      });
    } catch { /* ignore */ }
  };

  // ── 키워드 ──────────────────────────────────
  const addKeyword = (kw: string) => {
    const t = kw.trim();
    if (t && !keywords.includes(t)) setKeywords(prev => [...prev, t]);
  };
  const removeKeyword = (idx: number) => setKeywords(prev => prev.filter((_, i) => i !== idx));

  const handleKwInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword(kwInput); setKwInput("");
    }
  };

  const generateKeywords = async () => {
    if (!topic.trim()) { setError("주제를 먼저 입력해주세요"); return; }
    setIsGenKw(true);
    try {
      const res = await fetch("/api/generate/keywords", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, industry: industry || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        const newKws = (data.keywords as string[]).filter(k => !keywords.includes(k));
        setKeywords(prev => [...prev, ...newKws]);
      }
    } catch { setError("키워드 생성에 실패했습니다"); }
    finally { setIsGenKw(false); }
  };

  // ── 지침 저장 ──────────────────────────────
  const saveInstruction = async () => {
    if (!instructionName.trim() || !instructions.trim()) return;
    try {
      const res = await fetch("/api/user/instructions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: instructionName.trim(), content: instructions.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setSavedInstructions(prev => [...prev, data.instruction]);
        setInstructionName(""); setShowInstructionSave(false);
      }
    } catch { /* ignore */ }
  };

  const deleteInstruction = async (id: string) => {
    try {
      await fetch(`/api/user/instructions/${id}`, { method: "DELETE" });
      setSavedInstructions(prev => prev.filter(i => i.id !== id));
    } catch { /* ignore */ }
  };

  const applyInstruction = (inst: SavedInstruction) => {
    setInstructions(inst.content);
    setShowSavedList(false);
  };

  // ── 생성 ───────────────────────────────────
  const handleGenerate = async () => {
    if (!topic.trim()) { setError("주제를 입력해주세요"); return; }
    setIsGenerating(true); setError(""); setGeneratedContent(""); setWordCount(0); setContentId(null);
    try {
      const res = await fetch("/api/generate/longform", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          keywords: keywords.length ? keywords : undefined,
          length, tone,
          industry: industry || undefined,
          instructions: instructions.trim() || undefined,
        }),
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
    readerRef.current?.cancel(); readerRef.current = null; setIsGenerating(false);
  };

  // ── 스타일 ─────────────────────────────────
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#F7F8FA" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        .lf-input { width:100%; padding:10px 14px; border:1.5px solid #E5E7EB; border-radius:10px; font-size:14px; color:#111827; background:#fff; outline:none; transition:border-color 0.2s,box-shadow 0.2s; box-sizing:border-box; resize:none; }
        .lf-input:focus { border-color:#6366F1; box-shadow:0 0 0 3px rgba(99,102,241,0.10); }
        .lf-input:disabled { background:#F9FAFB; color:#9CA3AF; }
        .lf-seg { flex:1; padding:10px 8px; border-radius:10px; font-size:12px; font-weight:600; cursor:pointer; border:1.5px solid #E5E7EB; background:#fff; color:#374151; transition:all 0.15s; text-align:center; }
        .lf-seg.active { border-color:#6366F1; background:#EEF2FF; color:#6366F1; }
        .lf-seg:hover:not(.active) { border-color:#C7D2FE; background:#F8F7FF; }
        .gen-btn { width:100%; height:48px; border-radius:12px; font-size:15px; font-weight:700; cursor:pointer; border:none; background:linear-gradient(135deg,#6366F1,#8B5CF6); color:#fff; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.25s; box-shadow:0 4px 14px rgba(99,102,241,0.35); }
        .gen-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 8px 20px rgba(99,102,241,0.4); }
        .gen-btn:disabled { opacity:0.7; cursor:not-allowed; }
        .cancel-btn { flex:1; height:48px; border-radius:12px; font-size:14px; font-weight:600; cursor:pointer; border:1.5px solid #E5E7EB; background:#fff; color:#374151; display:flex; align-items:center; justify-content:center; gap:6px; }
        .cancel-btn:hover { border-color:#EF4444; color:#EF4444; }
        .action-btn { flex:1; height:42px; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; transition:all 0.15s; }
        .kw-tag { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:7px; background:#EEF2FF; color:#6366F1; font-size:12px; font-weight:600; border:1px solid #C7D2FE; }
        .kw-tag button { background:none; border:none; cursor:pointer; padding:0; color:#6366F1; display:flex; }
        .img-thumb { position:relative; width:72px; height:72px; border-radius:10px; overflow:hidden; border:1.5px solid #E5E7EB; flex-shrink:0; background:#F3F4F6; }
        .img-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
        .img-del { position:absolute; top:3px; right:3px; width:18px; height:18px; border-radius:50%; background:rgba(0,0,0,0.55); border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; }
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      `}</style>

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", flex: 1, minHeight: 0 }}>

        {/* ── 왼쪽 패널 ─────────────────────────────── */}
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
          <div style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>

            {/* 주제 */}
            <div>
              <label style={labelStyle}>주제 <span style={{ color: "#EF4444" }}>*</span></label>
              <textarea className="lf-input" rows={3} placeholder="예: 스타트업의 효과적인 SNS 마케팅 전략" value={topic} onChange={e => setTopic(e.target.value)} disabled={isGenerating} />
            </div>

            {/* ── 작성 지침 ───────────────────────────── */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>
                  <BookOpen size={12} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />
                  작성 지침
                </label>
                <div style={{ display: "flex", gap: 4 }}>
                  {/* 저장된 지침 */}
                  {savedInstructions.length > 0 && (
                    <div style={{ position: "relative" }}>
                      <button type="button" onClick={() => setShowSavedList(v => !v)}
                        style={{ height: 26, padding: "0 8px", borderRadius: 6, background: showSavedList ? "#EEF2FF" : "#F9FAFB", border: "1px solid #E5E7EB", color: "#6366F1", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                        <ChevronDown size={10} /> 저장된 지침 ({savedInstructions.length})
                      </button>
                      {showSavedList && (
                        <div style={{ position: "absolute", top: 30, right: 0, width: 260, background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, padding: 6, maxHeight: 240, overflowY: "auto" }}>
                          {savedInstructions.map(inst => (
                            <div key={inst.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 7, cursor: "pointer", transition: "background 0.1s" }}
                              onClick={() => applyInstruction(inst)}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#F8F7FF"}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                              {inst.isDefault && <Star size={11} color="#F59E0B" fill="#F59E0B" />}
                              <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inst.name}</span>
                              <button type="button" onClick={e => { e.stopPropagation(); deleteInstruction(inst.id); }}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#D1D5DB", display: "flex" }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#EF4444"}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#D1D5DB"}>
                                <Trash2 size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {/* 현재 지침 저장 */}
                  <button type="button" onClick={() => setShowInstructionSave(v => !v)}
                    style={{ height: 26, padding: "0 8px", borderRadius: 6, background: "#F9FAFB", border: "1px solid #E5E7EB", color: "#374151", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                    <Save size={10} /> 저장
                  </button>
                </div>
              </div>
              <textarea className="lf-input" rows={3}
                placeholder="예: 소제목 5개로 나눠줘, 타겟은 30대 직장인, 사례 중심으로 작성해줘"
                value={instructions} onChange={e => setInstructions(e.target.value)} disabled={isGenerating} />
              {/* 지침 저장 폼 */}
              {showInstructionSave && (
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <input className="lf-input" style={{ height: 34, flex: 1, fontSize: 12 }}
                    placeholder="지침 이름 (예: 블로그 기본)"
                    value={instructionName} onChange={e => setInstructionName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && saveInstruction()} />
                  <button type="button" onClick={saveInstruction}
                    style={{ height: 34, padding: "0 12px", borderRadius: 10, background: "#6366F1", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                    저장
                  </button>
                </div>
              )}
            </div>

            {/* ── 키워드 ──────────────────────────────── */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>
                  키워드 <span style={{ fontSize: 10, fontWeight: 500, color: "#9CA3AF", textTransform: "none" }}>(Enter로 추가)</span>
                </label>
                <button type="button" onClick={generateKeywords} disabled={isGenKw || isGenerating}
                  style={{ height: 26, padding: "0 10px", borderRadius: 6, background: isGenKw ? "#EEF2FF" : "linear-gradient(135deg,#6366F1,#8B5CF6)", border: "none", color: "#fff", fontSize: 11, fontWeight: 700, cursor: isGenKw ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4, boxShadow: "0 1px 4px rgba(99,102,241,0.3)" }}>
                  {isGenKw ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} AI 추천
                </button>
              </div>
              {/* 태그 */}
              {keywords.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {keywords.map((kw, idx) => (
                    <span key={idx} className="kw-tag">
                      {kw}
                      <button type="button" onClick={() => removeKeyword(idx)}><X size={10} /></button>
                    </span>
                  ))}
                </div>
              )}
              <input className="lf-input" style={{ height: 38, fontSize: 13 }}
                placeholder="키워드 입력 후 Enter"
                value={kwInput} onChange={e => setKwInput(e.target.value)}
                onKeyDown={handleKwInputKeyDown} disabled={isGenerating} />
            </div>

            {/* ── 이미지 ──────────────────────────────── */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>
                  이미지 {images.length > 0 && <span style={{ fontSize: 10, fontWeight: 500, color: "#9CA3AF", textTransform: "none" }}>({images.length}개)</span>}
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={() => setShowUrlInput(v => !v)}
                    style={{ height: 26, padding: "0 8px", borderRadius: 6, background: showUrlInput ? "#EEF2FF" : "#F9FAFB", border: "1px solid #E5E7EB", color: "#6366F1", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                    <LinkIcon size={10} /> URL
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    style={{ height: 26, padding: "0 8px", borderRadius: 6, background: "#F9FAFB", border: "1px solid #E5E7EB", color: "#374151", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                    <ImagePlus size={10} /> 업로드
                  </button>
                </div>
              </div>
              {showUrlInput && (
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <input className="lf-input" style={{ height: 34, flex: 1, fontSize: 12 }}
                    placeholder="https://example.com/image.jpg"
                    value={imageUrlInput} onChange={e => setImageUrlInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddUrl()} />
                  <button type="button" onClick={handleAddUrl}
                    style={{ height: 34, padding: "0 12px", borderRadius: 10, background: "#6366F1", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>추가</button>
                </div>
              )}
              {images.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {images.map((img, idx) => (
                    <div key={idx} className="img-thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={img.name} />
                      <button className="img-del" type="button" onClick={() => removeImage(idx)}><X size={10} color="#fff" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    style={{ width: 72, height: 72, borderRadius: 10, border: "1.5px dashed #C7D2FE", background: "#F8F7FF", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: "#6366F1" }}>
                    <ImagePlus size={16} /><span style={{ fontSize: 10, fontWeight: 600 }}>추가</span>
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  style={{ width: "100%", padding: "16px 0", borderRadius: 10, border: "1.5px dashed #E5E7EB", background: "#F9FAFB", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, color: "#9CA3AF", transition: "all 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#C7D2FE"; (e.currentTarget as HTMLElement).style.background = "#F8F7FF"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#E5E7EB"; (e.currentTarget as HTMLElement).style.background = "#F9FAFB"; }}>
                  <ImagePlus size={18} />
                  <span style={{ fontSize: 11, fontWeight: 600 }}>이미지 업로드 또는 URL 입력</span>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFileUpload} />
            </div>

            {/* 길이 + 톤 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>글 길이</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {LENGTHS.map(l => (
                    <button key={l.value} className={`lf-seg${length === l.value ? " active" : ""}`} onClick={() => setLength(l.value)} disabled={isGenerating} style={{ textAlign: "left", padding: "8px 12px" }}>
                      <span style={{ fontWeight: 700 }}>{l.label}</span> <span style={{ fontSize: 10, opacity: 0.7 }}>{l.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>톤</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {TONES.map(t => (
                    <button key={t.value} className={`lf-seg${tone === t.value ? " active" : ""}`} onClick={() => setTone(t.value)} disabled={isGenerating} style={{ textAlign: "left", padding: "8px 12px" }}>
                      <span style={{ fontWeight: 700 }}>{t.label}</span> <span style={{ fontSize: 10, opacity: 0.7 }}>{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 업종 */}
            <div>
              <label style={labelStyle}>업종</label>
              <Select value={industry} onValueChange={setIndustry} disabled={isGenerating}>
                <SelectTrigger style={{ height: 40, borderRadius: 10, fontSize: 14 }}><SelectValue placeholder="업종 선택 (선택)" /></SelectTrigger>
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

            <SchedulePicker value={scheduledAt} onChange={setScheduledAt} disabled={isGenerating} />

            {/* 버튼 */}
            {isGenerating ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="cancel-btn" onClick={handleCancel}><X size={15} /> 취소</button>
                <button className="gen-btn" style={{ flex: 2 }} disabled><Loader2 size={16} className="animate-spin" /> 생성 중...</button>
              </div>
            ) : (
              <button className="gen-btn" onClick={handleGenerate}><Sparkles size={16} /> 블로그 생성하기</button>
            )}
          </div>
        </div>

        {/* ── 오른쪽: 미리보기 ─────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <div style={{ padding: "16px 24px", background: "#fff", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>미리보기</span>
              {wordCount > 0 && <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 9999, background: "#EEF2FF", color: "#6366F1", fontWeight: 600 }}>약 {wordCount.toLocaleString()} 단어</span>}
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

          <div style={{ flex: 1, padding: "24px", overflowY: "auto" }}>
            {generatedContent ? (
              <div style={{ maxWidth: 720, margin: "0 auto", background: "#fff", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", border: "1px solid #F3F4F6", overflow: "hidden" }}>
                <MarkdownPreview content={generatedContent} />
                {isGenerating && (
                  <div style={{ padding: "0 28px 20px", display: "flex", gap: 4 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366F1", animation: `bounce 0.8s ${i*0.15}s infinite` }} />)}
                  </div>
                )}
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
                  {isGenerating ? "잠시 기다려주세요." : "왼쪽 패널에서 주제를 입력하고\n생성 버튼을 클릭하세요."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <PublishModal open={publishModalOpen} onOpenChange={setPublishModalOpen} contentId={contentId || ""} contentTitle={topic || "블로그"} defaultScheduledAt={scheduledAt} />
    </div>
  );
}
