import OpenAI from "openai";

let _openai: OpenAI | null = null;

/**
 * OpenAI 클라이언트 싱글턴 반환
 * OPENAI_API_KEY 미설정 시 Error throw
 */
export function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
    }
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

/**
 * API 키 설정 여부 확인
 */
export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * 표준 에러 응답 — API 키 미설정
 */
export function openAINotConfiguredResponse() {
  return Response.json(
    { error: "AI 기능이 아직 설정되지 않았습니다. 관리자에게 문의하세요." },
    { status: 503 }
  );
}
