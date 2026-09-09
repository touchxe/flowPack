import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  MediaArtifactHandleError,
  beginSealedMediaArtifact,
  recoverSealedMediaArtifact,
  withSealedMediaArtifact,
} from "./nas-media-artifact-handle.mjs";
import {
  nasOwnedMediaReplacement,
  prepareOwnedMediaMigration,
} from "./nas-media-migration.mjs";

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const PRIVATE_SOURCE = `data:image/png;base64,${PNG.toString("base64")}`;
const KEY = Buffer.alloc(32, 41);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function binding(overrides = {}) {
  return {
    candidateDatabaseNameSha256: "1".repeat(64),
    databaseBindingAttestationSha256: "2".repeat(64),
    migrationId: "11111111-2222-4333-8444-555555555555",
    projectId: "flowpack-nas",
    releaseCommit: "a".repeat(40),
    remoteLockIdentitySha256: "3".repeat(64),
    sourceFreezeReceiptSha256: "4".repeat(64),
    sourceSnapshotEvidenceSha256: "5".repeat(64),
    ...overrides,
  };
}

function expectCode(code) {
  return (error) => {
    assert.ok(error instanceof MediaArtifactHandleError || error?.code === code);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    assert.equal(error.message.includes(PRIVATE_SOURCE), false);
    return true;
  };
}

function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "flowpack-media-handle-")));
  chmodSync(root, 0o700);
  t.after(() => rmSync(root, { force: true, recursive: true }));
  const storageRoot = join(root, "storage");
  const controlRoot = join(root, "control");
  mkdirSync(storageRoot, { mode: 0o700 });
  mkdirSync(controlRoot, { mode: 0o700 });
  return {
    binding: binding(),
    controlRoot,
    handlePath: join(controlRoot, "media-artifact.handle"),
    root,
    storageRoot,
  };
}

function options(prepared, reviewer) {
  return {
    artifactHandle: {
      binding: prepared.binding,
      handlePath: prepared.handlePath,
      key: KEY,
    },
    policy: {
      allowedMimeTypes: ["image/png"],
      approvedSources: [{
        approvalId: "owned-inline",
        classification: "data",
        hosts: [],
        owned: true,
        pathPrefixes: [],
      }],
      maxBytes: 1024,
      policyId: "owned-v1",
      replacementFor: nasOwnedMediaReplacement,
      rewritePolicyId: "nas-v1",
    },
    records: {
      contentImages: [],
      contents: [],
      mediaFiles: [{
        blobKey: "legacy/private.png",
        id: "private-media",
        mimeType: "image/png",
        size: PNG.length,
        url: PRIVATE_SOURCE,
        userId: "private-user",
      }],
    },
    reviewer,
    rollbackKey: KEY,
    storageRoot: prepared.storageRoot,
  };
}

async function prepareFixture(t) {
  const prepared = fixture(t);
  let reviewCalls = 0;
  const result = await prepareOwnedMediaMigration(options(prepared, async (review) => {
    reviewCalls += 1;
    return {
      approved: true,
      reviewDigest: review.reviewDigest,
      reviewedAt: "2026-08-24T00:00:00.000Z",
      reviewerId: "private-reviewer",
    };
  }));
  return { ...prepared, result, reviewCalls };
}

test("a sealed handle resumes the private random artifact without exposing its locator", async (t) => {
  const prepared = await prepareFixture(t);
  assert.match(prepared.result.artifactHandleSha256, /^[a-f0-9]{64}$/);
  assert.equal(prepared.reviewCalls, 1);
  assert.equal(JSON.stringify(prepared.result).includes(prepared.root), false);
  assert.equal(JSON.stringify(prepared.result).includes(PRIVATE_SOURCE), false);
  assert.equal(existsSync(prepared.handlePath), true);

  const migrationsRoot = join(prepared.storageRoot, ".nas-media-migrations");
  const artifactRoot = join(migrationsRoot, readdirSync(migrationsRoot)[0]);
  await beginSealedMediaArtifact({
    artifactDirectory: artifactRoot,
    binding: prepared.binding,
  });

  let replayReviewCalls = 0;
  const replay = await prepareOwnedMediaMigration(options(prepared, async () => {
    replayReviewCalls += 1;
    throw new Error("must not review a sealed replay");
  }));
  assert.equal(replayReviewCalls, 0);
  assert.equal(replay.artifactHandleSha256, prepared.result.artifactHandleSha256);
  assert.deepEqual(replay.evidence, prepared.result.evidence);
  assert.equal(existsSync(join(artifactRoot, ".artifact-incomplete.json")), false);

  const consumed = await withSealedMediaArtifact({
    binding: prepared.binding,
    consume: async (artifact) => ({
      manifestSha256: sha256(readFileSync(artifact.manifestPath)),
      ok: true,
    }),
    expectedHandleSha256: prepared.result.artifactHandleSha256,
    handlePath: prepared.handlePath,
    key: KEY,
    storageRoot: prepared.storageRoot,
  });
  assert.deepEqual(consumed, {
    manifestSha256: prepared.result.evidence.manifestSha256,
    ok: true,
  });
  assert.equal(JSON.stringify(consumed).includes(prepared.root), false);
});

test("binding mismatch, symlink handles, hardlinked artifacts, and changed handles fail closed", async (t) => {
  const prepared = await prepareFixture(t);
  await assert.rejects(
    recoverSealedMediaArtifact({
      binding: binding({ remoteLockIdentitySha256: "9".repeat(64) }),
      handlePath: prepared.handlePath,
      key: KEY,
      storageRoot: prepared.storageRoot,
    }),
    expectCode("MEDIA_ARTIFACT_HANDLE_INVALID"),
  );

  const migrationsRoot = join(prepared.storageRoot, ".nas-media-migrations");
  const artifactRoot = join(migrationsRoot, readdirSync(migrationsRoot)[0]);
  const manifestPath = join(artifactRoot, "manifest.json");
  linkSync(manifestPath, join(artifactRoot, "manifest-hardlink"));
  await assert.rejects(
    withSealedMediaArtifact({
      binding: prepared.binding,
      consume: async () => ({ ok: true }),
      expectedHandleSha256: prepared.result.artifactHandleSha256,
      handlePath: prepared.handlePath,
      key: KEY,
      storageRoot: prepared.storageRoot,
    }),
    expectCode("MEDIA_ARTIFACT_FILE_INVALID"),
  );
  unlinkSync(join(artifactRoot, "manifest-hardlink"));

  const originalHandle = readFileSync(prepared.handlePath);
  unlinkSync(prepared.handlePath);
  const externalHandle = join(prepared.root, "external-handle");
  writeFileSync(externalHandle, originalHandle, { mode: 0o600 });
  symlinkSync(externalHandle, prepared.handlePath);
  await assert.rejects(
    recoverSealedMediaArtifact({
      binding: prepared.binding,
      handlePath: prepared.handlePath,
      key: KEY,
      storageRoot: prepared.storageRoot,
    }),
    expectCode("MEDIA_ARTIFACT_HANDLE_INVALID"),
  );
});

test("a completed artifact can recover after a handle-write crash and matching incomplete work is cleaned", async (t) => {
  const prepared = await prepareFixture(t);
  unlinkSync(prepared.handlePath);
  const orphan = join(prepared.storageRoot, ".nas-media-migrations", randomUUID());
  mkdirSync(orphan, { mode: 0o700 });
  await beginSealedMediaArtifact({ artifactDirectory: orphan, binding: prepared.binding });

  const recovered = await recoverSealedMediaArtifact({
    binding: prepared.binding,
    handlePath: prepared.handlePath,
    key: KEY,
    storageRoot: prepared.storageRoot,
  });
  assert.equal(recovered.ok, true);
  assert.equal(recovered.resumed, true);
  assert.match(recovered.artifactHandleSha256, /^[a-f0-9]{64}$/);
  assert.equal(existsSync(orphan), false);
});

test("multiple completed artifacts for one binding are rejected instead of guessed", async (t) => {
  const prepared = await prepareFixture(t);
  const migrationsRoot = join(prepared.storageRoot, ".nas-media-migrations");
  const original = join(migrationsRoot, readdirSync(migrationsRoot)[0]);
  const duplicate = join(migrationsRoot, randomUUID());
  cpSync(original, duplicate, { recursive: true, preserveTimestamps: true });
  chmodSync(duplicate, 0o700);
  for (const name of readdirSync(duplicate)) {
    const path = join(duplicate, name);
    if (!name.startsWith("." ) || name.endsWith(".json")) chmodSync(path, 0o600);
  }
  await assert.rejects(
    recoverSealedMediaArtifact({
      binding: prepared.binding,
      handlePath: prepared.handlePath,
      key: KEY,
      storageRoot: prepared.storageRoot,
    }),
    expectCode("MEDIA_ARTIFACT_RECOVERY_COLLISION"),
  );
});
