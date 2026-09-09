import assert from "node:assert/strict";
import test from "node:test";

import {
  assertNasAuthProviderSecrets,
  resolveAuthProviderIds,
} from "./auth-provider-policy.mjs";

test("NAS auth providers default to credentials and accept only an exact allowlist", () => {
  const nas = { FLOWPACK_DEPLOYMENT_PROFILE: "nas-private" };
  assert.deepEqual(resolveAuthProviderIds(nas), ["credentials"]);
  assert.deepEqual(
    resolveAuthProviderIds({ ...nas, FLOWPACK_AUTH_PROVIDERS: "credentials,google" }),
    ["credentials", "google"],
  );

  for (const value of [
    "google",
    "credentials,unknown",
    "credentials,google,google",
    "credentials, google",
    "Credentials",
    "",
  ]) {
    assert.throws(
      () => resolveAuthProviderIds({ ...nas, FLOWPACK_AUTH_PROVIDERS: value }),
      /NAS auth provider configuration is invalid/,
      value,
    );
  }
});

test("existing non-NAS deployments keep the current provider set", () => {
  assert.deepEqual(resolveAuthProviderIds({}), ["google", "kakao", "apple", "credentials"]);
});

test("enabled NAS social providers require their exact secret pair", () => {
  const nas = {
    FLOWPACK_DEPLOYMENT_PROFILE: "nas-private",
    GOOGLE_CLIENT_ID: "browser-reviewed-id",
    GOOGLE_CLIENT_SECRET: "private-secret",
  };
  assert.doesNotThrow(() => assertNasAuthProviderSecrets(["credentials", "google"], nas));
  assert.throws(
    () => assertNasAuthProviderSecrets(["credentials", "google"], {
      FLOWPACK_DEPLOYMENT_PROFILE: "nas-private",
      GOOGLE_CLIENT_ID: "browser-reviewed-id",
    }),
    /NAS auth provider configuration is invalid/,
  );
});
