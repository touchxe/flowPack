"use client";

import { useState, useRef, useEffect } from "react";
import {
  FileText, Loader2, AlertCircle, X, Sparkles,
  Edit3, BookOpen, Save, ChevronDown, Star, Trash2, ArrowRight,
} from "lucide-react";
import { MarkdownPreview } from "@/components/features/content/markdown-preview";
import { useRouter } from "next/navigation";
import Link from "next/link";


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
  const [topic, setTopic]         = useState("");
  const [length, setLength]       = useState("medium");
  const [instructions, setInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [error, setError]         = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [contentId, setContentId] = useState<string | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);

  // ── 지침 프리셋 ─────────────────────────
  const [savedInstructions, setSavedInstructions] = useState<SavedInstruction[]>([]);
  const [showInstructionSave, setShowInstructionSave] = useState(false);
  const [instructionName, setInstructionName] = useState("");
  const [showSavedList, setShowSavedList] = useState(false);

  // 저장된 지침 불러오기
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user/instructions");
        if (res.ok) {
          const data = await res.json();
          setSavedInstructions(data.instructions);
          const def = data.instructions.find((i: SavedInstruction) => i.isDefault);
          if (def && !instructions) setInstructions(def.content);
        }
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 지침 저장 ──────────────────────────
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

  // ── 초안 생성 ──────────────────────────
  const handleGenerate = async () => {
    if (!topic.trim()) { setError("주제를 입력해주세요"); return; }
    setIsGenerating(true); setError(""); setGeneratedContent(""); setWordCount(0); setContentId(null);
    try {
      const res = await fetch("/api/generate/longform", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic, length,
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
            else if (data.type === "title") { setGeneratedTitle(data.title); }
            else if (data.type === "done") { cId = data.contentId; setContentId(data.contentId); setWordCount(data.wordCount); }
            else if (data.type === "error") setError(data.message);
          } catch { /* ignore */ }
        }
      }
    } catch { setError("요청 중 오류가 발생했습니다"); }
    finally { setIsGenerating(false); }
  };

  const handleCancel = () => {
    readerRef.current?.cancel(); readerRef.current = null; setIsGenerating(false);
  };

  // ── 스타일 ─────────────────────────────
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#F7F8FA" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        .lf-input { width:100%; padding:10px 14px; border:1.5px solid #E5E7EB; border-radius:10px; font-size:14px; color:#111827; background:#fff; outline:none; transition:border-color 0.2s,box-shadow 0.2s; box-sizing:border-box; resize:none; }
        .lf-input:focus { border-color:var(--brand-500); box-shadow:0 0 0 3px rgba(99,102,241,0.10); }
        .lf-input:disabled { background:#F9FAFB; color:#9CA3AF; }
        .lf-seg { flex:1; padding:10px 8px; border-radius:10px; font-size:12px; font-weight:600; cursor:pointer; border:1.5px solid #E5E7EB; background:#fff; color:#374151; transition:all 0.15s; text-align:center; }
        .lf-seg.active { border-color:var(--brand-500); background:#EEF2FF; color:var(--brand-500); }
        .lf-seg:hover:not(.active) { border-color:#C7D2FE; background:#F8F7FF; }
        .gen-btn { width:100%; height:48px; border-radius:12px; font-size:15px; font-weight:700; cursor:pointer; border:none; background:linear-gradient(135deg,var(--brand-500),var(--fp-cyan)); color:#fff; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.25s; box-shadow:0 4px 14px rgba(99,102,241,0.35); }
        .gen-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 8px 20px rgba(99,102,241,0.4); }
        .gen-btn:disabled { opacity:0.7; cursor:not-allowed; }
        .cancel-btn { flex:1; height:48px; border-radius:12px; font-size:14px; font-weight:600; cursor:pointer; border:1.5px solid #E5E7EB; background:#fff; color:#374151; display:flex; align-items:center; justify-content:center; gap:6px; }
        .cancel-btn:hover { border-color:#EF4444; color:#EF4444; }
        .action-btn { flex:1; height:42px; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; transition:all 0.15s; }
        .regen-btn { flex:1; height:48px; border-radius:12px; font-size:14px; font-weight:700; cursor:pointer; border:1.5px solid #E5E7EB; background:#fff; color:#374151; display:flex; align-items:center; justify-content:center; gap:7px; transition:all 0.2s; }
        .regen-btn:hover { border-color:#F97316; color:#F97316; background:#FFF7ED; }
        .edit-goto-btn { flex:1; height:48px; border-radius:12px; font-size:14px; font-weight:700; cursor:pointer; border:none; background:linear-gradient(135deg,var(--brand-500),var(--fp-cyan)); color:#fff; display:flex; align-items:center; justify-content:center; gap:7px; transition:all 0.25s; box-shadow:0 4px 14px rgba(99,102,241,0.30); }
        .edit-goto-btn:hover { transform:translateY(-1px); box-shadow:0 8px 20px rgba(99,102,241,0.4); }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      `}</style>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", flex: 1, minHeight: 0 }}>

        {/* ── 왼쪽 패널 ─────────────────────────── */}
        <div style={{ background: "#fff", borderRight: "1px solid #F3F4F6", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {/* 헤더 */}
          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #F3F4F6" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileText size={17} color="#fff" />
              </div>
              <div>
                <h1 style={{ fontSize: 15, fontWeight: 800, color: "#111827", margin: 0 }}>초안 작성</h1>
                <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>AI 블로그 초안 작성</p>
              </div>
            </div>
          </div>

          {/* 폼 */}
          <div style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column", gap: 18, overflowY: "auto" }}>

            {/* 주제 */}
            <div>
              <label style={labelStyle}>주제 또는 내용 <span style={{ color: "#EF4444" }}>*</span></label>
              <textarea className="lf-input" rows={4} placeholder="예: 스타트업의 효과적인 SNS 마케팅 전략&#10;&#10;또는 블로그에 담고 싶은 내용을 자유롭게 작성하세요." value={topic} onChange={e => setTopic(e.target.value)} disabled={isGenerating} />
            </div>

            {/* ── 작성 지침 ──────────────────────── */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>
                  <BookOpen size={12} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />
                  작성 지침
                </label>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {/* 지침 관리 바로가기 */}
                  <Link href="/instructions"
                    style={{ height: 26, padding: "0 8px", borderRadius: 6, background: "#F9FAFB", border: "1px solid #E5E7EB", color: "#374151", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 3, textDecoration: "none" }}
                    title="지침 관리 페이지로 이동">
                    ⚙
                  </Link>
                  {savedInstructions.length > 0 && (
                    <div style={{ position: "relative" }}>
                      <button type="button" onClick={() => setShowSavedList(v => !v)}
                        style={{ height: 26, padding: "0 8px", borderRadius: 6, background: showSavedList ? "#EEF2FF" : "#F9FAFB", border: "1px solid #E5E7EB", color: "var(--brand-500)", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                        <ChevronDown size={10} /> 불러오기 ({savedInstructions.length})
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
                  <button type="button" onClick={() => setShowInstructionSave(v => !v)}
                    style={{ height: 26, padding: "0 8px", borderRadius: 6, background: "#F9FAFB", border: "1px solid #E5E7EB", color: "#374151", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                    <Save size={10} /> 저장
                  </button>
                </div>
              </div>
              <textarea className="lf-input" rows={3}
                placeholder="예: 소제목 5개로 나눠줘, 타겟은 30대 직장인, 사례 중심으로 작성"
                value={instructions} onChange={e => setInstructions(e.target.value)} disabled={isGenerating} />
              {showInstructionSave && (
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <input className="lf-input" style={{ height: 34, flex: 1, fontSize: 12 }}
                    placeholder="지침 이름 (예: 블로그 기본)"
                    value={instructionName} onChange={e => setInstructionName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && saveInstruction()} />
                  <button type="button" onClick={saveInstruction}
                    style={{ height: 34, padding: "0 12px", borderRadius: 10, background: "var(--brand-500)", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                    저장
                  </button>
                </div>
              )}
            </div>

            {/* 글 길이 */}
            <div>
              <label style={labelStyle}>글 길이</label>
              <div style={{ display: "flex", gap: 8 }}>
                {LENGTHS.map(l => (
                  <button key={l.value} className={`lf-seg${length === l.value ? " active" : ""}`} onClick={() => setLength(l.value)} disabled={isGenerating}>
                    <div style={{ fontWeight: 700 }}>{l.label}</div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{l.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 에러 */}
            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", fontSize: 13, color: "#DC2626" }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
              </div>
            )}

            {/* 안내 메시지 */}
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "#F0F9FF", border: "1px solid #BAE6FD", fontSize: 12, color: "#0369A1", lineHeight: 1.6 }}>
              💡 초안 작성 후 <strong>편집 화면</strong>에서 이미지 삽입, 키워드, 업종, 발행 일정을 설정할 수 있습니다.
            </div>

            {/* 버튼 영역 — 3상태 */}
            {isGenerating ? (
              /* 생성 중 */
              <div style={{ display: "flex", gap: 8 }}>
                <button className="cancel-btn" onClick={handleCancel}><X size={15} /> 취소</button>
                <button className="gen-btn" style={{ flex: 2 }} disabled><Loader2 size={16} className="animate-spin" /> 작성 중...</button>
              </div>
            ) : contentId ? (
              /* 초안 완료 후 */
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* 크레딧 소모 경고 */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, background: "#FFF7ED", border: "1px solid #FED7AA", fontSize: 12, color: "#C2410C" }}>
                  <AlertCircle size={13} style={{ flexShrink: 0 }} />
                  <span>초안을 다시 작성하면 <strong>크레딧 1개</strong>가 추가로 소모됩니다.</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="regen-btn" onClick={handleGenerate}>
                    <Sparkles size={15} /> 초안 다시 작성
                  </button>
                  <button className="edit-goto-btn" onClick={() => router.push(`/content/${contentId}/edit`)}>
                    편집 진행 <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ) : (
              /* 초기 상태 */
              <button className="gen-btn" onClick={handleGenerate}><Sparkles size={16} /> 초안 작성하기</button>
            )}
          </div>
        </div>

        {/* ── 오른쪽: 미리보기 ────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <div style={{ padding: "16px 24px", background: "#fff", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>미리보기</span>
              {wordCount > 0 && <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 9999, background: "#EEF2FF", color: "var(--brand-500)", fontWeight: 600 }}>약 {wordCount.toLocaleString()} 단어</span>}
            </div>
            {contentId && (
              <button className="action-btn" onClick={() => router.push(`/content/${contentId}/edit`)}
                style={{ border: "none", background: "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))", color: "#fff", padding: "0 24px", boxShadow: "0 2px 8px rgba(99,102,241,0.3)", maxWidth: 200 }}>
                <Edit3 size={14} /> 편집하러 가기
              </button>
            )}
          </div>

          <div style={{ flex: 1, padding: "24px", overflowY: "auto" }}>
            {generatedContent ? (
              <div style={{ maxWidth: 720, margin: "0 auto", background: "#fff", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", border: "1px solid #F3F4F6", overflow: "hidden" }}>
                {/* AI 생성 제목 표시 */}
                <div style={{ padding: "24px 28px 0" }}>
                  {generatedTitle ? (
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", lineHeight: 1.4, marginBottom: 0 }}>{generatedTitle}</h1>
                  ) : isGenerating ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <Sparkles size={14} color="var(--brand-500)" />
                      <span style={{ fontSize: 13, color: "#9CA3AF" }}>제목 생성 중...</span>
                    </div>
                  ) : null}
                </div>
                <MarkdownPreview content={generatedContent} />
                {isGenerating && (
                  <div style={{ padding: "0 28px 20px", display: "flex", gap: 4 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand-500)", animation: `bounce 0.8s ${i*0.15}s infinite` }} />)}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center" }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <FileText size={32} color="var(--brand-500)" />
                </div>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
                  {isGenerating ? "AI가 초안을 작성하고 있어요..." : "블로그 초안 미리보기"}
                </p>
                <p style={{ fontSize: 14, color: "#9CA3AF", lineHeight: 1.6 }}>
                  {isGenerating ? "잠시 기다려주세요." : "왼쪽에서 주제를 입력하고\n초안 작성 버튼을 클릭하세요."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
