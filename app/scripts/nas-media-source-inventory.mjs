import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { lstat, open, unlink } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

import {
  MEDIA_PROJECT_ID,
  canonicalMediaJson,
  mediaSha256,
} from "./nas-media-contract.mjs";

const SOURCE_ATTESTATION_SCHEMA_VERSION = 1;
const FILE_MODE = 0o600;
const DIRECTORY_MODE = 0o700;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const DATABASE_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;
const MIGRATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_ATTESTATION_BYTES = 16 * 1024;
const DEFAULT_MAX_ROWS_PER_TABLE = 200_000;
const HARD_MAX_ROWS_PER_TABLE = 500_000;
const DEFAULT_MAX_TEXT_BYTES = 512 * 1024 * 1024;
const HARD_MAX_TEXT_BYTES = 1024 * 1024 * 1024;
const MAX_IDENTIFIER_BYTES = 512;
const MAX_URL_BYTES = 2 * 1024 * 1024;
const MAX_BLOB_KEY_BYTES = 2 * 1024;
const MAX_MIME_BYTES = 128;
const MAX_DOCUMENT_BYTES = 16 * 1024 * 1024;
const MAX_MEDIA_BYTES = 1024 ** 3;

const ATTESTATION_KEYS = Object.freeze([
  "databaseName",
  "migrationId",
  "projectId",
  "remoteLockIdentitySha256",
  "schemaVersion",
  "sourceFreezeReceiptSha256",
  "sourceTransportProfileSha256",
  "targetKind",
]);

const QUERIES = Object.freeze({
  identity: Object.freeze({
    name: "flowpack_media_source_identity_v1",
    text: `SELECT current_database() AS "databaseName", current_setting('transaction_isolation') AS "transactionIsolation", current_setting('transaction_read_only') AS "transactionReadOnly"`,
    values: [],
  }),
  mediaFiles: Object.freeze({
    name: "flowpack_media_source_media_files_v1",
    text: 'SELECT id, "userId", url, "blobKey", "mimeType", size FROM public.media_files ORDER BY id LIMIT $1',
  }),
  contentImages: Object.freeze({
    name: "flowpack_media_source_content_images_v1",
    text: 'SELECT ci.id, ci."contentId", c."userId" AS "contentUserId", ci.url FROM public.content_images AS ci JOIN public.contents AS c ON c.id = ci."contentId" ORDER BY ci.id LIMIT $1',
  }),
  contents: Object.freeze({
    name: "flowpack_media_source_contents_v1",
    text: 'SELECT id, "userId", "thumbnailUrl", body, slides FROM public.contents ORDER BY id LIMIT $1',
  }),
});

export class MediaSourceInventoryError extends Error {
  constructor(code) {
    super(code);
    this.name = "MediaSourceInventoryError";
    this.code = code;
  }
}

function fail(code) {
  throw new MediaSourceInventoryError(code);
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

async function assertPrivateParent(path, code) {
  let info;
  try {
    info = await lstat(dirname(path));
  } catch {
    fail(code);
  }
  if (info.isSymbolicLink() || !info.isDirectory() || (info.mode & 0o777) !== DIRECTORY_MODE) {
    fail(code);
  }
  return dirname(path);
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

async function readPrivateAttestation(path) {
  absoluteNormalizedPath(path, "SOURCE_ATTESTATION_UNSAFE");
  await assertPrivateParent(path, "SOURCE_ATTESTATION_UNSAFE");
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const info = await handle.stat();
    if (
      !info.isFile() ||
      info.nlink !== 1 ||
      (info.mode & 0o777) !== FILE_MODE ||
      info.size <= 0 ||
      info.size > MAX_ATTESTATION_BYTES
    ) {
      fail("SOURCE_ATTESTATION_UNSAFE");
    }
    const bytes = await handle.readFile();
    if (bytes.length !== info.size) fail("SOURCE_ATTESTATION_UNSAFE");
    return bytes;
  } catch (error) {
    if (error instanceof MediaSourceInventoryError) throw error;
    fail("SOURCE_ATTESTATION_UNSAFE");
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function validateAttestation(value) {
  if (
    !exactKeys(value, ATTESTATION_KEYS) ||
    value.schemaVersion !== SOURCE_ATTESTATION_SCHEMA_VERSION ||
    value.projectId !== MEDIA_PROJECT_ID ||
    value.targetKind !== "source" ||
    !DATABASE_PATTERN.test(value.databaseName ?? "") ||
    !MIGRATION_ID_PATTERN.test(value.migrationId ?? "") ||
    !HASH_PATTERN.test(value.remoteLockIdentitySha256 ?? "") ||
    !HASH_PATTERN.test(value.sourceFreezeReceiptSha256 ?? "") ||
    !HASH_PATTERN.test(value.sourceTransportProfileSha256 ?? "")
  ) {
    fail("SOURCE_ATTESTATION_INVALID");
  }
  return Object.freeze({ ...value });
}

function parseCanonicalAttestation(bytes) {
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("SOURCE_ATTESTATION_INVALID");
  }
  const attestation = validateAttestation(parsed);
  if (!bytes.equals(Buffer.from(`${canonicalMediaJson(attestation)}\n`, "utf8"))) {
    fail("SOURCE_ATTESTATION_INVALID");
  }
  return attestation;
}

function publicAttestationEvidence(attestation, bytes) {
  return Object.freeze({
    attestationSha256: mediaSha256(bytes),
    databaseNameSha256: mediaSha256(attestation.databaseName),
    migrationIdSha256: mediaSha256(attestation.migrationId),
    ok: true,
    remoteLockIdentitySha256: attestation.remoteLockIdentitySha256,
    sourceFreezeReceiptSha256: attestation.sourceFreezeReceiptSha256,
    sourceTransportProfileSha256: attestation.sourceTransportProfileSha256,
  });
}

export async function writePrivateMediaSourceAttestation({
  attestationPath,
  databaseName,
  migrationId,
  remoteLockIdentitySha256,
  sourceFreezeReceiptSha256,
  sourceTransportProfileSha256,
} = {}) {
  const attestation = validateAttestation({
    databaseName,
    migrationId,
    projectId: MEDIA_PROJECT_ID,
    remoteLockIdentitySha256,
    schemaVersion: SOURCE_ATTESTATION_SCHEMA_VERSION,
    sourceFreezeReceiptSha256,
    sourceTransportProfileSha256,
    targetKind: "source",
  });
  absoluteNormalizedPath(attestationPath, "SOURCE_ATTESTATION_UNSAFE");
  const parent = await assertPrivateParent(attestationPath, "SOURCE_ATTESTATION_UNSAFE");
  const bytes = Buffer.from(`${canonicalMediaJson(attestation)}\n`, "utf8");
  let handle;
  let created = false;
  try {
    handle = await open(
      attestationPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0),
      FILE_MODE,
    );
    created = true;
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await syncDirectory(parent, "SOURCE_ATTESTATION_UNSAFE");
    return publicAttestationEvidence(attestation, bytes);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (created) await unlink(attestationPath).catch(() => undefined);
    if (error instanceof MediaSourceInventoryError) throw error;
    fail("SOURCE_ATTESTATION_UNSAFE");
  }
}

function validateLimits(maxRowsPerTable, maxTextBytes) {
  if (
    !Number.isSafeInteger(maxRowsPerTable) ||
    maxRowsPerTable <= 0 ||
    maxRowsPerTable > HARD_MAX_ROWS_PER_TABLE
  ) {
    fail("SOURCE_LIMIT_INVALID");
  }
  if (
    !Number.isSafeInteger(maxTextBytes) ||
    maxTextBytes <= 0 ||
    maxTextBytes > HARD_MAX_TEXT_BYTES
  ) {
    fail("SOURCE_LIMIT_INVALID");
  }
}

function queryRows(result, maximumRows) {
  if (
    !result ||
    !Number.isSafeInteger(result.rowCount) ||
    result.rowCount < 0 ||
    !Array.isArray(result.rows) ||
    result.rows.length !== result.rowCount
  ) {
    fail("SOURCE_QUERY_RESULT_INVALID");
  }
  if (result.rows.length > maximumRows) fail("SOURCE_ROW_LIMIT_EXCEEDED");
  return result.rows;
}

function textBytes(value, {
  allowEmpty = false,
  nullable = false,
  maximum = MAX_DOCUMENT_BYTES,
} = {}) {
  if (nullable && value === null) return 0;
  if (typeof value !== "string") fail("SOURCE_ROW_INVALID");
  const bytes = Buffer.byteLength(value, "utf8");
  if ((!allowEmpty && bytes <= 0) || bytes > maximum || /\0/u.test(value)) {
    fail("SOURCE_ROW_INVALID");
  }
  return bytes;
}

function identifierBytes(value) {
  return textBytes(value, { maximum: MAX_IDENTIFIER_BYTES });
}

function validateRows(raw, maxTextBytes) {
  const mediaFiles = [];
  const contentImagesWithOwner = [];
  const contents = [];
  const identifiers = {
    contentImages: new Set(),
    contents: new Set(),
    mediaFiles: new Set(),
  };
  let totalTextBytes = 0;
  const addBytes = (bytes) => {
    totalTextBytes += bytes;
    if (!Number.isSafeInteger(totalTextBytes) || totalTextBytes > maxTextBytes) {
      fail("SOURCE_TEXT_LIMIT_EXCEEDED");
    }
  };
  const unique = (scope, id) => {
    if (identifiers[scope].has(id)) fail("SOURCE_OWNERSHIP_INVALID");
    identifiers[scope].add(id);
  };

  for (const row of raw.mediaFiles) {
    if (!exactKeys(row, ["blobKey", "id", "mimeType", "size", "url", "userId"])) {
      fail("SOURCE_ROW_INVALID");
    }
    addBytes(identifierBytes(row.id));
    addBytes(identifierBytes(row.userId));
    addBytes(textBytes(row.url, { maximum: MAX_URL_BYTES }));
    addBytes(textBytes(row.blobKey, { maximum: MAX_BLOB_KEY_BYTES }));
    addBytes(textBytes(row.mimeType, { maximum: MAX_MIME_BYTES }));
    if (!Number.isSafeInteger(row.size) || row.size <= 0 || row.size > MAX_MEDIA_BYTES) {
      fail("SOURCE_ROW_INVALID");
    }
    unique("mediaFiles", row.id);
    mediaFiles.push(Object.freeze({ ...row }));
  }

  for (const row of raw.contentImages) {
    if (!exactKeys(row, ["contentId", "contentUserId", "id", "url"])) {
      fail("SOURCE_ROW_INVALID");
    }
    addBytes(identifierBytes(row.id));
    addBytes(identifierBytes(row.contentId));
    addBytes(identifierBytes(row.contentUserId));
    addBytes(textBytes(row.url, { maximum: MAX_URL_BYTES }));
    unique("contentImages", row.id);
    contentImagesWithOwner.push(Object.freeze({ ...row }));
  }

  for (const row of raw.contents) {
    if (!exactKeys(row, ["body", "id", "slides", "thumbnailUrl", "userId"])) {
      fail("SOURCE_ROW_INVALID");
    }
    addBytes(identifierBytes(row.id));
    addBytes(identifierBytes(row.userId));
    addBytes(textBytes(row.thumbnailUrl, {
      allowEmpty: true,
      nullable: true,
      maximum: MAX_URL_BYTES,
    }));
    addBytes(textBytes(row.body, {
      allowEmpty: true,
      nullable: true,
      maximum: MAX_DOCUMENT_BYTES,
    }));
    addBytes(textBytes(row.slides, {
      allowEmpty: true,
      nullable: true,
      maximum: MAX_DOCUMENT_BYTES,
    }));
    unique("contents", row.id);
    contents.push(Object.freeze({ ...row }));
  }

  const contentsById = new Map(contents.map((row) => [row.id, row]));
  const contentImages = contentImagesWithOwner.map((row) => {
    const content = contentsById.get(row.contentId);
    if (!content) fail("SOURCE_CONTENT_REFERENCE_INVALID");
    if (content.userId !== row.contentUserId) fail("SOURCE_OWNERSHIP_INVALID");
    return Object.freeze({
      contentId: row.contentId,
      id: row.id,
      url: row.url,
    });
  });

  return Object.freeze({
    records: Object.freeze({
      contentImages: Object.freeze(contentImages),
      contents: Object.freeze(contents),
      mediaFiles: Object.freeze(mediaFiles),
    }),
    totalTextBytes,
  });
}

async function executeQuery(client, query, values) {
  try {
    return await client.query({ ...query, values });
  } catch {
    fail("SOURCE_QUERY_FAILED");
  }
}

function recordsDigest(records) {
  const hash = createHash("sha256");
  hash.update(canonicalMediaJson(records));
  return hash.digest("hex");
}

export async function capturePostgresMediaSourceSnapshot({
  attestationPath,
  client,
  consume,
  maxRowsPerTable = DEFAULT_MAX_ROWS_PER_TABLE,
  maxTextBytes = DEFAULT_MAX_TEXT_BYTES,
  transactionScope = "owned",
} = {}) {
  if (
    !client ||
    typeof client.query !== "function" ||
    !Number.isSafeInteger(client.processID) ||
    client.processID <= 0
  ) {
    fail("POSTGRES_DEDICATED_SESSION_REQUIRED");
  }
  if (typeof consume !== "function") fail("SOURCE_CONSUMER_REQUIRED");
  if (!["existing", "owned"].includes(transactionScope)) fail("SOURCE_TRANSACTION_SCOPE_INVALID");
  validateLimits(maxRowsPerTable, maxTextBytes);
  const attestationBytes = await readPrivateAttestation(attestationPath);
  const attestation = parseCanonicalAttestation(attestationBytes);
  let began = false;
  try {
    if (transactionScope === "owned") {
      try {
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        began = true;
      } catch {
        fail("SOURCE_TRANSACTION_FAILED");
      }
    }

    const identityResult = queryRows(
      await executeQuery(client, QUERIES.identity, []),
      1,
    );
    if (
      identityResult.length !== 1 ||
      !exactKeys(identityResult[0], [
        "databaseName",
        "transactionIsolation",
        "transactionReadOnly",
      ])
    ) {
      fail("SOURCE_TRANSACTION_ATTESTATION_FAILED");
    }
    const identity = identityResult[0];
    if (identity.databaseName !== attestation.databaseName) fail("SOURCE_DATABASE_MISMATCH");
    if (
      identity.transactionIsolation !== "repeatable read" ||
      identity.transactionReadOnly !== "on"
    ) {
      fail("SOURCE_TRANSACTION_ATTESTATION_FAILED");
    }

    const rowLimit = maxRowsPerTable + 1;
    const [mediaFiles, contentImages, contents] = [
      ["mediaFiles", QUERIES.mediaFiles],
      ["contentImages", QUERIES.contentImages],
      ["contents", QUERIES.contents],
    ];
    const raw = {};
    for (const [key, query] of [mediaFiles, contentImages, contents]) {
      raw[key] = queryRows(await executeQuery(client, query, [rowLimit]), maxRowsPerTable);
    }
    const validated = validateRows(raw, maxTextBytes);
    const rowCounts = Object.freeze({
      contentImages: validated.records.contentImages.length,
      contents: validated.records.contents.length,
      mediaFiles: validated.records.mediaFiles.length,
      total:
        validated.records.contentImages.length +
        validated.records.contents.length +
        validated.records.mediaFiles.length,
    });
    const evidence = Object.freeze({
      attestationSha256: mediaSha256(attestationBytes),
      databaseNameSha256: mediaSha256(attestation.databaseName),
      migrationIdSha256: mediaSha256(attestation.migrationId),
      ok: true,
      recordsSha256: recordsDigest(validated.records),
      remoteLockIdentitySha256: attestation.remoteLockIdentitySha256,
      rows: rowCounts,
      sameSnapshotMediaInventory: true,
      snapshot: "repeatable-read-read-only",
      sourceFreezeReceiptSha256: attestation.sourceFreezeReceiptSha256,
      sourceTransportProfileSha256: attestation.sourceTransportProfileSha256,
      textBytes: validated.totalTextBytes,
    });

    try {
      await consume(validated.records, evidence);
    } catch {
      fail("SOURCE_CONSUMER_FAILED");
    }
    if (transactionScope === "owned") {
      try {
        await client.query("COMMIT");
        began = false;
      } catch {
        fail("SOURCE_TRANSACTION_FAILED");
      }
    }
    return evidence;
  } catch (error) {
    if (began) await client.query("ROLLBACK").catch(() => undefined);
    if (error instanceof MediaSourceInventoryError) throw error;
    fail("SOURCE_SNAPSHOT_FAILED");
  }
}
