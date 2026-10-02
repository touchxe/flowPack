import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import {
  DEFAULT_ERROR_DELAY_MS,
  DEFAULT_IDLE_DELAY_MS,
  readGenerationWorkerConfig,
  runGenerationWorkerIteration,
} from "./generation-worker-loop.mjs";

const secret = "worker-secret-0123456789abcdef0123456789abcdef";

async function listen(handler) {
  const server = createServer(handler);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    endpoint: `http://127.0.0.1:${address.port}/api/internal/generation-worker/run`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

test("worker configuration rejects weak secrets and unsafe endpoint credentials", () => {
  assert.throws(
    () => readGenerationWorkerConfig({ FLOWPACK_WORKER_SECRET: "short" }),
    /at least 32 characters/,
  );
  assert.throws(
    () => readGenerationWorkerConfig({
      FLOWPACK_WORKER_SECRET: secret,
      FLOWPACK_WORKER_URL: "https://user:password@example.com/worker",
    }),
    /must not contain credentials/,
  );
  assert.throws(
    () => readGenerationWorkerConfig({
      FLOWPACK_WORKER_SECRET: secret,
      FLOWPACK_WORKER_URL: "https://example.com/api/internal/generation-worker/run?token=secret",
    }),
    /exact internal worker route/,
  );
});

test("worker sends its bearer secret and identity over the internal HTTP request", async (context) => {
  const requests = [];
  const runtime = await listen((request, response) => {
    requests.push({
      method: request.method,
      authorization: request.headers.authorization,
      workerId: request.headers["x-flowpack-worker-id"],
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end('{"success":true,"data":{"processed":true}}');
  });
  context.after(runtime.close);

  const config = readGenerationWorkerConfig({
    FLOWPACK_WORKER_SECRET: secret,
    FLOWPACK_WORKER_URL: runtime.endpoint,
    FLOWPACK_WORKER_ID: "worker-test-1",
  });
  const result = await runGenerationWorkerIteration(config);

  assert.equal(result, "processed");
  assert.deepEqual(requests, [{
    method: "POST",
    authorization: `Bearer ${secret}`,
    workerId: "worker-test-1",
  }]);
});

test("empty queue waits with the idle delay", async (context) => {
  const runtime = await listen((_request, response) => {
    response.writeHead(204);
    response.end();
  });
  context.after(runtime.close);
  const waits = [];
  const config = readGenerationWorkerConfig({
    FLOWPACK_WORKER_SECRET: secret,
    FLOWPACK_WORKER_URL: runtime.endpoint,
  });

  const result = await runGenerationWorkerIteration(config, {
    wait: async (milliseconds) => { waits.push(milliseconds); },
  });

  assert.equal(result, "idle");
  assert.deepEqual(waits, [DEFAULT_IDLE_DELAY_MS]);
});

test("HTTP failure consumes the response and applies error backoff without logging secrets", async (context) => {
  const runtime = await listen((_request, response) => {
    response.writeHead(503, { "content-type": "text/plain" });
    response.end("temporarily unavailable");
  });
  context.after(runtime.close);
  const waits = [];
  const logs = [];
  const config = readGenerationWorkerConfig({
    FLOWPACK_WORKER_SECRET: secret,
    FLOWPACK_WORKER_URL: runtime.endpoint,
  });

  const result = await runGenerationWorkerIteration(config, {
    wait: async (milliseconds) => { waits.push(milliseconds); },
    logger: { error: (...values) => logs.push(values.join(" ")) },
  });

  assert.equal(result, "error");
  assert.deepEqual(waits, [DEFAULT_ERROR_DELAY_MS]);
  assert.match(logs.join("\n"), /status 503/);
  assert.doesNotMatch(logs.join("\n"), new RegExp(secret));
});
