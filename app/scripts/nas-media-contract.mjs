import { createHash } from "node:crypto";

export const MEDIA_PROJECT_ID = "flowpack";
export const MEDIA_EVIDENCE_SCHEMA_VERSION = 2;
export const MEDIA_CANDIDATE_ATTESTATION_SCHEMA_VERSION = 1;

const HASH_PATTERN = /^[a-f0-9]{64}$/;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function canonicalizeMediaEvidence(value) {
  if (Array.isArray(value)) return value.map(canonicalizeMediaEvidence);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalizeMediaEvidence(value[key])]),
    );
  }
  return value;
}

export function canonicalMediaJson(value) {
  return JSON.stringify(canonicalizeMediaEvidence(value));
}

export function mediaSha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function exactKeys(value, keys) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort())
  );
}

function identifier(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

export function normalizeMediaOwnershipIdentity(identity) {
  if (identity?.table === "content_images") {
    if (
      !exactKeys(identity, ["contentId", "contentUserId", "recordId", "table"]) ||
      !identifier(identity.recordId) ||
      !identifier(identity.contentId) ||
      !identifier(identity.contentUserId)
    ) {
      fail("OWNERSHIP_IDENTITY_INVALID");
    }
  } else if (identity?.table === "contents" || identity?.table === "media_files") {
    if (
      !exactKeys(identity, ["recordId", "table", "userId"]) ||
      !identifier(identity.recordId) ||
      !identifier(identity.userId)
    ) {
      fail("OWNERSHIP_IDENTITY_INVALID");
    }
  } else {
    fail("OWNERSHIP_IDENTITY_INVALID");
  }
  return Object.freeze({ ...identity });
}

export function mediaOwnershipIdentitySha256(identity) {
  return mediaSha256(canonicalMediaJson(normalizeMediaOwnershipIdentity(identity)));
}

export function mediaCandidateIdentitySha256({
  candidateDatabaseNameSha256,
  migrationId,
  projectId,
  remoteLockIdentitySha256,
}) {
  if (
    !HASH_PATTERN.test(candidateDatabaseNameSha256 ?? "") ||
    !HASH_PATTERN.test(remoteLockIdentitySha256 ?? "") ||
    typeof migrationId !== "string" ||
    migrationId.length === 0 ||
    projectId !== MEDIA_PROJECT_ID
  ) {
    fail("CANDIDATE_IDENTITY_INVALID");
  }
  return mediaSha256(canonicalMediaJson({
    candidateDatabaseNameSha256,
    migrationId,
    projectId,
    remoteLockIdentitySha256,
    schemaVersion: MEDIA_CANDIDATE_ATTESTATION_SCHEMA_VERSION,
    targetKind: "candidate",
  }));
}
