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
  readlinkSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createNasStagedObjectReader } from "./nas-media-io.mjs";
import {
  nasOwnedMediaReplacement,
  prepareOwnedMediaMigration,
} from "./nas-media-migration.mjs";
import { createMediaTransferBundle } from "./nas-media-transfer-bundle.mjs";
import {
  RemoteMediaTransferError,
  mediaRemoteLockIdentitySha256,
  receiveRemoteMediaBundle,
} from "./nas-remote-media-transfer.mjs";

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const PNG_DATA_URL = `data:image/png;base64,${PNG.toString("base64")}`;
const MIGRATION_ID = "0198d821-93d5-7af2-a15e-6d7437f10380";
const RELEASE_COMMIT = "a".repeat(40);
const TOKEN_DIGEST = "b".repeat(64);
const PROJECT_ID = "flowpack-nas";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function expectCode(code) {
  return (error) => {
    assert.ok(error instanceof RemoteMediaTransferError);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    assert.equal(error.message.includes(PNG_DATA_URL), false);
    return true;
  };
}

function writeCanonical(path, value) {
  const canonical = JSON.stringify(
    Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))),
  );
  writeFileSync(path, `${canonical}\n`, { mode: 0o600 });
}

function databaseLockState(overrides = {}) {
  return {
    candidateDatabase: "flowpack_candidate_0123456789ab",
    evidenceDigest: "c".repeat(64),
    migrationId: MIGRATION_ID,
    phase: "CANDIDATE_RESTORED",
    previousDatabase: "flowpack_precutover_0123456789ab",
    projectId: PROJECT_ID,
    releaseCommit: RELEASE_COMMIT,
    rollbackReportDigest: null,
    schemaVersion: 1,
    tokenDigest: TOKEN_DIGEST,
    ...overrides,
  };
}

async function fixture(t, { lockOverrides } = {}) {
  const root = mkdtempSync(join(tmpdir(), "flowpack-remote-media-"));
  chmodSync(root, 0o700);
  t.after(() => rmSync(root, { force: true, recursive: true }));

  const projectRoot = join(root, "project-root");
  mkdirSync(projectRoot, { mode: 0o700 });
  writeFileSync(join(projectRoot, ".nas-project-id"), `${PROJECT_ID}\n`, { mode: 0o600 });
  for (const path of [
    join(projectRoot, "state"),
    join(projectRoot, "releases"),
    join(projectRoot, "media"),
  ]) mkdirSync(path, { mode: 0o700 });
  mkdirSync(join(projectRoot, "releases", RELEASE_COMMIT), { mode: 0o700 });
  symlinkSync(join("releases", RELEASE_COMMIT), join(projectRoot, "current"));
  mkdirSync(join(projectRoot, "media", "objects"), { mode: 0o700 });
  writeFileSync(join(projectRoot, "media", "objects", "canonical.marker"), "untouched", { mode: 0o600 });
  mkdirSync(join(projectRoot, "media", "candidates"), { mode: 0o700 });
  mkdirSync(join(projectRoot, "state", "media-incoming"), { mode: 0o700 });

  const lockDirectory = join(projectRoot, "state", "database-migration.lock");
  mkdirSync(lockDirectory, { mode: 0o700 });
  const lockState = databaseLockState(lockOverrides);
  writeCanonical(join(lockDirectory, "state.json"), lockState);
  const remoteLockIdentitySha256 = mediaRemoteLockIdentitySha256(lockState);

  const storageRoot = join(root, "staged-media");
  const bundleDirectory = join(root, "bundle");
  mkdirSync(storageRoot, { mode: 0o700 });
  mkdirSync(bundleDirectory, { mode: 0o700 });
  const prepared = await prepareOwnedMediaMigration({
    records: {
      contentImages: [],
      contents: [],
      mediaFiles: [{
        id: "private-media",
        userId: "private-user",
        url: PNG_DATA_URL,
        blobKey: "legacy/private.png",
        mimeType: "image/png",
        size: PNG.length,
      }],
    },
    policy: {
      policyId: "owned-v1",
      rewritePolicyId: "nas-v1",
      maxBytes: 1024,
      allowedMimeTypes: ["image/png"],
      approvedSources: [{
        approvalId: "owned-inline",
        classification: "data",
        hosts: [],
        owned: true,
        pathPrefixes: [],
      }],
      replacementFor: nasOwnedMediaReplacement,
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
  const migrationName = readdirSync(join(storageRoot, ".nas-media-migrations"))[0];
  const bundle = await createMediaTransferBundle({
    bundleDirectory,
    manifestPath: join(storageRoot, ".nas-media-migrations", migrationName, "manifest.json"),
    manifestSha256: prepared.evidence.manifestSha256,
    migrationId: MIGRATION_ID,
    objectReader: await createNasStagedObjectReader({ storageRoot }),
    releaseCommit: RELEASE_COMMIT,
    remoteLockIdentitySha256,
  });
  return { bundle, lockState, projectRoot, remoteLockIdentitySha256, root };
}

function incomingDirectory(projectRoot) {
  return join(projectRoot, "state", "media-incoming", MIGRATION_ID);
}

function stageIncoming(fixture, sourcePath = fixture.bundle.bundlePath, digest = fixture.bundle.bundleSha256) {
  const directory = incomingDirectory(fixture.projectRoot);
  if (!existsSync(directory)) mkdirSync(directory, { mode: 0o700 });
  const path = join(directory, `${digest}.bundle`);
  copyFileSync(sourcePath, path);
  chmodSync(path, 0o600);
  return path;
}

function receiveInput(fixture, overrides = {}) {
  return {
    bundleSha256: fixture.bundle.bundleSha256,
    confirmation: `${PROJECT_ID}:${MIGRATION_ID}:receive-media:${fixture.bundle.bundleSha256}`,
    migrationId: MIGRATION_ID,
    projectId: PROJECT_ID,
    projectRoot: fixture.projectRoot,
    releaseCommit: RELEASE_COMMIT,
    tokenDigest: TOKEN_DIGEST,
    ...overrides,
  };
}

test("fixed incoming is fully verified into a private candidate namespace and completion is recorded last", async (t) => {
  const prepared = await fixture(t);
  const incoming = stageIncoming(prepared);
  const result = receiveRemoteMediaBundle(receiveInput(prepared));
  assert.equal(result.ok, true);
  assert.equal(result.idempotent, false);
  assert.equal(result.bundleSha256, prepared.bundle.bundleSha256);
  assert.equal(result.remoteLockIdentitySha256, prepared.remoteLockIdentitySha256);
  assert.match(result.candidateVerificationSha256, /^[a-f0-9]{64}$/);
  assert.match(result.completionReceiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.filesVerified, 1);
  assert.equal(result.objectBytes, PNG.length);
  assert.equal(existsSync(incoming), false);
  assert.equal(existsSync(incomingDirectory(prepared.projectRoot)), false);

  const candidate = join(prepared.projectRoot, "media", "candidates", MIGRATION_ID);
  assert.equal(lstatSync(candidate).mode & 0o777, 0o700);
  assert.equal(lstatSync(join(candidate, "complete.json")).mode & 0o777, 0o600);
  assert.equal(lstatSync(join(candidate, ".transfer-manifest.json")).mode & 0o777, 0o600);
  const manifest = JSON.parse(readFileSync(join(candidate, ".transfer-manifest.json"), "utf8"));
  const objectPath = join(candidate, manifest.objects[0].key);
  assert.equal(lstatSync(objectPath).mode & 0o777, 0o600);
  assert.deepEqual(readFileSync(objectPath), PNG);
  assert.equal(readFileSync(join(prepared.projectRoot, "media", "objects", "canonical.marker"), "utf8"), "untouched");
  assert.equal(existsSync(join(prepared.projectRoot, "state", "media-transfer.lock")), false);
});

test("completed same digest replays idempotently after full candidate verification; a different digest conflicts", async (t) => {
  const prepared = await fixture(t);
  stageIncoming(prepared);
  receiveRemoteMediaBundle(receiveInput(prepared));

  stageIncoming(prepared);
  const replay = receiveRemoteMediaBundle(receiveInput(prepared));
  assert.equal(replay.idempotent, true);
  assert.equal(replay.filesVerified, 1);
  const firstReceipt = JSON.parse(readFileSync(join(
    prepared.projectRoot,
    "media",
    "candidates",
    MIGRATION_ID,
    "complete.json",
  ), "utf8"));
  assert.equal(replay.candidateVerificationSha256, firstReceipt.candidateVerificationSha256);
  assert.match(replay.completionReceiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(existsSync(incomingDirectory(prepared.projectRoot)), false);

  const changedPath = join(prepared.root, "changed.bundle");
  writeFileSync(changedPath, Buffer.concat([readFileSync(prepared.bundle.bundlePath), Buffer.from("x")]), { mode: 0o600 });
  const changedDigest = sha256(readFileSync(changedPath));
  stageIncoming(prepared, changedPath, changedDigest);
  assert.throws(
    () => receiveRemoteMediaBundle(receiveInput(prepared, {
      bundleSha256: changedDigest,
      confirmation: `${PROJECT_ID}:${MIGRATION_ID}:receive-media:${changedDigest}`,
    })),
    expectCode("MEDIA_TRANSFER_DIGEST_CONFLICT"),
  );
  assert.equal(existsSync(incomingDirectory(prepared.projectRoot)), false);
});

test("sentinel/current release/exclusive database lock and exact confirmation are mandatory", async (t) => {
  const prepared = await fixture(t);
  stageIncoming(prepared);
  writeFileSync(join(prepared.projectRoot, ".nas-project-id"), "documate-nas\n", { mode: 0o600 });
  assert.throws(
    () => receiveRemoteMediaBundle(receiveInput(prepared)),
    expectCode("PROJECT_SENTINEL_INVALID"),
  );
  writeFileSync(join(prepared.projectRoot, ".nas-project-id"), `${PROJECT_ID}\n`, { mode: 0o600 });
  rmSync(join(prepared.projectRoot, "current"));
  symlinkSync(join("releases", "f".repeat(40)), join(prepared.projectRoot, "current"));
  assert.throws(
    () => receiveRemoteMediaBundle(receiveInput(prepared)),
    expectCode("CURRENT_RELEASE_MISMATCH"),
  );
  rmSync(join(prepared.projectRoot, "current"));
  symlinkSync(join("releases", RELEASE_COMMIT), join(prepared.projectRoot, "current"));
  assert.throws(
    () => receiveRemoteMediaBundle(receiveInput(prepared, { confirmation: "wrong" })),
    expectCode("MEDIA_TRANSFER_CONFIRMATION_REQUIRED"),
  );
  assert.throws(
    () => receiveRemoteMediaBundle(receiveInput(prepared, { tokenDigest: "d".repeat(64) })),
    expectCode("DATABASE_MIGRATION_IDENTITY_MISMATCH"),
  );
});

test("traversal records, corrupt payloads, incoming symlinks and hardlinks are rejected and cleaned", async (t) => {
  await t.test("archive traversal", async (t) => {
    const prepared = await fixture(t);
    const bundle = readFileSync(prepared.bundle.bundlePath);
    const headerBytes = bundle.readUInt32BE(8);
    const manifest = JSON.parse(bundle.subarray(12, 12 + headerBytes).toString("utf8"));
    const validKeyBytes = bundle.readUInt16BE(12 + headerBytes);
    const dataLengthOffset = 12 + headerBytes + 2 + validKeyBytes;
    const dataBytes = Number(bundle.readBigUInt64BE(dataLengthOffset));
    const data = bundle.subarray(dataLengthOffset + 8, dataLengthOffset + 8 + dataBytes);
    manifest.objects[0].key = "../escape.png";
    const maliciousHeader = Buffer.from(`${JSON.stringify(manifest)}\n`);
    const maliciousKey = Buffer.from("../escape.png");
    const keyLength = Buffer.alloc(2);
    keyLength.writeUInt16BE(maliciousKey.length);
    const length = Buffer.alloc(8);
    length.writeBigUInt64BE(BigInt(data.length));
    const headerLength = Buffer.alloc(4);
    headerLength.writeUInt32BE(maliciousHeader.length);
    const malicious = Buffer.concat([
      Buffer.from("FPMBNDL1"), headerLength, maliciousHeader,
      keyLength, maliciousKey, length, data, Buffer.from("FPMEND01"),
    ]);
    const maliciousPath = join(prepared.root, "malicious.bundle");
    writeFileSync(maliciousPath, malicious, { mode: 0o600 });
    const digest = sha256(malicious);
    stageIncoming(prepared, maliciousPath, digest);
    assert.throws(
      () => receiveRemoteMediaBundle(receiveInput(prepared, {
        bundleSha256: digest,
        confirmation: `${PROJECT_ID}:${MIGRATION_ID}:receive-media:${digest}`,
      })),
      expectCode("TRANSFER_MANIFEST_INVALID"),
    );
    assert.equal(existsSync(join(prepared.projectRoot, "media", "candidates", MIGRATION_ID)), false);
    assert.equal(existsSync(incomingDirectory(prepared.projectRoot)), false);
  });

  await t.test("corrupt object", async (t) => {
    const prepared = await fixture(t);
    const corrupt = Buffer.from(readFileSync(prepared.bundle.bundlePath));
    corrupt[corrupt.length - 9] ^= 1;
    const corruptPath = join(prepared.root, "corrupt.bundle");
    writeFileSync(corruptPath, corrupt, { mode: 0o600 });
    const digest = sha256(corrupt);
    stageIncoming(prepared, corruptPath, digest);
    assert.throws(
      () => receiveRemoteMediaBundle(receiveInput(prepared, {
        bundleSha256: digest,
        confirmation: `${PROJECT_ID}:${MIGRATION_ID}:receive-media:${digest}`,
      })),
      expectCode("MEDIA_OBJECT_DIGEST_MISMATCH"),
    );
    assert.equal(existsSync(join(prepared.projectRoot, "media", "candidates", MIGRATION_ID)), false);
    assert.equal(existsSync(incomingDirectory(prepared.projectRoot)), false);
  });

  await t.test("symlink and hardlink incoming", async (t) => {
    const prepared = await fixture(t);
    const directory = incomingDirectory(prepared.projectRoot);
    mkdirSync(directory, { mode: 0o700 });
    const incoming = join(directory, `${prepared.bundle.bundleSha256}.bundle`);
    symlinkSync(prepared.bundle.bundlePath, incoming);
    assert.throws(
      () => receiveRemoteMediaBundle(receiveInput(prepared)),
      expectCode("MEDIA_INCOMING_UNSAFE"),
    );
    assert.equal(existsSync(incomingDirectory(prepared.projectRoot)), false);

    mkdirSync(directory, { mode: 0o700 });
    linkSync(prepared.bundle.bundlePath, incoming);
    assert.throws(
      () => receiveRemoteMediaBundle(receiveInput(prepared)),
      expectCode("MEDIA_INCOMING_UNSAFE"),
    );
    assert.equal(lstatSync(prepared.bundle.bundlePath).nlink, 1);
    assert.equal(existsSync(incomingDirectory(prepared.projectRoot)), false);
  });
});

test("hostile CLI-shaped identity values fail before filesystem mutation", async (t) => {
  const prepared = await fixture(t);
  stageIncoming(prepared);
  const before = readlinkSync(join(prepared.projectRoot, "current"));
  assert.throws(
    () => receiveRemoteMediaBundle(receiveInput(prepared, {
      migrationId: `${MIGRATION_ID};touch-pwned`,
    })),
    expectCode("MEDIA_TRANSFER_INPUT_INVALID"),
  );
  assert.equal(readlinkSync(join(prepared.projectRoot, "current")), before);
  assert.equal(existsSync(join(prepared.projectRoot, "state", "media-transfer.lock")), false);
});
