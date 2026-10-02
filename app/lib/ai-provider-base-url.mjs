const PROVIDER_BASE_URL = Object.freeze({
  openai: "https://api.openai.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta/openai/",
  xai: "https://api.x.ai/v1",
  minimax: "https://api.minimax.io/v1",
});

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function resolveAIProviderBaseUrl(provider, env = process.env) {
  const configured = PROVIDER_BASE_URL[provider];
  if (!configured) return null;

  const testOverride = env.FLOWPACK_AI_TEST_BASE_URL;
  if (!testOverride) return configured;
  if (env.NODE_ENV === "production") {
    throw new Error("Local AI test endpoint is unavailable in production");
  }
  if (provider !== "openai") {
    throw new Error("Local AI test endpoint supports only the OpenAI-compatible test provider");
  }

  let parsed;
  try {
    parsed = new URL(testOverride);
  } catch {
    throw new Error("FLOWPACK_AI_TEST_BASE_URL must be a valid loopback HTTP(S) URL");
  }
  if (
    !new Set(["http:", "https:"]).has(parsed.protocol) ||
    !LOOPBACK_HOSTS.has(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("FLOWPACK_AI_TEST_BASE_URL must be a credential-free loopback HTTP(S) URL");
  }
  return parsed.toString().replace(/\/$/, "");
}
