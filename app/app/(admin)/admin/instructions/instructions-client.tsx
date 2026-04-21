"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileText, Layers, Link as LinkIcon, List, Globe,
  Save, CheckCircle, AlertCircle, ToggleLeft, ToggleRight,
  Info,
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
    color: "text-blue-400",
    bg: "bg-blue-500/15",
    border: "border-blue-500/30",
  },
  {
    key: "CAROUSEL",
    label: "카드뉴스",
    sublabel: "카드뉴스 슬라이드 생성 지침",
    icon: Layers,
    color: "text-purple-400",
    bg: "bg-purple-500/15",
    border: "border-purple-500/30",
  },
  {
    key: "BLOG",
    label: "블로그 글",
    sublabel: "블로그 장문 콘텐츠 생성 지침",
    icon: FileText,
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
  },
  {
    key: "URL_TO_POST",
    label: "URL → 콘텐츠",
    sublabel: "URL 분석 후 콘텐츠 변환 지침",
    icon: LinkIcon,
    color: "text-amber-400",
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
  },
  {
    key: "BULK_GENERATE",
    label: "대량 기획",
    sublabel: "다수 콘텐츠 기획 생성 지침",
    icon: List,
    color: "text-red-400",
    bg: "bg-red-500/15",
    border: "border-red-500/30",
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
  const ActiveIcon = activeMeta.icon;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-indigo-500" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* ── 좌측 타입 목록 ── */}
      <div className="w-[260px] flex-shrink-0 border-r border-slate-800 flex flex-col bg-slate-900/60 p-4 gap-1">
        <p className="text-[10px] font-bold text-slate-600 tracking-widest uppercase mb-2 pl-2">
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
              className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 transition-all ${
                isActive
                  ? "bg-slate-800 ring-1 ring-slate-700"
                  : "hover:bg-slate-800/50"
              }`}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 ${
                isActive ? type.bg : "bg-slate-800"
              }`}>
                <Icon className={`h-4 w-4 ${isActive ? type.color : "text-slate-500"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[13px] font-semibold ${isActive ? "text-slate-200" : "text-slate-400"}`}>
                    {type.label}
                  </span>
                  {!enabled && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
                      OFF
                    </span>
                  )}
                  {hasContent && enabled && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                      ON
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-600">{type.sublabel}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── 우측 편집 영역 ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="border-b border-slate-800 px-6 py-4 bg-slate-900/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${activeMeta.bg}`}>
              <ActiveIcon className={`h-4 w-4 ${activeMeta.color}`} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-slate-200">
                {activeMeta.label} 시스템 지침
              </h2>
              <p className="text-[12px] text-slate-500">{activeMeta.sublabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 활성화 토글 */}
            <button
              onClick={() => toggleActive(activeKey)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-semibold transition-colors ${
                activeInstruction?.isActive !== false
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  : "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
              }`}
            >
              {activeInstruction?.isActive !== false
                ? <><ToggleRight className="h-3.5 w-3.5" /> 활성화됨</>
                : <><ToggleLeft className="h-3.5 w-3.5" /> 비활성</>}
            </button>
            {/* 저장 버튼 */}
            <button
              onClick={() => save(activeKey)}
              disabled={saving === activeKey || !isDirty}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
                isDirty
                  ? "bg-indigo-600 text-white hover:bg-indigo-500"
                  : "bg-slate-800 text-slate-600 cursor-not-allowed"
              }`}
            >
              {saved === activeKey
                ? <><CheckCircle className="h-3.5 w-3.5" /> 저장됨</>
                : saving === activeKey
                  ? "저장 중..."
                  : <><Save className="h-3.5 w-3.5" /> 저장</>}
            </button>
          </div>
        </div>

        {/* 안내 배너 */}
        <div className="mx-6 mt-3 px-3.5 py-2.5 rounded-lg border border-indigo-500/20 bg-indigo-500/5 flex items-start gap-2">
          <Info className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-indigo-300/80 leading-relaxed">
            <strong>시스템 지침</strong>은 AI가 콘텐츠를 생성할 때 항상 자동으로 적용됩니다.
            {activeKey === "ALL"
              ? " 공통 지침은 모든 콘텐츠 타입에 우선 적용됩니다."
              : " 공통 지침과 함께 적용되며, 이 타입 전용 규칙을 입력하세요."}
          </p>
        </div>

        {/* 에러 */}
        {error && (
          <div className="mx-6 mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
            <span className="text-[12px] text-red-400">{error}</span>
          </div>
        )}

        {/* 편집기 */}
        <div className="flex-1 px-6 py-4 flex flex-col gap-2.5 overflow-hidden">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-semibold text-slate-300">
              지침 내용
            </label>
            {activeInstruction?.updatedBy && (
              <span className="text-[11px] text-slate-600">
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
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3 text-[13px] leading-relaxed text-slate-200 placeholder-slate-600 resize-none outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
          />
          <div className="flex justify-end">
            <span className="text-[11px] text-slate-600">
              {(drafts[activeKey] ?? "").length}자
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
