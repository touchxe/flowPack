import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { constants } from "node:fs";
import {
  link,
  lstat,
  mkdir,
  open,
  realpath,
  rmdir,
  stat,
  unlink,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  MEDIA_EVIDENCE_SCHEMA_VERSION,
  MEDIA_PROJECT_ID,
  canonicalMediaJson,
  mediaSha256,
} from "./nas-media-contract.mjs";

export const MEDIA_TRANSFER_SCHEMA_VERSION = 1;
export const MEDIA_BUNDLE_FORMAT = "flowpack-media-length-prefixed-v1";
export const MEDIA_BUNDLE_MAGIC = Buffer.from("FPMBNDL1", "ascii");
export const MEDIA_BUNDLE_END = Buffer.from("FPMEND01", "ascii");
export const MEDIA_OFFSITE_MAGIC = Buffer.from("FPMOFF01", "ascii");

const FILE_MODE = 0o600;
const DIRECTORY_MODE = 0o700;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MIGRATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RELEASE_PATTERN = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const OBJECT_KEY_PATTERN =
  /^objects\/([a-f0-9]{2})\/([a-f0-9]{64})\.(?:jpg|png|gif|webp|mp3|m4a|wav|ogg|pdf)$/;
const PROFILE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/;
const MAX_JSON_BYTES = 64 * 1024 * 1024;
const MAX_OBJECT_BYTES = 1024 ** 3;
const MAX_OBJECTS = 100_000;
const MAX_TOTAL_OBJECT_BYTES = 1024 ** 4;
const IO_CHUNK_BYTES = 1024 * 1024;

const TRANSFER_MANIFEST_KEYS = Object.freeze([
  "bundleFormat",
  "fileCount",
  "mediaEvidenceManifestSha256",
  "mediaEvidenceSchemaVersion",
  "migrationId",
  "objects",
  "projectId",
  "releaseCommit",
  "remoteLockIdentitySha256",
  "reviewDigest",
  "schemaVersion",
  "totalObjectBytes",
]);

const COMPLETION_KEYS = Object.freeze([
  "bundleBytes",
  "bundleSha256",
  "format",
  "mediaEvidenceManifestSha256",
  "migrationId",
  "objectBytes",
  "objects",
  "projectId",
  "releaseCommit",
  "remoteLockIdentitySha256",
  "schemaVersion",
  "state",
  "transferManifestSha256",
]);

export class MediaTransferBundleError extends Error {
  constructor(code) {
    super(code);
    this.name = "MediaTransferBundleError";
    this.code = code;
  }
}

function fail(code) {
  throw new MediaTransferBundleError(code);
}

function exactKeys(value, keys) {
  return (
    value &&
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
  ) {
    fail(code);
  }
  return path;
}

async function assertPrivateDirectory(path, code) {
  absoluteNormalizedPath(path, code);
  let info;
  try {
    info = await lstat(path);
  } catch {
    fail(code);
  }
  if (info.isSymbolicLink() || !info.isDirectory() || (info.mode & 0o777) !== DIRECTORY_MODE) {
    fail(code);
  }
  try {
    return await realpath(path);
  } catch {
    fail(code);
  }
}

async function assertPrivateFile(path, code, maximumBytes = Number.MAX_SAFE_INTEGER) {
  absoluteNormalizedPath(path, code);
  await assertPrivateDirectory(dirname(path), code);
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const info = await handle.stat();
    if (
      !info.isFile() ||
      info.nlink !== 1 ||
      (info.mode & 0o777) !== FILE_MODE ||
      info.size <= 0 ||
      info.size > maximumBytes
    ) {
      fail(code);
    }
    return { handle, info };
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (error instanceof MediaTransferBundleError) throw error;
    fail(code);
  }
}

async function readPrivateFile(path, code, maximumBytes) {
  const { handle, info } = await assertPrivateFile(path, code, maximumBytes);
  try {
    const bytes = await handle.readFile();
    if (bytes.length !== info.size) fail(code);
    return bytes;
  } finally {
    await handle.close().catch(() => undefined);
  }
}

async function syncDirectory(path, code) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY);
    await handle.sync();
  } catch {
    fail(code);
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function writeAll(handle, buffer) {
  let offset = 0;
  while (offset < buffer.length) {
    const { bytesWritten } = await handle.write(buffer, offset, buffer.length - offset, null);
    if (bytesWritten <= 0) fail("TRANSFER_WRITE_FAILED");
    offset += bytesWritten;
  }
}

async function writeExclusivePrivate(path, bytes, code) {
  let handle;
  let created = false;
  try {
    handle = await open(
      path,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0),
      FILE_MODE,
    );
    created = true;
    await writeAll(handle, bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    const { handle: verification } = await assertPrivateFile(path, code, bytes.length);
    const info = await verification.stat();
    await verification.close();
    if (info.size !== bytes.length) fail(code);
    await syncDirectory(dirname(path), code);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (created) await unlink(path).catch(() => undefined);
    if (error instanceof MediaTransferBundleError) throw error;
    fail(code);
  }
}

async function writeAtomicPrivateExclusive(path, bytes, code) {
  const temporary = join(dirname(path), `.${resolve(path).split(sep).at(-1)}.tmp-${randomBytes(8).toString("hex")}`);
  let temporaryCreated = false;
  let linked = false;
  try {
    await writeExclusivePrivate(temporary, bytes, code);
    temporaryCreated = true;
    await link(temporary, path);
    linked = true;
    await unlink(temporary);
    temporaryCreated = false;
    const { handle, info } = await assertPrivateFile(path, code, bytes.length);
    await handle.close();
    if (info.nlink !== 1 || info.size !== bytes.length) fail(code);
    await syncDirectory(dirname(path), code);
  } catch (error) {
    if (temporaryCreated) await unlink(temporary).catch(() => undefined);
    if (linked) await unlink(path).catch(() => undefined);
    if (error instanceof MediaTransferBundleError) throw error;
    fail(code);
  }
}

function parseCanonicalJson(bytes, code, newline) {
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(code);
  }
  const canonical = Buffer.from(`${canonicalMediaJson(parsed)}${newline ? "\n" : ""}`, "utf8");
  if (!bytes.equals(canonical)) fail(code);
  return parsed;
}

function validateObjectEvidence(object) {
  if (
    !exactKeys(object, ["bytes", "classifications", "key", "mimeType", "sha256", "sourceCount"]) ||
    !Number.isSafeInteger(object.bytes) ||
    object.bytes <= 0 ||
    object.bytes > MAX_OBJECT_BYTES ||
    !Array.isArray(object.classifications) ||
    object.classifications.length === 0 ||
    object.classifications.some((value) => typeof value !== "string" || value.length === 0 || value.length > 128) ||
    typeof object.mimeType !== "string" ||
    object.mimeType.length === 0 ||
    object.mimeType.length > 128 ||
    !HASH_PATTERN.test(object.sha256 ?? "") ||
    !Number.isSafeInteger(object.sourceCount) ||
    object.sourceCount <= 0
  ) {
    fail("MEDIA_EVIDENCE_MANIFEST_INVALID");
  }
  const match = OBJECT_KEY_PATTERN.exec(object.key ?? "");
  if (!match || match[1] !== object.sha256.slice(0, 2) || match[2] !== object.sha256) {
    fail("MEDIA_EVIDENCE_MANIFEST_INVALID");
  }
  return Object.freeze({
    bytes: object.bytes,
    key: object.key,
    mimeType: object.mimeType,
    sha256: object.sha256,
  });
}

function validateMediaEvidenceManifest(value) {
  if (
    !exactKeys(value, [
      "encryptedRollbackSha256",
      "inventory",
      "objects",
      "policy",
      "projectId",
      "review",
      "rewritePlanSha256",
      "schemaVersion",
    ]) ||
    value.projectId !== MEDIA_PROJECT_ID ||
    value.schemaVersion !== MEDIA_EVIDENCE_SCHEMA_VERSION ||
    !HASH_PATTERN.test(value.encryptedRollbackSha256 ?? "") ||
    !HASH_PATTERN.test(value.rewritePlanSha256 ?? "") ||
    !value.review ||
    !HASH_PATTERN.test(value.review.reviewDigest ?? "") ||
    !Array.isArray(value.objects) ||
    value.objects.length <= 0 ||
    value.objects.length > MAX_OBJECTS
  ) {
    fail("MEDIA_EVIDENCE_MANIFEST_INVALID");
  }
  const objects = value.objects.map(validateObjectEvidence).sort((left, right) => left.key.localeCompare(right.key));
  if (new Set(objects.map((object) => object.key)).size !== objects.length) {
    fail("MEDIA_EVIDENCE_MANIFEST_INVALID");
  }
  let totalObjectBytes = 0;
  for (const object of objects) {
    totalObjectBytes += object.bytes;
    if (!Number.isSafeInteger(totalObjectBytes) || totalObjectBytes > MAX_TOTAL_OBJECT_BYTES) {
      fail("MEDIA_EVIDENCE_MANIFEST_INVALID");
    }
  }
  return Object.freeze({
    objects: Object.freeze(objects),
    reviewDigest: value.review.reviewDigest,
    totalObjectBytes,
  });
}

function validateTransferIdentity({
  manifestSha256,
  migrationId,
  releaseCommit,
  remoteLockIdentitySha256,
}) {
  if (
    !HASH_PATTERN.test(manifestSha256 ?? "") ||
    !MIGRATION_ID_PATTERN.test(migrationId ?? "") ||
    !RELEASE_PATTERN.test(releaseCommit ?? "") ||
    !HASH_PATTERN.test(remoteLockIdentitySha256 ?? "")
  ) {
    fail("TRANSFER_IDENTITY_INVALID");
  }
}

export function validateMediaTransferManifest(value) {
  if (
    !exactKeys(value, TRANSFER_MANIFEST_KEYS) ||
    value.bundleFormat !== MEDIA_BUNDLE_FORMAT ||
    value.schemaVersion !== MEDIA_TRANSFER_SCHEMA_VERSION ||
    value.mediaEvidenceSchemaVersion !== MEDIA_EVIDENCE_SCHEMA_VERSION ||
    value.projectId !== MEDIA_PROJECT_ID ||
    !HASH_PATTERN.test(value.mediaEvidenceManifestSha256 ?? "") ||
    !MIGRATION_ID_PATTERN.test(value.migrationId ?? "") ||
    !RELEASE_PATTERN.test(value.releaseCommit ?? "") ||
    !HASH_PATTERN.test(value.remoteLockIdentitySha256 ?? "") ||
    !HASH_PATTERN.test(value.reviewDigest ?? "") ||
    !Number.isSafeInteger(value.fileCount) ||
    value.fileCount <= 0 ||
    value.fileCount > MAX_OBJECTS ||
    !Number.isSafeInteger(value.totalObjectBytes) ||
    value.totalObjectBytes <= 0 ||
    value.totalObjectBytes > MAX_TOTAL_OBJECT_BYTES ||
    !Array.isArray(value.objects) ||
    value.objects.length !== value.fileCount
  ) {
    fail("TRANSFER_MANIFEST_INVALID");
  }
  let total = 0;
  let previous = "";
  const seen = new Set();
  for (const object of value.objects) {
    if (
      !exactKeys(object, ["bytes", "key", "mimeType", "sha256"]) ||
      !Number.isSafeInteger(object.bytes) ||
      object.bytes <= 0 ||
      object.bytes > MAX_OBJECT_BYTES ||
      typeof object.mimeType !== "string" ||
      object.mimeType.length <= 0 ||
      object.mimeType.length > 128 ||
      !HASH_PATTERN.test(object.sha256 ?? "")
    ) {
      fail("TRANSFER_MANIFEST_INVALID");
    }
    const match = OBJECT_KEY_PATTERN.exec(object.key ?? "");
    if (
      !match ||
      match[1] !== object.sha256.slice(0, 2) ||
      match[2] !== object.sha256 ||
      seen.has(object.key) ||
      (previous !== "" && previous.localeCompare(object.key) >= 0)
    ) {
      fail("TRANSFER_MANIFEST_INVALID");
    }
    seen.add(object.key);
    previous = object.key;
    total += object.bytes;
  }
  if (total !== value.totalObjectBytes) fail("TRANSFER_MANIFEST_INVALID");
  return Object.freeze({
    ...value,
    objects: Object.freeze(value.objects.map((object) => Object.freeze({ ...object }))),
  });
}

export function parseCanonicalMediaTransferManifest(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length <= 0 || bytes.length > MAX_JSON_BYTES) {
    fail("TRANSFER_MANIFEST_INVALID");
  }
  return validateMediaTransferManifest(parseCanonicalJson(bytes, "TRANSFER_MANIFEST_INVALID", true));
}

function uint16(value) {
  const result = Buffer.allocUnsafe(2);
  result.writeUInt16BE(value);
  return result;
}

function uint32(value) {
  const result = Buffer.allocUnsafe(4);
  result.writeUInt32BE(value);
  return result;
}

function uint64(value) {
  const result = Buffer.allocUnsafe(8);
  result.writeBigUInt64BE(BigInt(value));
  return result;
}

async function createBundleFile(path, transferManifestBytes, transferManifest, objectReader) {
  let handle;
  let created = false;
  const hash = createHash("sha256");
  let totalWritten = 0;
  const append = async (bytes) => {
    await writeAll(handle, bytes);
    hash.update(bytes);
    totalWritten += bytes.length;
    if (!Number.isSafeInteger(totalWritten)) fail("TRANSFER_BUNDLE_LIMIT_EXCEEDED");
  };
  try {
    handle = await open(
      path,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0),
      FILE_MODE,
    );
    created = true;
    await append(MEDIA_BUNDLE_MAGIC);
    await append(uint32(transferManifestBytes.length));
    await append(transferManifestBytes);
    for (const object of transferManifest.objects) {
      let result;
      try {
        result = await objectReader(object.key);
      } catch {
        fail("TRANSFER_OBJECT_VERIFICATION_FAILED");
      }
      const buffer = Buffer.isBuffer(result) ? result : result?.buffer;
      if (
        !Buffer.isBuffer(buffer) ||
        buffer.length !== object.bytes ||
        (result?.size !== undefined && result.size !== object.bytes) ||
        mediaSha256(buffer) !== object.sha256
      ) {
        fail("TRANSFER_OBJECT_VERIFICATION_FAILED");
      }
      const keyBytes = Buffer.from(object.key, "utf8");
      if (keyBytes.length <= 0 || keyBytes.length > 0xffff) {
        fail("TRANSFER_MANIFEST_INVALID");
      }
      await append(uint16(keyBytes.length));
      await append(keyBytes);
      await append(uint64(buffer.length));
      await append(buffer);
    }
    await append(MEDIA_BUNDLE_END);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await syncDirectory(dirname(path), "TRANSFER_WRITE_FAILED");
    return Object.freeze({ bytes: totalWritten, sha256: hash.digest("hex") });
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (created) await unlink(path).catch(() => undefined);
    if (error instanceof MediaTransferBundleError) throw error;
    fail("TRANSFER_WRITE_FAILED");
  }
}

export async function createMediaTransferBundle({
  bundleDirectory,
  manifestPath,
  manifestSha256,
  migrationId,
  objectReader,
  releaseCommit,
  remoteLockIdentitySha256,
} = {}) {
  validateTransferIdentity({
    manifestSha256,
    migrationId,
    releaseCommit,
    remoteLockIdentitySha256,
  });
  if (typeof objectReader !== "function") fail("TRANSFER_OBJECT_READER_REQUIRED");
  const canonicalBundleDirectory = await assertPrivateDirectory(
    bundleDirectory,
    "TRANSFER_OUTPUT_DIRECTORY_UNSAFE",
  );
  const evidenceBytes = await readPrivateFile(
    manifestPath,
    "MEDIA_EVIDENCE_MANIFEST_UNSAFE",
    MAX_JSON_BYTES,
  );
  if (mediaSha256(evidenceBytes) !== manifestSha256) {
    fail("MEDIA_EVIDENCE_MANIFEST_HASH_MISMATCH");
  }
  const evidenceManifest = parseCanonicalJson(
    evidenceBytes,
    "MEDIA_EVIDENCE_MANIFEST_INVALID",
    false,
  );
  const evidence = validateMediaEvidenceManifest(evidenceManifest);
  const transferManifest = validateMediaTransferManifest({
    bundleFormat: MEDIA_BUNDLE_FORMAT,
    fileCount: evidence.objects.length,
    mediaEvidenceManifestSha256: manifestSha256,
    mediaEvidenceSchemaVersion: MEDIA_EVIDENCE_SCHEMA_VERSION,
    migrationId,
    objects: evidence.objects,
    projectId: MEDIA_PROJECT_ID,
    releaseCommit,
    remoteLockIdentitySha256,
    reviewDigest: evidence.reviewDigest,
    schemaVersion: MEDIA_TRANSFER_SCHEMA_VERSION,
    totalObjectBytes: evidence.totalObjectBytes,
  });
  const transferManifestBytes = Buffer.from(`${canonicalMediaJson(transferManifest)}\n`, "utf8");
  if (transferManifestBytes.length > MAX_JSON_BYTES) fail("TRANSFER_MANIFEST_INVALID");
  const transferManifestSha256 = mediaSha256(transferManifestBytes);
  const prefix = `media-transfer-${migrationId}`;
  const transferManifestPath = join(canonicalBundleDirectory, `${prefix}.manifest.json`);
  const bundlePath = join(canonicalBundleDirectory, `${prefix}.bundle`);
  const completionReceiptPath = join(canonicalBundleDirectory, `${prefix}.complete.json`);
  const created = [];
  try {
    for (const path of [transferManifestPath, bundlePath, completionReceiptPath]) {
      try {
        await lstat(path);
        fail("TRANSFER_OUTPUT_COLLISION");
      } catch (error) {
        if (error instanceof MediaTransferBundleError) throw error;
        if (error?.code !== "ENOENT") fail("TRANSFER_OUTPUT_COLLISION");
      }
    }
    await writeExclusivePrivate(
      transferManifestPath,
      transferManifestBytes,
      "TRANSFER_MANIFEST_WRITE_FAILED",
    );
    created.push(transferManifestPath);
    const bundle = await createBundleFile(
      bundlePath,
      transferManifestBytes,
      transferManifest,
      objectReader,
    );
    created.push(bundlePath);
    const completion = Object.freeze({
      bundleBytes: bundle.bytes,
      bundleSha256: bundle.sha256,
      format: MEDIA_BUNDLE_FORMAT,
      mediaEvidenceManifestSha256: manifestSha256,
      migrationId,
      objectBytes: evidence.totalObjectBytes,
      objects: evidence.objects.length,
      projectId: MEDIA_PROJECT_ID,
      releaseCommit,
      remoteLockIdentitySha256,
      schemaVersion: MEDIA_TRANSFER_SCHEMA_VERSION,
      state: "complete",
      transferManifestSha256,
    });
    const completionBytes = Buffer.from(`${canonicalMediaJson(completion)}\n`, "utf8");
    await writeAtomicPrivateExclusive(
      completionReceiptPath,
      completionBytes,
      "TRANSFER_COMPLETION_WRITE_FAILED",
    );
    created.push(completionReceiptPath);
    return Object.freeze({
      bundleBytes: bundle.bytes,
      bundlePath,
      bundleSha256: bundle.sha256,
      completionReceiptPath,
      mediaEvidenceManifestSha256: manifestSha256,
      migrationIdSha256: mediaSha256(migrationId),
      objectBytes: evidence.totalObjectBytes,
      objects: evidence.objects.length,
      ok: true,
      releaseCommit,
      remoteLockIdentitySha256,
      transferManifestPath,
      transferManifestSha256,
    });
  } catch (error) {
    for (const path of created.reverse()) await unlink(path).catch(() => undefined);
    await syncDirectory(canonicalBundleDirectory, "TRANSFER_CLEANUP_FAILED").catch(() => undefined);
    if (error instanceof MediaTransferBundleError) throw error;
    fail("TRANSFER_BUNDLE_FAILED");
  }
}

function validateCompletion(value) {
  if (
    !exactKeys(value, COMPLETION_KEYS) ||
    value.schemaVersion !== MEDIA_TRANSFER_SCHEMA_VERSION ||
    value.projectId !== MEDIA_PROJECT_ID ||
    value.format !== MEDIA_BUNDLE_FORMAT ||
    value.state !== "complete" ||
    !MIGRATION_ID_PATTERN.test(value.migrationId ?? "") ||
    !RELEASE_PATTERN.test(value.releaseCommit ?? "") ||
    !HASH_PATTERN.test(value.remoteLockIdentitySha256 ?? "") ||
    !HASH_PATTERN.test(value.mediaEvidenceManifestSha256 ?? "") ||
    !HASH_PATTERN.test(value.transferManifestSha256 ?? "") ||
    !HASH_PATTERN.test(value.bundleSha256 ?? "") ||
    !Number.isSafeInteger(value.bundleBytes) ||
    value.bundleBytes <= 0 ||
    !Number.isSafeInteger(value.objectBytes) ||
    value.objectBytes <= 0 ||
    !Number.isSafeInteger(value.objects) ||
    value.objects <= 0 ||
    value.objects > MAX_OBJECTS
  ) {
    fail("TRANSFER_COMPLETION_INVALID");
  }
  return Object.freeze({ ...value });
}

async function hashPrivateFile(path, expectedBytes, code) {
  const { handle, info } = await assertPrivateFile(path, code);
  if (expectedBytes !== undefined && info.size !== expectedBytes) {
    await handle.close();
    fail(code);
  }
  const hash = createHash("sha256");
  let position = 0;
  const buffer = Buffer.allocUnsafe(IO_CHUNK_BYTES);
  try {
    while (position < info.size) {
      const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, info.size - position), position);
      if (bytesRead <= 0) fail(code);
      hash.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }
    return Object.freeze({ bytes: info.size, sha256: hash.digest("hex") });
  } finally {
    await handle.close().catch(() => undefined);
  }
}

function isContained(parent, child) {
  const path = relative(parent, child);
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

async function ensurePrivateChild(parent, name, createdDirectories) {
  const path = join(parent, name);
  try {
    await mkdir(path, { mode: DIRECTORY_MODE });
    createdDirectories.push(path);
    await syncDirectory(parent, "OFFSITE_DIRECTORY_INVALID");
  } catch (error) {
    if (error?.code !== "EEXIST") {
      if (error instanceof MediaTransferBundleError) throw error;
      fail("OFFSITE_DIRECTORY_INVALID");
    }
  }
  await assertPrivateDirectory(path, "OFFSITE_DIRECTORY_INVALID");
  return path;
}

function offsiteAad(completion, offsiteProfileIdSha256) {
  return Buffer.from(canonicalMediaJson({
    bundleSha256: completion.bundleSha256,
    mediaEvidenceManifestSha256: completion.mediaEvidenceManifestSha256,
    migrationId: completion.migrationId,
    offsiteProfileIdSha256,
    projectId: MEDIA_PROJECT_ID,
    releaseCommit: completion.releaseCommit,
    remoteLockIdentitySha256: completion.remoteLockIdentitySha256,
    schemaVersion: MEDIA_TRANSFER_SCHEMA_VERSION,
    transferManifestSha256: completion.transferManifestSha256,
  }), "utf8");
}

async function encryptBundleToOffsite({
  sourcePath,
  sourceBytes,
  targetPath,
  encryptionKey,
  aad,
}) {
  if (!Buffer.isBuffer(encryptionKey) || encryptionKey.length !== 32) {
    fail("OFFSITE_ENCRYPTION_KEY_INVALID");
  }
  const source = await assertPrivateFile(sourcePath, "TRANSFER_BUNDLE_UNSAFE");
  if (source.info.size !== sourceBytes) {
    await source.handle.close();
    fail("TRANSFER_BUNDLE_HASH_MISMATCH");
  }
  let target;
  let targetCreated = false;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  cipher.setAAD(aad);
  const encryptedHash = createHash("sha256");
  let encryptedBytes = 0;
  const append = async (bytes) => {
    await writeAll(target, bytes);
    encryptedHash.update(bytes);
    encryptedBytes += bytes.length;
  };
  try {
    target = await open(
      targetPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0),
      FILE_MODE,
    );
    targetCreated = true;
    await append(MEDIA_OFFSITE_MAGIC);
    await append(iv);
    const buffer = Buffer.allocUnsafe(IO_CHUNK_BYTES);
    let position = 0;
    while (position < source.info.size) {
      const { bytesRead } = await source.handle.read(
        buffer,
        0,
        Math.min(buffer.length, source.info.size - position),
        position,
      );
      if (bytesRead <= 0) fail("OFFSITE_ENCRYPTION_FAILED");
      const encrypted = cipher.update(buffer.subarray(0, bytesRead));
      if (encrypted.length > 0) await append(encrypted);
      position += bytesRead;
    }
    const final = cipher.final();
    if (final.length > 0) await append(final);
    await append(cipher.getAuthTag());
    await target.sync();
    await target.close();
    target = undefined;
    await source.handle.close();
    await syncDirectory(dirname(targetPath), "OFFSITE_ENCRYPTION_FAILED");
    return Object.freeze({
      encryptedBytes,
      encryptedSha256: encryptedHash.digest("hex"),
    });
  } catch (error) {
    await target?.close().catch(() => undefined);
    await source.handle.close().catch(() => undefined);
    if (targetCreated) await unlink(targetPath).catch(() => undefined);
    if (error instanceof MediaTransferBundleError) throw error;
    fail("OFFSITE_ENCRYPTION_FAILED");
  }
}

async function defaultVerifyEncryptedReadback({
  encryptedPath,
  encryptedBytes,
  encryptedSha256,
  encryptionKey,
  aad,
  expectedBundleBytes,
  expectedBundleSha256,
}) {
  const encrypted = await assertPrivateFile(encryptedPath, "OFFSITE_READBACK_FAILED");
  if (encrypted.info.size !== encryptedBytes || encrypted.info.size <= 8 + 12 + 16) {
    await encrypted.handle.close();
    fail("OFFSITE_READBACK_FAILED");
  }
  const encryptedHash = createHash("sha256");
  const prefix = Buffer.allocUnsafe(20);
  const prefixResult = await encrypted.handle.read(prefix, 0, prefix.length, 0);
  if (prefixResult.bytesRead !== prefix.length || !prefix.subarray(0, 8).equals(MEDIA_OFFSITE_MAGIC)) {
    await encrypted.handle.close();
    fail("OFFSITE_READBACK_FAILED");
  }
  const tag = Buffer.allocUnsafe(16);
  const tagResult = await encrypted.handle.read(tag, 0, tag.length, encrypted.info.size - tag.length);
  if (tagResult.bytesRead !== tag.length) {
    await encrypted.handle.close();
    fail("OFFSITE_READBACK_FAILED");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, prefix.subarray(8));
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  const plaintextHash = createHash("sha256");
  let plaintextBytes = 0;
  let position = 0;
  const buffer = Buffer.allocUnsafe(IO_CHUNK_BYTES);
  try {
    while (position < encrypted.info.size) {
      const { bytesRead } = await encrypted.handle.read(
        buffer,
        0,
        Math.min(buffer.length, encrypted.info.size - position),
        position,
      );
      if (bytesRead <= 0) fail("OFFSITE_READBACK_FAILED");
      encryptedHash.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }
    if (encryptedHash.digest("hex") !== encryptedSha256) fail("OFFSITE_READBACK_FAILED");

    const ciphertextStart = 20;
    const ciphertextEnd = encrypted.info.size - 16;
    position = ciphertextStart;
    while (position < ciphertextEnd) {
      const length = Math.min(buffer.length, ciphertextEnd - position);
      const { bytesRead } = await encrypted.handle.read(buffer, 0, length, position);
      if (bytesRead <= 0) fail("OFFSITE_READBACK_FAILED");
      const plaintext = decipher.update(buffer.subarray(0, bytesRead));
      plaintextHash.update(plaintext);
      plaintextBytes += plaintext.length;
      position += bytesRead;
    }
    const final = decipher.final();
    plaintextHash.update(final);
    plaintextBytes += final.length;
    if (
      plaintextBytes !== expectedBundleBytes ||
      plaintextHash.digest("hex") !== expectedBundleSha256
    ) {
      fail("OFFSITE_READBACK_FAILED");
    }
    return Object.freeze({ bundleBytes: plaintextBytes, bundleSha256: expectedBundleSha256 });
  } catch (error) {
    if (error instanceof MediaTransferBundleError) throw error;
    fail("OFFSITE_READBACK_FAILED");
  } finally {
    await encrypted.handle.close().catch(() => undefined);
  }
}

export async function backupMediaTransferBundleOffsite({
  bundlePath,
  completionReceiptPath,
  encryptionKey,
  offsiteProfileId,
  offsiteRoot,
  statPath = stat,
  verifyEncryptedReadback = defaultVerifyEncryptedReadback,
  workspaceRoot,
} = {}) {
  if (
    !PROFILE_ID_PATTERN.test(offsiteProfileId ?? "") ||
    typeof statPath !== "function" ||
    typeof verifyEncryptedReadback !== "function"
  ) {
    fail("OFFSITE_PROFILE_INVALID");
  }
  if (!Buffer.isBuffer(encryptionKey) || encryptionKey.length !== 32) {
    fail("OFFSITE_ENCRYPTION_KEY_INVALID");
  }
  const canonicalWorkspace = await assertPrivateDirectory(workspaceRoot, "OFFSITE_PROFILE_INVALID");
  const canonicalOffsite = await assertPrivateDirectory(offsiteRoot, "OFFSITE_PROFILE_INVALID");
  if (canonicalWorkspace === canonicalOffsite) fail("OFFSITE_DEVICE_NOT_SEPARATE");
  const canonicalBundle = await realpath(absoluteNormalizedPath(bundlePath, "TRANSFER_BUNDLE_UNSAFE"));
  const canonicalCompletion = await realpath(
    absoluteNormalizedPath(completionReceiptPath, "TRANSFER_COMPLETION_INVALID"),
  );
  if (
    !isContained(canonicalWorkspace, canonicalBundle) ||
    !isContained(canonicalWorkspace, canonicalCompletion)
  ) {
    fail("TRANSFER_BUNDLE_UNSAFE");
  }
  let workspaceDevice;
  let offsiteDevice;
  try {
    workspaceDevice = (await statPath(canonicalWorkspace)).dev;
    offsiteDevice = (await statPath(canonicalOffsite)).dev;
  } catch {
    fail("OFFSITE_DEVICE_NOT_SEPARATE");
  }
  if (
    !Number.isSafeInteger(workspaceDevice) ||
    !Number.isSafeInteger(offsiteDevice) ||
    workspaceDevice === offsiteDevice
  ) {
    fail("OFFSITE_DEVICE_NOT_SEPARATE");
  }

  const completionBytes = await readPrivateFile(
    canonicalCompletion,
    "TRANSFER_COMPLETION_INVALID",
    MAX_JSON_BYTES,
  );
  const completion = validateCompletion(
    parseCanonicalJson(completionBytes, "TRANSFER_COMPLETION_INVALID", true),
  );
  const bundleHash = await hashPrivateFile(
    canonicalBundle,
    completion.bundleBytes,
    "TRANSFER_BUNDLE_UNSAFE",
  );
  if (bundleHash.sha256 !== completion.bundleSha256) fail("TRANSFER_BUNDLE_HASH_MISMATCH");

  const createdDirectories = [];
  const createdFiles = [];
  try {
    const projectDirectory = await ensurePrivateChild(
      canonicalOffsite,
      "flowpack-media",
      createdDirectories,
    );
    const migrationDirectory = await ensurePrivateChild(
      projectDirectory,
      completion.migrationId,
      createdDirectories,
    );
    const encryptedBundlePath = join(
      migrationDirectory,
      `${completion.bundleSha256}.bundle.enc`,
    );
    const offsiteReceiptPath = join(
      migrationDirectory,
      `${completion.bundleSha256}.offsite.json`,
    );
    for (const path of [encryptedBundlePath, offsiteReceiptPath]) {
      try {
        await lstat(path);
        fail("OFFSITE_OUTPUT_COLLISION");
      } catch (error) {
        if (error instanceof MediaTransferBundleError) throw error;
        if (error?.code !== "ENOENT") fail("OFFSITE_OUTPUT_COLLISION");
      }
    }
    const offsiteProfileIdSha256 = mediaSha256(offsiteProfileId);
    const aad = offsiteAad(completion, offsiteProfileIdSha256);
    const encrypted = await encryptBundleToOffsite({
      aad,
      encryptionKey,
      sourceBytes: completion.bundleBytes,
      sourcePath: canonicalBundle,
      targetPath: encryptedBundlePath,
    });
    createdFiles.push(encryptedBundlePath);
    let readback;
    try {
      readback = await verifyEncryptedReadback({
        aad,
        encryptedBytes: encrypted.encryptedBytes,
        encryptedPath: encryptedBundlePath,
        encryptedSha256: encrypted.encryptedSha256,
        encryptionKey,
        expectedBundleBytes: completion.bundleBytes,
        expectedBundleSha256: completion.bundleSha256,
      });
    } catch {
      fail("OFFSITE_READBACK_FAILED");
    }
    if (
      !readback ||
      readback.bundleBytes !== completion.bundleBytes ||
      readback.bundleSha256 !== completion.bundleSha256
    ) {
      fail("OFFSITE_READBACK_FAILED");
    }
    const receipt = Object.freeze({
      bundleBytes: completion.bundleBytes,
      bundleSha256: completion.bundleSha256,
      encryptedBytes: encrypted.encryptedBytes,
      encryptedSha256: encrypted.encryptedSha256,
      mediaEvidenceManifestSha256: completion.mediaEvidenceManifestSha256,
      migrationId: completion.migrationId,
      offsiteProfileIdSha256,
      projectId: MEDIA_PROJECT_ID,
      readbackBundleSha256: readback.bundleSha256,
      releaseCommit: completion.releaseCommit,
      remoteLockIdentitySha256: completion.remoteLockIdentitySha256,
      schemaVersion: MEDIA_TRANSFER_SCHEMA_VERSION,
      state: "verified",
      transferManifestSha256: completion.transferManifestSha256,
    });
    await writeAtomicPrivateExclusive(
      offsiteReceiptPath,
      Buffer.from(`${canonicalMediaJson(receipt)}\n`, "utf8"),
      "OFFSITE_RECEIPT_WRITE_FAILED",
    );
    createdFiles.push(offsiteReceiptPath);
    return Object.freeze({
      bundleSha256: completion.bundleSha256,
      encryptedBundlePath,
      encryptedBytes: encrypted.encryptedBytes,
      encryptedSha256: encrypted.encryptedSha256,
      mediaEvidenceManifestSha256: completion.mediaEvidenceManifestSha256,
      migrationIdSha256: mediaSha256(completion.migrationId),
      offsiteProfileIdSha256,
      offsiteReceiptPath,
      ok: true,
      readbackVerified: true,
      releaseCommit: completion.releaseCommit,
      remoteLockIdentitySha256: completion.remoteLockIdentitySha256,
      transferManifestSha256: completion.transferManifestSha256,
    });
  } catch (error) {
    for (const path of createdFiles.reverse()) await unlink(path).catch(() => undefined);
    for (const path of createdDirectories.reverse()) await rmdir(path).catch(() => undefined);
    if (error instanceof MediaTransferBundleError) throw error;
    fail("OFFSITE_BACKUP_FAILED");
  }
}
