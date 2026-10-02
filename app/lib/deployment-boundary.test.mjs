import assert from "node:assert/strict";
import test from "node:test";

import {
  assertNasDatabaseRole,
  FLOWPACK_WRITE_MODE_READ_ONLY,
  FLOWPACK_WRITE_MODE_READ_WRITE,
  isExternalApiEnabled,
  isPublicCallbackEnabled,
  isPublicMediaEnabled,
  isRemoteSchedulingSupported,
  isSchedulerEnabled,
  isImplicitWriteEnabled,
  resolveFlowpackWriteMode,
  shouldBlockRouteRequest,
  shouldBlockWriteRequest,
  isCredentialSmokeEnabled,
  isSocialTokenSmokeEnabled,
} from "./deployment-boundary.mjs";

test("external capabilities are deny-by-default and require exact true", () => {
  assert.equal(isPublicCallbackEnabled({}), false);
  assert.equal(isPublicCallbackEnabled({ FLOWPACK_PUBLIC_CALLBACKS_ENABLED: "TRUE" }), false);
  assert.equal(isPublicCallbackEnabled({ FLOWPACK_PUBLIC_CALLBACKS_ENABLED: "true" }), true);

  assert.equal(isPublicMediaEnabled({}), false);
  assert.equal(isPublicMediaEnabled({ FLOWPACK_PUBLIC_MEDIA_ENABLED: "true" }), true);

  assert.equal(isExternalApiEnabled({ FLOWPACK_DEPLOYMENT_PROFILE: "nas-private" }), false);
  assert.equal(isExternalApiEnabled({ FLOWPACK_DEPLOYMENT_PROFILE: "nas-private", FLOWPACK_EXTERNAL_API_ENABLED: "TRUE" }), false);
  assert.equal(isExternalApiEnabled({ FLOWPACK_DEPLOYMENT_PROFILE: "nas-private", FLOWPACK_EXTERNAL_API_ENABLED: "true" }), true);
  assert.equal(isExternalApiEnabled({}), true);

  assert.equal(isSchedulerEnabled({}), false);
  assert.equal(isSchedulerEnabled({ FLOWPACK_SCHEDULER_ENABLED: "true" }), true);
  assert.equal(
    isSchedulerEnabled({
      FLOWPACK_DEPLOYMENT_PROFILE: "nas-private",
      FLOWPACK_SCHEDULER_ENABLED: "true",
    }),
    false,
  );
});

test("only WordPress remote scheduling is supported without a local scheduler", () => {
  assert.equal(isRemoteSchedulingSupported("WORDPRESS"), true);
  assert.equal(isRemoteSchedulingSupported("INSTAGRAM"), false);
  assert.equal(isRemoteSchedulingSupported("FACEBOOK"), false);
  assert.equal(isRemoteSchedulingSupported("THREADS"), false);
});

test("read-only mode denies every unsafe HTTP method and keeps probes readable", () => {
  const environment = { FLOWPACK_WRITE_MODE: FLOWPACK_WRITE_MODE_READ_ONLY };

  for (const method of ["POST", "PUT", "PATCH", "DELETE", "CONNECT", "TRACE"]) {
    assert.equal(shouldBlockWriteRequest(method, environment), true, method);
  }
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    assert.equal(shouldBlockWriteRequest(method, environment), false, method);
  }
});

test("read-only mode blocks GET callback and cron mutations by route", () => {
  const environment = { FLOWPACK_WRITE_MODE: FLOWPACK_WRITE_MODE_READ_ONLY };
  for (const pathname of [
    "/api/auth/callback/google",
    "/api/auth/callback/kakao",
    "/api/cron/scheduled-publish",
    "/api/social-accounts/callback/facebook",
  ]) {
    assert.equal(shouldBlockRouteRequest({ method: "GET", pathname }, environment), true, pathname);
  }
  for (const pathname of ["/api/health", "/api/auth/session", "/home", "/r/opaque-id"]) {
    assert.equal(shouldBlockRouteRequest({ method: "GET", pathname }, environment), false, pathname);
  }
  assert.equal(isImplicitWriteEnabled(environment), false);
  assert.equal(isImplicitWriteEnabled({ FLOWPACK_WRITE_MODE: FLOWPACK_WRITE_MODE_READ_WRITE }), true);
});

test("external API enablement never bypasses the NAS read-only write gate", () => {
  const readOnly = {
    FLOWPACK_DEPLOYMENT_PROFILE: "nas-private",
    FLOWPACK_EXTERNAL_API_ENABLED: "true",
    FLOWPACK_WRITE_MODE: FLOWPACK_WRITE_MODE_READ_ONLY,
  };
  assert.equal(isExternalApiEnabled(readOnly), true);
  assert.equal(
    shouldBlockRouteRequest(
      { method: "POST", pathname: "/api/v1/generation-jobs/longform" },
      readOnly,
    ),
    true,
  );
  assert.equal(
    shouldBlockRouteRequest(
      { method: "POST", pathname: "/api/internal/generation-worker/run" },
      readOnly,
    ),
    true,
  );
  assert.equal(
    shouldBlockRouteRequest(
      { method: "GET", pathname: "/api/v1/capabilities" },
      readOnly,
    ),
    false,
  );

  const readWrite = { ...readOnly, FLOWPACK_WRITE_MODE: FLOWPACK_WRITE_MODE_READ_WRITE };
  assert.equal(
    shouldBlockRouteRequest(
      { method: "POST", pathname: "/api/v1/generation-jobs/longform" },
      readWrite,
    ),
    false,
  );
  assert.equal(
    shouldBlockRouteRequest(
      { method: "POST", pathname: "/api/internal/generation-worker/run" },
      readWrite,
    ),
    false,
  );
});

test("only the explicitly enabled NAS credential smoke POST bypasses the write freeze", () => {
  const environment = {
    FLOWPACK_DEPLOYMENT_PROFILE: "nas-private",
    FLOWPACK_WRITE_MODE: FLOWPACK_WRITE_MODE_READ_ONLY,
    FLOWPACK_AUTH_SMOKE_ENABLED: "true",
  };
  assert.equal(isCredentialSmokeEnabled(environment), true);
  assert.equal(
    shouldBlockRouteRequest(
      { method: "POST", pathname: "/api/auth/credential-smoke" },
      environment,
    ),
    false,
  );
  for (const changed of [
    { FLOWPACK_AUTH_SMOKE_ENABLED: "TRUE" },
    { FLOWPACK_DEPLOYMENT_PROFILE: "production" },
  ]) {
    const candidate = { ...environment, ...changed };
    assert.equal(isCredentialSmokeEnabled(candidate), false);
    assert.equal(
      shouldBlockRouteRequest(
        { method: "POST", pathname: "/api/auth/credential-smoke" },
        candidate,
      ),
      true,
    );
  }
  const readWrite = { ...environment, FLOWPACK_WRITE_MODE: FLOWPACK_WRITE_MODE_READ_WRITE };
  assert.equal(isCredentialSmokeEnabled(readWrite), false);
  assert.equal(
    shouldBlockRouteRequest(
      { method: "POST", pathname: "/api/auth/credential-smoke" },
      readWrite,
    ),
    true,
  );
  assert.equal(
    shouldBlockRouteRequest(
      { method: "POST", pathname: "/api/auth/credential-smoke/extra" },
      environment,
    ),
    true,
  );
});

test("only the exact operator-token social continuity path bypasses read-only mode", () => {
  const environment = {
    FLOWPACK_DEPLOYMENT_PROFILE: "nas-private",
    FLOWPACK_WRITE_MODE: FLOWPACK_WRITE_MODE_READ_ONLY,
    FLOWPACK_SOCIAL_TOKEN_SMOKE_ENABLED: "true",
  };
  assert.equal(isSocialTokenSmokeEnabled(environment), true);
  assert.equal(
    shouldBlockRouteRequest(
      { method: "POST", pathname: "/api/auth/social-token-smoke" },
      environment,
    ),
    false,
  );
  for (const request of [
    { method: "GET", pathname: "/api/auth/social-token-smoke" },
    { method: "POST", pathname: "/api/auth/social-token-smoke/" },
    { method: "POST", pathname: "/api/auth/social-token-smoke/extra" },
  ]) {
    assert.equal(shouldBlockRouteRequest(request, environment), true);
  }
  for (const changed of [
    { FLOWPACK_SOCIAL_TOKEN_SMOKE_ENABLED: "TRUE" },
    { FLOWPACK_DEPLOYMENT_PROFILE: "production" },
    { FLOWPACK_WRITE_MODE: FLOWPACK_WRITE_MODE_READ_WRITE },
  ]) {
    assert.equal(isSocialTokenSmokeEnabled({ ...environment, ...changed }), false);
  }
});

test("NAS private profile fails closed when write mode is absent or not exact", () => {
  const privateProfile = { FLOWPACK_DEPLOYMENT_PROFILE: "nas-private" };

  for (const value of [undefined, "", "READ-ONLY", "read_only", "true", "read-write "]) {
    const environment = {
      ...privateProfile,
      ...(value === undefined ? {} : { FLOWPACK_WRITE_MODE: value }),
    };
    assert.equal(resolveFlowpackWriteMode(environment), FLOWPACK_WRITE_MODE_READ_ONLY);
    assert.equal(shouldBlockWriteRequest("POST", environment), true);
  }

  assert.equal(
    resolveFlowpackWriteMode({
      ...privateProfile,
      FLOWPACK_WRITE_MODE: FLOWPACK_WRITE_MODE_READ_WRITE,
    }),
    FLOWPACK_WRITE_MODE_READ_WRITE,
  );
});

test("normal deployments preserve writes unless exact maintenance mode is selected", () => {
  assert.equal(resolveFlowpackWriteMode({}), FLOWPACK_WRITE_MODE_READ_WRITE);
  assert.equal(resolveFlowpackWriteMode({ FLOWPACK_WRITE_MODE: "invalid" }), FLOWPACK_WRITE_MODE_READ_WRITE);
  assert.equal(shouldBlockWriteRequest("POST", {}), false);
  assert.equal(
    shouldBlockWriteRequest("POST", { FLOWPACK_WRITE_MODE: FLOWPACK_WRITE_MODE_READ_ONLY }),
    true,
  );
});

test("NAS database role must match the effective write mode without leaking its URL", () => {
  assert.doesNotThrow(() => assertNasDatabaseRole({ DATABASE_URL: "not-checked-outside-nas" }));
  assert.doesNotThrow(() =>
    assertNasDatabaseRole({
      FLOWPACK_DEPLOYMENT_PROFILE: "nas-private",
      FLOWPACK_WRITE_MODE: FLOWPACK_WRITE_MODE_READ_ONLY,
      DATABASE_URL: "postgresql://flowpack_app_ro:secret-value@db:5432/flowpack",
    }),
  );
  assert.doesNotThrow(() =>
    assertNasDatabaseRole({
      FLOWPACK_DEPLOYMENT_PROFILE: "nas-private",
      FLOWPACK_WRITE_MODE: FLOWPACK_WRITE_MODE_READ_WRITE,
      DATABASE_URL: "postgresql://flowpack_app_rw:secret-value@db:5432/flowpack",
    }),
  );

  for (const environment of [
    {
      FLOWPACK_DEPLOYMENT_PROFILE: "nas-private",
      FLOWPACK_WRITE_MODE: FLOWPACK_WRITE_MODE_READ_ONLY,
      DATABASE_URL: "postgresql://flowpack_app_rw:do-not-print@db:5432/flowpack",
    },
    {
      FLOWPACK_DEPLOYMENT_PROFILE: "nas-private",
      FLOWPACK_WRITE_MODE: FLOWPACK_WRITE_MODE_READ_WRITE,
      DATABASE_URL: "postgresql://flowpack_app_ro:do-not-print@db:5432/flowpack",
    },
    {
      FLOWPACK_DEPLOYMENT_PROFILE: "nas-private",
      DATABASE_URL: "malformed-do-not-print",
    },
    {
      FLOWPACK_DEPLOYMENT_PROFILE: "nas-private",
      FLOWPACK_WRITE_MODE: FLOWPACK_WRITE_MODE_READ_ONLY,
      DATABASE_URL: "postgresql://flowpack_app_ro:do-not-print@source.example/flowpack",
    },
    {
      FLOWPACK_DEPLOYMENT_PROFILE: "nas-private",
      FLOWPACK_WRITE_MODE: FLOWPACK_WRITE_MODE_READ_ONLY,
      DATABASE_URL: "https://flowpack_app_ro:do-not-print@db/flowpack",
    },
  ]) {
    assert.throws(
      () => assertNasDatabaseRole(environment),
      (error) => {
        assert.doesNotMatch(error.message, /do-not-print|malformed/);
        return /NAS database role does not match write mode/.test(error.message);
      },
    );
  }
});
