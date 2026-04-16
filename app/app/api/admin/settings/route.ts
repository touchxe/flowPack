import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// ─── AI 모델 카탈로그 (2026년 4월 기준) ──────────────
// 출처: OpenAI / Anthropic / Google AI / xAI 공식 문서
export const AI_CATALOG = {
  openai: {
    name: "OpenAI",
    models: [
      // GPT-5.1 시리즈 (최신 플래그십)
      { id: "gpt-5.1",          label: "GPT-5.1",          inputPer1M: 1.25,  outputPer1M: 10.00, tier: "premium",  note: "긴 문서·고난도 범용 (40만 토큰)" },
      // GPT-4.1 시리즈 (가성비)
      { id: "gpt-4.1-mini",     label: "GPT-4.1 Mini",     inputPer1M: 0.40,  outputPer1M: 1.60,  tier: "economy",  note: "단가 저렴, 일반 글쓰기 (100만 토큰)" },
      // GPT-4o 시리즈 (안정 버전)
      { id: "gpt-4o",           label: "GPT-4o",           inputPer1M: 2.50,  outputPer1M: 10.00, tier: "premium",  note: "멀티모달" },
      { id: "gpt-4o-mini",      label: "GPT-4o mini",      inputPer1M: 0.15,  outputPer1M: 0.60,  tier: "economy",  note: "빠른 요약" },
      // o-시리즈 (추론)
      { id: "o3",               label: "o3",               inputPer1M: 10.00, outputPer1M: 40.00, tier: "premium",  note: "고급 추론" },
      { id: "o4-mini",          label: "o4-mini",          inputPer1M: 1.10,  outputPer1M: 4.40,  tier: "economy",  note: "추론 경량" },
    ],
  },
  anthropic: {
    name: "Anthropic",
    models: [
      // Claude 4 시리즈 (2026년 최신)
      { id: "claude-opus-4-6",   label: "Claude Opus 4.6",   inputPer1M: 15.00, outputPer1M: 75.00, tier: "premium", note: "최고 추론력" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", inputPer1M: 3.00,  outputPer1M: 15.00, tier: "premium", note: "코드/분석 최강" },
      // Claude 3.7 시리즈
      { id: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet", inputPer1M: 3.00,  outputPer1M: 15.00, tier: "premium", note: "고품질 프리미엄 (extended thinking)" },
      // Claude 3.5 시리즈 (안정)
      { id: "claude-3-5-haiku-20241022",  label: "Claude 3.5 Haiku",  inputPer1M: 0.80,  outputPer1M: 4.00,  tier: "economy", note: "빠른 요약·분류" },
    ],
  },
  google: {
    name: "Google AI",
    models: [
      // Gemini 3.1 (2026 최신 Preview)
      { id: "gemini-3.1-pro-preview",       label: "Gemini 3.1 Pro Preview",  inputPer1M: 2.50,  outputPer1M: 10.00, tier: "premium", note: "최신 멀티모달" },
      { id: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash Lite",  inputPer1M: 0.10,  outputPer1M: 0.40,  tier: "economy", note: "초저가 에이전트용" },
      // Gemini 2.5 (GA)
      { id: "gemini-2.5-pro",              label: "Gemini 2.5 Pro",           inputPer1M: 1.25,  outputPer1M: 10.00, tier: "premium", note: "1M 컨텍스트·추론" },
      { id: "gemini-2.5-flash",            label: "Gemini 2.5 Flash",         inputPer1M: 0.15,  outputPer1M: 0.60,  tier: "economy", note: "하이브리드 추론" },
      { id: "gemini-2.5-flash-lite",       label: "Gemini 2.5 Flash Lite",    inputPer1M: 0.10,  outputPer1M: 0.40,  tier: "economy", note: "대량처리 최저가" },
    ],
  },
  xai: {
    name: "xAI (Grok)",
    models: [
      // Grok 4 (2026 최신)
      { id: "grok-4",      label: "Grok 4",      inputPer1M: 3.00,  outputPer1M: 15.00, tier: "premium", note: "최신 추론+X검색" },
      { id: "grok-4-mini", label: "Grok 4 mini", inputPer1M: 0.50,  outputPer1M: 2.00,  tier: "economy", note: "경량·고속" },
      // Grok 3 (안정)
      { id: "grok-3",      label: "Grok 3",      inputPer1M: 3.00,  outputPer1M: 15.00, tier: "premium", note: "웹·X 실시간검색" },
      { id: "grok-3-mini", label: "Grok 3 mini", inputPer1M: 0.30,  outputPer1M: 0.50,  tier: "economy", note: "저비용 추론" },
    ],
  },
} as const;


// ─── 기본 설정값 ──────────────────────────────────────
const DEFAULTS: Record<string, string> = {
  // 플랜별 크레딧
  FREE_CREDITS: "10",
  STARTER_CREDITS: "100",
  PRO_CREDITS: "500",
  ENTERPRISE_CREDITS: "9999",
  // 기능 플래그
  FEATURE_BULK: "true",
  FEATURE_LONGFORM: "true",
  FEATURE_URL_TO_POST: "true",
  // 유지보수
  MAINTENANCE_MODE: "false",
  // AI 설정
  AI_PROVIDER: "openai",
  AI_MODEL_OPENAI: "gpt-4.1-mini",
  AI_MODEL_ANTHROPIC: "claude-3-7-sonnet-20250219",
  AI_MODEL_GOOGLE: "gemini-2.5-flash",
  AI_MODEL_XAI: "grok-4-mini",
  // API 키 (빈 값 = 미설정)
  AI_KEY_OPENAI: "",
  AI_KEY_ANTHROPIC: "",
  AI_KEY_GOOGLE: "",
  AI_KEY_XAI: "",
};

// ─── API 키 마스킹 헬퍼 ──────────────────────────────
function maskKey(key: string): string {
  if (!key || key.length < 8) return key;
  return key.slice(0, 4) + "••••••••" + key.slice(-4);
}

// ─── 제공사별 API 연결 확인 ──────────────────────────
async function checkProviderStatus(
  provider: string,
  apiKey: string
): Promise<boolean> {
  if (!apiKey) return false;
  try {
    switch (provider) {
      case "openai":
        return (await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(4000),
        })).ok;
      case "anthropic":
        return (await fetch("https://api.anthropic.com/v1/models", {
          headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          signal: AbortSignal.timeout(4000),
        })).ok;
      case "google":
        return (await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
          { signal: AbortSignal.timeout(4000) }
        )).ok;
      case "xai":
        return (await fetch("https://api.x.ai/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(4000),
        })).ok;
      default:
        return false;
    }
  } catch { return false; }
}

// GET /api/admin/settings ─────────────────────────────
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const configs = await prisma.systemConfig.findMany();
  const raw: Record<string, string> = { ...DEFAULTS };
  for (const c of configs) raw[c.key] = c.value;

  // API 키 마스킹해서 반환 (보안)
  const settings = { ...raw };
  for (const keyField of ["AI_KEY_OPENAI", "AI_KEY_ANTHROPIC", "AI_KEY_GOOGLE", "AI_KEY_XAI"]) {
    if (settings[keyField]) {
      settings[keyField] = maskKey(settings[keyField]);
    }
  }

  // 활성 제공사 연결 상태 체크
  const activeProvider = raw.AI_PROVIDER ?? "openai";
  const activeKey = raw[`AI_KEY_${activeProvider.toUpperCase()}`] ?? "";
  const providerStatus = await checkProviderStatus(activeProvider, activeKey);

  // Toss 상태
  const tossConfigured = !!process.env.TOSS_SECRET_KEY &&
    process.env.TOSS_SECRET_KEY !== "test_sk_placeholder";

  return NextResponse.json({
    settings,
    catalog: AI_CATALOG,
    apiStatus: {
      activeProvider,
      providerStatus,
      toss: tossConfigured,
    },
  });
}

// PATCH /api/admin/settings ───────────────────────────
export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json() as Record<string, string>;

  const allowedKeys = Object.keys(DEFAULTS);
  const updates: { key: string; value: string }[] = [];

  for (const [key, value] of Object.entries(body)) {
    if (!allowedKeys.includes(key)) continue;

    // API 키: 마스킹된 값(•••)은 저장하지 않음 (이미 저장된 값 유지)
    if (key.startsWith("AI_KEY_") && value.includes("•")) continue;

    updates.push({ key, value: String(value) });
  }

  for (const { key, value } of updates) {
    await prisma.systemConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  return NextResponse.json({ success: true, updated: updates.length });
}
