#!/usr/bin/env node

import { createDecipheriv, createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

import {
  MEDIA_EVIDENCE_SCHEMA_VERSION,
  MEDIA_PROJECT_ID,
  canonicalMediaJson,
  mediaCandidateIdentitySha256,
  mediaOwnershipIdentitySha256,
  normalizeMediaOwnershipIdentity,
} from "./nas-media-contract.mjs";

const PROJECT_ID = MEDIA_PROJECT_ID;
const SCHEMA_VERSION = MEDIA_EVIDENCE_SCHEMA_VERSION;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MIGRATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const OBJECT_KEY_PATTERN = /^objects\/([a-f0-9]{2})\/([a-f0-9]{64})\.(?:jpg|png|gif|webp|mp3|m4a|wav|ogg|pdf)$/;
const MAX_CONTROL_BYTES = 64 * 1024;
const MAX_JSON_ARTIFACT_BYTES = 64 * 1024 * 1024;
const MAX_MAPPING_BYTES = 128 * 1024 * 1024;

const CONTROL_KEYS = [
  "candidateAttestationSha256",
  "candidateDatabaseNameSha256",
  "candidateIdentitySha256",
  "encryptedRollbackSha256",
  "manifestSha256",
  "migrationId",
  "projectId",
  "reviewDigest",
  "remoteLockIdentitySha256",
  "rewritePlanSha256",
  "schemaVersion",
  "targetKind",
];
const ALLOWED_FIELDS = Object.freeze({
  media_files: new Set(["url"]),
  content_images: new Set(["url"]),
  contents: new Set(["thumbnailUrl", "body", "slides"]),
});

export class MediaOperatorError extends Error {
  constructor(code) {
    super(code);
    this.name = "MediaOperatorError";
    this.code = code;
  }
}

function fail(code) {
  throw new MediaOperatorError(code);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function exactKeys(value, keys) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort())
  );
}

function isIdentifier(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

async function readPrivateRegularFile(path, { code, maxBytes }) {
  if (
    typeof path !== "string" ||
    !isAbsolute(path) ||
    resolve(path) !== path ||
    path.includes("\0")
  ) {
    fail(code);
  }
  let parentInfo;
  try {
    parentInfo = await lstat(dirname(path));
  } catch {
    fail(code);
  }
  if (
    parentInfo.isSymbolicLink() ||
    !parentInfo.isDirectory() ||
    (parentInfo.mode & 0o777) !== 0o700
  ) {
    fail(code);
  }
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  } catch {
    fail(code);
  }
  try {
    const info = await handle.stat();
    if (
      !info.isFile() ||
      info.nlink !== 1 ||
      (info.mode & 0o777) !== 0o600 ||
      info.size <= 0 ||
      info.size > maxBytes
    ) {
      fail(code);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (
      bytes.length <= 0 ||
      bytes.length !== info.size ||
      bytes.length > maxBytes ||
      !after.isFile() ||
      after.dev !== info.dev ||
      after.ino !== info.ino ||
      after.nlink !== 1 ||
      after.size !== info.size ||
      (after.mode & 0o777) !== 0o600
    ) fail(code);
    return bytes;
  } catch {
    fail(code);
  } finally {
    await handle.close().catch(() => undefined);
  }
}

function parseJson(bytes, code) {
  try {
    const parsed = JSON.parse(bytes.toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail(code);
    return parsed;
  } catch (error) {
    if (error instanceof MediaOperatorError) throw error;
    fail(code);
  }
}

async function loadControl(controlPath) {
  const bytes = await readPrivateRegularFile(controlPath, {
    code: "CONTROL_FILE_UNSAFE",
    maxBytes: MAX_CONTROL_BYTES,
  });
  const control = parseJson(bytes, "CONTROL_FILE_INVALID");
  if (
    !exactKeys(control, CONTROL_KEYS) ||
    control.schemaVersion !== SCHEMA_VERSION ||
    control.projectId !== PROJECT_ID ||
    control.targetKind !== "candidate" ||
    !MIGRATION_ID_PATTERN.test(control.migrationId ?? "") ||
    !HASH_PATTERN.test(control.candidateAttestationSha256 ?? "") ||
    !HASH_PATTERN.test(control.candidateDatabaseNameSha256 ?? "") ||
    !HASH_PATTERN.test(control.candidateIdentitySha256 ?? "") ||
    !HASH_PATTERN.test(control.remoteLockIdentitySha256 ?? "") ||
    !HASH_PATTERN.test(control.reviewDigest ?? "") ||
    !HASH_PATTERN.test(control.manifestSha256 ?? "") ||
    !HASH_PATTERN.test(control.rewritePlanSha256 ?? "") ||
    !HASH_PATTERN.test(control.encryptedRollbackSha256 ?? "")
  ) {
    fail("CONTROL_FILE_INVALID");
  }
  let expectedCandidateIdentity;
  try {
    expectedCandidateIdentity = mediaCandidateIdentitySha256({
      candidateDatabaseNameSha256: control.candidateDatabaseNameSha256,
      migrationId: control.migrationId,
      projectId: control.projectId,
      remoteLockIdentitySha256: control.remoteLockIdentitySha256,
    });
  } catch {
    fail("CONTROL_FILE_INVALID");
  }
  if (expectedCandidateIdentity !== control.candidateIdentitySha256) {
    fail("CONTROL_FILE_INVALID");
  }
  return Object.freeze({ ...control });
}

function validateReview(review, control) {
  if (
    !exactKeys(review, ["reviewDigest", "reviewedAt", "reviewerIdSha256", "state"]) ||
    review.reviewDigest !== control.reviewDigest ||
    review.state !== "approved" ||
    !HASH_PATTERN.test(review.reviewerIdSha256 ?? "") ||
    typeof review.reviewedAt !== "string" ||
    Number.isNaN(Date.parse(review.reviewedAt))
  ) {
    fail("REVIEW_EVIDENCE_INVALID");
  }
}

function validateManifest(manifest, control) {
  if (
    !exactKeys(manifest, [
      "encryptedRollbackSha256",
      "inventory",
      "objects",
      "policy",
      "projectId",
      "review",
      "rewritePlanSha256",
      "schemaVersion",
    ]) ||
    manifest.projectId !== PROJECT_ID ||
    manifest.schemaVersion !== SCHEMA_VERSION ||
    manifest.encryptedRollbackSha256 !== control.encryptedRollbackSha256 ||
    manifest.rewritePlanSha256 !== control.rewritePlanSha256 ||
    !Array.isArray(manifest.objects) ||
    manifest.objects.length === 0
  ) {
    fail("MANIFEST_INVALID");
  }
  validateReview(manifest.review, control);

  const byKey = new Map();
  let totalBytes = 0;
  for (const object of manifest.objects) {
    if (
      !exactKeys(object, ["bytes", "classifications", "key", "mimeType", "sha256", "sourceCount"]) ||
      !Number.isSafeInteger(object.bytes) ||
      object.bytes <= 0 ||
      !Number.isSafeInteger(object.sourceCount) ||
      object.sourceCount <= 0 ||
      !Array.isArray(object.classifications) ||
      object.classifications.some((value) => !isIdentifier(value)) ||
      !HASH_PATTERN.test(object.sha256 ?? "")
    ) {
      fail("MANIFEST_OBJECT_INVALID");
    }
    const match = OBJECT_KEY_PATTERN.exec(object.key ?? "");
    if (
      !match ||
      match[1] !== object.sha256.slice(0, 2) ||
      match[2] !== object.sha256 ||
      byKey.has(object.key)
    ) {
      fail("MANIFEST_OBJECT_INVALID");
    }
    byKey.set(object.key, Object.freeze({ ...object }));
    totalBytes += object.bytes;
    if (!Number.isSafeInteger(totalBytes)) fail("MANIFEST_OBJECT_INVALID");
  }
  return { byKey, totalBytes };
}

function validateSafeOperation(operation) {
  if (
    !exactKeys(operation, [
      "coupledBlobKey",
      "expectedValueSha256",
      "field",
      "locatorSha256",
      "objectKeys",
      "occurrenceCount",
      "operationId",
      "ownershipIdentitySha256",
      "replacementValueSha256",
      "table",
    ]) ||
    !ALLOWED_FIELDS[operation.table]?.has(operation.field) ||
    typeof operation.coupledBlobKey !== "boolean" ||
    !HASH_PATTERN.test(operation.expectedValueSha256 ?? "") ||
    !HASH_PATTERN.test(operation.locatorSha256 ?? "") ||
    !HASH_PATTERN.test(operation.operationId ?? "") ||
    !HASH_PATTERN.test(operation.ownershipIdentitySha256 ?? "") ||
    !HASH_PATTERN.test(operation.replacementValueSha256 ?? "") ||
    !Number.isSafeInteger(operation.occurrenceCount) ||
    operation.occurrenceCount <= 0 ||
    !Array.isArray(operation.objectKeys) ||
    operation.objectKeys.length === 0 ||
    operation.objectKeys.some((key) => !OBJECT_KEY_PATTERN.test(key)) ||
    new Set(operation.objectKeys).size !== operation.objectKeys.length
  ) {
    fail("REWRITE_OPERATION_INVALID");
  }
}

function validateRewritePlan(rewritePlan, control) {
  if (
    !exactKeys(rewritePlan, ["operations", "projectId", "review", "schemaVersion", "transaction"]) ||
    rewritePlan.projectId !== PROJECT_ID ||
    rewritePlan.schemaVersion !== SCHEMA_VERSION ||
    !Array.isArray(rewritePlan.operations) ||
    rewritePlan.operations.length === 0 ||
    !exactKeys(rewritePlan.transaction, [
      "allOrNothing",
      "isolation",
      "mutationPerformed",
      "precondition",
    ]) ||
    rewritePlan.transaction.allOrNothing !== true ||
    rewritePlan.transaction.isolation !== "serializable" ||
    rewritePlan.transaction.mutationPerformed !== false ||
    rewritePlan.transaction.precondition !== "sha256-current-value-and-source-ownership-must-match"
  ) {
    fail("REWRITE_PLAN_INVALID");
  }
  validateReview(rewritePlan.review, control);
  const byId = new Map();
  for (const operation of rewritePlan.operations) {
    validateSafeOperation(operation);
    if (byId.has(operation.operationId)) fail("REWRITE_OPERATION_DUPLICATE");
    byId.set(operation.operationId, operation);
  }
  return byId;
}

function validateCountMap(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.entries(value).every(([key, count]) => (
      isIdentifier(key) && Number.isSafeInteger(count) && count > 0
    ))
  );
}

function validateOwnershipInventory(inventory, safeById) {
  if (
    !exactKeys(inventory, [
      "classifications",
      "fields",
      "ownership",
      "references",
      "uniqueSources",
    ]) ||
    !validateCountMap(inventory.classifications) ||
    !validateCountMap(inventory.fields) ||
    !exactKeys(inventory.ownership, ["identityScopeSha256", "records"]) ||
    !HASH_PATTERN.test(inventory.ownership.identityScopeSha256 ?? "") ||
    !Number.isSafeInteger(inventory.ownership.records) ||
    inventory.ownership.records <= 0 ||
    !Number.isSafeInteger(inventory.references) ||
    inventory.references <= 0 ||
    !Number.isSafeInteger(inventory.uniqueSources) ||
    inventory.uniqueSources <= 0
  ) {
    fail("INVENTORY_EVIDENCE_INVALID");
  }
  const identities = [...new Set(
    [...safeById.values()].map((operation) => operation.ownershipIdentitySha256),
  )].sort();
  if (
    identities.length !== inventory.ownership.records ||
    sha256(canonicalJson(identities)) !== inventory.ownership.identityScopeSha256
  ) {
    fail("INVENTORY_EVIDENCE_INVALID");
  }
}

function validateReviewedEvidence({ manifest, rewritePlan, safeById, control }) {
  validateOwnershipInventory(manifest.inventory, safeById);
  const reviewDocument = {
    inventory: manifest.inventory,
    objects: manifest.objects,
    operations: rewritePlan.operations,
    policy: manifest.policy,
    projectId: PROJECT_ID,
    schemaVersion: SCHEMA_VERSION,
    transaction: rewritePlan.transaction,
  };
  if (sha256(canonicalJson(reviewDocument)) !== control.reviewDigest) {
    fail("REVIEW_EVIDENCE_INVALID");
  }
}

function decryptMapping(envelope, rollbackKey, control) {
  if (!Buffer.isBuffer(rollbackKey) || rollbackKey.length !== 32) fail("ROLLBACK_KEY_INVALID");
  if (
    envelope.length <= 5 + 12 + 16 ||
    envelope.subarray(0, 5).toString("ascii") !== "FPMR2"
  ) {
    fail("MAPPING_ENVELOPE_INVALID");
  }
  const iv = envelope.subarray(5, 17);
  const tag = envelope.subarray(17, 33);
  const ciphertext = envelope.subarray(33);
  const aad = Buffer.from(canonicalJson({
    projectId: PROJECT_ID,
    reviewDigest: control.reviewDigest,
    schemaVersion: SCHEMA_VERSION,
  }), "utf8");
  try {
    const decipher = createDecipheriv("aes-256-gcm", rollbackKey, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    return parseJson(
      Buffer.concat([decipher.update(ciphertext), decipher.final()]),
      "MAPPING_INVALID",
    );
  } catch (error) {
    if (error instanceof MediaOperatorError && error.code === "MAPPING_INVALID") throw error;
    fail("MAPPING_DECRYPTION_FAILED");
  }
}

function validateSecretOperation(operation) {
  const allowedKeys = new Set([
    "expectedValue",
    "expectedOwnership",
    "field",
    "operationId",
    "originalBlobKey",
    "recordId",
    "replacementBlobKey",
    "replacementValue",
    "table",
  ]);
  if (
    !operation ||
    typeof operation !== "object" ||
    Array.isArray(operation) ||
    Object.keys(operation).some((key) => !allowedKeys.has(key)) ||
    !["expectedOwnership", "expectedValue", "field", "operationId", "recordId", "replacementValue", "table"]
      .every((key) => Object.hasOwn(operation, key)) ||
    !ALLOWED_FIELDS[operation.table]?.has(operation.field) ||
    !HASH_PATTERN.test(operation.operationId ?? "") ||
    !isIdentifier(operation.recordId) ||
    typeof operation.expectedValue !== "string" ||
    typeof operation.replacementValue !== "string"
  ) {
    fail("MAPPING_OPERATION_INVALID");
  }
  if (operation.table === "media_files") {
    if (
      typeof operation.originalBlobKey !== "string" ||
      !OBJECT_KEY_PATTERN.test(operation.replacementBlobKey ?? "")
    ) {
      fail("MAPPING_OPERATION_INVALID");
    }
  } else if (
    Object.hasOwn(operation, "originalBlobKey") ||
    Object.hasOwn(operation, "replacementBlobKey")
  ) {
    fail("MAPPING_OPERATION_INVALID");
  }
  let normalizedOwnership;
  try {
    normalizedOwnership = normalizeMediaOwnershipIdentity(operation.expectedOwnership);
  } catch {
    fail("MAPPING_OPERATION_INVALID");
  }
  if (
    normalizedOwnership.table !== operation.table ||
    normalizedOwnership.recordId !== operation.recordId
  ) {
    fail("MAPPING_OPERATION_INVALID");
  }
}

function bindOperations({ mapping, safeById, objectsByKey, control, manifestReview }) {
  if (
    !exactKeys(mapping, ["operations", "projectId", "reviewDigest", "schemaVersion"]) ||
    mapping.projectId !== PROJECT_ID ||
    mapping.schemaVersion !== SCHEMA_VERSION ||
    mapping.reviewDigest !== control.reviewDigest ||
    !Array.isArray(mapping.operations) ||
    mapping.operations.length !== safeById.size
  ) {
    fail("MAPPING_INVALID");
  }
  if (manifestReview.reviewDigest !== mapping.reviewDigest) fail("REVIEW_EVIDENCE_INVALID");

  const operationIds = new Set();
  const referencedObjectKeys = new Set();
  const bound = [];
  for (const secret of mapping.operations) {
    validateSecretOperation(secret);
    if (operationIds.has(secret.operationId)) fail("MAPPING_OPERATION_DUPLICATE");
    operationIds.add(secret.operationId);
    const safe = safeById.get(secret.operationId);
    if (!safe || safe.table !== secret.table || safe.field !== secret.field) {
      fail("MAPPING_PLAN_MISMATCH");
    }
    const groupKey = sha256(`${secret.table}\0${secret.field}\0${secret.recordId}`);
    let ownershipIdentitySha256;
    try {
      ownershipIdentitySha256 = mediaOwnershipIdentitySha256(secret.expectedOwnership);
    } catch {
      fail("MAPPING_PLAN_MISMATCH");
    }
    const expectedOperationId = sha256(
      `${groupKey}\0${ownershipIdentitySha256}\0${sha256(secret.expectedValue)}\0${sha256(secret.replacementValue)}`,
    );
    if (
      safe.operationId !== expectedOperationId ||
      safe.locatorSha256 !== sha256(secret.recordId) ||
      safe.ownershipIdentitySha256 !== ownershipIdentitySha256 ||
      safe.expectedValueSha256 !== sha256(secret.expectedValue) ||
      safe.replacementValueSha256 !== sha256(secret.replacementValue)
    ) {
      fail("MAPPING_PLAN_MISMATCH");
    }

    if (secret.table === "media_files") {
      if (
        safe.coupledBlobKey !== true ||
        secret.replacementValue !== `/api/media/${encodeURIComponent(secret.recordId)}/content` ||
        safe.objectKeys.length !== 1 ||
        safe.objectKeys[0] !== secret.replacementBlobKey
      ) {
        fail("MAPPING_PLAN_MISMATCH");
      }
    } else {
      if (safe.coupledBlobKey !== false) fail("MAPPING_PLAN_MISMATCH");
      for (const key of safe.objectKeys) {
        if (!secret.replacementValue.includes(`/api/nas-owned-media/${key}`)) {
          fail("MAPPING_PLAN_MISMATCH");
        }
      }
    }
    for (const key of safe.objectKeys) {
      if (!objectsByKey.has(key)) fail("MAPPING_PLAN_MISMATCH");
      referencedObjectKeys.add(key);
    }
    bound.push(Object.freeze({ safe, secret }));
  }
  if (
    operationIds.size !== safeById.size ||
    referencedObjectKeys.size !== objectsByKey.size
  ) {
    fail("MAPPING_PLAN_MISMATCH");
  }
  return bound.sort((left, right) => left.safe.operationId.localeCompare(right.safe.operationId));
}

function buildRollbackPlan(boundOperations, control) {
  const rollback = {
    schemaVersion: SCHEMA_VERSION,
    projectId: PROJECT_ID,
    migrationId: control.migrationId,
    reviewDigest: control.reviewDigest,
    manifestSha256: control.manifestSha256,
    candidateOnly: true,
    postWriteLiveExecutionAllowed: false,
    operations: boundOperations.map(({ secret }) => ({
      table: secret.table,
      field: secret.field,
      recordId: secret.recordId,
      expectedValue: secret.replacementValue,
      replacementValue: secret.expectedValue,
      ...(secret.table === "media_files" ? {
        expectedBlobKey: secret.replacementBlobKey,
        replacementBlobKey: secret.originalBlobKey,
      } : {}),
    })),
  };
  return { plan: rollback, sha256: sha256(canonicalJson(rollback)) };
}

async function verifyObjects(objectsByKey, objectReader) {
  if (typeof objectReader !== "function") fail("OBJECT_READER_REQUIRED");
  let totalBytes = 0;
  for (const object of objectsByKey.values()) {
    let result;
    try {
      result = await objectReader(object.key);
    } catch {
      fail("OBJECT_VERIFICATION_FAILED");
    }
    const buffer = Buffer.isBuffer(result) ? result : result?.buffer;
    if (
      !Buffer.isBuffer(buffer) ||
      buffer.length !== object.bytes ||
      (result?.size !== undefined && result.size !== object.bytes) ||
      sha256(buffer) !== object.sha256
    ) {
      fail("OBJECT_VERIFICATION_FAILED");
    }
    totalBytes += buffer.length;
  }
  return totalBytes;
}

async function verifyInternal(options, preloadedControl) {
  const control = preloadedControl ?? await loadControl(options.controlPath);
  const [manifestBytes, rewritePlanBytes, encryptedMapping] = await Promise.all([
    readPrivateRegularFile(options.manifestPath, {
      code: "MANIFEST_FILE_UNSAFE",
      maxBytes: MAX_JSON_ARTIFACT_BYTES,
    }),
    readPrivateRegularFile(options.rewritePlanPath, {
      code: "REWRITE_PLAN_FILE_UNSAFE",
      maxBytes: MAX_JSON_ARTIFACT_BYTES,
    }),
    readPrivateRegularFile(options.encryptedMappingPath, {
      code: "MAPPING_FILE_UNSAFE",
      maxBytes: MAX_MAPPING_BYTES,
    }),
  ]);
  if (sha256(manifestBytes) !== control.manifestSha256) fail("MANIFEST_HASH_MISMATCH");
  if (sha256(rewritePlanBytes) !== control.rewritePlanSha256) fail("REWRITE_PLAN_HASH_MISMATCH");
  if (sha256(encryptedMapping) !== control.encryptedRollbackSha256) {
    fail("ENCRYPTED_MAPPING_HASH_MISMATCH");
  }

  const manifest = parseJson(manifestBytes, "MANIFEST_INVALID");
  const rewritePlan = parseJson(rewritePlanBytes, "REWRITE_PLAN_INVALID");
  const { byKey: objectsByKey, totalBytes } = validateManifest(manifest, control);
  const safeById = validateRewritePlan(rewritePlan, control);
  if (canonicalJson(manifest.review) !== canonicalJson(rewritePlan.review)) {
    fail("REVIEW_EVIDENCE_INVALID");
  }
  validateReviewedEvidence({ manifest, rewritePlan, safeById, control });
  const mapping = decryptMapping(encryptedMapping, options.rollbackKey, control);
  const boundOperations = bindOperations({
    mapping,
    safeById,
    objectsByKey,
    control,
    manifestReview: manifest.review,
  });
  const verifiedBytes = await verifyObjects(objectsByKey, options.objectReader);
  if (verifiedBytes !== totalBytes) fail("OBJECT_VERIFICATION_FAILED");
  const rollback = buildRollbackPlan(boundOperations, control);
  return {
    boundOperations,
    control,
    objectsByKey,
    objectBytes: totalBytes,
    rollbackPlan: rollback.plan,
    rollbackPlanSha256: rollback.sha256,
  };
}

function publicVerification(verified, mode) {
  return Object.freeze({
    ok: true,
    mode,
    migrationIdSha256: sha256(verified.control.migrationId),
    reviewDigest: verified.control.reviewDigest,
    manifestSha256: verified.control.manifestSha256,
    rewritePlanSha256: verified.control.rewritePlanSha256,
    encryptedRollbackSha256: verified.control.encryptedRollbackSha256,
    rollbackPlanSha256: verified.rollbackPlanSha256,
    operationsVerified: verified.boundOperations.length,
    objectsVerified: verified.objectsByKey.size,
    objectBytes: verified.objectBytes,
  });
}

export async function verifyMediaApplyPlan(options = {}) {
  try {
    return publicVerification(await verifyInternal(options), "verify-plan");
  } catch (error) {
    if (error instanceof MediaOperatorError) throw error;
    fail("VERIFY_PLAN_FAILED");
  }
}

function classifyOwnedRow(row, operation) {
  if (!row || typeof row !== "object" || row.id !== operation.secret.recordId) {
    fail("ROW_IDENTITY_MISMATCH");
  }
  let actualOwnership;
  if (operation.secret.table === "content_images") {
    actualOwnership = {
      contentId: row.contentId,
      contentUserId: row.contentUserId,
      recordId: row.id,
      table: operation.secret.table,
    };
  } else {
    actualOwnership = {
      recordId: row.id,
      table: operation.secret.table,
      userId: row.userId,
    };
  }
  let actualOwnershipSha256;
  try {
    actualOwnershipSha256 = mediaOwnershipIdentitySha256(actualOwnership);
  } catch {
    fail("ROW_OWNERSHIP_MISMATCH");
  }
  if (
    actualOwnershipSha256 !== operation.safe.ownershipIdentitySha256 ||
    canonicalMediaJson(actualOwnership) !== canonicalMediaJson(operation.secret.expectedOwnership)
  ) {
    fail("ROW_OWNERSHIP_MISMATCH");
  }
  const sourceValueMatches = row[operation.secret.field] === operation.secret.expectedValue;
  const replacementValueMatches = row[operation.secret.field] === operation.secret.replacementValue;
  if (operation.secret.table === "media_files") {
    const sourceMatches = sourceValueMatches && row.blobKey === operation.secret.originalBlobKey;
    const replacementMatches = replacementValueMatches && row.blobKey === operation.secret.replacementBlobKey;
    if (sourceMatches !== replacementMatches) return sourceMatches ? "source" : "replacement";
    fail("ROW_PRECONDITION_MISMATCH");
  }
  if (sourceValueMatches !== replacementValueMatches) {
    return sourceValueMatches ? "source" : "replacement";
  }
  fail("ROW_PRECONDITION_MISMATCH");
}

function mutationFor(operation) {
  const expected = { [operation.secret.field]: operation.secret.expectedValue };
  const replacement = { [operation.secret.field]: operation.secret.replacementValue };
  if (operation.secret.table === "media_files") {
    expected.blobKey = operation.secret.originalBlobKey;
    replacement.blobKey = operation.secret.replacementBlobKey;
  }
  return { expected, ownership: operation.secret.expectedOwnership, replacement };
}

function validateCandidateIdentity(identity, control) {
  if (
    !exactKeys(identity, [
      "attestationSha256",
      "databaseNameSha256",
      "identitySha256",
      "kind",
      "migrationId",
      "projectId",
      "remoteLockIdentitySha256",
    ]) ||
    identity.kind !== "candidate" ||
    identity.projectId !== PROJECT_ID ||
    identity.migrationId !== control.migrationId ||
    identity.attestationSha256 !== control.candidateAttestationSha256 ||
    identity.databaseNameSha256 !== control.candidateDatabaseNameSha256 ||
    identity.remoteLockIdentitySha256 !== control.remoteLockIdentitySha256 ||
    identity.identitySha256 !== control.candidateIdentitySha256
  ) {
    fail("CANDIDATE_TARGET_REQUIRED");
  }
}

async function assertCandidateTarget(database, control) {
  if (!database || typeof database.describeTarget !== "function") {
    fail("CANDIDATE_ADAPTER_REQUIRED");
  }
  let identity;
  try {
    identity = await database.describeTarget();
  } catch {
    fail("CANDIDATE_TARGET_REQUIRED");
  }
  validateCandidateIdentity(identity, control);
}

export async function applyMediaCandidate(options = {}) {
  try {
    const control = await loadControl(options.controlPath);
    const expectedConfirmation =
      `apply-candidate:${PROJECT_ID}:${control.migrationId}:${control.manifestSha256}`;
    if (options.confirmation !== expectedConfirmation) fail("APPLY_CONFIRMATION_INVALID");
    const verified = await verifyInternal(options, control);
    await assertCandidateTarget(options.database, control);
    if (typeof options.database.transaction !== "function") fail("CANDIDATE_ADAPTER_REQUIRED");

    let transactionResult;
    try {
      transactionResult = await options.database.transaction(
        { isolationLevel: "SERIALIZABLE" },
        async (tx) => {
          if (
            !tx ||
            typeof tx.describeTarget !== "function" ||
            typeof tx.readRow !== "function" ||
            typeof tx.updateExact !== "function"
          ) {
            fail("CANDIDATE_TRANSACTION_INVALID");
          }
          let transactionIdentity;
          try {
            transactionIdentity = await tx.describeTarget();
          } catch {
            fail("CANDIDATE_TARGET_REQUIRED");
          }
          validateCandidateIdentity(transactionIdentity, control);
          const inspected = [];
          const operationIds = new Set();
          const states = new Set();
          for (const operation of verified.boundOperations) {
            if (operationIds.has(operation.safe.operationId)) fail("OPERATION_EXECUTION_DUPLICATE");
            const row = await tx.readRow({
              table: operation.secret.table,
              recordId: operation.secret.recordId,
            });
            const state = classifyOwnedRow(row, operation);
            inspected.push({ operation, state });
            operationIds.add(operation.safe.operationId);
            states.add(state);
          }
          if (operationIds.size !== verified.boundOperations.length) {
            fail("OPERATION_EXECUTION_INCOMPLETE");
          }
          if (states.size !== 1) fail("CANDIDATE_STATE_MIXED");
          const [candidateState] = states;
          if (candidateState === "replacement") {
            return Object.freeze({
              idempotentReplay: true,
              operationsApplied: 0,
              operationsVerified: inspected.length,
            });
          }

          const executed = new Set();
          for (const { operation } of inspected) {
            const mutation = mutationFor(operation);
            const result = await tx.updateExact({
              table: operation.secret.table,
              recordId: operation.secret.recordId,
              operationId: operation.safe.operationId,
              field: operation.secret.field,
              ...mutation,
            });
            if (!exactKeys(result, ["matched", "updated"]) || result.matched !== 1 || result.updated !== 1) {
              fail("ROW_PRECONDITION_MISMATCH");
            }
            const updated = await tx.readRow({
              table: operation.secret.table,
              recordId: operation.secret.recordId,
            });
            if (classifyOwnedRow(updated, operation) !== "replacement") {
              fail("ROW_PRECONDITION_MISMATCH");
            }
            executed.add(operation.safe.operationId);
          }
          if (executed.size !== verified.boundOperations.length) fail("OPERATION_EXECUTION_INCOMPLETE");
          return Object.freeze({
            idempotentReplay: false,
            operationsApplied: executed.size,
            operationsVerified: inspected.length,
          });
        },
      );
    } catch (error) {
      if (error instanceof MediaOperatorError) throw error;
      fail("CANDIDATE_TRANSACTION_FAILED");
    }
    if (
      !exactKeys(transactionResult, [
        "idempotentReplay",
        "operationsApplied",
        "operationsVerified",
      ]) ||
      typeof transactionResult.idempotentReplay !== "boolean" ||
      transactionResult.operationsVerified !== verified.boundOperations.length ||
      (
        transactionResult.idempotentReplay === true
          ? transactionResult.operationsApplied !== 0
          : transactionResult.operationsApplied !== verified.boundOperations.length
      )
    ) {
      fail("OPERATION_EXECUTION_INCOMPLETE");
    }

    const executionDigest = sha256(canonicalJson({
      candidateIdentitySha256: control.candidateIdentitySha256,
      candidateAttestationSha256: control.candidateAttestationSha256,
      candidateDatabaseNameSha256: control.candidateDatabaseNameSha256,
      manifestSha256: control.manifestSha256,
      migrationId: control.migrationId,
      operationIds: verified.boundOperations.map(({ safe }) => safe.operationId),
      rollbackPlanSha256: verified.rollbackPlanSha256,
      remoteLockIdentitySha256: control.remoteLockIdentitySha256,
    }));
    return Object.freeze({
      ok: true,
      mode: "apply-candidate",
      migrationIdSha256: sha256(control.migrationId),
      manifestSha256: control.manifestSha256,
      reviewDigest: control.reviewDigest,
      executionDigest,
      idempotentReplay: transactionResult.idempotentReplay,
      rollbackPlanSha256: verified.rollbackPlanSha256,
      operationsApplied: transactionResult.operationsApplied,
      operationsVerified: transactionResult.operationsVerified,
      objectsVerified: verified.objectsByKey.size,
      objectBytes: verified.objectBytes,
      postWriteRollbackAllowed: false,
    });
  } catch (error) {
    if (error instanceof MediaOperatorError) throw error;
    fail("APPLY_CANDIDATE_FAILED");
  }
}

export async function runMediaOperator(options = {}) {
  if (options.mode === "verify-plan") return verifyMediaApplyPlan(options);
  if (options.mode === "apply-candidate") return applyMediaCandidate(options);
  if (typeof options.mode === "string" && options.mode.includes("rollback")) {
    fail("POST_WRITE_ROLLBACK_DISABLED");
  }
  fail("OPERATOR_MODE_INVALID");
}
