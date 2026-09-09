import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { constants } from "node:fs";
import {
  lstat,
  open,
  readdir,
  realpath,
  rm,
  unlink,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { canonicalMediaJson, mediaSha256 } from "./nas-media-contract.mjs";

const PROJECT_ID = "flowpack-nas";
const HANDLE_SCHEMA_VERSION = 1;
const HANDLE_MAGIC = Buffer.from("FPMHNDL1", "ascii");
const HANDLE_KEY_CONTEXT = Buffer.from("flowpack-media-artifact-handle-v1\0", "utf8");
const FILE_MODE = 0o600;
const DIRECTORY_MODE = 0o700;
const MAX_HANDLE_BYTES = 4 * 1024 * 1024;
const MAX_ARTIFACT_BYTES = 128 * 1024 * 1024;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MIGRATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RELEASE_PATTERN = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const ARTIFACT_DIRECTORY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const BINDING_KEYS = Object.freeze([
  "candidateDatabaseNameSha256",
  "databaseBindingAttestationSha256",
  "migrationId",
  "projectId",
  "releaseCommit",
  "remoteLockIdentitySha256",
  "sourceFreezeReceiptSha256",
  "sourceSnapshotEvidenceSha256",
]);
const EVIDENCE_KEYS = Object.freeze([
  "encryptedRollbackSha256",
  "manifestSha256",
  "rewritePlanSha256",
]);
const ARTIFACT_FILES = Object.freeze({
  encryptedRollbackSha256: "rollback-map.enc",
  manifestSha256: "manifest.json",
  rewritePlanSha256: "rewrite-plan.json",
});
const INCOMPLETE_FILE = ".artifact-incomplete.json";
const COMPLETE_FILE = ".artifact-complete.json";

export class MediaArtifactHandleError extends Error {
  constructor(code) {
    super(code);
    this.name = "MediaArtifactHandleError";
    this.code = code;
  }
}

function fail(code) {
  throw new MediaArtifactHandleError(code);
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

async function privateDirectory(path, code) {
  absoluteNormalizedPath(path, code);
  let info;
  let canonical;
  try {
    info = await lstat(path);
    canonical = await realpath(path);
  } catch {
    fail(code);
  }
  if (
    info.isSymbolicLink() ||
    !info.isDirectory() ||
    (info.mode & 0o777) !== DIRECTORY_MODE ||
    canonical !== path
  ) fail(code);
  return Object.freeze({ canonical, dev: info.dev, ino: info.ino });
}

async function syncDirectory(path, code) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const info = await handle.stat();
    if (!info.isDirectory() || (info.mode & 0o777) !== DIRECTORY_MODE) fail(code);
    await handle.sync();
  } catch (error) {
    if (error instanceof MediaArtifactHandleError) throw error;
    fail(code);
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function readPrivateFile(path, code, maximumBytes = MAX_ARTIFACT_BYTES) {
  absoluteNormalizedPath(path, code);
  await privateDirectory(dirname(path), code);
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const before = await handle.stat();
    if (
      !before.isFile() ||
      before.nlink !== 1 ||
      (before.mode & 0o777) !== FILE_MODE ||
      before.size <= 0 ||
      before.size > maximumBytes
    ) fail(code);
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (
      bytes.length !== before.size ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.nlink !== 1 ||
      (after.mode & 0o777) !== FILE_MODE
    ) fail(code);
    return Object.freeze({
      bytes,
      identity: Object.freeze({ dev: before.dev, ino: before.ino, size: before.size }),
      sha256: mediaSha256(bytes),
    });
  } catch (error) {
    if (error instanceof MediaArtifactHandleError) throw error;
    fail(code);
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function readOptionalPrivateFile(path, code, maximumBytes) {
  try {
    return await readPrivateFile(path, code, maximumBytes);
  } catch (error) {
    if (error instanceof MediaArtifactHandleError) {
      try {
        await lstat(path);
      } catch (missing) {
        if (missing?.code === "ENOENT") return undefined;
      }
    }
    throw error;
  }
}

async function writeExclusivePrivate(path, bytes, code) {
  absoluteNormalizedPath(path, code);
  await privateDirectory(dirname(path), code);
  let handle;
  let created = false;
  let createdIdentity;
  try {
    handle = await open(
      path,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_WRONLY |
        (constants.O_NOFOLLOW ?? 0),
      FILE_MODE,
    );
    created = true;
    await handle.writeFile(bytes);
    await handle.sync();
    const info = await handle.stat();
    createdIdentity = Object.freeze({ dev: info.dev, ino: info.ino });
    if (
      !info.isFile() ||
      info.nlink !== 1 ||
      (info.mode & 0o777) !== FILE_MODE ||
      info.size !== bytes.length
    ) fail(code);
    await handle.close();
    handle = undefined;
    await syncDirectory(dirname(path), code);
    const readback = await readPrivateFile(path, code, Math.max(bytes.length, 1));
    if (!readback.bytes.equals(bytes)) fail(code);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (created && createdIdentity !== undefined) {
      try {
        const actual = await lstat(path);
        if (
          !actual.isSymbolicLink() &&
          actual.isFile() &&
          actual.dev === createdIdentity.dev &&
          actual.ino === createdIdentity.ino
        ) {
          await unlink(path);
          await syncDirectory(dirname(path), code);
        }
      } catch {
        // Preserve the original fail-closed error. A later recovery pass only
        // cleans artifacts whose exact binding marker validates.
      }
    }
    if (error instanceof MediaArtifactHandleError) throw error;
    fail(code);
  }
}

async function writeCanonicalExclusive(path, value, code) {
  const bytes = Buffer.from(`${canonicalMediaJson(value)}\n`, "utf8");
  await writeExclusivePrivate(path, bytes, code);
  return Object.freeze({ bytes, sha256: mediaSha256(bytes) });
}

function parseCanonical(bytes, code) {
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(code);
  }
  if (!bytes.equals(Buffer.from(`${canonicalMediaJson(value)}\n`, "utf8"))) fail(code);
  return value;
}

export function validateMediaArtifactBinding(value) {
  if (
    !exactKeys(value, BINDING_KEYS) ||
    value.projectId !== PROJECT_ID ||
    !MIGRATION_ID_PATTERN.test(value.migrationId ?? "") ||
    !RELEASE_PATTERN.test(value.releaseCommit ?? "") ||
    [
      value.candidateDatabaseNameSha256,
      value.databaseBindingAttestationSha256,
      value.remoteLockIdentitySha256,
      value.sourceFreezeReceiptSha256,
      value.sourceSnapshotEvidenceSha256,
    ].some((entry) => !HASH_PATTERN.test(entry ?? ""))
  ) fail("MEDIA_ARTIFACT_BINDING_INVALID");
  return Object.freeze({ ...value });
}

function validateEvidence(value) {
  if (
    !exactKeys(value, EVIDENCE_KEYS) ||
    EVIDENCE_KEYS.some((key) => !HASH_PATTERN.test(value[key] ?? ""))
  ) fail("MEDIA_ARTIFACT_COMPLETE_INVALID");
  return Object.freeze({ ...value });
}

function validatePreparation(value, evidence) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.ok !== true ||
    value.evidence?.manifestSha256 !== evidence.manifestSha256 ||
    value.evidence?.rewritePlanSha256 !== evidence.rewritePlanSha256 ||
    value.evidence?.encryptedRollbackSha256 !== evidence.encryptedRollbackSha256 ||
    !Number.isSafeInteger(value.objects?.staged) ||
    value.objects.staged <= 0 ||
    !Number.isSafeInteger(value.objects?.bytes) ||
    value.objects.bytes <= 0 ||
    !Number.isSafeInteger(value.rewrite?.operations) ||
    value.rewrite.operations <= 0 ||
    value.rewrite.transactional !== true ||
    value.rewrite.mutationPerformed !== false
  ) fail("MEDIA_ARTIFACT_PREPARATION_INVALID");
  return Object.freeze(JSON.parse(canonicalMediaJson(value)));
}

function bindingDigest(binding) {
  return mediaSha256(canonicalMediaJson(validateMediaArtifactBinding(binding)));
}

function validateState(value, expectedBinding, expectedState) {
  const keys = expectedState === "incomplete"
    ? ["binding", "bindingSha256", "projectId", "schemaVersion", "state"]
    : [
        "binding",
        "bindingSha256",
        "evidence",
        "preparation",
        "preparationSha256",
        "projectId",
        "schemaVersion",
        "state",
      ];
  if (
    !exactKeys(value, keys) ||
    value.schemaVersion !== HANDLE_SCHEMA_VERSION ||
    value.projectId !== PROJECT_ID ||
    value.state !== expectedState
  ) fail(`MEDIA_ARTIFACT_${expectedState.toUpperCase()}_INVALID`);
  const binding = validateMediaArtifactBinding(value.binding);
  if (
    canonicalMediaJson(binding) !== canonicalMediaJson(expectedBinding) ||
    value.bindingSha256 !== bindingDigest(binding)
  ) fail("MEDIA_ARTIFACT_BINDING_MISMATCH");
  if (expectedState === "incomplete") return Object.freeze({ ...value });
  const evidence = validateEvidence(value.evidence);
  const preparation = validatePreparation(value.preparation, evidence);
  if (value.preparationSha256 !== mediaSha256(canonicalMediaJson(preparation))) {
    fail("MEDIA_ARTIFACT_COMPLETE_INVALID");
  }
  return Object.freeze({ ...value, binding, evidence, preparation });
}

function deriveHandleKey(key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) fail("MEDIA_ARTIFACT_HANDLE_KEY_INVALID");
  return createHash("sha256").update(HANDLE_KEY_CONTEXT).update(key).digest();
}

function handleAad(binding, handlePath) {
  return Buffer.from(canonicalMediaJson({
    binding,
    handlePathSha256: mediaSha256(handlePath),
    projectId: PROJECT_ID,
    schemaVersion: HANDLE_SCHEMA_VERSION,
  }), "utf8");
}

function encryptHandle(payload, binding, handlePath, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveHandleKey(key), iv);
  cipher.setAAD(handleAad(binding, handlePath));
  const plaintext = Buffer.from(canonicalMediaJson(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([HANDLE_MAGIC, iv, cipher.getAuthTag(), ciphertext]);
}

function decryptHandle(bytes, binding, handlePath, key) {
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length <= HANDLE_MAGIC.length + 12 + 16 ||
    bytes.length > MAX_HANDLE_BYTES ||
    !bytes.subarray(0, HANDLE_MAGIC.length).equals(HANDLE_MAGIC)
  ) fail("MEDIA_ARTIFACT_HANDLE_INVALID");
  const ivOffset = HANDLE_MAGIC.length;
  const tagOffset = ivOffset + 12;
  const bodyOffset = tagOffset + 16;
  let plaintext;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveHandleKey(key),
      bytes.subarray(ivOffset, tagOffset),
    );
    decipher.setAAD(handleAad(binding, handlePath));
    decipher.setAuthTag(bytes.subarray(tagOffset, bodyOffset));
    plaintext = Buffer.concat([
      decipher.update(bytes.subarray(bodyOffset)),
      decipher.final(),
    ]);
  } catch {
    fail("MEDIA_ARTIFACT_HANDLE_INVALID");
  }
  let value;
  try {
    value = JSON.parse(plaintext.toString("utf8"));
  } catch {
    fail("MEDIA_ARTIFACT_HANDLE_INVALID");
  }
  if (!plaintext.equals(Buffer.from(canonicalMediaJson(value), "utf8"))) {
    fail("MEDIA_ARTIFACT_HANDLE_INVALID");
  }
  return value;
}

async function artifactRoots(storageRoot) {
  const root = await privateDirectory(storageRoot, "MEDIA_ARTIFACT_STORAGE_INVALID");
  const migrationsPath = join(root.canonical, ".nas-media-migrations");
  const migrations = await privateDirectory(
    migrationsPath,
    "MEDIA_ARTIFACT_STORAGE_INVALID",
  );
  if (!isContained(root.canonical, migrations.canonical)) {
    fail("MEDIA_ARTIFACT_STORAGE_INVALID");
  }
  return Object.freeze({ root: root.canonical, migrations: migrations.canonical });
}

function assertHandleOutsideArtifactTree(handlePath, roots) {
  if (handlePath === roots.migrations || isContained(roots.migrations, handlePath)) {
    fail("MEDIA_ARTIFACT_HANDLE_PATH_INVALID");
  }
}

async function validateArtifactDirectory(path, roots) {
  const name = path.slice(roots.migrations.length + 1);
  if (!ARTIFACT_DIRECTORY_PATTERN.test(name) || join(roots.migrations, name) !== path) {
    fail("MEDIA_ARTIFACT_DIRECTORY_INVALID");
  }
  const directory = await privateDirectory(path, "MEDIA_ARTIFACT_DIRECTORY_INVALID");
  if (!isContained(roots.migrations, directory.canonical)) {
    fail("MEDIA_ARTIFACT_DIRECTORY_INVALID");
  }
  return Object.freeze({ name, ...directory });
}

async function validateCompleteArtifact(path, roots, binding) {
  const directory = await validateArtifactDirectory(path, roots);
  const completeDocument = await readPrivateFile(
    join(path, COMPLETE_FILE),
    "MEDIA_ARTIFACT_COMPLETE_INVALID",
    MAX_HANDLE_BYTES,
  );
  const complete = validateState(
    parseCanonical(completeDocument.bytes, "MEDIA_ARTIFACT_COMPLETE_INVALID"),
    binding,
    "complete",
  );
  const artifacts = {};
  for (const [digestKey, fileName] of Object.entries(ARTIFACT_FILES)) {
    const document = await readPrivateFile(
      join(path, fileName),
      "MEDIA_ARTIFACT_FILE_INVALID",
    );
    if (document.sha256 !== complete.evidence[digestKey]) {
      fail("MEDIA_ARTIFACT_FILE_DIGEST_MISMATCH");
    }
    artifacts[fileName] = document;
  }
  return Object.freeze({ artifacts: Object.freeze(artifacts), complete, directory });
}

function handlePayload(artifact, binding) {
  return Object.freeze({
    artifactDirectoryName: artifact.directory.name,
    binding,
    bindingSha256: bindingDigest(binding),
    completeReceiptSha256: artifact.completeReceiptSha256,
    evidence: artifact.complete.evidence,
    preparation: artifact.complete.preparation,
    preparationSha256: artifact.complete.preparationSha256,
    projectId: PROJECT_ID,
    schemaVersion: HANDLE_SCHEMA_VERSION,
    state: "sealed",
  });
}

function validateHandlePayload(value, binding) {
  if (
    !exactKeys(value, [
      "artifactDirectoryName",
      "binding",
      "bindingSha256",
      "completeReceiptSha256",
      "evidence",
      "preparation",
      "preparationSha256",
      "projectId",
      "schemaVersion",
      "state",
    ]) ||
    value.schemaVersion !== HANDLE_SCHEMA_VERSION ||
    value.projectId !== PROJECT_ID ||
    value.state !== "sealed" ||
    !ARTIFACT_DIRECTORY_PATTERN.test(value.artifactDirectoryName ?? "") ||
    !HASH_PATTERN.test(value.completeReceiptSha256 ?? "")
  ) fail("MEDIA_ARTIFACT_HANDLE_INVALID");
  const complete = validateState({
    binding: value.binding,
    bindingSha256: value.bindingSha256,
    evidence: value.evidence,
    preparation: value.preparation,
    preparationSha256: value.preparationSha256,
    projectId: value.projectId,
    schemaVersion: value.schemaVersion,
    state: "complete",
  }, binding, "complete");
  return Object.freeze({ ...value, ...complete, state: "sealed" });
}

async function writeHandleForArtifact({ artifact, binding, handlePath, key }) {
  const payload = handlePayload(artifact, binding);
  const bytes = encryptHandle(payload, binding, handlePath, key);
  await writeExclusivePrivate(handlePath, bytes, "MEDIA_ARTIFACT_HANDLE_WRITE_FAILED");
  return Object.freeze({
    artifactHandleSha256: mediaSha256(bytes),
    preparation: payload.preparation,
  });
}

async function readHandle({ binding, handlePath, key, roots }) {
  const document = await readPrivateFile(
    handlePath,
    "MEDIA_ARTIFACT_HANDLE_INVALID",
    MAX_HANDLE_BYTES,
  );
  const payload = validateHandlePayload(
    decryptHandle(document.bytes, binding, handlePath, key),
    binding,
  );
  const artifactPath = join(roots.migrations, payload.artifactDirectoryName);
  const artifact = await validateCompleteArtifact(artifactPath, roots, binding);
  const actualComplete = await readPrivateFile(
    join(artifactPath, COMPLETE_FILE),
    "MEDIA_ARTIFACT_COMPLETE_INVALID",
    MAX_HANDLE_BYTES,
  );
  if (
    actualComplete.sha256 !== payload.completeReceiptSha256 ||
    canonicalMediaJson(artifact.complete.evidence) !== canonicalMediaJson(payload.evidence) ||
    artifact.complete.preparationSha256 !== payload.preparationSha256
  ) fail("MEDIA_ARTIFACT_HANDLE_BINDING_MISMATCH");
  return Object.freeze({ artifact, document, path: artifactPath, payload });
}

async function scanMatchingArtifacts(roots, binding) {
  let entries;
  try {
    entries = await readdir(roots.migrations, { withFileTypes: true });
  } catch {
    fail("MEDIA_ARTIFACT_RECOVERY_FAILED");
  }
  const digest = bindingDigest(binding);
  const complete = [];
  const incomplete = [];
  for (const entry of entries) {
    if (!ARTIFACT_DIRECTORY_PATTERN.test(entry.name)) continue;
    const path = join(roots.migrations, entry.name);
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      fail("MEDIA_ARTIFACT_DIRECTORY_INVALID");
    }
    await validateArtifactDirectory(path, roots);
    const completePath = join(path, COMPLETE_FILE);
    const incompletePath = join(path, INCOMPLETE_FILE);
    const completeDocument = await readOptionalPrivateFile(
      completePath,
      "MEDIA_ARTIFACT_COMPLETE_INVALID",
      MAX_HANDLE_BYTES,
    );
    if (completeDocument) {
      const value = parseCanonical(completeDocument.bytes, "MEDIA_ARTIFACT_COMPLETE_INVALID");
      if (value?.bindingSha256 === digest) complete.push(path);
      continue;
    }
    const incompleteDocument = await readOptionalPrivateFile(
      incompletePath,
      "MEDIA_ARTIFACT_INCOMPLETE_INVALID",
      MAX_HANDLE_BYTES,
    );
    if (incompleteDocument) {
      const value = parseCanonical(incompleteDocument.bytes, "MEDIA_ARTIFACT_INCOMPLETE_INVALID");
      if (value?.bindingSha256 === digest) {
        validateState(value, binding, "incomplete");
        incomplete.push(path);
      }
    }
  }
  return Object.freeze({ complete, incomplete });
}

async function cleanupIncomplete(paths, roots) {
  for (const path of paths) {
    await validateArtifactDirectory(path, roots);
    try {
      await rm(path, { recursive: true });
      await syncDirectory(roots.migrations, "MEDIA_ARTIFACT_CLEANUP_FAILED");
    } catch (error) {
      if (error instanceof MediaArtifactHandleError) throw error;
      fail("MEDIA_ARTIFACT_CLEANUP_FAILED");
    }
  }
}

async function cleanupCompletedMarker(path, binding) {
  const markerPath = join(path, INCOMPLETE_FILE);
  const document = await readOptionalPrivateFile(
    markerPath,
    "MEDIA_ARTIFACT_INCOMPLETE_INVALID",
    MAX_HANDLE_BYTES,
  );
  if (document === undefined) return;
  validateState(
    parseCanonical(document.bytes, "MEDIA_ARTIFACT_INCOMPLETE_INVALID"),
    binding,
    "incomplete",
  );
  try {
    await unlink(markerPath);
    await syncDirectory(path, "MEDIA_ARTIFACT_CLEANUP_FAILED");
  } catch {
    fail("MEDIA_ARTIFACT_CLEANUP_FAILED");
  }
}

export async function beginSealedMediaArtifact({ artifactDirectory, binding }) {
  const expected = validateMediaArtifactBinding(binding);
  const path = absoluteNormalizedPath(
    artifactDirectory,
    "MEDIA_ARTIFACT_DIRECTORY_INVALID",
  );
  await privateDirectory(path, "MEDIA_ARTIFACT_DIRECTORY_INVALID");
  const document = Object.freeze({
    binding: expected,
    bindingSha256: bindingDigest(expected),
    projectId: PROJECT_ID,
    schemaVersion: HANDLE_SCHEMA_VERSION,
    state: "incomplete",
  });
  await writeCanonicalExclusive(
    join(path, INCOMPLETE_FILE),
    document,
    "MEDIA_ARTIFACT_INCOMPLETE_WRITE_FAILED",
  );
  return Object.freeze({ bindingSha256: document.bindingSha256 });
}

export async function sealPreparedMediaArtifact({
  artifactDirectory,
  binding,
  handlePath,
  key,
  preparation,
  storageRoot,
} = {}) {
  const expected = validateMediaArtifactBinding(binding);
  absoluteNormalizedPath(handlePath, "MEDIA_ARTIFACT_HANDLE_PATH_INVALID");
  await privateDirectory(dirname(handlePath), "MEDIA_ARTIFACT_HANDLE_PATH_INVALID");
  deriveHandleKey(key);
  const roots = await artifactRoots(storageRoot);
  assertHandleOutsideArtifactTree(handlePath, roots);
  const directory = await validateArtifactDirectory(
    absoluteNormalizedPath(artifactDirectory, "MEDIA_ARTIFACT_DIRECTORY_INVALID"),
    roots,
  );
  const incompleteDocument = await readPrivateFile(
    join(artifactDirectory, INCOMPLETE_FILE),
    "MEDIA_ARTIFACT_INCOMPLETE_INVALID",
    MAX_HANDLE_BYTES,
  );
  validateState(
    parseCanonical(incompleteDocument.bytes, "MEDIA_ARTIFACT_INCOMPLETE_INVALID"),
    expected,
    "incomplete",
  );
  const evidence = validateEvidence(preparation?.evidence);
  const safePreparation = validatePreparation(preparation, evidence);
  for (const [digestKey, fileName] of Object.entries(ARTIFACT_FILES)) {
    const artifact = await readPrivateFile(
      join(artifactDirectory, fileName),
      "MEDIA_ARTIFACT_FILE_INVALID",
    );
    if (artifact.sha256 !== evidence[digestKey]) fail("MEDIA_ARTIFACT_FILE_DIGEST_MISMATCH");
  }
  const complete = Object.freeze({
    binding: expected,
    bindingSha256: bindingDigest(expected),
    evidence,
    preparation: safePreparation,
    preparationSha256: mediaSha256(canonicalMediaJson(safePreparation)),
    projectId: PROJECT_ID,
    schemaVersion: HANDLE_SCHEMA_VERSION,
    state: "complete",
  });
  const completeWrite = await writeCanonicalExclusive(
    join(artifactDirectory, COMPLETE_FILE),
    complete,
    "MEDIA_ARTIFACT_COMPLETE_WRITE_FAILED",
  );
  const artifact = await validateCompleteArtifact(artifactDirectory, roots, expected);
  const boundArtifact = Object.freeze({
    ...artifact,
    completeReceiptSha256: completeWrite.sha256,
    directory,
  });
  const result = await writeHandleForArtifact({
    artifact: boundArtifact,
    binding: expected,
    handlePath,
    key,
  });
  await unlink(join(artifactDirectory, INCOMPLETE_FILE));
  await syncDirectory(artifactDirectory, "MEDIA_ARTIFACT_COMPLETE_WRITE_FAILED");
  return Object.freeze({
    artifactHandleSha256: result.artifactHandleSha256,
    ok: true,
    resumed: false,
  });
}

export async function recoverSealedMediaArtifact({
  binding,
  handlePath,
  key,
  storageRoot,
} = {}) {
  const expected = validateMediaArtifactBinding(binding);
  absoluteNormalizedPath(handlePath, "MEDIA_ARTIFACT_HANDLE_PATH_INVALID");
  await privateDirectory(dirname(handlePath), "MEDIA_ARTIFACT_HANDLE_PATH_INVALID");
  deriveHandleKey(key);
  const storage = await privateDirectory(storageRoot, "MEDIA_ARTIFACT_STORAGE_INVALID");
  const migrationsPath = join(storage.canonical, ".nas-media-migrations");
  try {
    await lstat(migrationsPath);
  } catch (error) {
    if (error?.code !== "ENOENT") fail("MEDIA_ARTIFACT_STORAGE_INVALID");
    const unexpectedHandle = await readOptionalPrivateFile(
      handlePath,
      "MEDIA_ARTIFACT_HANDLE_INVALID",
      MAX_HANDLE_BYTES,
    );
    if (unexpectedHandle !== undefined) fail("MEDIA_ARTIFACT_HANDLE_INVALID");
    return undefined;
  }
  const roots = await artifactRoots(storageRoot);
  assertHandleOutsideArtifactTree(handlePath, roots);
  const existingHandle = await readOptionalPrivateFile(
    handlePath,
    "MEDIA_ARTIFACT_HANDLE_INVALID",
    MAX_HANDLE_BYTES,
  );
  if (existingHandle) {
    const opened = await readHandle({ binding: expected, handlePath, key, roots });
    const matches = await scanMatchingArtifacts(roots, expected);
    if (
      matches.complete.length !== 1 ||
      matches.complete[0] !== opened.path
    ) fail("MEDIA_ARTIFACT_RECOVERY_COLLISION");
    await cleanupIncomplete(
      matches.incomplete.filter((path) => path !== opened.path),
      roots,
    );
    await cleanupCompletedMarker(opened.path, expected);
    return Object.freeze({
      artifactHandleSha256: opened.document.sha256,
      ok: true,
      preparation: opened.payload.preparation,
      resumed: true,
    });
  }
  const matches = await scanMatchingArtifacts(roots, expected);
  if (matches.complete.length > 1) fail("MEDIA_ARTIFACT_RECOVERY_COLLISION");
  await cleanupIncomplete(matches.incomplete, roots);
  if (matches.complete.length === 0) return undefined;
  const artifactPath = matches.complete[0];
  const artifact = await validateCompleteArtifact(artifactPath, roots, expected);
  const completeDocument = await readPrivateFile(
    join(artifactPath, COMPLETE_FILE),
    "MEDIA_ARTIFACT_COMPLETE_INVALID",
    MAX_HANDLE_BYTES,
  );
  const result = await writeHandleForArtifact({
    artifact: Object.freeze({
      ...artifact,
      completeReceiptSha256: completeDocument.sha256,
    }),
    binding: expected,
    handlePath,
    key,
  });
  return Object.freeze({
    artifactHandleSha256: result.artifactHandleSha256,
    ok: true,
    preparation: result.preparation,
    resumed: true,
  });
}

export async function withSealedMediaArtifact({
  binding,
  consume,
  expectedHandleSha256,
  handlePath,
  key,
  storageRoot,
} = {}) {
  if (typeof consume !== "function" || !HASH_PATTERN.test(expectedHandleSha256 ?? "")) {
    fail("MEDIA_ARTIFACT_CONSUMER_INVALID");
  }
  const expected = validateMediaArtifactBinding(binding);
  const roots = await artifactRoots(storageRoot);
  assertHandleOutsideArtifactTree(handlePath, roots);
  const opened = await readHandle({ binding: expected, handlePath, key, roots });
  if (opened.document.sha256 !== expectedHandleSha256) {
    fail("MEDIA_ARTIFACT_HANDLE_DIGEST_MISMATCH");
  }
  let result;
  try {
    result = await consume(Object.freeze({
      artifactDirectory: opened.path,
      manifestPath: join(opened.path, "manifest.json"),
      rollbackMappingPath: join(opened.path, "rollback-map.enc"),
      rewritePlanPath: join(opened.path, "rewrite-plan.json"),
      storageRoot: roots.root,
    }));
  } catch {
    fail("MEDIA_ARTIFACT_CONSUMER_FAILED");
  }
  const after = await readHandle({ binding: expected, handlePath, key, roots });
  if (
    after.document.sha256 !== opened.document.sha256 ||
    after.payload.completeReceiptSha256 !== opened.payload.completeReceiptSha256 ||
    after.path !== opened.path
  ) fail("MEDIA_ARTIFACT_CHANGED_DURING_CONSUMPTION");
  return result;
}
