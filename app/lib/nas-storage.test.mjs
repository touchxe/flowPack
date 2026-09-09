import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  deleteNasObject,
  isMigratedNasObjectKey,
  mimeTypeForNasObjectKey,
  readNasObject,
  resolveNasObject,
  storeNasObject,
} from "./nas-storage.mjs";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function storageRoot() {
  return mkdtemp(join(tmpdir(), "flowpack-storage-test-"));
}

test("stores a verified object under an opaque key with mode 0600", async () => {
  const root = await storageRoot();
  const result = await storeNasObject({
    root,
    ownerId: "private-user-identifier",
    buffer: PNG_1X1,
    mimeType: "image/png",
  });

  assert.match(result.key, /^[a-f0-9]{16}\/[0-9a-f-]{36}\.png$/);
  assert.equal(result.key.includes("private-user-identifier"), false);
  assert.equal(result.bytes, PNG_1X1.length);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);

  const path = await resolveNasObject({ root, key: result.key });
  assert.deepEqual(await readFile(path), PNG_1X1);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
});

test("rejects a claimed MIME type that does not match the file signature", async () => {
  const root = await storageRoot();
  await assert.rejects(
    storeNasObject({
      root,
      ownerId: "owner",
      buffer: Buffer.from("this is not a png"),
      mimeType: "image/png",
    }),
    /signature/i,
  );
});

test("rejects SVG and other active or unsupported content", async () => {
  const root = await storageRoot();
  await assert.rejects(
    storeNasObject({
      root,
      ownerId: "owner",
      buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"),
      mimeType: "image/svg+xml",
    }),
    /unsupported/i,
  );
});

test("rejects traversal and non-canonical object keys", async () => {
  const root = await storageRoot();
  for (const key of ["../secret", "/absolute/file", "bucket/../../secret", "bucket/file.png"]) {
    await assert.rejects(resolveNasObject({ root, key }), /object key/i);
  }
});

test("reads a content-addressed migration object through the runtime key contract", async () => {
  const root = await storageRoot();
  const digest = createHash("sha256").update(PNG_1X1).digest("hex");
  const key = `objects/${digest.slice(0, 2)}/${digest}.png`;
  const bucket = join(root, "objects", digest.slice(0, 2));
  await mkdir(bucket, { recursive: true, mode: 0o700 });
  await writeFile(join(root, key), PNG_1X1, { mode: 0o600 });

  assert.equal(isMigratedNasObjectKey(key), true);
  assert.equal(mimeTypeForNasObjectKey(key), "image/png");
  const stored = await readNasObject({ root, key });
  assert.deepEqual(stored.buffer, PNG_1X1);
  assert.equal(stored.size, PNG_1X1.length);

  for (const invalid of [
    `objects/ff/${digest}.png`,
    `objects/${digest.slice(0, 2)}/${"0".repeat(64)}.png`,
    `objects/${digest.slice(0, 2)}/${digest}.svg`,
  ]) {
    assert.equal(isMigratedNasObjectKey(invalid), false);
    await assert.rejects(resolveNasObject({ root, key: invalid }), /object key/i);
  }
});

test("rejects a storage root reached through a symlink", async () => {
  const base = await storageRoot();
  const realRoot = await storageRoot();
  const linkedRoot = join(base, "linked-root");
  await symlink(realRoot, linkedRoot);

  await assert.rejects(
    storeNasObject({
      root: linkedRoot,
      ownerId: "owner",
      buffer: PNG_1X1,
      mimeType: "image/png",
    }),
    /symlink/i,
  );
});

test("deletes only canonical regular files within the storage root", async () => {
  const root = await storageRoot();
  const result = await storeNasObject({
    root,
    ownerId: "owner",
    buffer: PNG_1X1,
    mimeType: "image/png",
  });

  assert.equal(await deleteNasObject({ root, key: result.key }), true);
  assert.equal(await deleteNasObject({ root, key: result.key }), false);
});
