export const PUBLIC_INTEGRATION_DISABLED = "PUBLIC_INTEGRATION_DISABLED";
export const FLOWPACK_WRITE_MODE_READ_ONLY = "read-only";
export const FLOWPACK_WRITE_MODE_READ_WRITE = "read-write";

const NAS_PRIVATE_PROFILE = "nas-private";
const NAS_READ_ONLY_ROLE = "flowpack_app_ro";
const NAS_READ_WRITE_ROLE = "flowpack_app_rw";
const SAFE_HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const MUTATING_GET_PREFIXES = Object.freeze([
  "/api/cron/",
  "/api/social-accounts/callback/",
]);
const MUTATING_AUTH_CALLBACKS = new Set(["google", "kakao", "apple"]);

function exactTrue(value) {
  return value === "true";
}

export function isPublicCallbackEnabled(env = process.env) {
  return exactTrue(env.FLOWPACK_PUBLIC_CALLBACKS_ENABLED);
}

export function isPublicMediaEnabled(env = process.env) {
  return exactTrue(env.FLOWPACK_PUBLIC_MEDIA_ENABLED);
}

export function isSchedulerEnabled(env = process.env) {
  // No NAS scheduler service or singleton lease exists yet.
  if (env.FLOWPACK_DEPLOYMENT_PROFILE === NAS_PRIVATE_PROFILE) return false;
  return exactTrue(env.FLOWPACK_SCHEDULER_ENABLED);
}

export function isCredentialSmokeEnabled(env = process.env) {
  return (
    env.FLOWPACK_DEPLOYMENT_PROFILE === NAS_PRIVATE_PROFILE &&
    resolveFlowpackWriteMode(env) === FLOWPACK_WRITE_MODE_READ_ONLY &&
    exactTrue(env.FLOWPACK_AUTH_SMOKE_ENABLED)
  );
}

export function isSocialTokenSmokeEnabled(env = process.env) {
  return (
    env.FLOWPACK_DEPLOYMENT_PROFILE === NAS_PRIVATE_PROFILE &&
    resolveFlowpackWriteMode(env) === FLOWPACK_WRITE_MODE_READ_ONLY &&
    exactTrue(env.FLOWPACK_SOCIAL_TOKEN_SMOKE_ENABLED)
  );
}

export function isRemoteSchedulingSupported(platform) {
  return platform === "WORDPRESS";
}

/**
 * Resolve the runtime write boundary without accepting aliases or case
 * variations. Existing non-NAS deployments remain read-write unless they
 * deliberately select the exact maintenance value. A NAS private deployment
 * fails closed whenever its value is absent or malformed.
 */
export function resolveFlowpackWriteMode(env = process.env) {
  if (env.FLOWPACK_WRITE_MODE === FLOWPACK_WRITE_MODE_READ_ONLY) {
    return FLOWPACK_WRITE_MODE_READ_ONLY;
  }
  if (env.FLOWPACK_WRITE_MODE === FLOWPACK_WRITE_MODE_READ_WRITE) {
    return FLOWPACK_WRITE_MODE_READ_WRITE;
  }
  return env.FLOWPACK_DEPLOYMENT_PROFILE === NAS_PRIVATE_PROFILE
    ? FLOWPACK_WRITE_MODE_READ_ONLY
    : FLOWPACK_WRITE_MODE_READ_WRITE;
}

export function shouldBlockWriteRequest(method, env = process.env) {
  const normalizedMethod = typeof method === "string" ? method.toUpperCase() : "";
  if (SAFE_HTTP_METHODS.has(normalizedMethod)) return false;
  return resolveFlowpackWriteMode(env) !== FLOWPACK_WRITE_MODE_READ_WRITE;
}

export function isImplicitWriteEnabled(env = process.env) {
  return resolveFlowpackWriteMode(env) === FLOWPACK_WRITE_MODE_READ_WRITE;
}

/**
 * Some provider callbacks and schedulers mutate state through GET. Keep the
 * generic method gate for ordinary requests, then classify these known routes
 * explicitly so source maintenance mode is a real write freeze.
 */
export function shouldBlockRouteRequest(request, env = process.env) {
  const method = typeof request?.method === "string" ? request.method.toUpperCase() : "";
  const pathname = typeof request?.pathname === "string" ? request.pathname : "";
  if (pathname === "/api/auth/credential-smoke") {
    return !(method === "POST" && isCredentialSmokeEnabled(env));
  }
  if (pathname === "/api/auth/social-token-smoke") {
    return !(method === "POST" && isSocialTokenSmokeEnabled(env));
  }
  if (shouldBlockWriteRequest(method, env)) return true;
  if (isImplicitWriteEnabled(env) || (method !== "GET" && method !== "HEAD")) return false;

  if (!pathname.startsWith("/") || pathname.includes("\0")) return true;
  if (MUTATING_GET_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;

  const authCallback = /^\/api\/auth\/callback\/([^/]+)\/?$/.exec(pathname);
  return Boolean(authCallback && MUTATING_AUTH_CALLBACKS.has(authCallback[1]));
}

/**
 * Keep the HTTP switch and PostgreSQL credentials paired on NAS. This does
 * not inspect or log the password, hostname, database name, or query string.
 */
export function assertNasDatabaseRole(env = process.env) {
  if (env.FLOWPACK_DEPLOYMENT_PROFILE !== NAS_PRIVATE_PROFILE) return;

  const expectedRole =
    resolveFlowpackWriteMode(env) === FLOWPACK_WRITE_MODE_READ_WRITE
      ? NAS_READ_WRITE_ROLE
      : NAS_READ_ONLY_ROLE;
  let databaseUrl;
  try {
    databaseUrl = new URL(env.DATABASE_URL);
  } catch {
    throw new Error("NAS database role does not match write mode");
  }
  if (
    databaseUrl.protocol !== "postgresql:" ||
    databaseUrl.username !== expectedRole ||
    databaseUrl.password.length === 0 ||
    databaseUrl.hostname !== "db" ||
    (databaseUrl.port !== "" && databaseUrl.port !== "5432") ||
    databaseUrl.pathname !== "/flowpack"
  ) {
    throw new Error("NAS database role does not match write mode");
  }
}
