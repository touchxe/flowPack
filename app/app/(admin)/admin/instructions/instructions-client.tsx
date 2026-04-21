"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileText, Layers, Link as LinkIcon, List, Globe,
  Save, CheckCircle, AlertCircle, ToggleLeft, ToggleRight,
  ChevronDown, Info,
} from "lucide-react";

/* ── 타입 정의 ── */
interface SystemInstruction {
  id: string | null;
  contentType: string;
  title: string;
  content: string;
  isActive: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

const CONTENT_TYPES = [
  {
    key: "ALL",
    label: "공통 지침",
    sublabel: "모든 콘텐츠 생성 시 공통 적용",
    icon: Globe,
    color: "#3B82F6",
    bg: "#EFF6FF",
  },
  {
    key: "CAROUSEL",
    label: "카드뉴스",
    sublabel: "카드뉴스 슬라이드 생성 지침",
    icon: Layers,
    color: "#8B5CF6",
    bg: "#F5F3FF",
  },
  {
    key: "BLOG",
    label: "블로그 글",
    sublabel: "블로그 장문 콘텐츠 생성 지침",
    icon: FileText,
    color: "#10B981",
    bg: "#ECFDF5",
  },
  {
    key: "URL_TO_POST",
    label: "URL → 콘텐츠",
    sublabel: "URL 분석 후 콘텐츠 변환 지침",
    icon: LinkIcon,
    color: "#F59E0B",
    bg: "#FFFBEB",
  },
  {
    key: "BULK_GENERATE",
    label: "대량 기획",
    sublabel: "다수 콘텐츠 기획 생성 지침",
    icon: List,
    color: "#EF4444",
    bg: "#FEF2F2",
  },
];

export function AdminInstructionsClient() {
  const [instructions, setInstructions] = useState<Record<string, SystemInstruction>>({});
  const [activeKey, setActiveKey] = useState("ALL");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /* 데이터 로드 */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/instructions");
      const data: SystemInstruction[] = await res.json();
      const map: Record<string, SystemInstruction> = {};
      const draftMap: Record<string, string> = {};
      data.forEach((item) => {
        map[item.contentType] = item;
        draftMap[item.contentType] = item.content;
      });
      setInstructions(map);
      setDrafts(draftMap);
    } catch {
      setError("데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* 저장 */
  const save = async (key: string) => {
    setSaving(key);
    setError(null);
    try {
      const current = instructions[key];
      const res = await fetch("/api/admin/instructions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: key,
          title: current?.title,
          content: drafts[key] ?? "",
          isActive: current?.isActive ?? true,
        }),
      });
      if (!res.ok) throw new Error("저장 실패");
      const updated: SystemInstruction = await res.json();
      setInstructions((prev) => ({ ...prev, [key]: updated }));
      setSaved(key);
      setTimeout(() => setSaved(null), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(null);
    }
  };

  /* 활성화 토글 */
  const toggleActive = async (key: string) => {
    const current = instructions[key];
    if (!current) return;
    const newActive = !current.isActive;
    setInstructions((prev) => ({ ...prev, [key]: { ...current, isActive: newActive } }));
    await fetch("/api/admin/instructions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentType: key,
        title: current.title,
        content: current.content,
        isActive: newActive,
      }),
    });
  };

  const activeMeta = CONTENT_TYPES.find((t) => t.key === activeKey)!;
  const activeInstruction = instructions[activeKey];
  const isDirty = (drafts[activeKey] ?? "") !== (activeInstruction?.content ?? "");

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      {/* ── 좌측 타입 목록 ── */}
      <div style={{
        width: 260, flexShrink: 0,
        borderRight: "1px solid #E2E8F0",
        display: "flex", flexDirection: "column",
        background: "#F8FAFC", padding: "16px 12px",
        gap: 4,
      }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, paddingLeft: 8 }}>
          콘텐츠 유형별 지침
        </p>
        {CONTENT_TYPES.map((type) => {
          const inst = instructions[type.key];
          const isActive = activeKey === type.key;
          const Icon = type.icon;
          const hasContent = inst?.content && inst.content.trim().length > 0;
          const enabled = inst?.isActive !== false;

          return (
            <button
              key={type.key}
              onClick={() => setActiveKey(type.key)}
              style={{
                width: "100%", border: "none", cursor: "pointer", textAlign: "left",
                padding: "10px 12px", borderRadius: 10,
                background: isActive ? "#fff" : "transparent",
                boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.12s",
                display: "flex", alignItems: "center", gap: 10,
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: isActive ? type.bg : "#F1F5F9",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={15} color={isActive ? type.color : "#94A3B8"} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: isActive ? "#1A2332" : "#5A6A7A" }}>
                    {type.label}
                  </span>
                  {!enabled && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "#FEF2F2", color: "#B91C1C" }}>
                      OFF
                    </span>
                  )}
                  {hasContent && enabled && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "#F0FDF4", color: "#15803D" }}>
                      ON
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: "#94A3B8" }}>{type.sublabel}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── 우측 편집 영역 ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* 헤더 */}
        <div style={{
          borderBottom: "1px solid #E2E8F0",
          padding: "16px 24px",
          background: "#fff",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: activeMeta.bg, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <activeMeta.icon size={16} color={activeMeta.color} />
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1A2332", margin: 0 }}>
                {activeMeta.label} 시스템 지침
              </h2>
              <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>{activeMeta.sublabel}</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* 활성화 토글 */}
            <button
              onClick={() => toggleActive(activeKey)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "6px 12px", borderRadius: 8, border: "1px solid #E2E8F0",
                background: activeInstruction?.isActive !== false ? "#F0FDF4" : "#FEF2F2",
                cursor: "pointer", fontSize: 12, fontWeight: 600,
                color: activeInstruction?.isActive !== false ? "#15803D" : "#B91C1C",
                transition: "all 0.15s",
              }}
            >
              {activeInstruction?.isActive !== false
                ? <><ToggleRight size={14} /> 활성화됨</>
                : <><ToggleLeft size={14} /> 비활성</>}
            </button>
            {/* 저장 버튼 */}
            <button
              onClick={() => save(activeKey)}
              disabled={saving === activeKey || !isDirty}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "7px 16px", borderRadius: 8, border: "none",
                background: isDirty ? "#3B82F6" : "#E2E8F0",
                color: isDirty ? "#fff" : "#94A3B8",
                cursor: isDirty ? "pointer" : "not-allowed",
                fontSize: 13, fontWeight: 600,
                transition: "all 0.15s",
              }}
            >
              {saved === activeKey
                ? <><CheckCircle size={13} /> 저장됨</>
                : saving === activeKey
                  ? "저장 중..."
                  : <><Save size={13} /> 저장</>}
            </button>
          </div>
        </div>

        {/* 안내 배너 */}
        <div style={{
          margin: "12px 24px 0",
          padding: "10px 14px",
          background: "#EFF6FF", borderRadius: 8,
          border: "1px solid #BFDBFE",
          display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <Info size={14} color="#3B82F6" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "#1D4ED8", margin: 0, lineHeight: 1.6 }}>
            <strong>시스템 지침</strong>은 AI가 콘텐츠를 생성할 때 항상 자동으로 적용됩니다.
            {activeKey === "ALL"
              ? " 공통 지침은 모든 콘텐츠 타입에 우선 적용됩니다."
              : " 공통 지침과 함께 적용되며, 이 타입 전용 규칙을 입력하세요."}
          </p>
        </div>

        {/* 에러 */}
        {error && (
          <div style={{ margin: "8px 24px 0", padding: "8px 12px", background: "#FEF2F2", borderRadius: 8, display: "flex", gap: 6, alignItems: "center" }}>
            <AlertCircle size={13} color="#EF4444" />
            <span style={{ fontSize: 12, color: "#B91C1C" }}>{error}</span>
          </div>
        )}

        {/* 편집기 */}
        <div style={{ flex: 1, padding: "16px 24px", display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
              지침 내용
            </label>
            {activeInstruction?.updatedBy && (
              <span style={{ fontSize: 11, color: "#94A3B8" }}>
                마지막 수정: {activeInstruction.updatedBy} ·{" "}
                {activeInstruction.updatedAt
                  ? new Date(activeInstruction.updatedAt).toLocaleString("ko-KR")
                  : ""}
              </span>
            )}
          </div>
          <textarea
            value={drafts[activeKey] ?? ""}
            onChange={(e) =>
              setDrafts((prev) => ({ ...prev, [activeKey]: e.target.value }))
            }
            placeholder={`[${activeMeta.label}] 지침을 입력하세요.\n\n예시:\n- 항상 한국어로 작성하세요.\n- 전문적이고 신뢰감 있는 톤을 유지하세요.\n- 독자가 실질적인 가치를 얻을 수 있도록 구체적인 정보를 포함하세요.`}
            style={{
              flex: 1,
              border: "1px solid #E2E8F0",
              borderRadius: 10,
              padding: "14px 16px",
              fontSize: 13,
              lineHeight: 1.7,
              color: "#1A2332",
              background: "#fff",
              resize: "none",
              outline: "none",
              fontFamily: "'Pretendard Variable', sans-serif",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#3B82F6")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#E2E8F0")}
          />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <span style={{ fontSize: 11, color: "#94A3B8" }}>
              {(drafts[activeKey] ?? "").length}자
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
