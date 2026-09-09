import { constants } from "node:fs";
import { lstat, open, unlink } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

import {
  MEDIA_CANDIDATE_ATTESTATION_SCHEMA_VERSION,
  MEDIA_PROJECT_ID,
  canonicalMediaJson,
  mediaCandidateIdentitySha256,
  mediaSha256,
  normalizeMediaOwnershipIdentity,
} from "./nas-media-contract.mjs";

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MIGRATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CANDIDATE_DATABASE_PATTERN = /^flowpack_candidate_[a-f0-9]{12}$/;
const MAX_ATTESTATION_BYTES = 16 * 1024;
const OPERATION_ID_PATTERN = HASH_PATTERN;

const READ_QUERIES = Object.freeze({
  media_files: Object.freeze({
    name: "flowpack_media_read_media_file_v1",
    text: 'SELECT id, "userId", url, "blobKey" FROM public.media_files WHERE id = $1',
  }),
  content_images: Object.freeze({
    name: "flowpack_media_read_content_image_v1",
    text: 'SELECT ci.id, ci."contentId", c."userId" AS "contentUserId", ci.url FROM public.content_images AS ci JOIN public.contents AS c ON c.id = ci."contentId" WHERE ci.id = $1',
  }),
  contents: Object.freeze({
    name: "flowpack_media_read_content_v1",
    text: 'SELECT id, "userId", "thumbnailUrl", body, slides FROM public.contents WHERE id = $1',
  }),
});

const UPDATE_QUERIES = Object.freeze({
  "media_files.url": Object.freeze({
    name: "flowpack_media_update_media_file_url_v1",
    text: 'UPDATE public.media_files SET url = $2, "blobKey" = $3 WHERE id = $1 AND "userId" = $4 AND url IS NOT DISTINCT FROM $5 AND "blobKey" IS NOT DISTINCT FROM $6 RETURNING id',
  }),
  "content_images.url": Object.freeze({
    name: "flowpack_media_update_content_image_url_v1",
    text: 'UPDATE public.content_images AS ci SET url = $2 FROM public.contents AS c WHERE ci.id = $1 AND ci."contentId" = $3 AND c.id = ci."contentId" AND c."userId" = $4 AND ci.url IS NOT DISTINCT FROM $5 RETURNING ci.id',
  }),
  "contents.thumbnailUrl": Object.freeze({
    name: "flowpack_media_update_content_thumbnail_v1",
    text: 'UPDATE public.contents SET "thumbnailUrl" = $2 WHERE id = $1 AND "userId" = $3 AND "thumbnailUrl" IS NOT DISTINCT FROM $4 RETURNING id',
  }),
  "contents.body": Object.freeze({
    name: "flowpack_media_update_content_body_v1",
    text: 'UPDATE public.contents SET body = $2 WHERE id = $1 AND "userId" = $3 AND body IS NOT DISTINCT FROM $4 RETURNING id',
  }),
  "contents.slides": Object.freeze({
    name: "flowpack_media_update_content_slides_v1",
    text: 'UPDATE public.contents SET slides = $2 WHERE id = $1 AND "userId" = $3 AND slides IS NOT DISTINCT FROM $4 RETURNING id',
  }),
});

export class PostgresMediaAdapterError extends Error {
  constructor(code) {
    super(code);
    this.name = "PostgresMediaAdapterError";
    this.code = code;
  }
}

function fail(code) {
  throw new PostgresMediaAdapterError(code);
}

function isRedactedCodedError(error) {
  return (
    error &&
    typeof error.code === "string" &&
    /^[A-Z][A-Z0-9_]{2,127}$/.test(error.code) &&
    error.message === error.code
  );
}

function exactKeys(value, keys) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort())
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

async function assertPrivateParent(path, code) {
  const parent = dirname(path);
  let info;
  try {
    info = await lstat(parent);
  } catch {
    fail(code);
  }
  if (info.isSymbolicLink() || !info.isDirectory() || (info.mode & 0o777) !== 0o700) {
    fail(code);
  }
  return parent;
}

async function readPrivateAttestation(path) {
  absoluteNormalizedPath(path, "CANDIDATE_ATTESTATION_UNSAFE");
  await assertPrivateParent(path, "CANDIDATE_ATTESTATION_UNSAFE");
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  } catch {
    fail("CANDIDATE_ATTESTATION_UNSAFE");
  }
  try {
    const info = await handle.stat();
    if (
      !info.isFile() ||
      (info.mode & 0o777) !== 0o600 ||
      info.size <= 0 ||
      info.size > MAX_ATTESTATION_BYTES
    ) {
      fail("CANDIDATE_ATTESTATION_UNSAFE");
    }
    const bytes = await handle.readFile();
    if (bytes.length !== info.size) fail("CANDIDATE_ATTESTATION_UNSAFE");
    return bytes;
  } catch (error) {
    if (error instanceof PostgresMediaAdapterError) throw error;
    fail("CANDIDATE_ATTESTATION_UNSAFE");
  } finally {
    await handle.close().catch(() => undefined);
  }
}

function validateAttestation(document) {
  if (
    !exactKeys(document, [
      "candidateDatabaseName",
      "migrationId",
      "projectId",
      "remoteLockIdentitySha256",
      "schemaVersion",
      "targetKind",
    ]) ||
    document.schemaVersion !== MEDIA_CANDIDATE_ATTESTATION_SCHEMA_VERSION ||
    document.projectId !== MEDIA_PROJECT_ID ||
    document.targetKind !== "candidate" ||
    !CANDIDATE_DATABASE_PATTERN.test(document.candidateDatabaseName ?? "") ||
    !MIGRATION_ID_PATTERN.test(document.migrationId ?? "") ||
    !HASH_PATTERN.test(document.remoteLockIdentitySha256 ?? "")
  ) {
    fail("CANDIDATE_ATTESTATION_INVALID");
  }
  return Object.freeze({ ...document });
}

function parseCanonicalAttestation(bytes) {
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("CANDIDATE_ATTESTATION_INVALID");
  }
  const document = validateAttestation(parsed);
  if (!bytes.equals(Buffer.from(`${canonicalMediaJson(document)}\n`, "utf8"))) {
    fail("CANDIDATE_ATTESTATION_INVALID");
  }
  return document;
}

function safeEvidence(document, bytes) {
  const candidateDatabaseNameSha256 = mediaSha256(document.candidateDatabaseName);
  return Object.freeze({
    attestationSha256: mediaSha256(bytes),
    candidateDatabaseNameSha256,
    candidateIdentitySha256: mediaCandidateIdentitySha256({
      candidateDatabaseNameSha256,
      migrationId: document.migrationId,
      projectId: document.projectId,
      remoteLockIdentitySha256: document.remoteLockIdentitySha256,
    }),
    migrationIdSha256: mediaSha256(document.migrationId),
    ok: true,
    remoteLockIdentitySha256: document.remoteLockIdentitySha256,
  });
}

export async function writePrivateMediaCandidateAttestation({
  attestationPath,
  candidateDatabaseName,
  migrationId,
  remoteLockIdentitySha256,
} = {}) {
  const document = validateAttestation({
    candidateDatabaseName,
    migrationId,
    projectId: MEDIA_PROJECT_ID,
    remoteLockIdentitySha256,
    schemaVersion: MEDIA_CANDIDATE_ATTESTATION_SCHEMA_VERSION,
    targetKind: "candidate",
  });
  absoluteNormalizedPath(attestationPath, "CANDIDATE_ATTESTATION_UNSAFE");
  const parent = await assertPrivateParent(attestationPath, "CANDIDATE_ATTESTATION_UNSAFE");
  const bytes = Buffer.from(`${canonicalMediaJson(document)}\n`, "utf8");
  let handle;
  let created = false;
  try {
    handle = await open(
      attestationPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0),
      0o600,
    );
    created = true;
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = null;
    const parentHandle = await open(parent, constants.O_RDONLY);
    try {
      await parentHandle.sync();
    } finally {
      await parentHandle.close();
    }
    return safeEvidence(document, bytes);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (created) await unlink(attestationPath).catch(() => undefined);
    if (error instanceof PostgresMediaAdapterError) throw error;
    fail("CANDIDATE_ATTESTATION_UNSAFE");
  }
}

function candidateIdentity(document, bytes) {
  const evidence = safeEvidence(document, bytes);
  return Object.freeze({
    attestationSha256: evidence.attestationSha256,
    databaseNameSha256: evidence.candidateDatabaseNameSha256,
    identitySha256: evidence.candidateIdentitySha256,
    kind: "candidate",
    migrationId: document.migrationId,
    projectId: document.projectId,
    remoteLockIdentitySha256: document.remoteLockIdentitySha256,
  });
}

function validateQueryResult(result, code) {
  if (
    !result ||
    !Number.isSafeInteger(result.rowCount) ||
    result.rowCount < 0 ||
    result.rowCount > 1 ||
    !Array.isArray(result.rows) ||
    result.rows.length !== result.rowCount
  ) {
    fail(code);
  }
  return result;
}

function validateMutationInput({ expected, field, operationId, ownership, recordId, replacement, table }) {
  const query = UPDATE_QUERIES[`${table}.${field}`];
  if (
    !query ||
    !OPERATION_ID_PATTERN.test(operationId ?? "") ||
    typeof recordId !== "string" ||
    recordId.length === 0 ||
    recordId.length > 512
  ) {
    fail("MEDIA_MUTATION_INVALID");
  }
  let normalizedOwnership;
  try {
    normalizedOwnership = normalizeMediaOwnershipIdentity(ownership);
  } catch {
    fail("MEDIA_MUTATION_INVALID");
  }
  if (normalizedOwnership.table !== table || normalizedOwnership.recordId !== recordId) {
    fail("MEDIA_MUTATION_INVALID");
  }
  const expectedKeys = table === "media_files" ? ["blobKey", "url"] : [field];
  if (!exactKeys(expected, expectedKeys) || !exactKeys(replacement, expectedKeys)) {
    fail("MEDIA_MUTATION_INVALID");
  }
  for (const value of [...Object.values(expected), ...Object.values(replacement)]) {
    if (typeof value !== "string") fail("MEDIA_MUTATION_INVALID");
  }
  return { normalizedOwnership, query };
}

function mutationValues({ expected, field, ownership, recordId, replacement, table }) {
  if (table === "media_files") {
    return [
      recordId,
      replacement.url,
      replacement.blobKey,
      ownership.userId,
      expected.url,
      expected.blobKey,
    ];
  }
  if (table === "content_images") {
    return [
      recordId,
      replacement.url,
      ownership.contentId,
      ownership.contentUserId,
      expected.url,
    ];
  }
  return [recordId, replacement[field], ownership.userId, expected[field]];
}

export async function createPostgresMediaCandidateAdapter({ attestationPath, client } = {}) {
  if (
    !client ||
    typeof client.query !== "function" ||
    !Number.isSafeInteger(client.processID) ||
    client.processID <= 0
  ) {
    fail("POSTGRES_DEDICATED_SESSION_REQUIRED");
  }
  const attestationBytes = await readPrivateAttestation(attestationPath);
  const attestation = parseCanonicalAttestation(attestationBytes);
  const identity = candidateIdentity(attestation, attestationBytes);
  let transactionActive = false;

  const describeTarget = async () => {
    let result;
    try {
      result = validateQueryResult(await client.query({
        name: "flowpack_media_target_identity_v1",
        text: 'SELECT current_database() AS "databaseName"',
        values: [],
      }), "CANDIDATE_DATABASE_ATTESTATION_FAILED");
    } catch (error) {
      if (error instanceof PostgresMediaAdapterError) throw error;
      fail("CANDIDATE_DATABASE_ATTESTATION_FAILED");
    }
    if (
      result.rowCount !== 1 ||
      !exactKeys(result.rows[0], ["databaseName"]) ||
      result.rows[0].databaseName !== attestation.candidateDatabaseName ||
      !CANDIDATE_DATABASE_PATTERN.test(result.rows[0].databaseName)
    ) {
      fail("CANDIDATE_DATABASE_MISMATCH");
    }
    return identity;
  };

  const readRow = async ({ table, recordId } = {}) => {
    const query = READ_QUERIES[table];
    if (
      !query ||
      typeof recordId !== "string" ||
      recordId.length === 0 ||
      recordId.length > 512
    ) {
      fail("MEDIA_READ_INVALID");
    }
    let result;
    try {
      result = validateQueryResult(
        await client.query({ ...query, values: [recordId] }),
        "MEDIA_READ_FAILED",
      );
    } catch (error) {
      if (error instanceof PostgresMediaAdapterError) throw error;
      fail("MEDIA_READ_FAILED");
    }
    return result.rowCount === 0 ? null : Object.freeze({ ...result.rows[0] });
  };

  const updateExact = async (input = {}) => {
    const validated = validateMutationInput(input);
    let result;
    try {
      result = validateQueryResult(await client.query({
        ...validated.query,
        values: mutationValues({ ...input, ownership: validated.normalizedOwnership }),
      }), "MEDIA_MUTATION_FAILED");
    } catch (error) {
      if (error instanceof PostgresMediaAdapterError) throw error;
      fail("MEDIA_MUTATION_FAILED");
    }
    return Object.freeze({ matched: result.rowCount, updated: result.rowCount });
  };

  const adapter = {
    describeTarget,
    async transaction(options, callback) {
      if (
        transactionActive ||
        !exactKeys(options, ["isolationLevel"]) ||
        options.isolationLevel !== "SERIALIZABLE" ||
        typeof callback !== "function"
      ) {
        fail("MEDIA_TRANSACTION_INVALID");
      }
      transactionActive = true;
      let began = false;
      try {
        await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
        began = true;
        const value = await callback(Object.freeze({ describeTarget, readRow, updateExact }));
        await client.query("COMMIT");
        began = false;
        return value;
      } catch (error) {
        if (began) await client.query("ROLLBACK").catch(() => undefined);
        if (error instanceof PostgresMediaAdapterError || isRedactedCodedError(error)) throw error;
        fail("MEDIA_TRANSACTION_FAILED");
      } finally {
        transactionActive = false;
      }
    },
  };
  return Object.freeze(adapter);
}
