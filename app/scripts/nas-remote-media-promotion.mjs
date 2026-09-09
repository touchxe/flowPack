#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  readlinkSync,
  realpathSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import {
  MEDIA_PROJECT_ID,
  canonicalMediaJson,
  mediaCandidateIdentitySha256,
  mediaSha256,
} from "./nas-media-contract.mjs";
import {
  MEDIA_TRANSFER_SCHEMA_VERSION,
  validateMediaTransferManifest,
} from "./nas-media-transfer-bundle.mjs";
import { mediaRemoteLockIdentitySha256 } from "./nas-remote-media-transfer.mjs";

const REMOTE_PROJECT_ID = "flowpack-nas";
const FILE_MODE = 0o600;
const DIRECTORY_MODE = 0o700;
const MAX_JSON_BYTES = 64 * 1024 * 1024;
const MAX_OBJECT_BYTES = 1024 ** 3;
const IO_CHUNK_BYTES = 1024 * 1024;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MIGRATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RELEASE_PATTERN = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const DATABASE_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;
const OBJECT_KEY_PATTERN =
  /^objects\/([a-f0-9]{2})\/([a-f0-9]{64})\.(?:jpg|png|gif|webp|mp3|m4a|wav|ogg|pdf)$/;
const LOCK_STATE_KEYS = Object.freeze([
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
const CANDIDATE_COMPLETION_KEYS = Object.freeze([
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
const REWRITE_RECEIPT_KEYS = Object.freeze([
  "candidateAttestationSha256",
  "candidateDatabaseNameSha256",
  "candidateIdentitySha256",
  "candidateRewriteExecutionDigest",
  "mediaEvidenceManifestSha256",
  "mediaGenerationDigest",
  "migrationId",
  "objectBytes",
  "objectsVerified",
  "operationsVerified",
  "preparationReportDigest",
  "projectId",
  "releaseCommit",
  "remoteLockIdentitySha256",
  "schemaVersion",
  "state",
]);
const PROMOTION_INPUT_KEYS = Object.freeze([
  "bundleSha256",
  "candidateRewriteReceiptSha256",
  "candidateVerificationSha256",
  "completionReceiptSha256",
  "confirmation",
  "mediaEvidenceManifestSha256",
  "mediaGenerationDigest",
  "migrationId",
  "preparationReportDigest",
  "projectId",
  "projectRoot",
  "releaseCommit",
  "tokenDigest",
  "transferManifestSha256",
]);
const PROMOTION_RECEIPT_KEYS = Object.freeze([
  "additiveOnly",
  "bundleSha256",
  "candidateRewriteReceiptSha256",
  "candidateVerificationSha256",
  "canonicalObjectBytes",
  "canonicalObjects",
  "canonicalVerificationSha256",
  "completionReceiptSha256",
  "deletesPerformed",
  "fullReadbackVerified",
  "mediaEvidenceManifestSha256",
  "mediaGenerationDigest",
  "migrationId",
  "overwritesPerformed",
  "preparationReportDigest",
  "projectId",
  "promotionMode",
  "releaseCommit",
  "remoteLockIdentitySha256",
  "schemaVersion",
  "state",
  "transferManifestSha256",
]);

export class RemoteMediaPromotionError extends Error {
  constructor(code) {
    super(code);
    this.name = "RemoteMediaPromotionError";
    this.code = code;
  }
}

function fail(code) {
  throw new RemoteMediaPromotionError(code);
}

function exactKeys(value, keys) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join("\n") === [...keys].sort().join("\n")
  );
}

function absoluteNormalizedPath(path, code) {
  if (
    typeof path !== "string" ||
    !isAbsolute(path) ||
    resolve(path) !== path ||
    path.includes("\0")
  ) fail(code);
  return path;
}

function isContained(parent, child) {
  const path = relative(parent, child);
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function assertPrivateDirectory(path, code) {
  absoluteNormalizedPath(path, code);
  let info;
  let canonical;
  try {
    info = lstatSync(path);
    canonical = realpathSync(path);
  } catch {
    fail(code);
  }
  if (
    info.isSymbolicLink() ||
    !info.isDirectory() ||
    (info.mode & 0o777) !== DIRECTORY_MODE ||
    canonical !== path
  ) fail(code);
  return info;
}

function ensurePrivateChildDirectory(parent, name, code) {
  if (!/^[a-zA-Z0-9._-]+$/.test(name) || name === "." || name === "..") fail(code);
  assertPrivateDirectory(parent, code);
  const path = join(parent, name);
  if (!existsSync(path)) {
    try {
      mkdirSync(path, { mode: DIRECTORY_MODE });
      fsyncDirectory(parent, code);
    } catch {
      fail(code);
    }
  }
  assertPrivateDirectory(path, code);
  if (!isContained(parent, path)) fail(code);
  return path;
}

function assertPrivateFile(
  path,
  code,
  maximumBytes = MAX_JSON_BYTES,
  expectedLinks = 1,
) {
  absoluteNormalizedPath(path, code);
  assertPrivateDirectory(dirname(path), code);
  let info;
  try {
    info = lstatSync(path);
  } catch {
    fail(code);
  }
  if (
    info.isSymbolicLink() ||
    !info.isFile() ||
    info.nlink !== expectedLinks ||
    (info.mode & 0o777) !== FILE_MODE ||
    info.size <= 0 ||
    info.size > maximumBytes
  ) fail(code);
  return info;
}

function fsyncDirectory(path, code) {
  let descriptor;
  try {
    descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    fsyncSync(descriptor);
  } catch {
    fail(code);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function hashPrivateFile(
  path,
  expectedBytes,
  expectedSha256,
  code,
  expectedLinks = 1,
) {
  const initial = assertPrivateFile(
    path,
    code,
    Math.max(expectedBytes ?? 1, 1),
    expectedLinks,
  );
  if (expectedBytes !== undefined && initial.size !== expectedBytes) fail(code);
  const hash = createHash("sha256");
  let descriptor;
  let total = 0;
  try {
    descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = fstatSync(descriptor);
    if (
      !opened.isFile() ||
      opened.dev !== initial.dev ||
      opened.ino !== initial.ino ||
      opened.nlink !== expectedLinks ||
      (opened.mode & 0o777) !== FILE_MODE ||
      opened.size !== initial.size
    ) fail(code);
    const buffer = Buffer.allocUnsafe(IO_CHUNK_BYTES);
    while (total < initial.size) {
      const bytesRead = readSync(
        descriptor,
        buffer,
        0,
        Math.min(buffer.length, initial.size - total),
        null,
      );
      if (bytesRead <= 0) fail(code);
      hash.update(buffer.subarray(0, bytesRead));
      total += bytesRead;
    }
  } catch (error) {
    if (error instanceof RemoteMediaPromotionError) throw error;
    fail(code);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  const final = assertPrivateFile(
    path,
    code,
    Math.max(initial.size, 1),
    expectedLinks,
  );
  const sha256 = hash.digest("hex");
  if (
    final.dev !== initial.dev ||
    final.ino !== initial.ino ||
    final.size !== initial.size ||
    total !== initial.size ||
    (expectedSha256 !== undefined && sha256 !== expectedSha256)
  ) fail(code);
  return Object.freeze({ bytes: total, sha256 });
}

function parseCanonicalPrivate(path, code, maximumBytes = MAX_JSON_BYTES) {
  const initial = assertPrivateFile(path, code, maximumBytes);
  let descriptor;
  let bytes;
  let value;
  try {
    descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = fstatSync(descriptor);
    if (
      !opened.isFile() ||
      opened.dev !== initial.dev ||
      opened.ino !== initial.ino ||
      opened.nlink !== 1 ||
      (opened.mode & 0o777) !== FILE_MODE ||
      opened.size !== initial.size
    ) fail(code);
    bytes = Buffer.allocUnsafe(initial.size);
    let offset = 0;
    while (offset < bytes.length) {
      const read = readSync(descriptor, bytes, offset, bytes.length - offset, null);
      if (read <= 0) fail(code);
      offset += read;
    }
    const after = fstatSync(descriptor);
    if (
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.nlink !== 1 ||
      (after.mode & 0o777) !== FILE_MODE ||
      after.size !== opened.size
    ) fail(code);
    value = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    if (error instanceof RemoteMediaPromotionError) throw error;
    fail(code);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  const final = assertPrivateFile(path, code, maximumBytes);
  if (
    final.dev !== initial.dev ||
    final.ino !== initial.ino ||
    final.size !== initial.size ||
    bytes.length !== initial.size ||
    !bytes.equals(Buffer.from(`${canonicalMediaJson(value)}\n`, "utf8"))
  ) fail(code);
  return Object.freeze({ bytes, sha256: mediaSha256(bytes), value });
}

function writeAll(descriptor, bytes, code) {
  let offset = 0;
  while (offset < bytes.length) {
    let written;
    try {
      written = writeSync(descriptor, bytes, offset, bytes.length - offset);
    } catch {
      fail(code);
    }
    if (written <= 0) fail(code);
    offset += written;
  }
}

function writeCanonicalExclusive(path, value, code) {
  const bytes = Buffer.from(`${canonicalMediaJson(value)}\n`, "utf8");
  let descriptor;
  let created = false;
  let createdIdentity;
  try {
    descriptor = openSync(
      path,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_WRONLY |
        (constants.O_NOFOLLOW ?? 0),
      FILE_MODE,
    );
    created = true;
    writeAll(descriptor, bytes, code);
    fsyncSync(descriptor);
    const createdInfo = fstatSync(descriptor);
    createdIdentity = Object.freeze({ dev: createdInfo.dev, ino: createdInfo.ino });
    closeSync(descriptor);
    descriptor = undefined;
    fsyncDirectory(dirname(path), code);
    const readback = parseCanonicalPrivate(path, code);
    if (!readback.bytes.equals(bytes)) fail(code);
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    if (created && createdIdentity !== undefined && existsSync(path)) {
      try {
        const actual = lstatSync(path);
        if (
          !actual.isSymbolicLink() &&
          actual.isFile() &&
          actual.dev === createdIdentity.dev &&
          actual.ino === createdIdentity.ino
        ) unlinkSync(path);
      } catch {
        // Keep the original fail-closed error and never unlink a replacement.
      }
    }
    if (error instanceof RemoteMediaPromotionError) throw error;
    fail(code);
  }
  return mediaSha256(bytes);
}

function validateInput(value) {
  if (
    !exactKeys(value, PROMOTION_INPUT_KEYS) ||
    value.projectId !== REMOTE_PROJECT_ID ||
    !MIGRATION_ID_PATTERN.test(value.migrationId ?? "") ||
    !RELEASE_PATTERN.test(value.releaseCommit ?? "") ||
    [
      value.bundleSha256,
      value.candidateRewriteReceiptSha256,
      value.candidateVerificationSha256,
      value.completionReceiptSha256,
      value.mediaEvidenceManifestSha256,
      value.mediaGenerationDigest,
      value.preparationReportDigest,
      value.tokenDigest,
      value.transferManifestSha256,
    ].some((entry) => !HASH_PATTERN.test(entry ?? "")) ||
    value.confirmation !==
      `${REMOTE_PROJECT_ID}:${value.migrationId}:promote-media:${value.mediaGenerationDigest}`
  ) fail("MEDIA_PROMOTION_INPUT_INVALID");
  absoluteNormalizedPath(value.projectRoot, "MEDIA_PROMOTION_INPUT_INVALID");
  return Object.freeze({ ...value });
}

function validateBoundary(input) {
  assertPrivateDirectory(input.projectRoot, "MEDIA_PROMOTION_BOUNDARY_INVALID");
  const sentinelPath = join(input.projectRoot, ".nas-project-id");
  assertPrivateFile(sentinelPath, "MEDIA_PROMOTION_BOUNDARY_INVALID");
  const sentinel = hashPrivateFile(
    sentinelPath,
    Buffer.byteLength(`${REMOTE_PROJECT_ID}\n`),
    mediaSha256(`${REMOTE_PROJECT_ID}\n`),
    "MEDIA_PROMOTION_BOUNDARY_INVALID",
  );
  if (sentinel.bytes !== Buffer.byteLength(`${REMOTE_PROJECT_ID}\n`)) {
    fail("MEDIA_PROMOTION_BOUNDARY_INVALID");
  }
  const releasesRoot = join(input.projectRoot, "releases");
  const releaseRoot = join(releasesRoot, input.releaseCommit);
  let releaseInfo;
  try {
    releaseInfo = lstatSync(releaseRoot);
  } catch {
    fail("MEDIA_PROMOTION_BOUNDARY_INVALID");
  }
  if (releaseInfo.isSymbolicLink() || !releaseInfo.isDirectory()) {
    fail("MEDIA_PROMOTION_BOUNDARY_INVALID");
  }
  const current = join(input.projectRoot, "current");
  let currentTarget;
  try {
    if (!lstatSync(current).isSymbolicLink()) fail("MEDIA_PROMOTION_BOUNDARY_INVALID");
    currentTarget = readlinkSync(current);
  } catch (error) {
    if (error instanceof RemoteMediaPromotionError) throw error;
    fail("MEDIA_PROMOTION_BOUNDARY_INVALID");
  }
  if (
    currentTarget !== `releases/${input.releaseCommit}` ||
    realpathSync(current) !== releaseRoot
  ) fail("MEDIA_PROMOTION_BOUNDARY_INVALID");
  for (const name of ["state", "media"]) {
    assertPrivateDirectory(join(input.projectRoot, name), "MEDIA_PROMOTION_BOUNDARY_INVALID");
  }
}

function readDatabaseLock(input) {
  const lockRoot = join(input.projectRoot, "state", "database-migration.lock");
  assertPrivateDirectory(lockRoot, "MEDIA_PROMOTION_DATABASE_LOCK_INVALID");
  const state = parseCanonicalPrivate(
    join(lockRoot, "state.json"),
    "MEDIA_PROMOTION_DATABASE_LOCK_INVALID",
  ).value;
  if (
    !exactKeys(state, LOCK_STATE_KEYS) ||
    state.schemaVersion !== 1 ||
    state.projectId !== REMOTE_PROJECT_ID ||
    state.migrationId !== input.migrationId ||
    state.releaseCommit !== input.releaseCommit ||
    state.tokenDigest !== input.tokenDigest ||
    state.phase !== "CANDIDATE_RESTORED" ||
    state.rollbackReportDigest !== null ||
    !DATABASE_PATTERN.test(state.candidateDatabase ?? "") ||
    !DATABASE_PATTERN.test(state.previousDatabase ?? "") ||
    !HASH_PATTERN.test(state.evidenceDigest ?? "")
  ) fail("MEDIA_PROMOTION_DATABASE_LOCK_INVALID");
  return Object.freeze({
    lockRoot,
    remoteLockIdentitySha256: mediaRemoteLockIdentitySha256(state),
    state,
  });
}

function readCandidate(input, lock) {
  const candidateRoot = join(input.projectRoot, "media", "candidates", input.migrationId);
  assertPrivateDirectory(candidateRoot, "MEDIA_PROMOTION_CANDIDATE_INVALID");
  const completionDocument = parseCanonicalPrivate(
    join(candidateRoot, "complete.json"),
    "MEDIA_PROMOTION_CANDIDATE_INVALID",
  );
  const completion = completionDocument.value;
  if (
    !exactKeys(completion, CANDIDATE_COMPLETION_KEYS) ||
    completion.schemaVersion !== MEDIA_TRANSFER_SCHEMA_VERSION ||
    completion.projectId !== MEDIA_PROJECT_ID ||
    completion.state !== "candidate-complete" ||
    completion.migrationId !== input.migrationId ||
    completion.releaseCommit !== input.releaseCommit ||
    completion.remoteLockIdentitySha256 !== lock.remoteLockIdentitySha256 ||
    completion.bundleSha256 !== input.bundleSha256 ||
    completion.candidateVerificationSha256 !== input.candidateVerificationSha256 ||
    completion.mediaEvidenceManifestSha256 !== input.mediaEvidenceManifestSha256 ||
    completion.transferManifestSha256 !== input.transferManifestSha256 ||
    completionDocument.sha256 !== input.completionReceiptSha256 ||
    !Number.isSafeInteger(completion.fileCount) ||
    completion.fileCount <= 0 ||
    !Number.isSafeInteger(completion.objectBytes) ||
    completion.objectBytes <= 0
  ) fail("MEDIA_PROMOTION_CANDIDATE_INVALID");
  const manifestDocument = parseCanonicalPrivate(
    join(candidateRoot, ".transfer-manifest.json"),
    "MEDIA_PROMOTION_CANDIDATE_INVALID",
  );
  let manifest;
  try {
    manifest = validateMediaTransferManifest(manifestDocument.value);
  } catch {
    fail("MEDIA_PROMOTION_CANDIDATE_INVALID");
  }
  if (
    manifestDocument.sha256 !== input.transferManifestSha256 ||
    manifest.migrationId !== input.migrationId ||
    manifest.releaseCommit !== input.releaseCommit ||
    manifest.remoteLockIdentitySha256 !== lock.remoteLockIdentitySha256 ||
    manifest.mediaEvidenceManifestSha256 !== input.mediaEvidenceManifestSha256 ||
    manifest.fileCount !== completion.fileCount ||
    manifest.totalObjectBytes !== completion.objectBytes
  ) fail("MEDIA_PROMOTION_CANDIDATE_INVALID");
  return Object.freeze({ candidateRoot, completion, manifest });
}

function validateRewriteReceipt(value, input, lock, candidate) {
  const candidateDatabaseNameSha256 = mediaSha256(lock.state.candidateDatabase);
  const candidateIdentitySha256 = mediaCandidateIdentitySha256({
    candidateDatabaseNameSha256,
    migrationId: input.migrationId,
    projectId: MEDIA_PROJECT_ID,
    remoteLockIdentitySha256: lock.remoteLockIdentitySha256,
  });
  if (
    !exactKeys(value, REWRITE_RECEIPT_KEYS) ||
    value.schemaVersion !== 1 ||
    value.projectId !== REMOTE_PROJECT_ID ||
    value.state !== "candidate-rewrite-complete" ||
    value.migrationId !== input.migrationId ||
    value.releaseCommit !== input.releaseCommit ||
    value.remoteLockIdentitySha256 !== lock.remoteLockIdentitySha256 ||
    value.candidateDatabaseNameSha256 !== candidateDatabaseNameSha256 ||
    value.candidateIdentitySha256 !== candidateIdentitySha256 ||
    value.mediaEvidenceManifestSha256 !== input.mediaEvidenceManifestSha256 ||
    value.mediaGenerationDigest !== input.mediaGenerationDigest ||
    value.preparationReportDigest !== input.preparationReportDigest ||
    value.objectsVerified !== candidate.manifest.fileCount ||
    value.objectBytes !== candidate.manifest.totalObjectBytes ||
    !Number.isSafeInteger(value.operationsVerified) ||
    value.operationsVerified <= 0 ||
    !HASH_PATTERN.test(value.candidateAttestationSha256 ?? "") ||
    !HASH_PATTERN.test(value.candidateRewriteExecutionDigest ?? "")
  ) fail("MEDIA_PROMOTION_REWRITE_RECEIPT_INVALID");
  return Object.freeze({ ...value });
}

export function recordRemoteMediaCandidateRewrite(rawInput = {}) {
  const keys = [
    "candidateAttestationSha256",
    "candidateDatabaseNameSha256",
    "candidateIdentitySha256",
    "candidateRewriteExecutionDigest",
    "confirmation",
    "mediaEvidenceManifestSha256",
    "mediaGenerationDigest",
    "migrationId",
    "objectBytes",
    "objectsVerified",
    "operationsVerified",
    "preparationReportDigest",
    "projectId",
    "projectRoot",
    "releaseCommit",
    "remoteLockIdentitySha256",
    "tokenDigest",
  ];
  if (
    !exactKeys(rawInput, keys) ||
    rawInput.confirmation !==
      `${REMOTE_PROJECT_ID}:${rawInput.migrationId}:record-media-rewrite:${rawInput.candidateRewriteExecutionDigest}`
  ) fail("MEDIA_REWRITE_RECEIPT_INPUT_INVALID");
  const promotionShape = validateInput({
    bundleSha256: "0".repeat(64),
    candidateRewriteReceiptSha256: "0".repeat(64),
    candidateVerificationSha256: "0".repeat(64),
    completionReceiptSha256: "0".repeat(64),
    confirmation: `${REMOTE_PROJECT_ID}:${rawInput.migrationId}:promote-media:${rawInput.mediaGenerationDigest}`,
    mediaEvidenceManifestSha256: rawInput.mediaEvidenceManifestSha256,
    mediaGenerationDigest: rawInput.mediaGenerationDigest,
    migrationId: rawInput.migrationId,
    preparationReportDigest: rawInput.preparationReportDigest,
    projectId: rawInput.projectId,
    projectRoot: rawInput.projectRoot,
    releaseCommit: rawInput.releaseCommit,
    tokenDigest: rawInput.tokenDigest,
    transferManifestSha256: "0".repeat(64),
  });
  validateBoundary(promotionShape);
  const lock = readDatabaseLock(promotionShape);
  const receipt = Object.freeze({
    candidateAttestationSha256: rawInput.candidateAttestationSha256,
    candidateDatabaseNameSha256: rawInput.candidateDatabaseNameSha256,
    candidateIdentitySha256: rawInput.candidateIdentitySha256,
    candidateRewriteExecutionDigest: rawInput.candidateRewriteExecutionDigest,
    mediaEvidenceManifestSha256: rawInput.mediaEvidenceManifestSha256,
    mediaGenerationDigest: rawInput.mediaGenerationDigest,
    migrationId: rawInput.migrationId,
    objectBytes: rawInput.objectBytes,
    objectsVerified: rawInput.objectsVerified,
    operationsVerified: rawInput.operationsVerified,
    preparationReportDigest: rawInput.preparationReportDigest,
    projectId: REMOTE_PROJECT_ID,
    releaseCommit: rawInput.releaseCommit,
    remoteLockIdentitySha256: rawInput.remoteLockIdentitySha256,
    schemaVersion: 1,
    state: "candidate-rewrite-complete",
  });
  const candidateDatabaseNameSha256 = mediaSha256(lock.state.candidateDatabase);
  const candidateIdentitySha256 = mediaCandidateIdentitySha256({
    candidateDatabaseNameSha256,
    migrationId: rawInput.migrationId,
    projectId: MEDIA_PROJECT_ID,
    remoteLockIdentitySha256: lock.remoteLockIdentitySha256,
  });
  if (
    rawInput.remoteLockIdentitySha256 !== lock.remoteLockIdentitySha256 ||
    rawInput.candidateDatabaseNameSha256 !== candidateDatabaseNameSha256 ||
    rawInput.candidateIdentitySha256 !== candidateIdentitySha256 ||
    [
      rawInput.candidateAttestationSha256,
      rawInput.candidateRewriteExecutionDigest,
    ].some((entry) => !HASH_PATTERN.test(entry ?? "")) ||
    !Number.isSafeInteger(rawInput.operationsVerified) ||
    rawInput.operationsVerified <= 0 ||
    !Number.isSafeInteger(rawInput.objectsVerified) ||
    rawInput.objectsVerified <= 0 ||
    !Number.isSafeInteger(rawInput.objectBytes) ||
    rawInput.objectBytes <= 0
  ) fail("MEDIA_REWRITE_RECEIPT_INPUT_INVALID");
  const path = join(lock.lockRoot, "media-candidate-rewrite.json");
  if (existsSync(path)) {
    const existing = parseCanonicalPrivate(path, "MEDIA_REWRITE_RECEIPT_COLLISION");
    if (canonicalMediaJson(existing.value) !== canonicalMediaJson(receipt)) {
      fail("MEDIA_REWRITE_RECEIPT_COLLISION");
    }
    return Object.freeze({
      candidateRewriteReceiptSha256: existing.sha256,
      idempotent: true,
      ok: true,
      remoteLockIdentitySha256: lock.remoteLockIdentitySha256,
    });
  }
  const digest = writeCanonicalExclusive(path, receipt, "MEDIA_REWRITE_RECEIPT_WRITE_FAILED");
  return Object.freeze({
    candidateRewriteReceiptSha256: digest,
    idempotent: false,
    ok: true,
    remoteLockIdentitySha256: lock.remoteLockIdentitySha256,
  });
}

function acquirePromotionLock(input, lock) {
  const path = join(input.projectRoot, "state", "media-promotion.lock");
  const identity = {
    mediaGenerationDigest: input.mediaGenerationDigest,
    migrationId: input.migrationId,
    projectId: REMOTE_PROJECT_ID,
    releaseCommit: input.releaseCommit,
    remoteLockIdentitySha256: lock.remoteLockIdentitySha256,
    schemaVersion: 1,
  };
  if (existsSync(path)) {
    assertPrivateDirectory(path, "MEDIA_PROMOTION_LOCK_HELD");
    const existing = parseCanonicalPrivate(
      join(path, "identity.json"),
      "MEDIA_PROMOTION_LOCK_HELD",
    );
    if (canonicalMediaJson(existing.value) !== canonicalMediaJson(identity)) {
      fail("MEDIA_PROMOTION_LOCK_HELD");
    }
    return path;
  }
  try {
    mkdirSync(path, { mode: DIRECTORY_MODE });
    fsyncDirectory(join(input.projectRoot, "state"), "MEDIA_PROMOTION_LOCK_FAILED");
    writeCanonicalExclusive(
      join(path, "identity.json"),
      identity,
      "MEDIA_PROMOTION_LOCK_FAILED",
    );
  } catch (error) {
    if (error instanceof RemoteMediaPromotionError) throw error;
    fail("MEDIA_PROMOTION_LOCK_HELD");
  }
  return path;
}

function releasePromotionLock(path, projectRoot) {
  try {
    unlinkSync(join(path, "identity.json"));
    rmdirSync(path);
    fsyncDirectory(join(projectRoot, "state"), "MEDIA_PROMOTION_LOCK_RELEASE_FAILED");
  } catch {
    fail("MEDIA_PROMOTION_LOCK_RELEASE_FAILED");
  }
}

function copyCandidateToTemporary(source, temporary, object) {
  const sourceEvidence = hashPrivateFile(
    source,
    object.bytes,
    object.sha256,
    "MEDIA_PROMOTION_CANDIDATE_OBJECT_INVALID",
  );
  let sourceDescriptor;
  let outputDescriptor;
  let created = false;
  let createdIdentity;
  try {
    const sourceInitial = assertPrivateFile(
      source,
      "MEDIA_PROMOTION_CANDIDATE_OBJECT_INVALID",
      object.bytes,
    );
    if (sourceInitial.size !== object.bytes) {
      fail("MEDIA_PROMOTION_CANDIDATE_OBJECT_INVALID");
    }
    sourceDescriptor = openSync(source, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const sourceOpened = fstatSync(sourceDescriptor);
    if (
      !sourceOpened.isFile() ||
      sourceOpened.dev !== sourceInitial.dev ||
      sourceOpened.ino !== sourceInitial.ino ||
      sourceOpened.nlink !== 1 ||
      (sourceOpened.mode & 0o777) !== FILE_MODE ||
      sourceOpened.size !== object.bytes
    ) fail("MEDIA_PROMOTION_CANDIDATE_OBJECT_INVALID");
    outputDescriptor = openSync(
      temporary,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_WRONLY |
        (constants.O_NOFOLLOW ?? 0),
      FILE_MODE,
    );
    created = true;
    const outputOpened = fstatSync(outputDescriptor);
    createdIdentity = Object.freeze({ dev: outputOpened.dev, ino: outputOpened.ino });
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(IO_CHUNK_BYTES);
    let total = 0;
    while (total < sourceEvidence.bytes) {
      const bytesRead = readSync(
        sourceDescriptor,
        buffer,
        0,
        Math.min(buffer.length, sourceEvidence.bytes - total),
        null,
      );
      if (bytesRead <= 0) fail("MEDIA_PROMOTION_COPY_FAILED");
      const chunk = buffer.subarray(0, bytesRead);
      hash.update(chunk);
      writeAll(outputDescriptor, chunk, "MEDIA_PROMOTION_COPY_FAILED");
      total += bytesRead;
    }
    if (total !== object.bytes || hash.digest("hex") !== object.sha256) {
      fail("MEDIA_PROMOTION_COPY_FAILED");
    }
    const sourceAfter = fstatSync(sourceDescriptor);
    if (
      sourceAfter.dev !== sourceOpened.dev ||
      sourceAfter.ino !== sourceOpened.ino ||
      sourceAfter.nlink !== 1 ||
      (sourceAfter.mode & 0o777) !== FILE_MODE ||
      sourceAfter.size !== sourceOpened.size
    ) fail("MEDIA_PROMOTION_COPY_FAILED");
    fsyncSync(outputDescriptor);
  } catch (error) {
    if (outputDescriptor !== undefined) closeSync(outputDescriptor);
    if (sourceDescriptor !== undefined) closeSync(sourceDescriptor);
    if (created && createdIdentity !== undefined && existsSync(temporary)) {
      try {
        const actual = lstatSync(temporary);
        if (
          !actual.isSymbolicLink() &&
          actual.isFile() &&
          actual.dev === createdIdentity.dev &&
          actual.ino === createdIdentity.ino
        ) unlinkSync(temporary);
      } catch {
        // Never unlink a path that changed identity during the failed copy.
      }
    }
    if (error instanceof RemoteMediaPromotionError) throw error;
    fail("MEDIA_PROMOTION_COPY_FAILED");
  }
  closeSync(outputDescriptor);
  closeSync(sourceDescriptor);
  const readback = hashPrivateFile(
    temporary,
    object.bytes,
    object.sha256,
    "MEDIA_PROMOTION_COPY_FAILED",
  );
  return readback;
}

function recoverKnownPublication(destination, temporary, object, bucket, stagingRoot) {
  const destinationInfo = lstatSync(destination);
  if (
    destinationInfo.isSymbolicLink() ||
    !destinationInfo.isFile() ||
    (destinationInfo.mode & 0o777) !== FILE_MODE
  ) fail("MEDIA_CANONICAL_OBJECT_CONFLICT");
  if (destinationInfo.nlink === 2 && existsSync(temporary)) {
    const temporaryInfo = lstatSync(temporary);
    if (
      temporaryInfo.isSymbolicLink() ||
      !temporaryInfo.isFile() ||
      (temporaryInfo.mode & 0o777) !== FILE_MODE ||
      temporaryInfo.nlink !== 2 ||
      temporaryInfo.dev !== destinationInfo.dev ||
      temporaryInfo.ino !== destinationInfo.ino
    ) fail("MEDIA_CANONICAL_OBJECT_CONFLICT");
    hashPrivateFile(
      temporary,
      object.bytes,
      object.sha256,
      "MEDIA_CANONICAL_OBJECT_CONFLICT",
      2,
    );
    hashPrivateFile(
      destination,
      object.bytes,
      object.sha256,
      "MEDIA_CANONICAL_OBJECT_CONFLICT",
      2,
    );
    unlinkSync(temporary);
    fsyncDirectory(stagingRoot, "MEDIA_PROMOTION_FSYNC_FAILED");
    fsyncDirectory(bucket, "MEDIA_PROMOTION_FSYNC_FAILED");
  } else if (destinationInfo.nlink === 1 && existsSync(temporary)) {
    const temporaryInfo = lstatSync(temporary);
    if (
      temporaryInfo.isSymbolicLink() ||
      !temporaryInfo.isFile() ||
      (temporaryInfo.mode & 0o777) !== FILE_MODE ||
      temporaryInfo.nlink !== 1 ||
      (temporaryInfo.dev === destinationInfo.dev &&
        temporaryInfo.ino === destinationInfo.ino)
    ) fail("MEDIA_CANONICAL_OBJECT_CONFLICT");
    hashPrivateFile(
      destination,
      object.bytes,
      object.sha256,
      "MEDIA_CANONICAL_OBJECT_CONFLICT",
    );
    hashPrivateFile(
      temporary,
      object.bytes,
      object.sha256,
      "MEDIA_CANONICAL_OBJECT_CONFLICT",
    );
    unlinkSync(temporary);
    fsyncDirectory(stagingRoot, "MEDIA_PROMOTION_FSYNC_FAILED");
  } else if (destinationInfo.nlink !== 1) {
    fail("MEDIA_CANONICAL_OBJECT_CONFLICT");
  }
  return hashPrivateFile(
    destination,
    object.bytes,
    object.sha256,
    "MEDIA_CANONICAL_OBJECT_CONFLICT",
  );
}

function publishObject({ candidateRoot, canonicalRoot, object, stagingRoot }) {
  const match = OBJECT_KEY_PATTERN.exec(object.key ?? "");
  if (!match || match[1] !== object.sha256.slice(0, 2) || match[2] !== object.sha256) {
    fail("MEDIA_PROMOTION_OBJECT_INVALID");
  }
  if (
    !Number.isSafeInteger(object.bytes) ||
    object.bytes <= 0 ||
    object.bytes > MAX_OBJECT_BYTES
  ) fail("MEDIA_PROMOTION_OBJECT_INVALID");
  const source = join(candidateRoot, ...object.key.split("/"));
  const bucket = ensurePrivateChildDirectory(
    canonicalRoot,
    match[1],
    "MEDIA_CANONICAL_BUCKET_INVALID",
  );
  const destination = join(bucket, object.key.slice(`objects/${match[1]}/`.length));
  const temporary = join(stagingRoot, `${object.sha256}.tmp`);
  if (existsSync(destination)) {
    const evidence = recoverKnownPublication(
      destination,
      temporary,
      object,
      bucket,
      stagingRoot,
    );
    return Object.freeze({ ...evidence, created: false, key: object.key });
  }
  if (existsSync(temporary)) {
    hashPrivateFile(temporary, object.bytes, object.sha256, "MEDIA_PROMOTION_STAGING_CONFLICT");
  } else {
    copyCandidateToTemporary(source, temporary, object);
    fsyncDirectory(stagingRoot, "MEDIA_PROMOTION_FSYNC_FAILED");
  }
  try {
    linkSync(temporary, destination);
    fsyncDirectory(bucket, "MEDIA_PROMOTION_FSYNC_FAILED");
  } catch (error) {
    if (error?.code !== "EEXIST") fail("MEDIA_PROMOTION_PUBLISH_FAILED");
  }
  const evidence = recoverKnownPublication(
    destination,
    temporary,
    object,
    bucket,
    stagingRoot,
  );
  return Object.freeze({ ...evidence, created: true, key: object.key });
}

function verifyCanonicalGeneration(canonicalRoot, objects) {
  const evidence = [];
  let bytes = 0;
  for (const object of objects) {
    const match = OBJECT_KEY_PATTERN.exec(object.key);
    const bucket = join(canonicalRoot, match[1]);
    assertPrivateDirectory(bucket, "MEDIA_CANONICAL_READBACK_FAILED");
    const path = join(bucket, object.key.slice(`objects/${match[1]}/`.length));
    const verified = hashPrivateFile(
      path,
      object.bytes,
      object.sha256,
      "MEDIA_CANONICAL_READBACK_FAILED",
    );
    evidence.push({ bytes: verified.bytes, key: object.key, sha256: verified.sha256 });
    bytes += verified.bytes;
  }
  return Object.freeze({
    bytes,
    sha256: mediaSha256(canonicalMediaJson(evidence)),
  });
}

function promotionReceipt(input, lock, candidate, rewrite, canonical) {
  return Object.freeze({
    additiveOnly: true,
    bundleSha256: input.bundleSha256,
    candidateRewriteReceiptSha256: input.candidateRewriteReceiptSha256,
    candidateVerificationSha256: input.candidateVerificationSha256,
    canonicalObjectBytes: canonical.bytes,
    canonicalObjects: candidate.manifest.fileCount,
    canonicalVerificationSha256: canonical.sha256,
    completionReceiptSha256: input.completionReceiptSha256,
    deletesPerformed: 0,
    fullReadbackVerified: true,
    mediaEvidenceManifestSha256: input.mediaEvidenceManifestSha256,
    mediaGenerationDigest: rewrite.mediaGenerationDigest,
    migrationId: input.migrationId,
    overwritesPerformed: 0,
    preparationReportDigest: input.preparationReportDigest,
    projectId: REMOTE_PROJECT_ID,
    promotionMode: "additive-content-addressed-before-database",
    releaseCommit: input.releaseCommit,
    remoteLockIdentitySha256: lock.remoteLockIdentitySha256,
    schemaVersion: 1,
    state: "canonical-complete",
    transferManifestSha256: input.transferManifestSha256,
  });
}

function validatePromotionReceipt(value, expected) {
  if (
    !exactKeys(value, PROMOTION_RECEIPT_KEYS) ||
    canonicalMediaJson(value) !== canonicalMediaJson(expected)
  ) fail("MEDIA_PROMOTION_RECEIPT_COLLISION");
}

export function promoteRemoteMediaCandidate(rawInput = {}) {
  const input = validateInput(rawInput);
  validateBoundary(input);
  const lock = readDatabaseLock(input);
  const candidate = readCandidate(input, lock);
  const rewriteDocument = parseCanonicalPrivate(
    join(lock.lockRoot, "media-candidate-rewrite.json"),
    "MEDIA_PROMOTION_REWRITE_RECEIPT_INVALID",
  );
  if (rewriteDocument.sha256 !== input.candidateRewriteReceiptSha256) {
    fail("MEDIA_PROMOTION_REWRITE_RECEIPT_INVALID");
  }
  const rewrite = validateRewriteReceipt(rewriteDocument.value, input, lock, candidate);
  const mediaRoot = join(input.projectRoot, "media");
  const canonicalRoot = join(mediaRoot, "objects");
  assertPrivateDirectory(canonicalRoot, "MEDIA_CANONICAL_ROOT_INVALID");
  const stagingParent = ensurePrivateChildDirectory(
    mediaRoot,
    ".promotion-staging",
    "MEDIA_PROMOTION_STAGING_INVALID",
  );
  const stagingRoot = ensurePrivateChildDirectory(
    stagingParent,
    input.migrationId,
    "MEDIA_PROMOTION_STAGING_INVALID",
  );
  const receiptPath = join(lock.lockRoot, "media-canonical-promotion.json");
  const promotionLock = acquirePromotionLock(input, lock);
  let pendingError;
  let result;
  try {
    for (const object of candidate.manifest.objects) {
      publishObject({ candidateRoot: candidate.candidateRoot, canonicalRoot, object, stagingRoot });
    }
    const remaining = readdirSync(stagingRoot);
    if (remaining.length !== 0) fail("MEDIA_PROMOTION_STAGING_NOT_EMPTY");
    const canonical = verifyCanonicalGeneration(canonicalRoot, candidate.manifest.objects);
    if (canonical.bytes !== candidate.manifest.totalObjectBytes) {
      fail("MEDIA_CANONICAL_READBACK_FAILED");
    }
    const receipt = promotionReceipt(input, lock, candidate, rewrite, canonical);
    let digest;
    let idempotent;
    if (existsSync(receiptPath)) {
      const existing = parseCanonicalPrivate(
        receiptPath,
        "MEDIA_PROMOTION_RECEIPT_COLLISION",
      );
      validatePromotionReceipt(existing.value, receipt);
      digest = existing.sha256;
      idempotent = true;
    } else {
      digest = writeCanonicalExclusive(
        receiptPath,
        receipt,
        "MEDIA_PROMOTION_RECEIPT_WRITE_FAILED",
      );
      idempotent = false;
    }
    result = Object.freeze({
      candidateRewriteReceiptSha256: input.candidateRewriteReceiptSha256,
      canonicalObjectsVerified: true,
      canonicalVerificationSha256: canonical.sha256,
      idempotent,
      mediaGenerationDigest: input.mediaGenerationDigest,
      ok: true,
      promotionMode: receipt.promotionMode,
      promotionReceiptSha256: digest,
      remoteLockIdentitySha256: lock.remoteLockIdentitySha256,
    });
  } catch (error) {
    pendingError = error instanceof RemoteMediaPromotionError
      ? error
      : new RemoteMediaPromotionError("MEDIA_PROMOTION_FAILED");
  }
  try {
    releasePromotionLock(promotionLock, input.projectRoot);
  } catch (error) {
    if (!pendingError) pendingError = error;
  }
  if (pendingError) throw pendingError;
  try {
    rmdirSync(stagingRoot);
    fsyncDirectory(stagingParent, "MEDIA_PROMOTION_FSYNC_FAILED");
  } catch {
    fail("MEDIA_PROMOTION_STAGING_CLEANUP_FAILED");
  }
  return result;
}

export function runCli() {
  // The public CLI previously accepted a caller-selected project root and
  // evidence vector. Promotion is now callable only by a root-owned gateway
  // action whose policy derives every NAS path from immutable configuration.
  fail("MEDIA_PROMOTION_ROOT_GATEWAY_REQUIRED");
}

const invokedPath = process.argv[1] === undefined
  ? undefined
  : pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  try {
    process.stdout.write(`${canonicalMediaJson(runCli())}\n`);
  } catch {
    process.stderr.write('{"ok":false}\n');
    process.exitCode = 1;
  }
}
