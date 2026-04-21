/**
 * 작성 지침 관리 페이지 — /instructions
 * 탭 1: 시스템 지침 (관리자 설정, 읽기 전용)
 * 탭 2: 내 지침 (사용자 CRUD)
 */
"use client";

import { useState, useEffect } from "react";
import {
  BookOpen, Plus, Trash2, Edit3, Check, Star, StarOff,
  Loader2, AlertCircle, X, Save, Sparkles, ChevronRight,
  Shield, Globe, Layers, FileText, Link as LinkIcon, List,
} from "lucide-react";

/* ── 인터페이스 ── */
interface Instruction {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SystemInstruction {
  id: string | null;
  contentType: string;
  title: string;
  content: string;
  isActive: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

/* ── 시스템 지침 타입 메타 ── */
const SYS_TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  ALL:           { label: "공통",        icon: Globe,    color: "#3B82F6", bg: "#EFF6FF" },
  CAROUSEL:      { label: "카드뉴스",    icon: Layers,   color: "#8B5CF6", bg: "#F5F3FF" },
  BLOG:          { label: "블로그 글",   icon: FileText, color: "#10B981", bg: "#ECFDF5" },
  URL_TO_POST:   { label: "URL→콘텐츠", icon: LinkIcon, color: "#F59E0B", bg: "#FFFBEB" },
  BULK_GENERATE: { label: "대량 기획",  icon: List,     color: "#EF4444", bg: "#FEF2F2" },
};

/* ── 예시 지침 템플릿 ── */
const TEMPLATES = [
  {
    name: "SEO 최적화 블로그",
    content: "• 제목에 타겟 키워드를 반드시 포함하세요\n• 소제목(H2, H3)을 5개 이상 사용하세요\n• 각 단락은 3~5문장으로 간결하게 작성하세요\n• 통계나 수치를 포함하여 신뢰성을 높이세요\n• 마지막 단락에 CTA(행동 유도 문구)를 포함하세요",
  },
  {
    name: "친근한 일상 글투",
    content: "• 독자와 대화하듯 친근한 말투(~해요, ~이에요)를 사용하세요\n• 전문 용어는 쉬운 말로 풀어서 설명하세요\n• 개인적인 경험이나 사례를 자연스럽게 섞어주세요\n• 이모지를 적절히 활용해 가독성을 높이세요\n• 짧은 문장 위주로 읽기 편하게 작성하세요",
  },
  {
    name: "전문가 칼럼 스타일",
    content: "• 격식체(~합니다, ~입니다)를 일관되게 사용하세요\n• 주장에는 반드시 근거(데이터, 연구)를 함께 제시하세요\n• 업계 전문 용어를 정확하게 사용하고 필요시 설명을 추가하세요\n• 결론에서 핵심 인사이트를 명확히 요약하세요\n• 타 전문가나 브랜드 언급 시 출처를 명시하세요",
  },
  {
    name: "짧고 임팩트 있게",
    content: "• 전체 분량을 500단어 이내로 유지하세요\n• 핵심 메시지 1가지만 집중해서 전달하세요\n• 소제목 없이 흐름을 유지하세요\n• 불필요한 수식어와 미사여구를 최대한 제거하세요\n• 첫 문장에서 바로 핵심을 언급하세요",
  },
];

/* ══════════════════════════════════════════════════════ */

export default function InstructionsPage() {
  /* ── 탭 ── */
  const [activeTab, setActiveTab] = useState<"system" | "user">("system");

  /* ── 시스템 지침 상태 ── */
  const [sysInstructions, setSysInstructions] = useState<SystemInstruction[]>([]);
  const [sysLoading, setSysLoading] = useState(true);
  const [activeSysKey, setActiveSysKey] = useState("ALL");

  /* ── 내 지침 상태 ── */
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  /* 편집/생성 폼 */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  /* 삭제 */
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  /* ── 데이터 로드 ── */
  useEffect(() => {
    loadInstructions();
    loadSysInstructions();
  }, []);

  const loadInstructions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/user/instructions");
      if (res.ok) {
        const data = await res.json();
        setInstructions(data.instructions);
      }
    } catch { setError("지침을 불러올 수 없습니다"); }
    finally { setIsLoading(false); }
  };

  const loadSysInstructions = async () => {
    setSysLoading(true);
    try {
      const res = await fetch("/api/admin/instructions");
      if (res.ok) {
        const data: SystemInstruction[] = await res.json();
        /* 전체 목록(isActive 무관)을 보여주되, 내용이 있는 것만 "적용 중" 표시 */
        setSysInstructions(data);
      }
    } catch { /* 권한 없어도 무시 */ }
    finally { setSysLoading(false); }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 2500);
  };

  /* ── 폼 제어 ── */
  const openNew = () => {
    setEditingId(null); setFormName(""); setFormContent(""); setFormIsDefault(false);
    setShowForm(true); setShowTemplates(false);
  };
  const openEdit = (inst: Instruction) => {
    setEditingId(inst.id); setFormName(inst.name); setFormContent(inst.content);
    setFormIsDefault(inst.isDefault); setShowForm(true); setShowTemplates(false);
  };
  const closeForm = () => {
    setShowForm(false); setEditingId(null); setFormName(""); setFormContent("");
  };
  const applyTemplate = (t: typeof TEMPLATES[0]) => {
    setFormName(t.name); setFormContent(t.content); setShowTemplates(false);
  };

  /* ── 저장 ── */
  const handleSave = async () => {
    if (!formName.trim() || !formContent.trim()) {
      setError("이름과 지침 내용을 모두 입력해주세요"); return;
    }
    setIsSaving(true); setError("");
    try {
      const payload = { name: formName.trim(), content: formContent.trim(), isDefault: formIsDefault };
      let res: Response;
      if (editingId) {
        res = await fetch(`/api/user/instructions/${editingId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/user/instructions", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      }
      if (!res.ok) { const d = await res.json(); setError(d.error || "저장 중 오류"); return; }
      await loadInstructions(); closeForm();
      showSuccess(editingId ? "지침이 수정되었습니다" : "지침이 저장되었습니다");
    } catch { setError("저장 중 오류가 발생했습니다"); }
    finally { setIsSaving(false); }
  };

  /* ── 기본 지침 토글 ── */
  const toggleDefault = async (inst: Instruction) => {
    try {
      await fetch(`/api/user/instructions/${inst.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: !inst.isDefault }),
      });
      await loadInstructions();
      showSuccess(inst.isDefault ? "기본 지침이 해제되었습니다" : `'${inst.name}'이(가) 기본 지침으로 설정되었습니다`);
    } catch { setError("변경 중 오류가 발생했습니다"); }
  };

  /* ── 삭제 ── */
  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/user/instructions/${deleteId}`, { method: "DELETE" });
      setInstructions(prev => prev.filter(i => i.id !== deleteId));
      setDeleteId(null); showSuccess("지침이 삭제되었습니다");
    } catch { setError("삭제 중 오류가 발생했습니다"); }
    finally { setIsDeleting(false); }
  };

  /* ══════════════════════════════════════════════════════
     렌더
  ══════════════════════════════════════════════════════ */
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#F7F8FA" }}>
      <style>{`
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        .inst-input { width:100%; padding:10px 14px; border:1.5px solid #E5E7EB; border-radius:10px;
          font-size:14px; color:#111827; background:#fff; outline:none;
          transition:border-color 0.2s, box-shadow 0.2s;
          box-sizing:border-box; resize:none; line-height:1.7; }
        .inst-input:focus { border-color:#6366F1; box-shadow:0 0 0 3px rgba(99,102,241,0.10); }
        .inst-card { background:#fff; border:1.5px solid #E5E7EB; border-radius:16px; padding:20px 22px;
          transition:all 0.15s; }
        .inst-card:hover { border-color:#C7D2FE; box-shadow:0 4px 16px rgba(99,102,241,0.08); }
        .inst-card.is-default { border-color:#6366F1; background:#FAFBFF; }
        .icon-btn { width:32px; height:32px; border-radius:8px; border:1.5px solid #E5E7EB;
          background:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center;
          color:#9CA3AF; transition:all 0.12s; flex-shrink:0; }
        .icon-btn:hover { border-color:#C7D2FE; color:#6366F1; background:#F8F7FF; }
        .icon-btn.danger:hover { border-color:#FECACA; color:#EF4444; background:#FEF2F2; }
        .icon-btn.star-active { border-color:#F59E0B; color:#F59E0B; background:#FFFBEB; }
        .tpl-card { padding:12px 14px; border-radius:10px; border:1.5px solid #E5E7EB;
          cursor:pointer; background:#fff; transition:all 0.12s; }
        .tpl-card:hover { border-color:#C7D2FE; background:#F8F7FF; }
      `}</style>

      {/* ── 헤더 + 탭 ── */}
      <div style={{ padding: "20px 28px 0", background: "#fff", borderBottom: "1px solid #F3F4F6", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BookOpen size={18} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 800, color: "#111827", margin: 0 }}>작성 지침 관리</h1>
              <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>AI 글쓰기 스타일·규칙을 지침으로 저장하여 재사용</p>
            </div>
          </div>
          {activeTab === "user" && (
            <button
              onClick={openNew}
              style={{ height: 38, padding: "0 16px", borderRadius: 10, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 8px rgba(99,102,241,0.30)" }}
            >
              <Plus size={14} /> 새 지침 만들기
            </button>
          )}
        </div>
        {/* 탭 */}
        <div style={{ display: "flex" }}>
          {(["system", "user"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "10px 20px", border: "none", background: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600,
                color: activeTab === tab ? "#6366F1" : "#9CA3AF",
                borderBottom: activeTab === tab ? "2px solid #6366F1" : "2px solid transparent",
                transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {tab === "system" ? <><Shield size={13} /> 시스템 지침</> : <><BookOpen size={13} /> 내 지침</>}
            </button>
          ))}
        </div>
      </div>

      {/* 알림 */}
      {(error || successMsg) && (
        <div style={{ padding: "0 28px" }}>
          {error && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, display: "flex", alignItems: "center", gap: 8, background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", fontSize: 13, fontWeight: 600 }}>
              <AlertCircle size={14} /> {error}
              <button onClick={() => setError("")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }}><X size={13} /></button>
            </div>
          )}
          {successMsg && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, display: "flex", alignItems: "center", gap: 8, background: "#ECFDF5", border: "1px solid #A7F3D0", color: "#065F46", fontSize: 13, fontWeight: 700 }}>
              <Check size={14} /> {successMsg}
            </div>
          )}
        </div>
      )}

      {/* ═══ 시스템 지침 탭 ═══ */}
      {activeTab === "system" && (
        <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
          {/* 좌측 타입 목록 */}
          <div style={{ width: 220, flexShrink: 0, borderRight: "1px solid #F3F4F6", background: "#F9FAFB", padding: "12px 10px", overflowY: "auto" }}>
            {Object.entries(SYS_TYPE_META).map(([key, meta]) => {
              const Icon = meta.icon;
              const inst = sysInstructions.find((i) => i.contentType === key);
              const hasContent = inst?.content && inst.content.trim().length > 0 && inst.isActive;
              const isSelected = activeSysKey === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveSysKey(key)}
                  style={{
                    width: "100%", border: "none", cursor: "pointer", textAlign: "left",
                    padding: "9px 10px", borderRadius: 9,
                    background: isSelected ? "#fff" : "transparent",
                    boxShadow: isSelected ? "0 1px 4px rgba(0,0,0,0.07)" : "none",
                    display: "flex", alignItems: "center", gap: 8, marginBottom: 2,
                    transition: "all 0.12s",
                  }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: isSelected ? meta.bg : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={13} color={isSelected ? meta.color : "#94A3B8"} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? "#1A2332" : "#5A6A7A" }}>{meta.label}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: hasContent ? "#22C55E" : "#94A3B8" }}>
                      {hasContent ? "적용 중" : "미설정"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 우측 read-only 뷰 */}
          <div style={{ flex: 1, padding: "24px 28px", overflowY: "auto" }}>
            {(() => {
              const meta = SYS_TYPE_META[activeSysKey];
              const Icon = meta.icon;
              const inst = sysInstructions.find((i) => i.contentType === activeSysKey);
              const activeContent = inst?.content && inst.isActive ? inst.content : null;
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon size={16} color={meta.color} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0 }}>{meta.label} 시스템 지침</h2>
                      <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>관리자가 설정한 AI 기본 지침 (읽기 전용, AI 생성 시 자동 적용)</p>
                    </div>
                    <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#DBEAFE", color: "#1D4ED8", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Shield size={10} /> 시스템 지침
                    </span>
                  </div>

                  {sysLoading ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9CA3AF", padding: "40px 0" }}>
                      <Loader2 size={16} className="animate-spin" /> 불러오는 중...
                    </div>
                  ) : activeContent ? (
                    <pre style={{
                      fontSize: 13, color: "#374151", lineHeight: 1.8,
                      whiteSpace: "pre-wrap", wordBreak: "break-word",
                      fontFamily: "inherit",
                      background: "#F8FAFC", border: "1px solid #E2E8F0",
                      borderRadius: 10, padding: "16px 18px", margin: 0,
                    }}>
                      {activeContent}
                    </pre>
                  ) : (
                    <div style={{ textAlign: "center", padding: "60px 0" }}>
                      <div style={{ width: 56, height: 56, borderRadius: 16, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                        <Shield size={24} color="#CBD5E1" />
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "#CBD5E1", margin: 0 }}>설정된 시스템 지침이 없습니다</p>
                      <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>관리자가 지침을 설정하면 AI 생성 시 자동 적용됩니다</p>
                    </div>
                  )}

                  {inst?.updatedBy && (
                    <p style={{ fontSize: 11, color: "#CBD5E1", marginTop: 12, textAlign: "right" }}>
                      마지막 수정: {inst.updatedBy} · {inst.updatedAt ? new Date(inst.updatedAt).toLocaleString("ko-KR") : ""}
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ═══ 내 지침 탭 ═══ */}
      {activeTab === "user" && (
        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: showForm ? "1fr 420px" : "1fr", overflow: "hidden" }}>

          {/* 목록 */}
          <div style={{ overflowY: "auto", padding: "24px 28px" }}>
            {/* 안내 배너 */}
            <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#4F46E5", marginBottom: 4 }}>💡 내 작성 지침이란?</p>
                <p style={{ fontSize: 12, color: "#6366F1", lineHeight: 1.6, margin: 0 }}>
                  AI 콘텐츠 생성 시 시스템 지침에 추가로 적용되는 개인 글쓰기 스타일 가이드입니다.
                  <strong> ★ 기본 지침</strong>으로 설정하면 생성 시 자동 적용됩니다.
                </p>
              </div>
              <ChevronRight size={16} color="#6366F1" />
            </div>

            {isLoading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, gap: 10, color: "#9CA3AF" }}>
                <Loader2 size={20} className="animate-spin" /> 불러오는 중...
              </div>
            ) : instructions.length === 0 ? (
              /* 빈 상태 */
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <BookOpen size={32} color="#6366F1" />
                </div>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 8 }}>저장된 지침이 없습니다</p>
                <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 20, lineHeight: 1.6 }}>
                  새 지침을 만들거나 아래 템플릿 중 하나를 선택해보세요.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, maxWidth: 560, margin: "0 auto", textAlign: "left" }}>
                  {TEMPLATES.map((t, i) => (
                    <button key={i} className="tpl-card" onClick={() => { openNew(); applyTemplate(t); }}
                      style={{ textAlign: "left", border: "none", padding: "14px 16px", borderRadius: 12, background: "#fff", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                        <Sparkles size={12} color="#6366F1" /> {t.name}
                      </div>
                      <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0, lineHeight: 1.6 }}>
                        {t.content.split("\n")[0].slice(2, 40)}...
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {instructions.map(inst => (
                  <div key={inst.id} className={`inst-card${inst.isDefault ? " is-default" : ""}`}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          {inst.isDefault && (
                            <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "#FEF3C7", color: "#D97706", border: "1px solid #FDE68A" }}>
                              ★ 기본 지침
                            </span>
                          )}
                          <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{inst.name}</span>
                        </div>
                        <pre style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", background: "#F9FAFB", padding: "10px 14px", borderRadius: 8, maxHeight: 120, overflow: "hidden" }}>
                          {inst.content.length > 280 ? inst.content.slice(0, 280) + "..." : inst.content}
                        </pre>
                        <p style={{ fontSize: 11, color: "#D1D5DB", margin: "8px 0 0", textAlign: "right" }}>
                          수정: {new Date(inst.updatedAt).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <button
                          className={`icon-btn${inst.isDefault ? " star-active" : ""}`}
                          title={inst.isDefault ? "기본 지침 해제" : "기본 지침으로 설정"}
                          onClick={() => toggleDefault(inst)}
                        >
                          {inst.isDefault ? <Star size={14} fill="currentColor" /> : <StarOff size={14} />}
                        </button>
                        <button className="icon-btn" title="수정" onClick={() => openEdit(inst)}>
                          <Edit3 size={13} />
                        </button>
                        <button className="icon-btn danger" title="삭제" onClick={() => setDeleteId(inst.id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* 하단 템플릿 버튼 */}
                <button
                  onClick={() => setShowTemplates(v => !v)}
                  style={{ padding: "12px 16px", borderRadius: 12, border: "1.5px dashed #C7D2FE", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#6366F1", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#F8F7FF")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <Sparkles size={14} /> 템플릿에서 시작하기
                </button>
                {showTemplates && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                    {TEMPLATES.map((t, i) => (
                      <button key={i} className="tpl-card" onClick={() => { openNew(); applyTemplate(t); }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 4 }}>{t.name}</div>
                        <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0, lineHeight: 1.6 }}>{t.content.split("\n")[0].slice(2, 50)}...</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 편집 패널 (오른쪽) ── */}
          {showForm && (
            <div style={{ borderLeft: "1px solid #F3F4F6", background: "#fff", display: "flex", flexDirection: "column", overflowY: "auto" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                  {editingId ? "지침 수정" : "새 지침 만들기"}
                </span>
                <button onClick={closeForm} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 4 }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
                {/* 이름 */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>지침 이름 *</label>
                  <input
                    className="inst-input" style={{ height: 38 }}
                    placeholder="예: SEO 블로그 기본, 친근한 글투"
                    value={formName} onChange={e => setFormName(e.target.value)}
                  />
                </div>
                {/* 빠른 템플릿 */}
                {!editingId && (
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>빠른 템플릿</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {TEMPLATES.map((t, i) => (
                        <button key={i} onClick={() => applyTemplate(t)}
                          style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", background: "#FAFBFC", cursor: "pointer", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", gap: 6, transition: "all 0.12s" }}
                          onMouseEnter={e => { (e.currentTarget).style.borderColor = "#C7D2FE"; (e.currentTarget).style.background = "#F8F7FF"; }}
                          onMouseLeave={e => { (e.currentTarget).style.borderColor = "#E5E7EB"; (e.currentTarget).style.background = "#FAFBFC"; }}>
                          <Sparkles size={11} color="#6366F1" /> {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* 지침 내용 */}
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>지침 내용 *</label>
                  <textarea
                    className="inst-input" rows={10}
                    placeholder={"AI에게 전달할 글쓰기 규칙을 작성하세요.\n\n예시:\n• 소제목 5개 이상 사용\n• 타겟: 30~40대 직장인\n• 친근한 말투 (~해요체)\n• 이모지 사용 금지"}
                    value={formContent} onChange={e => setFormContent(e.target.value)}
                    style={{ minHeight: 200 }}
                  />
                  <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>
                    {formContent.length} 자 · AI 글쓰기 시 프롬프트에 자동 포함됩니다
                  </p>
                </div>
                {/* 기본 지침 설정 */}
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 12px", borderRadius: 10, background: formIsDefault ? "#FFF7ED" : "#F9FAFB", border: `1.5px solid ${formIsDefault ? "#FDE68A" : "#E5E7EB"}`, transition: "all 0.15s" }}>
                  <input
                    type="checkbox" checked={formIsDefault}
                    onChange={e => setFormIsDefault(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: "#F59E0B", cursor: "pointer" }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: formIsDefault ? "#D97706" : "#374151" }}>★ 기본 지침으로 설정</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>콘텐츠 생성 시 자동으로 적용됩니다</div>
                  </div>
                </label>
                {/* 저장 버튼 */}
                <button
                  onClick={handleSave} disabled={isSaving}
                  style={{ height: 44, borderRadius: 12, border: "none", background: isSaving ? "#C7D2FE" : "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: isSaving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 2px 8px rgba(99,102,241,0.30)" }}
                >
                  {isSaving ? <><Loader2 size={14} className="animate-spin" /> 저장 중...</> : <><Save size={14} /> 저장하기</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 삭제 확인 모달 ── */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 8 }}>지침 삭제</h3>
            <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6, marginBottom: 20 }}>
              이 지침을 삭제하면 복구할 수 없습니다. 계속하시겠습니까?
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteId(null)}
                style={{ flex: 1, height: 40, borderRadius: 10, border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                취소
              </button>
              <button onClick={handleDelete} disabled={isDeleting}
                style={{ flex: 1, height: 40, borderRadius: 10, border: "none", background: "#EF4444", color: "#fff", fontSize: 13, fontWeight: 700, cursor: isDeleting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} 삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
