import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("NAS Compose selects private NAS storage and mounts it", async () => {
  const [compose, env] = await Promise.all([
    read("docker-compose.nas.yml"),
    read("ops/nas/env.example"),
  ]);

  assert.match(compose, /^      FLOWPACK_STORAGE_DRIVER: nas$/m);
  assert.match(compose, /^      FLOWPACK_STORAGE_ROOT: \/app\/data\/media$/m);
  assert.match(compose, /^      - \$\{FLOWPACK_DATA_ROOT\}\/media:\/app\/data\/media$/m);
  assert.match(env, /^FLOWPACK_STORAGE_DRIVER=nas$/m);
});

test("browser uploads only to the authenticated application endpoint", async () => {
  const client = await read("app/(app)/media/media-client.tsx");
  assert.doesNotMatch(client, /api\.cloudinary\.com/);
  assert.doesNotMatch(client, /NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET/);
  assert.match(client, /fetch\("\/api\/media\/upload"/);
});

test("untrusted client-side storage result endpoint is retired", async () => {
  const route = await read("app/api/media/save/route.ts");
  assert.match(route, /status:\s*410/);
  assert.doesNotMatch(route, /prisma\.mediaFile\.create/);
});

test("NAS media downloads require authentication and ownership", async () => {
  const route = await read("app/api/media/\[id\]/content/route.ts");
  assert.match(route, /await auth\(\)/);
  assert.match(route, /userId:\s*session\.user\.id/);
  assert.match(route, /readStoredObject/);
});

test("content-addressed migrated media has a real private serving route", async () => {
  const [route, migration] = await Promise.all([
    read("app/api/nas-owned-media/[...key]/route.ts"),
    read("scripts/nas-media-migration.mjs"),
  ]);
  assert.match(route, /isMigratedNasObjectKey/);
  assert.match(route, /readNasObject/);
  assert.match(route, /await auth\(\)/);
  assert.match(route, /userOwnsNasObjectReference/);
  assert.match(route, /status: 401/);
  assert.match(route, /status: 404/);
  assert.match(route, /Cache-Control["']?:\s*["']private, no-store/);
  assert.match(migration, /`\/api\/nas-owned-media\/\$\{nasKey\}`/);
});
