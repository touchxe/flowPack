const NAS_PRIVATE_PROFILE = "nas-private";
const DEFAULT_PROVIDER_IDS = Object.freeze(["google", "kakao", "apple", "credentials"]);
const NAS_PROVIDER_IDS = new Set(DEFAULT_PROVIDER_IDS);

function invalid() {
  throw new Error("NAS auth provider configuration is invalid");
}

/**
 * The public deployment keeps its current providers. A NAS deployment has a
 * separate, exact allowlist and defaults to credentials only. Credentials are
 * mandatory on NAS until each social callback has independent browser proof.
 */
export function resolveAuthProviderIds(env = process.env) {
  if (env.FLOWPACK_DEPLOYMENT_PROFILE !== NAS_PRIVATE_PROFILE) {
    return [...DEFAULT_PROVIDER_IDS];
  }

  const configured = env.FLOWPACK_AUTH_PROVIDERS ?? "credentials";
  if (!/^[a-z]+(?:,[a-z]+)*$/.test(configured)) invalid();
  const providerIds = configured.split(",");
  if (
    providerIds.length === 0 ||
    providerIds[0] !== "credentials" ||
    new Set(providerIds).size !== providerIds.length ||
    providerIds.some((providerId) => !NAS_PROVIDER_IDS.has(providerId))
  ) {
    invalid();
  }
  return providerIds;
}

export function assertNasAuthProviderSecrets(providerIds, env = process.env) {
  if (env.FLOWPACK_DEPLOYMENT_PROFILE !== NAS_PRIVATE_PROFILE) return;
  const required = {
    google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    kakao: ["KAKAO_CLIENT_ID", "KAKAO_CLIENT_SECRET"],
    apple: ["APPLE_CLIENT_ID", "APPLE_CLIENT_SECRET"],
  };
  for (const providerId of providerIds) {
    for (const name of required[providerId] ?? []) {
      const value = env[name];
      if (typeof value !== "string" || value.length === 0 || value.trim() !== value) invalid();
    }
  }
}
