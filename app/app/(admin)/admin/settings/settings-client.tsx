"use client";

import { useEffect, useState } from "react";
import {
  Save, CheckCircle, Wifi, WifiOff, AlertTriangle, Shield,
  Eye, EyeOff, RefreshCw, ChevronDown, Sparkles,
  DollarSign, Zap, Crown, Circle,
} from "lucide-react";

// ─── 타입 ────────────────────────────────────────────
interface ModelInfo {
  id: string;
  label: string;
  inputPer1M: number;
  outputPer1M: number;
  tier: string;
}
interface ProviderCatalog {
  name: string;
  models: ModelInfo[];
}
interface SettingsData {
  settings: Record<string, string>;
  catalog: Record<string, ProviderCatalog>;
  apiStatus: {
    activeProvider: string;
    providerStatus: boolean;
    toss: boolean;
  };
}

// ─── 제공사 메타 ─────────────────────────────────────
const PROVIDER_META: Record<string, {
  color: string; bg: string; border: string; logo: string; desc: string;
}> = {
  openai:    { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", logo: "⬡",  desc: "GPT-4o, GPT-4o mini 등 업계 표준" },
  anthropic: { color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30",  logo: "◈",  desc: "Claude 3.5 Sonnet — 코드/분석 최강" },
  google:    { color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30",    logo: "◉",  desc: "Gemini 2.0 Flash — 초저가 고성능" },
  xai:       { color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/30",  logo: "✕",  desc: "Grok-2 — 실시간 웹 검색 가능" },
  minimax:   { color: "text-pink-400",    bg: "bg-pink-500/10",    border: "border-pink-500/30",    logo: "◆",  desc: "MiniMax M2.7 — OpenAI 호환·고성능 추론" },
};

const TIER_LABEL: Record<string, { label: string; color: string }> = {
  premium: { label: "Premium", color: "text-amber-400" },
  economy: { label: "Economy", color: "text-emerald-400" },
};

// ─── 서브 컴포넌트 ──────────────────────────────────

function Toggle({ checked, onChange, label, desc }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm text-slate-200">{label}</p>
        {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-indigo-500" : "bg-slate-700"}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

function ApiKeyInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string;
}) {
  const [visible, setVisible] = useState(false);
  const isMasked = value.includes("•");

  return (
    <div className="relative mt-1">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 pr-10 text-sm text-slate-200 font-mono placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
      />
      <button
        onClick={() => setVisible(v => !v)}
        className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
        title={visible ? "숨기기" : "보기"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      {isMasked && (
        <p className="text-[10px] text-slate-600 mt-1">저장된 키가 있습니다. 변경하려면 새 키를 입력하세요.</p>
      )}
    </div>
  );
}

function CostBadge({ input, output }: { input: number; output: number }) {
  const totalRef = (input + output) / 2; // 평균으로 저렴한지 판단
  const cheap = totalRef < 2;
  return (
    <div className="flex items-center gap-2 text-[10px] font-mono mt-1">
      <span className="text-slate-600">In:</span>
      <span className={cheap ? "text-emerald-400" : "text-amber-400"}>
        ${input < 1 ? input.toFixed(3) : input.toFixed(2)}/1M
      </span>
      <span className="text-slate-700">|</span>
      <span className="text-slate-600">Out:</span>
      <span className={cheap ? "text-emerald-400" : "text-amber-400"}>
        ${output < 1 ? output.toFixed(2) : output.toFixed(2)}/1M
      </span>
    </div>
  );
}

// ─── 제공사 카드 ─────────────────────────────────────
function ProviderCard({
  providerId, provider, isActive, selectedModel, apiKey,
  onSelect, onModelChange, onKeyChange,
}: {
  providerId: string;
  provider: ProviderCatalog;
  isActive: boolean;
  selectedModel: string;
  apiKey: string;
  onSelect: () => void;
  onModelChange: (model: string) => void;
  onKeyChange: (key: string) => void;
}) {
  const meta = PROVIDER_META[providerId] ?? PROVIDER_META.openai;
  const currentModel = provider.models.find(m => m.id === selectedModel) ?? provider.models[0];

  return (
    <div className={`rounded-xl border p-4 transition-all ${
      isActive
        ? `${meta.border} ${meta.bg} ring-1 ${meta.border}`
        : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
    }`}>
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg ${meta.bg} border ${meta.border}`}>
            <span className={meta.color}>{meta.logo}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className={`text-sm font-bold ${isActive ? meta.color : "text-slate-300"}`}>
                {provider.name}
              </p>
              {isActive && (
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${meta.bg} ${meta.color} border ${meta.border}`}>
                  사용 중
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">{meta.desc}</p>
          </div>
        </div>
        <button
          onClick={onSelect}
          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
            isActive ? `${meta.color.replace("text-", "border-")} bg-current` : "border-slate-600"
          }`}
        >
          {isActive && <span className="h-2 w-2 rounded-full bg-slate-900" />}
        </button>
      </div>

      {/* 모델 선택 */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">모델 선택</p>
        <div className="relative">
          <select
            value={selectedModel}
            onChange={e => onModelChange(e.target.value)}
            className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 pr-8 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            {provider.models.map(m => (
              <option key={m.id} value={m.id}>
                {m.label} — In: ${m.inputPer1M.toFixed(m.inputPer1M < 1 ? 3 : 2)}/1M
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
        </div>

        {/* 선택된 모델 비용 */}
        {currentModel && (
          <div className="rounded-lg bg-slate-800/60 px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {currentModel.tier === "premium"
                ? <Crown className="h-3 w-3 text-amber-400" />
                : <Zap className="h-3 w-3 text-emerald-400" />
              }
              <span className={`text-[10px] font-bold ${TIER_LABEL[currentModel.tier]?.color}`}>
                {TIER_LABEL[currentModel.tier]?.label}
              </span>
            </div>
            <CostBadge input={currentModel.inputPer1M} output={currentModel.outputPer1M} />
          </div>
        )}

        {/* API 키 */}
        <div className="pt-1">
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
            API Key
          </p>
          <ApiKeyInput
            value={apiKey}
            onChange={onKeyChange}
            placeholder={`${provider.name} API Key`}
          />
        </div>
      </div>
    </div>
  );
}

// ─── 비용 비교 테이블 ────────────────────────────────
function CostComparisonTable({ catalog }: { catalog: Record<string, ProviderCatalog> }) {
  const allModels: Array<{ provider: string; providerName: string; model: ModelInfo }> = [];
  for (const [pId, pData] of Object.entries(catalog)) {
    for (const m of pData.models) {
      allModels.push({ provider: pId, providerName: pData.name, model: m });
    }
  }
  allModels.sort((a, b) => a.model.inputPer1M - b.model.inputPer1M);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="border-b border-slate-800 px-5 py-3 flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-amber-400" />
        <p className="text-sm font-semibold text-slate-300">전체 모델 비용 비교</p>
        <span className="text-[10px] text-slate-600 ml-1">저렴한 순</span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-600 uppercase">제공사</th>
            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-600 uppercase">모델</th>
            <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-600 uppercase">등급</th>
            <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-600 uppercase">Input /1M</th>
            <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-600 uppercase">Output /1M</th>
            <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-600 uppercase">1K토큰 예상</th>
          </tr>
        </thead>
        <tbody>
          {allModels.map(({ provider, providerName, model }, i) => {
            const meta = PROVIDER_META[provider];
            const estCost = (model.inputPer1M * 0.5 + model.outputPer1M * 0.5) / 1000;
            return (
              <tr key={model.id} className={`border-b border-slate-800/50 hover:bg-slate-800/30 ${i === 0 ? "bg-emerald-500/5" : ""}`}>
                <td className="px-4 py-2.5">
                  <span className={`text-[11px] font-bold ${meta?.color ?? "text-slate-400"}`}>
                    {meta?.logo} {providerName}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-300 font-medium">{model.label}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`text-[9px] font-bold ${TIER_LABEL[model.tier]?.color}`}>
                    {TIER_LABEL[model.tier]?.label}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                  ${model.inputPer1M < 1 ? model.inputPer1M.toFixed(3) : model.inputPer1M.toFixed(2)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                  ${model.outputPer1M < 1 ? model.outputPer1M.toFixed(2) : model.outputPer1M.toFixed(2)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  <span className={estCost < 0.005 ? "text-emerald-400" : estCost < 0.02 ? "text-amber-400" : "text-red-400"}>
                    ${estCost.toFixed(4)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── 메인 ────────────────────────────────────────────
export default function SettingsClient() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const fetchData = async () => {
    const res = await fetch("/api/admin/settings");
    if (!res.ok) { setLoading(false); return; }
    const d = await res.json();
    setData(d);
    setSettings(d.settings);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    if (res.ok) showToast("설정이 저장되었습니다");
    else showToast("저장 실패", "error");
  };

  const handlePing = async () => {
    setPinging(true);
    await fetchData();
    setPinging(false);
    showToast("API 상태를 새로고침했습니다");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-indigo-500" />
      </div>
    );
  }
  if (!data) {
    return <div className="flex items-center justify-center h-64 text-slate-500">데이터를 불러올 수 없습니다</div>;
  }

  const activeProvider = settings.AI_PROVIDER ?? "openai";

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-xl transition-all ${
          toast.type === "success"
            ? "bg-emerald-950 border-emerald-700 text-emerald-300"
            : "bg-red-950 border-red-700 text-red-300"
        }`}>
          <CheckCircle className="h-4 w-4" />{toast.msg}
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">시스템 설정</h1>
          <p className="text-sm text-slate-500 mt-1">AI 서비스, 플랜, 기능 플래그, API, 유지보수</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          <Save className="h-4 w-4" />
          {saving ? "저장 중..." : "전체 저장"}
        </button>
      </div>

      {/* ── 섹션 1: AI 서비스 설정 ─────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-400" />
          <h2 className="text-sm font-bold text-slate-300">AI 서비스 설정</h2>
          {/* 활성 제공사 연결 상태 */}
          <div className="ml-auto flex items-center gap-1.5">
            {data.apiStatus.providerStatus
              ? <><Wifi className="h-3.5 w-3.5 text-emerald-400" /><span className="text-[11px] text-emerald-400 font-semibold">연결됨</span></>
              : <><WifiOff className="h-3.5 w-3.5 text-red-400" /><span className="text-[11px] text-red-400 font-semibold">연결 안 됨</span></>
            }
            <button
              onClick={handlePing}
              disabled={pinging}
              className="ml-2 text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${pinging ? "animate-spin" : ""}`} />
              새로고침
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-600">
          활성 제공사의 API 키가 설정되어 있어야 AI 기능이 동작합니다.
          라디오 버튼으로 사용할 제공사를 선택하세요.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {data.catalog && Object.entries(data.catalog).map(([pId, pData]) => (
            <ProviderCard
              key={pId}
              providerId={pId}
              provider={pData}
              isActive={activeProvider === pId}
              selectedModel={settings[`AI_MODEL_${pId.toUpperCase()}`] ?? pData.models[0]?.id ?? ""}
              apiKey={settings[`AI_KEY_${pId.toUpperCase()}`] ?? ""}
              onSelect={() => updateSetting("AI_PROVIDER", pId)}
              onModelChange={(model) => updateSetting(`AI_MODEL_${pId.toUpperCase()}`, model)}
              onKeyChange={(key) => updateSetting(`AI_KEY_${pId.toUpperCase()}`, key)}
            />
          ))}
        </div>
      </div>

      {/* ── 섹션 2: 비용 비교 테이블 ──────────────── */}
      {data.catalog && <CostComparisonTable catalog={data.catalog} />}

      {/* ── 섹션 3: 플랜별 크레딧 ─────────────────── */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">플랜별 월 크레딧 한도</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { key: "FREE_CREDITS", label: "FREE", accent: "border-slate-600" },
            { key: "STARTER_CREDITS", label: "STARTER", accent: "border-blue-500/50" },
            { key: "PRO_CREDITS", label: "PRO", accent: "border-purple-500/50" },
            { key: "ENTERPRISE_CREDITS", label: "ENTERPRISE", accent: "border-amber-500/50" },
          ].map(p => (
            <div key={p.key} className={`rounded-lg border ${p.accent} bg-slate-800 p-3`}>
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">{p.label}</p>
              <input
                type="number"
                value={settings[p.key] ?? "0"}
                onChange={e => updateSetting(p.key, e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200 text-center focus:border-indigo-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-600 text-center mt-1">개 / 월</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 섹션 4: Feature Flag ───────────────────── */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Feature Flag</h3>
        <div className="divide-y divide-slate-800">
          <Toggle
            checked={settings.FEATURE_BULK === "true"}
            onChange={v => updateSetting("FEATURE_BULK", String(v))}
            label="대량 생성 (Bulk)"
            desc="여러 키워드로 콘텐츠 일괄 생성"
          />
          <Toggle
            checked={settings.FEATURE_LONGFORM === "true"}
            onChange={v => updateSetting("FEATURE_LONGFORM", String(v))}
            label="롱폼 작성"
            desc="AI 기반 장문 블로그 자동 작성"
          />
          <Toggle
            checked={settings.FEATURE_URL_TO_POST === "true"}
            onChange={v => updateSetting("FEATURE_URL_TO_POST", String(v))}
            label="URL → 포스트"
            desc="URL에서 콘텐츠 자동 추출"
          />
        </div>
      </div>

      {/* ── 섹션 5: 외부 API 상태 ─────────────────── */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">외부 API 연결 상태</h3>
        <div className="space-y-3">
          {/* AI 제공사 */}
          {Object.keys(data.catalog ?? {}).map(pId => {
            const hasKey = !!(settings[`AI_KEY_${pId.toUpperCase()}`]);
            const isActive = activeProvider === pId;
            const status = isActive ? data.apiStatus.providerStatus : hasKey ? null : false;
            const meta = PROVIDER_META[pId];
            return (
              <div key={pId} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  {status === true ? (
                    <Wifi className={`h-4 w-4 ${meta?.color ?? "text-emerald-400"}`} />
                  ) : status === null ? (
                    <Circle className="h-4 w-4 text-slate-600" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-slate-600" />
                  )}
                  <div>
                    <span className="text-sm text-slate-200">{data.catalog[pId]?.name}</span>
                    {isActive && <span className="ml-2 text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">ACTIVE</span>}
                  </div>
                </div>
                <span className={`text-xs font-bold ${
                  status === true ? "text-emerald-400"
                  : status === null ? "text-slate-600"
                  : "text-slate-600"
                }`}>
                  {status === true ? "✅ 연결됨"
                    : status === null ? "— 미확인"
                    : hasKey ? "❌ 키 오류" : "— 키 미설정"}
                </span>
              </div>
            );
          })}

          {/* Toss */}
          <div className="flex items-center justify-between py-2 border-t border-slate-800">
            <div className="flex items-center gap-3">
              {data.apiStatus.toss
                ? <Wifi className="h-4 w-4 text-blue-400" />
                : <WifiOff className="h-4 w-4 text-yellow-400" />}
              <span className="text-sm text-slate-200">Toss Payments</span>
            </div>
            <span className={`text-xs font-bold ${data.apiStatus.toss ? "text-emerald-400" : "text-yellow-400"}`}>
              {data.apiStatus.toss ? "✅ 연결됨" : "⚠️ 테스트 키"}
            </span>
          </div>
        </div>
      </div>

      {/* ── 섹션 6: 유지보수 모드 ─────────────────── */}
      <div className="rounded-xl border border-red-500/20 bg-slate-900 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-red-400" />
          <h3 className="text-sm font-semibold text-red-400">유지보수 모드</h3>
        </div>
        <Toggle
          checked={settings.MAINTENANCE_MODE === "true"}
          onChange={v => updateSetting("MAINTENANCE_MODE", String(v))}
          label="서비스 점검 모드"
          desc="활성화 시 일반 유저의 접속이 차단됩니다"
        />
        {settings.MAINTENANCE_MODE === "true" && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400">현재 유지보수 모드가 활성화되어 있습니다. 일반 유저 접속이 차단됩니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
