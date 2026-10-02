import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

export const DEFAULT_IDLE_DELAY_MS = 5_000;
export const DEFAULT_ERROR_DELAY_MS = 15_000;
export const DEFAULT_REQUEST_TIMEOUT_MS = 290_000;

export function readGenerationWorkerConfig(env = process.env) {
  const endpoint = env.FLOWPACK_WORKER_URL ?? "http://web:3000/api/internal/generation-worker/run";
  let parsedEndpoint;
  try {
    parsedEndpoint = new URL(endpoint);
  } catch {
    throw new Error("FLOWPACK_WORKER_URL must be a valid HTTP(S) URL");
  }
  if (!new Set(["http:", "https:"]).has(parsedEndpoint.protocol)) {
    throw new Error("FLOWPACK_WORKER_URL must use HTTP or HTTPS");
  }
  if (parsedEndpoint.username || parsedEndpoint.password) {
    throw new Error("FLOWPACK_WORKER_URL must not contain credentials");
  }
  if (
    parsedEndpoint.pathname !== "/api/internal/generation-worker/run" ||
    parsedEndpoint.search ||
    parsedEndpoint.hash
  ) {
    throw new Error("FLOWPACK_WORKER_URL must target the exact internal worker route");
  }

  const secret = env.FLOWPACK_WORKER_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("FLOWPACK_WORKER_SECRET must contain at least 32 characters");
  }

  const workerId = env.FLOWPACK_WORKER_ID ?? `generation-worker-${randomUUID()}`;
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(workerId)) {
    throw new Error("FLOWPACK_WORKER_ID must contain 1-128 safe characters");
  }

  return {
    endpoint: parsedEndpoint.toString(),
    secret,
    workerId,
    idleDelayMs: DEFAULT_IDLE_DELAY_MS,
    errorDelayMs: DEFAULT_ERROR_DELAY_MS,
    requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
  };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function runGenerationWorkerIteration(config, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const wait = dependencies.wait ?? delay;
  const logger = dependencies.logger ?? console;

  try {
    const response = await fetchImpl(config.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.secret}`,
        "X-FlowPack-Worker-Id": config.workerId,
      },
      signal: AbortSignal.timeout(config.requestTimeoutMs),
    });
    if (response.status === 204) {
      await wait(config.idleDelayMs);
      return "idle";
    }

    await response.arrayBuffer().catch(() => undefined);
    if (!response.ok) {
      logger.error(`[Generation worker] request failed with status ${response.status}`);
      await wait(config.errorDelayMs);
      return "error";
    }
    return "processed";
  } catch (error) {
    logger.error(
      "[Generation worker] request failed",
      error instanceof Error ? error.message : "unknown error",
    );
    await wait(config.errorDelayMs);
    return "error";
  }
}

export async function runGenerationWorker(config, dependencies = {}) {
  const shouldStop = dependencies.shouldStop ?? (() => false);
  while (!shouldStop()) {
    await runGenerationWorkerIteration(config, dependencies);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = readGenerationWorkerConfig();
  let stopping = false;
  process.on("SIGTERM", () => { stopping = true; });
  process.on("SIGINT", () => { stopping = true; });
  await runGenerationWorker(config, { shouldStop: () => stopping });
}
