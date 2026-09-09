import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const compose = readFileSync(new URL("../docker-compose.nas.yml", import.meta.url), "utf8");
const envTemplate = readFileSync(new URL("../ops/nas/env.example", import.meta.url), "utf8");
const dbEnvTemplate = readFileSync(new URL("../ops/nas/db.env.example", import.meta.url), "utf8");
const roleBootstrap = readFileSync(
  new URL("../ops/nas/postgres/10-flowpack-runtime-roles.sh", import.meta.url),
  "utf8",
);
const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
const repositoryIgnore = readFileSync(new URL("../../.gitignore", import.meta.url), "utf8");

function serviceBlock(name) {
  const lines = compose.split("\n");
  const start = lines.findIndex((line) => line === `  ${name}:`);
  assert.notEqual(start, -1, `missing ${name} service`);

  const end = lines.findIndex(
    (line, index) => index > start && /^  [A-Za-z0-9_-]+:$/.test(line),
  );
  return lines.slice(start, end === -1 ? undefined : end).join("\n");
}

test("keeps PostgreSQL private and binds the web service to loopback", () => {
  const database = serviceBlock("db");
  const web = serviceBlock("web");

  assert.doesNotMatch(database, /^    ports:/m);
  assert.match(web, /^    ports:\n      - 127\.0\.0\.1:\$\{FLOWPACK_NAS_HTTP_PORT\}:3000$/m);
  assert.match(compose, /^  database:\n    internal: true$/m);
  assert.doesNotMatch(compose, /privileged:\s*true/);
});

test("uses a fixed project identity and disables public callbacks and scheduler by default", () => {
  assert.match(envTemplate, /^COMPOSE_PROJECT_NAME=flowpack-nas$/m);
  assert.match(envTemplate, /^FLOWPACK_PUBLIC_CALLBACKS_ENABLED=false$/m);
  assert.match(envTemplate, /^FLOWPACK_SCHEDULER_ENABLED=false$/m);
  assert.match(compose, /^      FLOWPACK_PUBLIC_CALLBACKS_ENABLED: "false"$/m);
  assert.doesNotMatch(compose, /^  scheduler:$/m);
});

test("all NAS runtime role and operator environment variants stay outside Git", () => {
  assert.match(repositoryIgnore, /^app\/\.env\.nas\*\.local$/m);
  for (const privateName of [
    ".env.nas.local",
    ".env.nas.db.local",
    ".env.nas.ro.local",
    ".env.nas.rw.local",
    ".env.nas-operator.local",
  ]) {
    assert.ok(privateName.startsWith(".env.nas") && privateName.endsWith(".local"));
  }
});

test("destination starts with an exact read-only application and database role pair", () => {
  assert.match(envTemplate, /^FLOWPACK_WRITE_MODE=read-only$/m);
  assert.match(envTemplate, /^DATABASE_URL=postgresql:\/\/flowpack_app_ro:/m);
  assert.doesNotMatch(envTemplate, /^DATABASE_URL=postgresql:\/\/flowpack_(?:owner|app_rw):/m);
  assert.match(compose, /^      FLOWPACK_WRITE_MODE: \$\{FLOWPACK_WRITE_MODE:-read-only\}$/m);
});

test("database bootstrap creates separate owner, read-write and read-only boundaries", () => {
  assert.match(dbEnvTemplate, /^POSTGRES_USER=flowpack_owner$/m);
  assert.match(dbEnvTemplate, /^FLOWPACK_APP_RW_DB_PASSWORD=/m);
  assert.match(dbEnvTemplate, /^FLOWPACK_APP_RO_DB_PASSWORD=/m);
  assert.doesNotMatch(dbEnvTemplate, /replace_with_app_secret/);

  assert.match(compose, /10-flowpack-runtime-roles\.sh:ro/);
  assert.match(roleBootstrap, /CREATE ROLE flowpack_app_rw/);
  assert.match(roleBootstrap, /CREATE ROLE flowpack_app_ro/);
  assert.match(roleBootstrap, /GRANT SELECT, INSERT, UPDATE, DELETE/);
  assert.match(roleBootstrap, /GRANT SELECT ON ALL TABLES/);
  assert.match(roleBootstrap, /ALTER ROLE flowpack_app_ro SET default_transaction_read_only = on/);
  assert.match(roleBootstrap, /NOBYPASSRLS/);
  assert.match(roleBootstrap, /REVOKE EXECUTE ON ALL FUNCTIONS/);
  assert.doesNotMatch(roleBootstrap, /GRANT .*?(?:INSERT|UPDATE|DELETE).*?flowpack_app_ro/);
  assert.doesNotMatch(roleBootstrap, /--set=(?:rw|ro)_password/);
  assert.doesNotMatch(roleBootstrap, /replace_with|generated_(?:owner|app)_secret/);
});

test("middleware covers API handlers and delegates authentication only after the write gate", () => {
  assert.match(middleware, /shouldBlockRouteRequest/);
  assert.match(middleware, /MAINTENANCE_READ_ONLY/);
  assert.match(middleware, /authenticatedMiddleware\(request, event\)/);
  assert.match(middleware, /matcher:[\s\S]*_next\/static/);
  assert.doesNotMatch(middleware, /\(\?!api\|/);
  assert.ok(
    middleware.indexOf("shouldBlockRouteRequest(") <
      middleware.indexOf("authenticatedMiddleware(request, event)"),
  );
});
