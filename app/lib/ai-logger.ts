/**
 * AI 사용량 로깅 헬퍼
 * generate 라우트에서 AI 호출 후 사용량을 기록합니다.
 *
 * 사용 예:
 *   await logAiUsage({
 *     userId: session.user.id,
 *     feature: "CAROUSEL",
 *     model: "gpt-4o",
 *     promptTokens: usage.prompt_tokens,
 *     completionTokens: usage.completion_tokens,
 *     totalTokens: usage.total_tokens,
 *     durationMs: Date.now() - startTime,
 *   });
 */
import { prisma } from "@/lib/prisma";

// 모델별 가격 (USD per 1K tokens) — 2024.04 기준
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o":      { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
};

interface AiLogInput {
  userId: string;
  feature: string;         // CAROUSEL / BLOG / BULK / URL_TO_POST / LONGFORM
  model: string;           // gpt-4o / gpt-4o-mini
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs?: number;
  isError?: boolean;
  errorCode?: string;
}

export async function logAiUsage(input: AiLogInput) {
  const pricing = MODEL_PRICING[input.model] ?? MODEL_PRICING["gpt-4o-mini"]!;
  const estimatedCostUsd =
    (input.promptTokens / 1000) * pricing.input +
    (input.completionTokens / 1000) * pricing.output;

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
