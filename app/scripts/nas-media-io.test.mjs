import assert from "node:assert/strict";
import { chmod, link, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  MediaIoError,
  createNasMediaOperatorIo,
  createNasStagedObjectReader,
  readPrivateMediaKey,
} from "./nas-media-io.mjs";

const DIGEST = "a".repeat(64);
const KEY = `objects/aa/${DIGEST}.png`;
const BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function expectCode(code) {
  return (error) => {
    assert.ok(error instanceof MediaIoError);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    return true;
  };
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "flowpack-media-io-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await chmod(root, 0o700);
  const bucket = join(root, "objects", "aa");
  await mkdir(bucket, { recursive: true, mode: 0o700 });
  await chmod(join(root, "objects"), 0o700);
  await chmod(bucket, 0o700);
  const objectPath = join(bucket, `${DIGEST}.png`);
  await writeFile(objectPath, BYTES, { mode: 0o600 });
  await chmod(objectPath, 0o600);
  const keyPath = join(root, "rollback-key.bin");
  await writeFile(keyPath, Buffer.alloc(32, 7), { mode: 0o600 });
  await chmod(keyPath, 0o600);
  return { root, bucket, keyPath, objectPath };
}

test("operator IO reads only an exact private key and a contained staged object", async (t) => {
  const prepared = await fixture(t);
  const rollbackKey = await readPrivateMediaKey(prepared.keyPath);
  assert.equal(rollbackKey.length, 32);
  const objectReader = await createNasStagedObjectReader({ storageRoot: prepared.root });
  const object = await objectReader(KEY);
  assert.deepEqual(object, { buffer: BYTES, size: BYTES.length });
  const combined = await createNasMediaOperatorIo({
    rollbackKeyPath: prepared.keyPath,
    storageRoot: prepared.root,
  });
  assert.equal(combined.rollbackKey.length, 32);
  assert.deepEqual(await combined.objectReader(KEY), object);
});

test("operator IO rejects loose modes, symlinks, traversal and shell-shaped keys", async (t) => {
  const prepared = await fixture(t);
  await chmod(prepared.keyPath, 0o644);
  await assert.rejects(readPrivateMediaKey(prepared.keyPath), expectCode("MEDIA_KEY_UNSAFE"));
  await chmod(prepared.keyPath, 0o600);

  const linkedKey = join(prepared.root, "linked-key.bin");
  await symlink(prepared.keyPath, linkedKey);
  await assert.rejects(readPrivateMediaKey(linkedKey), expectCode("MEDIA_KEY_UNSAFE"));

  const hardlinkedKey = join(prepared.root, "hardlinked-key.bin");
  await link(prepared.keyPath, hardlinkedKey);
  await assert.rejects(readPrivateMediaKey(prepared.keyPath), expectCode("MEDIA_KEY_UNSAFE"));

  const reader = await createNasStagedObjectReader({ storageRoot: prepared.root });
  for (const hostile of [
    `../${KEY}`,
    `/tmp/${KEY}`,
    `${KEY};touch /tmp/pwned`,
    `objects/aa/$(${DIGEST}).png`,
    `objects/../aa/${DIGEST}.png`,
  ]) {
    await assert.rejects(reader(hostile), expectCode("STAGED_OBJECT_KEY_INVALID"));
  }

  const linkedBucket = join(prepared.root, "objects", "bb");
  await mkdir(linkedBucket, { mode: 0o700 });
  await chmod(linkedBucket, 0o700);
  const linkedObject = join(linkedBucket, `${"b".repeat(64)}.png`);
  await symlink(prepared.objectPath, linkedObject);
  await assert.rejects(
    reader(`objects/bb/${"b".repeat(64)}.png`),
    expectCode("STAGED_OBJECT_UNSAFE"),
  );
});
