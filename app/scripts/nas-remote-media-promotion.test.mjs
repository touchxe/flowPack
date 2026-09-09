import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createNasStagedObjectReader } from "./nas-media-io.mjs";
import {
  MEDIA_PROJECT_ID,
  canonicalMediaJson,
  mediaCandidateIdentitySha256,
  mediaSha256,
} from "./nas-media-contract.mjs";
import {
  nasOwnedMediaReplacement,
  prepareOwnedMediaMigration,
} from "./nas-media-migration.mjs";
import { createMediaTransferBundle } from "./nas-media-transfer-bundle.mjs";
import {
  mediaRemoteLockIdentitySha256,
  receiveRemoteMediaBundle,
} from "./nas-remote-media-transfer.mjs";
import {
  RemoteMediaPromotionError,
  promoteRemoteMediaCandidate,
  recordRemoteMediaCandidateRewrite,
} from "./nas-remote-media-promotion.mjs";

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const PRIVATE_SOURCE = `data:image/png;base64,${PNG.toString("base64")}`;
const MIGRATION_ID = "11111111-2222-4333-8444-555555555555";
const RELEASE_COMMIT = "a".repeat(40);
const TOKEN_DIGEST = "b".repeat(64);
const PREPARATION_REPORT_DIGEST = "c".repeat(64);
const MEDIA_GENERATION_DIGEST = "d".repeat(64);
const CANDIDATE_DATABASE = "flowpack_candidate_0123456789ab";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function writeCanonical(path, value) {
  writeFileSync(path, `${canonicalMediaJson(value)}\n`, { mode: 0o600 });
}

function expectCode(code) {
  return (error) => {
    assert.ok(error instanceof RemoteMediaPromotionError);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    assert.equal(error.message.includes(PRIVATE_SOURCE), false);
    return true;
  };
}

function databaseLockState(overrides = {}) {
  return {
    candidateDatabase: CANDIDATE_DATABASE,
    evidenceDigest: "e".repeat(64),
    migrationId: MIGRATION_ID,
    phase: "CANDIDATE_RESTORED",
    previousDatabase: "flowpack_precutover_0123456789ab",
    projectId: "flowpack-nas",
    releaseCommit: RELEASE_COMMIT,
    rollbackReportDigest: null,
    schemaVersion: 1,
    tokenDigest: TOKEN_DIGEST,
    ...overrides,
  };
}

async function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "flowpack-media-promotion-")));
  chmodSync(root, 0o700);
  t.after(() => rmSync(root, { force: true, recursive: true }));
  const projectRoot = join(root, "project");
  const stateRoot = join(projectRoot, "state");
  const lockRoot = join(stateRoot, "database-migration.lock");
  const mediaRoot = join(projectRoot, "media");
  for (const path of [
    projectRoot,
    join(projectRoot, "releases"),
    join(projectRoot, "releases", RELEASE_COMMIT),
    stateRoot,
    lockRoot,
    join(stateRoot, "media-incoming"),
    mediaRoot,
    join(mediaRoot, "objects"),
    join(mediaRoot, "candidates"),
  ]) mkdirSync(path, { mode: 0o700 });
  writeFileSync(join(projectRoot, ".nas-project-id"), "flowpack-nas\n", { mode: 0o600 });
  symlinkSync(`releases/${RELEASE_COMMIT}`, join(projectRoot, "current"));
  const lockState = databaseLockState();
  writeCanonical(join(lockRoot, "state.json"), lockState);
  const remoteLockIdentitySha256 = mediaRemoteLockIdentitySha256(lockState);

  const storageRoot = join(root, "source-media");
  const bundleRoot = join(root, "bundle");
  mkdirSync(storageRoot, { mode: 0o700 });
  mkdirSync(bundleRoot, { mode: 0o700 });
  const prepared = await prepareOwnedMediaMigration({
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
    reviewer: async (review) => ({
      approved: true,
      reviewDigest: review.reviewDigest,
      reviewedAt: "2026-08-24T00:00:00.000Z",
      reviewerId: "private-reviewer",
    }),
    rollbackKey: Buffer.alloc(32, 7),
    storageRoot,
  });
  const artifactName = readdirSync(join(storageRoot, ".nas-media-migrations"))[0];
  const bundle = await createMediaTransferBundle({
    bundleDirectory: bundleRoot,
    manifestPath: join(storageRoot, ".nas-media-migrations", artifactName, "manifest.json"),
    manifestSha256: prepared.evidence.manifestSha256,
    migrationId: MIGRATION_ID,
    objectReader: await createNasStagedObjectReader({ storageRoot }),
    releaseCommit: RELEASE_COMMIT,
    remoteLockIdentitySha256,
  });
  const incoming = join(
    stateRoot,
    "media-incoming",
    MIGRATION_ID,
  );
  mkdirSync(incoming, { mode: 0o700 });
  copyFileSync(bundle.bundlePath, join(incoming, `${bundle.bundleSha256}.bundle`));
  chmodSync(join(incoming, `${bundle.bundleSha256}.bundle`), 0o600);
  const remote = receiveRemoteMediaBundle({
    bundleSha256: bundle.bundleSha256,
    confirmation:
      `flowpack-nas:${MIGRATION_ID}:receive-media:${bundle.bundleSha256}`,
    migrationId: MIGRATION_ID,
    projectId: "flowpack-nas",
    projectRoot,
    releaseCommit: RELEASE_COMMIT,
    tokenDigest: TOKEN_DIGEST,
  });
  const candidateDatabaseNameSha256 = mediaSha256(CANDIDATE_DATABASE);
  const candidateIdentitySha256 = mediaCandidateIdentitySha256({
    candidateDatabaseNameSha256,
    migrationId: MIGRATION_ID,
    projectId: MEDIA_PROJECT_ID,
    remoteLockIdentitySha256,
  });
  const rewrite = recordRemoteMediaCandidateRewrite({
    candidateAttestationSha256: "f".repeat(64),
    candidateDatabaseNameSha256,
    candidateIdentitySha256,
    candidateRewriteExecutionDigest: "1".repeat(64),
    confirmation:
      `flowpack-nas:${MIGRATION_ID}:record-media-rewrite:${"1".repeat(64)}`,
    mediaEvidenceManifestSha256: prepared.evidence.manifestSha256,
    mediaGenerationDigest: MEDIA_GENERATION_DIGEST,
    migrationId: MIGRATION_ID,
    objectBytes: remote.objectBytes,
    objectsVerified: remote.filesVerified,
    operationsVerified: 1,
    preparationReportDigest: PREPARATION_REPORT_DIGEST,
    projectId: "flowpack-nas",
    projectRoot,
    releaseCommit: RELEASE_COMMIT,
    remoteLockIdentitySha256,
    tokenDigest: TOKEN_DIGEST,
  });
  const input = {
    bundleSha256: bundle.bundleSha256,
    candidateRewriteReceiptSha256: rewrite.candidateRewriteReceiptSha256,
    candidateVerificationSha256: remote.candidateVerificationSha256,
    completionReceiptSha256: remote.completionReceiptSha256,
    confirmation:
      `flowpack-nas:${MIGRATION_ID}:promote-media:${MEDIA_GENERATION_DIGEST}`,
    mediaEvidenceManifestSha256: prepared.evidence.manifestSha256,
    mediaGenerationDigest: MEDIA_GENERATION_DIGEST,
    migrationId: MIGRATION_ID,
    preparationReportDigest: PREPARATION_REPORT_DIGEST,
    projectId: "flowpack-nas",
    projectRoot,
    releaseCommit: RELEASE_COMMIT,
    tokenDigest: TOKEN_DIGEST,
    transferManifestSha256: bundle.transferManifestSha256,
  };
  const candidateManifest = JSON.parse(readFileSync(join(
    mediaRoot,
    "candidates",
    MIGRATION_ID,
    ".transfer-manifest.json",
  ), "utf8"));
  return {
    candidateManifest,
    input,
    lockRoot,
    mediaRoot,
    projectRoot,
    remoteLockIdentitySha256,
    root,
  };
}

function canonicalPath(prepared) {
  const object = prepared.candidateManifest.objects[0];
  return join(prepared.mediaRoot, ...object.key.split("/"));
}

function candidatePath(prepared) {
  const object = prepared.candidateManifest.objects[0];
  return join(
    prepared.mediaRoot,
    "candidates",
    MIGRATION_ID,
    ...object.key.split("/"),
  );
}

test("candidate objects publish additively with full readback and a durable rewrite-bound receipt", async (t) => {
  const prepared = await fixture(t);
  const first = promoteRemoteMediaCandidate(prepared.input);
  assert.equal(first.ok, true);
  assert.equal(first.idempotent, false);
  assert.equal(first.canonicalObjectsVerified, true);
  assert.equal(first.remoteLockIdentitySha256, prepared.remoteLockIdentitySha256);
  assert.match(first.canonicalVerificationSha256, /^[a-f0-9]{64}$/);
  assert.match(first.promotionReceiptSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(readFileSync(canonicalPath(prepared)), PNG);
  assert.equal(existsSync(candidatePath(prepared)), true);
  assert.equal(JSON.stringify(first).includes(prepared.projectRoot), false);
  assert.equal(JSON.stringify(first).includes(PRIVATE_SOURCE), false);
  const receipt = JSON.parse(readFileSync(join(
    prepared.lockRoot,
    "media-canonical-promotion.json",
  ), "utf8"));
  assert.equal(receipt.additiveOnly, true);
  assert.equal(receipt.overwritesPerformed, 0);
  assert.equal(receipt.deletesPerformed, 0);
  assert.equal(receipt.candidateRewriteReceiptSha256, prepared.input.candidateRewriteReceiptSha256);

  const replay = promoteRemoteMediaCandidate(prepared.input);
  assert.equal(replay.idempotent, true);
  assert.equal(replay.promotionReceiptSha256, first.promotionReceiptSha256);
});

test("an exact canonical object is reused, while conflicting bytes, symlinks, and hardlinks never overwrite", async (t) => {
  await t.test("exact object", async (t) => {
    const prepared = await fixture(t);
    const object = prepared.candidateManifest.objects[0];
    const bucket = join(prepared.mediaRoot, "objects", object.sha256.slice(0, 2));
    mkdirSync(bucket, { mode: 0o700 });
    copyFileSync(candidatePath(prepared), canonicalPath(prepared));
    chmodSync(canonicalPath(prepared), 0o600);
    const before = readFileSync(canonicalPath(prepared));
    const result = promoteRemoteMediaCandidate(prepared.input);
    assert.equal(result.ok, true);
    assert.deepEqual(readFileSync(canonicalPath(prepared)), before);
  });

  await t.test("conflicting bytes", async (t) => {
    const prepared = await fixture(t);
    const object = prepared.candidateManifest.objects[0];
    const bucket = join(prepared.mediaRoot, "objects", object.sha256.slice(0, 2));
    mkdirSync(bucket, { mode: 0o700 });
    writeFileSync(canonicalPath(prepared), Buffer.alloc(PNG.length, 9), { mode: 0o600 });
    const before = readFileSync(canonicalPath(prepared));
    assert.throws(
      () => promoteRemoteMediaCandidate(prepared.input),
      expectCode("MEDIA_CANONICAL_OBJECT_CONFLICT"),
    );
    assert.deepEqual(readFileSync(canonicalPath(prepared)), before);
  });

  await t.test("symlink and hardlink", async (t) => {
    const symlinked = await fixture(t);
    const object = symlinked.candidateManifest.objects[0];
    const bucket = join(symlinked.mediaRoot, "objects", object.sha256.slice(0, 2));
    mkdirSync(bucket, { mode: 0o700 });
    symlinkSync(candidatePath(symlinked), canonicalPath(symlinked));
    assert.throws(
      () => promoteRemoteMediaCandidate(symlinked.input),
      expectCode("MEDIA_CANONICAL_OBJECT_CONFLICT"),
    );

    const hardlinked = await fixture(t);
    const hardObject = hardlinked.candidateManifest.objects[0];
    const hardBucket = join(hardlinked.mediaRoot, "objects", hardObject.sha256.slice(0, 2));
    mkdirSync(hardBucket, { mode: 0o700 });
    linkSync(candidatePath(hardlinked), canonicalPath(hardlinked));
    assert.throws(
      () => promoteRemoteMediaCandidate(hardlinked.input),
      expectCode("MEDIA_CANONICAL_OBJECT_CONFLICT"),
    );
  });
});

test("a crash after additive link but before temporary unlink resumes without deleting canonical data", async (t) => {
  const prepared = await fixture(t);
  const object = prepared.candidateManifest.objects[0];
  const bucket = join(prepared.mediaRoot, "objects", object.sha256.slice(0, 2));
  const stagingParent = join(prepared.mediaRoot, ".promotion-staging");
  const staging = join(stagingParent, MIGRATION_ID);
  mkdirSync(bucket, { mode: 0o700 });
  mkdirSync(stagingParent, { mode: 0o700 });
  mkdirSync(staging, { mode: 0o700 });
  const temporary = join(staging, `${object.sha256}.tmp`);
  copyFileSync(candidatePath(prepared), temporary);
  chmodSync(temporary, 0o600);
  linkSync(temporary, canonicalPath(prepared));
  assert.equal(lstatSync(canonicalPath(prepared)).nlink, 2);

  const result = promoteRemoteMediaCandidate(prepared.input);
  assert.equal(result.ok, true);
  assert.equal(lstatSync(canonicalPath(prepared)).nlink, 1);
  assert.deepEqual(readFileSync(canonicalPath(prepared)), PNG);
  assert.equal(existsSync(temporary), false);
});

test("rewrite, candidate, lock, and existing receipt identities are exact fail-closed gates", async (t) => {
  await t.test("rewrite receipt digest", async (t) => {
    const prepared = await fixture(t);
    assert.throws(
      () => promoteRemoteMediaCandidate({
        ...prepared.input,
        candidateRewriteReceiptSha256: "9".repeat(64),
      }),
      expectCode("MEDIA_PROMOTION_REWRITE_RECEIPT_INVALID"),
    );
    assert.equal(existsSync(canonicalPath(prepared)), false);
  });

  await t.test("candidate verification", async (t) => {
    const prepared = await fixture(t);
    assert.throws(
      () => promoteRemoteMediaCandidate({
        ...prepared.input,
        candidateVerificationSha256: "9".repeat(64),
      }),
      expectCode("MEDIA_PROMOTION_CANDIDATE_INVALID"),
    );
  });

  await t.test("remote lock phase", async (t) => {
    const prepared = await fixture(t);
    writeCanonical(join(prepared.lockRoot, "state.json"), databaseLockState({ phase: "LIVE_RENAMED" }));
    assert.throws(
      () => promoteRemoteMediaCandidate(prepared.input),
      expectCode("MEDIA_PROMOTION_DATABASE_LOCK_INVALID"),
    );
  });

  await t.test("promotion receipt collision", async (t) => {
    const prepared = await fixture(t);
    promoteRemoteMediaCandidate(prepared.input);
    const receiptPath = join(prepared.lockRoot, "media-canonical-promotion.json");
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    writeCanonical(receiptPath, { ...receipt, canonicalVerificationSha256: "9".repeat(64) });
    assert.throws(
      () => promoteRemoteMediaCandidate(prepared.input),
      expectCode("MEDIA_PROMOTION_RECEIPT_COLLISION"),
    );
  });
});
