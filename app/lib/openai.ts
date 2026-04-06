import OpenAI from "openai";

let _openai: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

// For backwards compatibility, returns a client (may throw if API key not set)
export const openai = {
  chat: {
    completions: {
      create: (...args: Parameters<OpenAI["chat"]["completions"]["create"]>) =>
        getOpenAI().chat.completions.create(...args),
    },
  },
};
