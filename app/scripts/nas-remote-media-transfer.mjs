#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readlinkSync,
  renameSync,
  rmdirSync,
  rmSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  MEDIA_BUNDLE_END,
  MEDIA_BUNDLE_MAGIC,
  MEDIA_TRANSFER_SCHEMA_VERSION,
  MediaTransferBundleError,
  parseCanonicalMediaTransferManifest,
} from "./nas-media-transfer-bundle.mjs";
import {
  MEDIA_PROJECT_ID,
  canonicalMediaJson,
  mediaSha256,
} from "./nas-media-contract.mjs";

export const REMOTE_MEDIA_PROJECT_ID = "flowpack-nas";

const FILE_MODE = 0o600;
const DIRECTORY_MODE = 0o700;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MIGRATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RELEASE_PATTERN = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const DATABASE_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;
const REMOTE_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;
const MAX_STATE_BYTES = 64 * 1024;
const MAX_MANIFEST_BYTES = 64 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 1024 ** 4 + 128 * 1024 * 1024;
const IO_CHUNK_BYTES = 1024 * 1024;
const DATABASE_STATE_KEYS = Object.freeze([
  "candidateDatabase",
  "evidenceDigest",
  "migrationId",
  "phase",
  "previousDatabase",
  "projectId",
  "releaseCommit",
  "rollbackReportDigest",
  "schemaVersion",
  "tokenDigest",
]);
const COMPLETION_KEYS = Object.freeze([
  "bundleSha256",
  "candidateVerificationSha256",
  "fileCount",
  "mediaEvidenceManifestSha256",
  "migrationId",
  "objectBytes",
  "projectId",
  "releaseCommit",
  "remoteLockIdentitySha256",
  "schemaVersion",
  "state",
  "transferManifestSha256",
]);
const ALLOWED_DATABASE_PHASES = new Set([
  "TARGET_PREPARED",
  "SOURCE_FROZEN",
  "FINAL_BOUND",
  "CANDIDATE_RESTORED",
  "LIVE_RENAMED",
  "CANDIDATE_PROMOTED",
  "DESTINATION_READ_ONLY",
  "ZERO_WRITE_SMOKE_PASSED",
]);

export class RemoteMediaTransferError extends Error {
  constructor(code) {
    super(code);
    this.name = "RemoteMediaTransferError";
    this.code = code;
  }
}

function fail(code) {
  throw new RemoteMediaTransferError(code);
}

function exactKeys(value, keys) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join("\n") === [...keys].sort().join("\n")
  );
}

function assertProjectRoot(path) {
  if (
    typeof path !== "string" ||
    !isAbsolute(path) ||
    path === "/" ||
    resolve(path) !== path ||
    path.includes("\0")
  ) {
    fail("MEDIA_TRANSFER_INPUT_INVALID");
  }
  const segments = path.split("/").filter(Boolean);
  if (
    segments.length < 3 ||
    segments.some((segment) => !REMOTE_SEGMENT_PATTERN.test(segment) || segment === "." || segment === "..")
  ) {
    fail("MEDIA_TRANSFER_INPUT_INVALID");
  }
  let info;
  try {
    info = lstatSync(path);
  } catch {
    fail("PROJECT_ROOT_INVALID");
  }
  if (info.isSymbolicLink() || !info.isDirectory()) fail("PROJECT_ROOT_INVALID");
  return path;
}

function assertPrivateDirectory(path, code) {
  let info;
  try {
    info = lstatSync(path);
  } catch {
    fail(code);
  }
  if (info.isSymbolicLink() || !info.isDirectory() || (info.mode & 0o777) !== DIRECTORY_MODE) {
    fail(code);
  }
  return info;
}

function assertPrivateFile(path, code, maximumBytes = MAX_BUNDLE_BYTES) {
  let info;
  try {
    info = lstatSync(path);
  } catch {
    fail(code);
  }
  if (
    info.isSymbolicLink() ||
    !info.isFile() ||
    info.nlink !== 1 ||
    (info.mode & 0o777) !== FILE_MODE ||
    info.size <= 0 ||
    info.size > maximumBytes
  ) {
    fail(code);
  }
  return info;
}

function fsyncDirectory(path, code = "MEDIA_DIRECTORY_FSYNC_FAILED") {
  let descriptor;
  try {
    descriptor = openSync(path, constants.O_RDONLY);
    fsyncSync(descriptor);
  } catch {
    fail(code);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function writeAll(descriptor, bytes, code) {
  let offset = 0;
  while (offset < bytes.length) {
    const written = writeSync(descriptor, bytes, offset, bytes.length - offset);
    if (written <= 0) fail(code);
    offset += written;
  }
}

function writeExclusivePrivate(path, bytes, code) {
  let descriptor;
  try {
    descriptor = openSync(
      path,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0),
      FILE_MODE,
    );
    writeAll(descriptor, bytes, code);
    fsyncSync(descriptor);
  } catch (error) {
    if (error instanceof RemoteMediaTransferError) throw error;
    fail(code);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  const info = assertPrivateFile(path, code, bytes.length);
  if (info.size !== bytes.length) fail(code);
  fsyncDirectory(dirname(path), code);
}

function writeAtomicCompletion(path, value) {
  const bytes = Buffer.from(`${canonicalMediaJson(value)}\n`, "utf8");
  const temporary = join(dirname(path), ".complete.tmp");
  try {
    writeExclusivePrivate(temporary, bytes, "MEDIA_COMPLETION_WRITE_FAILED");
    renameSync(temporary, path);
    fsyncDirectory(dirname(path), "MEDIA_COMPLETION_WRITE_FAILED");
  } catch (error) {
    if (existsSync(temporary)) unlinkSync(temporary);
    if (error instanceof RemoteMediaTransferError) throw error;
    fail("MEDIA_COMPLETION_WRITE_FAILED");
  }
  const info = assertPrivateFile(path, "MEDIA_COMPLETION_WRITE_FAILED", bytes.length);
  if (info.size !== bytes.length) fail("MEDIA_COMPLETION_WRITE_FAILED");
  return mediaSha256(bytes);
}

function parseCanonicalFile(path, code, maximumBytes) {
  assertPrivateFile(path, code, maximumBytes);
  let raw;
  let value;
  try {
    raw = readFileSync(path, "utf8");
    value = JSON.parse(raw);
  } catch {
    fail(code);
  }
  if (raw !== `${canonicalMediaJson(value)}\n`) fail(code);
  return value;
}

function validateInput(input) {
  if (
    !exactKeys(input, [
      "bundleSha256",
      "confirmation",
      "migrationId",
      "projectId",
      "projectRoot",
      "releaseCommit",
      "tokenDigest",
    ]) ||
    input.projectId !== REMOTE_MEDIA_PROJECT_ID ||
    !MIGRATION_ID_PATTERN.test(input.migrationId ?? "") ||
    !RELEASE_PATTERN.test(input.releaseCommit ?? "") ||
    !HASH_PATTERN.test(input.tokenDigest ?? "") ||
    !HASH_PATTERN.test(input.bundleSha256 ?? "")
  ) {
    fail("MEDIA_TRANSFER_INPUT_INVALID");
  }
  assertProjectRoot(input.projectRoot);
  if (
    input.confirmation !==
      `${REMOTE_MEDIA_PROJECT_ID}:${input.migrationId}:receive-media:${input.bundleSha256}`
  ) {
    fail("MEDIA_TRANSFER_CONFIRMATION_REQUIRED");
  }
  return input;
}

function assertBoundary(input) {
  const sentinel = join(input.projectRoot, ".nas-project-id");
  assertPrivateFile(sentinel, "PROJECT_SENTINEL_INVALID", 128);
  if (readFileSync(sentinel, "utf8") !== `${REMOTE_MEDIA_PROJECT_ID}\n`) {
    fail("PROJECT_SENTINEL_INVALID");
  }
  assertPrivateDirectory(join(input.projectRoot, "state"), "PROJECT_STATE_DIRECTORY_INVALID");
  assertPrivateDirectory(join(input.projectRoot, "releases"), "CURRENT_RELEASE_INVALID");
  const expectedRelease = join(input.projectRoot, "releases", input.releaseCommit);
  assertPrivateDirectory(expectedRelease, "CURRENT_RELEASE_INVALID");
  const currentPath = join(input.projectRoot, "current");
  let current;
  try {
    current = lstatSync(currentPath);
  } catch {
    fail("CURRENT_RELEASE_INVALID");
  }
  if (!current.isSymbolicLink()) fail("CURRENT_RELEASE_INVALID");
  if (resolve(dirname(currentPath), readlinkSync(currentPath)) !== expectedRelease) {
    fail("CURRENT_RELEASE_MISMATCH");
  }
  if (existsSync(join(input.projectRoot, "state", "source-deploy.lock"))) {
    fail("SOURCE_DEPLOY_LOCK_HELD");
  }
}

function readDatabaseLock(input) {
  const lockDirectory = join(input.projectRoot, "state", "database-migration.lock");
  assertPrivateDirectory(lockDirectory, "DATABASE_MIGRATION_LOCK_INVALID");
  const state = parseCanonicalFile(
    join(lockDirectory, "state.json"),
    "DATABASE_MIGRATION_STATE_INVALID",
    MAX_STATE_BYTES,
  );
  if (
    !exactKeys(state, DATABASE_STATE_KEYS) ||
    state.schemaVersion !== 1 ||
    state.projectId !== REMOTE_MEDIA_PROJECT_ID ||
    !MIGRATION_ID_PATTERN.test(state.migrationId ?? "") ||
    !RELEASE_PATTERN.test(state.releaseCommit ?? "") ||
    !HASH_PATTERN.test(state.tokenDigest ?? "") ||
    !DATABASE_PATTERN.test(state.candidateDatabase ?? "") ||
    !DATABASE_PATTERN.test(state.previousDatabase ?? "") ||
    !ALLOWED_DATABASE_PHASES.has(state.phase) ||
    !(state.evidenceDigest === null || HASH_PATTERN.test(state.evidenceDigest ?? "")) ||
    !(state.rollbackReportDigest === null || HASH_PATTERN.test(state.rollbackReportDigest ?? ""))
  ) {
    fail("DATABASE_MIGRATION_STATE_INVALID");
  }
  if (
    state.migrationId !== input.migrationId ||
    state.releaseCommit !== input.releaseCommit ||
    state.tokenDigest !== input.tokenDigest
  ) {
    fail("DATABASE_MIGRATION_IDENTITY_MISMATCH");
  }
  return Object.freeze({ ...state });
}

export function mediaRemoteLockIdentitySha256(state) {
  if (
    !state ||
    state.projectId !== REMOTE_MEDIA_PROJECT_ID ||
    !MIGRATION_ID_PATTERN.test(state.migrationId ?? "") ||
    !RELEASE_PATTERN.test(state.releaseCommit ?? "") ||
    !HASH_PATTERN.test(state.tokenDigest ?? "") ||
    !DATABASE_PATTERN.test(state.candidateDatabase ?? "") ||
    !DATABASE_PATTERN.test(state.previousDatabase ?? "")
  ) {
    fail("DATABASE_MIGRATION_STATE_INVALID");
  }
  return mediaSha256(canonicalMediaJson({
    candidateDatabase: state.candidateDatabase,
    migrationId: state.migrationId,
    previousDatabase: state.previousDatabase,
    projectId: state.projectId,
    releaseCommit: state.releaseCommit,
    tokenDigest: state.tokenDigest,
  }));
}

function acquireMediaLock(input, remoteLockIdentitySha256) {
  const path = join(input.projectRoot, "state", "media-transfer.lock");
  try {
    mkdirSync(path, { mode: DIRECTORY_MODE });
  } catch (error) {
    if (error?.code === "EEXIST") fail("MEDIA_TRANSFER_LOCK_HELD");
    fail("MEDIA_TRANSFER_LOCK_FAILED");
  }
  try {
    assertPrivateDirectory(path, "MEDIA_TRANSFER_LOCK_FAILED");
    writeExclusivePrivate(
      join(path, "identity.json"),
      Buffer.from(`${canonicalMediaJson({
        bundleSha256: input.bundleSha256,
        migrationId: input.migrationId,
        projectId: REMOTE_MEDIA_PROJECT_ID,
        releaseCommit: input.releaseCommit,
        remoteLockIdentitySha256,
        schemaVersion: MEDIA_TRANSFER_SCHEMA_VERSION,
      })}\n`, "utf8"),
      "MEDIA_TRANSFER_LOCK_FAILED",
    );
    fsyncDirectory(join(input.projectRoot, "state"), "MEDIA_TRANSFER_LOCK_FAILED");
    return path;
  } catch (error) {
    rmSync(path, { force: true, recursive: true });
    throw error;
  }
}

function releaseMediaLock(path) {
  try {
    rmSync(path, { force: true, recursive: true });
    fsyncDirectory(dirname(path), "MEDIA_TRANSFER_LOCK_RELEASE_FAILED");
  } catch (error) {
    if (error instanceof RemoteMediaTransferError) throw error;
    fail("MEDIA_TRANSFER_LOCK_RELEASE_FAILED");
  }
}

function incomingPaths(input) {
  const incomingRoot = join(input.projectRoot, "state", "media-incoming");
  assertPrivateDirectory(incomingRoot, "MEDIA_INCOMING_ROOT_INVALID");
  const migrationDirectory = join(incomingRoot, input.migrationId);
  return Object.freeze({
    incomingRoot,
    migrationDirectory,
    path: join(migrationDirectory, `${input.bundleSha256}.bundle`),
  });
}

function cleanupIncoming(paths) {
  if (existsSync(paths.path)) {
    try {
      const info = lstatSync(paths.path);
      if (info.isDirectory() && !info.isSymbolicLink()) rmdirSync(paths.path);
      else unlinkSync(paths.path);
    } catch {
      fail("MEDIA_INCOMING_CLEANUP_FAILED");
    }
  }
  if (existsSync(paths.migrationDirectory)) {
    try {
      rmdirSync(paths.migrationDirectory);
    } catch {
      fail("MEDIA_INCOMING_CLEANUP_FAILED");
    }
  }
  fsyncDirectory(paths.incomingRoot, "MEDIA_INCOMING_CLEANUP_FAILED");
}

function hashFile(path, code) {
  const info = assertPrivateFile(path, code);
  const descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  const hash = createHash("sha256");
  const buffer = Buffer.allocUnsafe(IO_CHUNK_BYTES);
  let position = 0;
  try {
    while (position < info.size) {
      const bytesRead = readSync(
        descriptor,
        buffer,
        0,
        Math.min(buffer.length, info.size - position),
        position,
      );
      if (bytesRead <= 0) fail(code);
      hash.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }
    return Object.freeze({ bytes: info.size, sha256: hash.digest("hex") });
  } finally {
    closeSync(descriptor);
  }
}

function readExact(descriptor, size, state, code) {
  if (!Number.isSafeInteger(size) || size < 0 || state.position + size > state.fileBytes) {
    fail(code);
  }
  const result = Buffer.allocUnsafe(size);
  let offset = 0;
  while (offset < size) {
    const bytesRead = readSync(descriptor, result, offset, size - offset, state.position + offset);
    if (bytesRead <= 0) fail(code);
    offset += bytesRead;
  }
  state.position += size;
  return result;
}

function candidatePaths(input) {
  const mediaRoot = join(input.projectRoot, "media");
  assertPrivateDirectory(mediaRoot, "MEDIA_ROOT_INVALID");
  const canonicalRoot = join(mediaRoot, "objects");
  assertPrivateDirectory(canonicalRoot, "MEDIA_CANONICAL_ROOT_INVALID");
  const candidatesRoot = join(mediaRoot, "candidates");
  assertPrivateDirectory(candidatesRoot, "MEDIA_CANDIDATES_ROOT_INVALID");
  return Object.freeze({
    candidateRoot: join(candidatesRoot, input.migrationId),
    candidatesRoot,
  });
}

function validateCompletion(value, input, remoteLockIdentitySha256) {
  if (
    !exactKeys(value, COMPLETION_KEYS) ||
    value.schemaVersion !== MEDIA_TRANSFER_SCHEMA_VERSION ||
    value.projectId !== MEDIA_PROJECT_ID ||
    value.state !== "candidate-complete" ||
    value.migrationId !== input.migrationId ||
    value.releaseCommit !== input.releaseCommit ||
    value.remoteLockIdentitySha256 !== remoteLockIdentitySha256 ||
    !HASH_PATTERN.test(value.bundleSha256 ?? "") ||
    !HASH_PATTERN.test(value.candidateVerificationSha256 ?? "") ||
    !HASH_PATTERN.test(value.transferManifestSha256 ?? "") ||
    !HASH_PATTERN.test(value.mediaEvidenceManifestSha256 ?? "") ||
    !Number.isSafeInteger(value.fileCount) ||
    value.fileCount <= 0 ||
    !Number.isSafeInteger(value.objectBytes) ||
    value.objectBytes <= 0
  ) {
    fail("MEDIA_CANDIDATE_RECEIPT_INVALID");
  }
  return Object.freeze({ ...value });
}

function verifyCandidate(candidateRoot, completion, input, remoteLockIdentitySha256) {
  assertPrivateDirectory(candidateRoot, "MEDIA_CANDIDATE_INVALID");
  const manifestPath = join(candidateRoot, ".transfer-manifest.json");
  const manifestInfo = assertPrivateFile(
    manifestPath,
    "MEDIA_CANDIDATE_VERIFICATION_FAILED",
    MAX_MANIFEST_BYTES,
  );
  const manifestBytes = readFileSync(manifestPath);
  if (manifestBytes.length !== manifestInfo.size) fail("MEDIA_CANDIDATE_VERIFICATION_FAILED");
  let manifest;
  try {
    manifest = parseCanonicalMediaTransferManifest(manifestBytes);
  } catch {
    fail("MEDIA_CANDIDATE_VERIFICATION_FAILED");
  }
  if (
    mediaSha256(manifestBytes) !== completion.transferManifestSha256 ||
    manifest.migrationId !== input.migrationId ||
    manifest.releaseCommit !== input.releaseCommit ||
    manifest.remoteLockIdentitySha256 !== remoteLockIdentitySha256 ||
    manifest.mediaEvidenceManifestSha256 !== completion.mediaEvidenceManifestSha256 ||
    manifest.fileCount !== completion.fileCount ||
    manifest.totalObjectBytes !== completion.objectBytes
  ) {
    fail("MEDIA_CANDIDATE_VERIFICATION_FAILED");
  }
  for (const object of manifest.objects) {
    const evidence = hashFile(join(candidateRoot, object.key), "MEDIA_CANDIDATE_VERIFICATION_FAILED");
    if (evidence.bytes !== object.bytes || evidence.sha256 !== object.sha256) {
      fail("MEDIA_CANDIDATE_VERIFICATION_FAILED");
    }
  }
  const candidateVerificationSha256 = candidateVerificationDigest({
    bundleSha256: completion.bundleSha256,
    manifest,
    transferManifestSha256: completion.transferManifestSha256,
  });
  if (candidateVerificationSha256 !== completion.candidateVerificationSha256) {
    fail("MEDIA_CANDIDATE_VERIFICATION_FAILED");
  }
  return Object.freeze({ candidateVerificationSha256, manifest });
}

function candidateVerificationDigest({ bundleSha256, manifest, transferManifestSha256 }) {
  return mediaSha256(canonicalMediaJson({
    bundleSha256,
    files: manifest.objects.map((object) => ({
      bytes: object.bytes,
      keySha256: mediaSha256(object.key),
      sha256: object.sha256,
    })),
    mediaEvidenceManifestSha256: manifest.mediaEvidenceManifestSha256,
    migrationId: manifest.migrationId,
    projectId: MEDIA_PROJECT_ID,
    releaseCommit: manifest.releaseCommit,
    remoteLockIdentitySha256: manifest.remoteLockIdentitySha256,
    schemaVersion: MEDIA_TRANSFER_SCHEMA_VERSION,
    transferManifestSha256,
  }));
}

function publicResult({
  bundleSha256,
  candidateVerificationSha256,
  completionReceiptSha256,
  idempotent,
  manifest,
  remoteLockIdentitySha256,
  transferManifestSha256,
}) {
  return Object.freeze({
    bundleSha256,
    candidateVerificationSha256,
    completionReceiptSha256,
    filesVerified: manifest.fileCount,
    idempotent,
    mediaEvidenceManifestSha256: manifest.mediaEvidenceManifestSha256,
    migrationIdSha256: mediaSha256(manifest.migrationId),
    objectBytes: manifest.totalObjectBytes,
    ok: true,
    releaseCommit: manifest.releaseCommit,
    remoteLockIdentitySha256,
    state: "candidate-complete",
    transferManifestSha256,
  });
}

function receiveBundleIntoCandidate({
  candidateRoot,
  incomingPath,
  input,
  remoteLockIdentitySha256,
}) {
  const incomingInfo = assertPrivateFile(incomingPath, "MEDIA_INCOMING_UNSAFE");
  const incomingHash = hashFile(incomingPath, "MEDIA_INCOMING_UNSAFE");
  if (incomingHash.sha256 !== input.bundleSha256) fail("MEDIA_BUNDLE_HASH_MISMATCH");
  let descriptor;
  try {
    descriptor = openSync(incomingPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  } catch {
    fail("MEDIA_INCOMING_UNSAFE");
  }
  const state = { fileBytes: incomingInfo.size, position: 0 };
  try {
    if (!readExact(descriptor, MEDIA_BUNDLE_MAGIC.length, state, "MEDIA_BUNDLE_INVALID").equals(MEDIA_BUNDLE_MAGIC)) {
      fail("MEDIA_BUNDLE_INVALID");
    }
    const headerBytes = readExact(descriptor, 4, state, "MEDIA_BUNDLE_INVALID").readUInt32BE(0);
    if (headerBytes <= 0 || headerBytes > MAX_MANIFEST_BYTES) fail("TRANSFER_MANIFEST_INVALID");
    const manifestBytes = readExact(descriptor, headerBytes, state, "MEDIA_BUNDLE_INVALID");
    let manifest;
    try {
      manifest = parseCanonicalMediaTransferManifest(manifestBytes);
    } catch (error) {
      if (error instanceof MediaTransferBundleError) fail(error.code);
      fail("TRANSFER_MANIFEST_INVALID");
    }
    if (
      manifest.migrationId !== input.migrationId ||
      manifest.releaseCommit !== input.releaseCommit ||
      manifest.remoteLockIdentitySha256 !== remoteLockIdentitySha256
    ) {
      fail("MEDIA_TRANSFER_IDENTITY_MISMATCH");
    }
    const transferManifestSha256 = mediaSha256(manifestBytes);

    mkdirSync(candidateRoot, { mode: DIRECTORY_MODE });
    assertPrivateDirectory(candidateRoot, "MEDIA_CANDIDATE_CREATE_FAILED");
    const objectsRoot = join(candidateRoot, "objects");
    mkdirSync(objectsRoot, { mode: DIRECTORY_MODE });
    assertPrivateDirectory(objectsRoot, "MEDIA_CANDIDATE_CREATE_FAILED");
    writeExclusivePrivate(
      join(candidateRoot, ".transfer-manifest.json"),
      manifestBytes,
      "MEDIA_CANDIDATE_CREATE_FAILED",
    );

    let currentBucket;
    for (const object of manifest.objects) {
      const keyBytes = readExact(descriptor, 2, state, "MEDIA_BUNDLE_INVALID").readUInt16BE(0);
      if (keyBytes <= 0) fail("MEDIA_BUNDLE_INVALID");
      const key = readExact(descriptor, keyBytes, state, "MEDIA_BUNDLE_INVALID").toString("utf8");
      const objectBytesBig = readExact(descriptor, 8, state, "MEDIA_BUNDLE_INVALID").readBigUInt64BE(0);
      if (objectBytesBig > BigInt(Number.MAX_SAFE_INTEGER)) fail("MEDIA_BUNDLE_INVALID");
      const objectBytes = Number(objectBytesBig);
      if (key !== object.key || objectBytes !== object.bytes) fail("MEDIA_BUNDLE_INVALID");

      const bucket = object.key.split("/")[1];
      const bucketPath = join(objectsRoot, bucket);
      if (currentBucket !== bucket) {
        if (!existsSync(bucketPath)) mkdirSync(bucketPath, { mode: DIRECTORY_MODE });
        assertPrivateDirectory(bucketPath, "MEDIA_CANDIDATE_CREATE_FAILED");
        currentBucket = bucket;
      }
      const objectPath = join(candidateRoot, object.key);
      let output;
      const objectHash = createHash("sha256");
      let remaining = objectBytes;
      try {
        output = openSync(
          objectPath,
          constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0),
          FILE_MODE,
        );
        while (remaining > 0) {
          const bytes = readExact(
            descriptor,
            Math.min(IO_CHUNK_BYTES, remaining),
            state,
            "MEDIA_BUNDLE_INVALID",
          );
          writeAll(output, bytes, "MEDIA_CANDIDATE_CREATE_FAILED");
          objectHash.update(bytes);
          remaining -= bytes.length;
        }
        fsyncSync(output);
      } catch (error) {
        if (error instanceof RemoteMediaTransferError) throw error;
        fail("MEDIA_CANDIDATE_CREATE_FAILED");
      } finally {
        if (output !== undefined) closeSync(output);
      }
      const objectInfo = assertPrivateFile(
        objectPath,
        "MEDIA_CANDIDATE_CREATE_FAILED",
        object.bytes,
      );
      if (objectInfo.size !== object.bytes || objectHash.digest("hex") !== object.sha256) {
        fail("MEDIA_OBJECT_DIGEST_MISMATCH");
      }
      fsyncDirectory(bucketPath, "MEDIA_DIRECTORY_FSYNC_FAILED");
    }
    if (!readExact(descriptor, MEDIA_BUNDLE_END.length, state, "MEDIA_BUNDLE_INVALID").equals(MEDIA_BUNDLE_END)) {
      fail("MEDIA_BUNDLE_INVALID");
    }
    if (state.position !== state.fileBytes) fail("MEDIA_BUNDLE_INVALID");
    fsyncDirectory(objectsRoot, "MEDIA_DIRECTORY_FSYNC_FAILED");
    fsyncDirectory(candidateRoot, "MEDIA_DIRECTORY_FSYNC_FAILED");
    return Object.freeze({ manifest, transferManifestSha256 });
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

export function receiveRemoteMediaBundle(rawInput) {
  const input = validateInput(rawInput);
  assertBoundary(input);
  const databaseState = readDatabaseLock(input);
  const remoteLockIdentitySha256 = mediaRemoteLockIdentitySha256(databaseState);
  const paths = incomingPaths(input);
  const candidates = candidatePaths(input);
  const mediaLock = acquireMediaLock(input, remoteLockIdentitySha256);
  let candidateOwned = false;
  try {
    const completionPath = join(candidates.candidateRoot, "complete.json");
    if (existsSync(candidates.candidateRoot)) {
      assertPrivateDirectory(candidates.candidateRoot, "MEDIA_CANDIDATE_INVALID");
      if (existsSync(completionPath)) {
        const completion = validateCompletion(
          parseCanonicalFile(
            completionPath,
            "MEDIA_CANDIDATE_RECEIPT_INVALID",
            MAX_STATE_BYTES,
          ),
          input,
          remoteLockIdentitySha256,
        );
        if (completion.bundleSha256 !== input.bundleSha256) {
          cleanupIncoming(paths);
          fail("MEDIA_TRANSFER_DIGEST_CONFLICT");
        }
        const manifest = verifyCandidate(
          candidates.candidateRoot,
          completion,
          input,
          remoteLockIdentitySha256,
        );
        if (existsSync(paths.migrationDirectory)) cleanupIncoming(paths);
        const completionReceiptSha256 = mediaSha256(
          Buffer.from(`${canonicalMediaJson(completion)}\n`, "utf8"),
        );
        return publicResult({
          bundleSha256: completion.bundleSha256,
          candidateVerificationSha256: manifest.candidateVerificationSha256,
          completionReceiptSha256,
          idempotent: true,
          manifest: manifest.manifest,
          remoteLockIdentitySha256,
          transferManifestSha256: completion.transferManifestSha256,
        });
      }
      rmSync(candidates.candidateRoot, { force: true, recursive: true });
      fsyncDirectory(candidates.candidatesRoot, "MEDIA_CANDIDATE_CLEANUP_FAILED");
    }
    assertPrivateDirectory(paths.migrationDirectory, "MEDIA_INCOMING_UNSAFE");
    candidateOwned = true;
    const extracted = receiveBundleIntoCandidate({
      candidateRoot: candidates.candidateRoot,
      incomingPath: paths.path,
      input,
      remoteLockIdentitySha256,
    });
    fsyncDirectory(candidates.candidatesRoot, "MEDIA_DIRECTORY_FSYNC_FAILED");
    cleanupIncoming(paths);
    const completion = Object.freeze({
      bundleSha256: input.bundleSha256,
      candidateVerificationSha256: candidateVerificationDigest({
        bundleSha256: input.bundleSha256,
        manifest: extracted.manifest,
        transferManifestSha256: extracted.transferManifestSha256,
      }),
      fileCount: extracted.manifest.fileCount,
      mediaEvidenceManifestSha256: extracted.manifest.mediaEvidenceManifestSha256,
      migrationId: input.migrationId,
      objectBytes: extracted.manifest.totalObjectBytes,
      projectId: MEDIA_PROJECT_ID,
      releaseCommit: input.releaseCommit,
      remoteLockIdentitySha256,
      schemaVersion: MEDIA_TRANSFER_SCHEMA_VERSION,
      state: "candidate-complete",
      transferManifestSha256: extracted.transferManifestSha256,
    });
    const completionReceiptSha256 = writeAtomicCompletion(completionPath, completion);
    candidateOwned = false;
    return publicResult({
      bundleSha256: input.bundleSha256,
      candidateVerificationSha256: completion.candidateVerificationSha256,
      completionReceiptSha256,
      idempotent: false,
      manifest: extracted.manifest,
      remoteLockIdentitySha256,
      transferManifestSha256: extracted.transferManifestSha256,
    });
  } catch (error) {
    if (candidateOwned && existsSync(candidates.candidateRoot)) {
      rmSync(candidates.candidateRoot, { force: true, recursive: true });
      fsyncDirectory(candidates.candidatesRoot, "MEDIA_CANDIDATE_CLEANUP_FAILED");
    }
    if (existsSync(paths.migrationDirectory)) cleanupIncoming(paths);
    if (error instanceof RemoteMediaTransferError) throw error;
    fail("MEDIA_TRANSFER_FAILED");
  } finally {
    releaseMediaLock(mediaLock);
  }
}

function parseCli(argv) {
  if (!Array.isArray(argv) || argv.length !== 8 || argv[0] !== "receive") fail("USAGE");
  const [
    ,
    projectId,
    projectRoot,
    migrationId,
    releaseCommit,
    tokenDigest,
    bundleSha256,
    confirmation,
  ] = argv;
  return {
    bundleSha256,
    confirmation,
    migrationId,
    projectId,
    projectRoot,
    releaseCommit,
    tokenDigest,
  };
}

export function runCli(argv = process.argv.slice(2)) {
  return receiveRemoteMediaBundle(parseCli(argv));
}

const invokedPath = process.argv[1] === undefined
  ? undefined
  : pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  try {
    process.stdout.write(`${JSON.stringify(runCli())}\n`);
  } catch {
    process.stderr.write('{"ok":false}\n');
    process.exitCode = 1;
  }
}
