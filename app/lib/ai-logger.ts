/**
 * AI 사용량 로깅 헬퍼
 * generate 라우트에서 AI 호출 후 사용량을 기록합니다.
 *
 * 사용 예:
 *   await logAiUsage({
 *     userId: session.user.id,
 *     feature: "CAROUSEL",
 *     provider: "openai",
 *     model: "gpt-4o",
 *     promptTokens: usage.prompt_tokens,
 *     completionTokens: usage.completion_tokens,
 *     totalTokens: usage.total_tokens,
 *     durationMs: Date.now() - startTime,
 *   });
 */
import { prisma } from "@/lib/prisma";

// 모델별 가격 (USD per 1M tokens) — 2026.04 기준
// Admin Settings의 AI_CATALOG와 동기화
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  "gpt-5.1":          { input: 1.25,  output: 10.00 },
  "gpt-4.1-mini":     { input: 0.40,  output: 1.60 },
  "gpt-4o":           { input: 2.50,  output: 10.00 },
  "gpt-4o-mini":      { input: 0.15,  output: 0.60 },
  "o3":               { input: 10.00, output: 40.00 },
  "o4-mini":          { input: 1.10,  output: 4.40 },
  // Anthropic
  "claude-opus-4-6":               { input: 15.00, output: 75.00 },
  "claude-sonnet-4-6":             { input: 3.00,  output: 15.00 },
  "claude-3-7-sonnet-20250219":    { input: 3.00,  output: 15.00 },
  "claude-3-5-haiku-20241022":     { input: 0.80,  output: 4.00 },
  // Google
  "gemini-3.1-pro-preview":        { input: 2.50,  output: 10.00 },
  "gemini-3.1-flash-lite-preview": { input: 0.10,  output: 0.40 },
  "gemini-2.5-pro":                { input: 1.25,  output: 10.00 },
  "gemini-2.5-flash":              { input: 0.15,  output: 0.60 },
  "gemini-2.5-flash-lite":         { input: 0.10,  output: 0.40 },
  // xAI (Grok)
  "grok-4":      { input: 3.00,  output: 15.00 },
  "grok-4-mini": { input: 0.50,  output: 2.00 },
  "grok-3":      { input: 3.00,  output: 15.00 },
  "grok-3-mini": { input: 0.30,  output: 0.50 },
  // MiniMax
  "MiniMax-M2.7":           { input: 0.80,  output: 4.50 },
  "MiniMax-M2.7-highspeed": { input: 0.40,  output: 2.00 },
  "MiniMax-M2.5":           { input: 0.60,  output: 3.00 },
  "MiniMax-M2.5-highspeed": { input: 0.30,  output: 1.50 },
  "MiniMax-M2":             { input: 0.20,  output: 1.10 },
};

interface AiLogInput {
  userId: string;
  feature: string;         // CAROUSEL / BLOG / BULK / URL_TO_POST / LONGFORM
  provider?: string;       // openai / anthropic / google / xai / minimax
  model: string;           // 사용된 모델 ID
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs?: number;
  isError?: boolean;
  errorCode?: string;
}

export async function logAiUsage(input: AiLogInput) {
  // 가격은 1M 토큰 기준 → 실제 토큰 수에 맞게 계산
  const pricing = MODEL_PRICING[input.model] ?? { input: 0.15, output: 0.60 };
  const estimatedCostUsd =
    (input.promptTokens / 1_000_000) * pricing.input +
    (input.completionTokens / 1_000_000) * pricing.output;

  try {
    await prisma.aiUsageLog.create({
      data: {
        userId: input.userId,
        feature: input.feature,
        model: input.model,
        promptTokens: input.promptTokens,
        completionTokens: input.completionTokens,
        totalTokens: input.totalTokens,
        estimatedCostUsd: Math.round(estimatedCostUsd * 1_000_000) / 1_000_000,
        durationMs: input.durationMs ?? null,
        isError: input.isError ?? false,
        errorCode: input.errorCode ?? null,
      },
    });
  } catch (err) {
    // 로깅 실패가 사용자 응답에 영향을 주면 안 됨
    console.error("[AI Logger] 기록 실패:", err);
  }
}
