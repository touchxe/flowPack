/**
 * 통합 AI 클라이언트
 * Admin Settings(SystemConfig DB)에서 설정된 제공사/모델/API키를 읽어
 * 실제 AI 호출에 사용합니다.
 *
 * 지원 제공사:
 *   - OpenAI   (네이티브)
 *   - xAI      (OpenAI 호환 API)
 *   - MiniMax  (OpenAI 호환 API)
 *   - Google   (OpenAI 호환 엔드포인트)
 *   - Anthropic (fetch 직접 호출 — API 형식 상이)
 */
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

// ─── 제공사별 설정 ───────────────────────────────────
const PROVIDER_BASE_URL: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta/openai/",
  xai: "https://api.x.ai/v1",
  minimax: "https://api.minimax.io/v1",
};

const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o",
  anthropic: "claude-3-7-sonnet-20250219",
  google: "gemini-2.5-flash",
  xai: "grok-4-mini",
  minimax: "MiniMax-M2.7-highspeed",
};

// ─── 타입 정의 ──────────────────────────────────────
export interface AIConfig {
  provider: string;
  model: string;
  apiKey: string;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AICompletionOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  responseFormat?: { type: "json_object" | "text" };
}

export interface AICompletionResult {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
}

export interface AIStreamResult {
  stream: AsyncIterable<string>;
  model: string;
  provider: string;
}

// ─── DB에서 활성 AI 설정 조회 ────────────────────────
export async function getAIConfig(): Promise<AIConfig> {
  const configs = await prisma.systemConfig.findMany({
    where: {
      key: {
        in: [
          "AI_PROVIDER",
          "AI_MODEL_OPENAI", "AI_MODEL_ANTHROPIC", "AI_MODEL_GOOGLE",
          "AI_MODEL_XAI", "AI_MODEL_MINIMAX",
          "AI_KEY_OPENAI", "AI_KEY_ANTHROPIC", "AI_KEY_GOOGLE",
          "AI_KEY_XAI", "AI_KEY_MINIMAX",
        ],
      },
    },
  });

  const settings: Record<string, string> = {};
  for (const c of configs) settings[c.key] = c.value;

  const provider = settings.AI_PROVIDER || "openai";
  const model =
    settings[`AI_MODEL_${provider.toUpperCase()}`] ||
    DEFAULT_MODELS[provider] ||
    "gpt-4o";
  const apiKey =
    settings[`AI_KEY_${provider.toUpperCase()}`] ||
    (provider === "openai" ? process.env.OPENAI_API_KEY || "" : "");

  return { provider, model, apiKey };
}

// ─── 상태 확인 헬퍼 ─────────────────────────────────
export async function isAIConfigured(): Promise<boolean> {
  const config = await getAIConfig();
  return !!config.apiKey;
}

export function aiNotConfiguredResponse() {
  return Response.json(
    { error: "AI 기능이 아직 설정되지 않았습니다. 관리자에게 문의하세요." },
    { status: 503 },
  );
}

// ─── OpenAI 호환 클라이언트 생성 ─────────────────────
function createOpenAIClient(provider: string, apiKey: string): OpenAI {
  const baseURL = PROVIDER_BASE_URL[provider];
  if (!baseURL) {
    throw new Error(`지원되지 않는 AI 제공사입니다: ${provider}`);
  }
  return new OpenAI({ apiKey, baseURL });
}

// ─── 비스트리밍 AI 호출 ─────────────────────────────
export async function callAI(
  options: AICompletionOptions,
): Promise<AICompletionResult> {
  const config = await getAIConfig();
  if (!config.apiKey) {
    throw new Error("AI API 키가 설정되지 않았습니다.");
  }

  // Anthropic은 별도 처리
  if (config.provider === "anthropic") {
    return callAnthropic(config, options);
  }

  // OpenAI 호환 제공사 (openai, xai, minimax, google)
  const client = createOpenAIClient(config.provider, config.apiKey);

  const completion = await client.chat.completions.create({
    model: config.model,
    messages: options.messages as OpenAI.ChatCompletionMessageParam[],
    max_tokens: options.maxTokens ?? 2000,
    ...(options.temperature !== undefined
      ? { temperature: options.temperature }
      : {}),
    ...(options.responseFormat
      ? { response_format: options.responseFormat }
      : {}),
  });

  return {
    content: completion.choices[0]?.message?.content || "",
    usage: completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        }
      : undefined,
    model: config.model,
    provider: config.provider,
  };
}

// ─── 스트리밍 AI 호출 ───────────────────────────────
export async function callAIStream(
  options: AICompletionOptions,
): Promise<AIStreamResult> {
  const config = await getAIConfig();
  if (!config.apiKey) {
    throw new Error("AI API 키가 설정되지 않았습니다.");
  }

  // Anthropic 스트리밍
  if (config.provider === "anthropic") {
    return callAnthropicStream(config, options);
  }

  // OpenAI 호환 제공사
  const client = createOpenAIClient(config.provider, config.apiKey);

  const completion = await client.chat.completions.create({
    model: config.model,
    messages: options.messages as OpenAI.ChatCompletionMessageParam[],
    max_tokens: options.maxTokens ?? 4000,
    stream: true,
    ...(options.temperature !== undefined
      ? { temperature: options.temperature }
      : {}),
  });

  async function* streamContent() {
    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  }

  return {
    stream: streamContent(),
    model: config.model,
    provider: config.provider,
  };
}

// ─── Anthropic 비스트리밍 ────────────────────────────
async function callAnthropic(
  config: AIConfig,
  options: AICompletionOptions,
): Promise<AICompletionResult> {
  const systemMsg =
    options.messages.find((m) => m.role === "system")?.content || "";
  const messages = options.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: options.maxTokens ?? 2000,
    messages,
  };
  if (systemMsg) body.system = systemMsg;
  if (options.temperature !== undefined) body.temperature = options.temperature;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API 오류 (${response.status}): ${errorBody}`);
  }

  const result = await response.json();
  return {
    content: result.content?.[0]?.text || "",
    usage: result.usage
      ? {
          promptTokens: result.usage.input_tokens,
          completionTokens: result.usage.output_tokens,
          totalTokens:
            result.usage.input_tokens + result.usage.output_tokens,
        }
      : undefined,
    model: config.model,
    provider: config.provider,
  };
}

// ─── Anthropic 스트리밍 ──────────────────────────────
async function callAnthropicStream(
  config: AIConfig,
  options: AICompletionOptions,
): Promise<AIStreamResult> {
  const systemMsg =
    options.messages.find((m) => m.role === "system")?.content || "";
  const messages = options.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: options.maxTokens ?? 4000,
    stream: true,
    messages,
  };
  if (systemMsg) body.system = systemMsg;
  if (options.temperature !== undefined) body.temperature = options.temperature;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API 오류 (${response.status}): ${errorBody}`);
  }

  async function* streamContent() {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data);
          if (
            parsed.type === "content_block_delta" &&
            parsed.delta?.text
          ) {
            yield parsed.delta.text;
          }
        } catch {
          /* 비-JSON 라인 무시 */
        }
      }
    }
  }

  return {
    stream: streamContent(),
    model: config.model,
    provider: config.provider,
  };
}

// ─── 이미지 생성 클라이언트 (DALL-E 전용 — 항상 OpenAI) ─
export async function getImageClient(): Promise<OpenAI> {
  const configs = await prisma.systemConfig.findMany({
    where: { key: "AI_KEY_OPENAI" },
  });

  const dbKey = configs[0]?.value || "";
  const apiKey = dbKey || process.env.OPENAI_API_KEY || "";

  if (!apiKey) {
    throw new Error("이미지 생성을 위한 OpenAI API 키가 설정되지 않았습니다.");
  }

  return new OpenAI({ apiKey });
}
