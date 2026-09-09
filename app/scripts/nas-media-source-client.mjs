import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

import { readSourceDatabaseConfig } from "./nas-database-artifact.mjs";
import {
  MEDIA_PROJECT_ID,
  canonicalMediaJson,
  mediaSha256,
} from "./nas-media-contract.mjs";
import { capturePostgresMediaSourceSnapshot } from "./nas-media-source-inventory.mjs";

const REMOTE_PROJECT_ID = "flowpack-nas";
const ATTESTATION_SCHEMA_VERSION = 1;
const FILE_MODE = 0o600;
const DIRECTORY_MODE = 0o700;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MIGRATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RELEASE_PATTERN = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DATABASE_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;
const QUALIFIED_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]*\.[A-Za-z_][A-Za-z0-9_$]*$/;
const SCHEMA_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]*$/;
const MAX_EVIDENCE_BYTES = 64 * 1024 * 1024;
const MAX_ATTESTATION_BYTES = 64 * 1024;
const SOURCE_FREEZE_RECEIPT_KEYS = Object.freeze([
  "healthHttpStatus",
  "inFlightWrites",
  "migrationId",
  "projectId",
  "providerActionDigest",
  "recordedAt",
  "releaseCommit",
  "schemaVersion",
  "sourceCallbacksDisabled",
  "sourceMediaWritesDisabled",
  "sourcePaymentsDisabled",
  "sourcePublishingDisabled",
  "sourceSchedulerDisabled",
  "sourceWritesDisabled",
  "unsafeHttpStatus",
]);

const SYSTEM_IDENTITY_QUERY = Object.freeze({
  name: "flowpack_media_source_system_identity_v1",
  text: `SELECT pg_backend_pid()::integer AS "backendPid", current_database() AS "databaseName", current_setting('server_version_num')::integer AS "serverVersionNum", pg_encoding_to_char(db.encoding) AS "databaseEncoding", db.datcollate AS "databaseCollation", db.datctype AS "databaseCtype", (pg_control_system()).system_identifier::text AS "systemIdentifier" FROM pg_database AS db WHERE db.datname = current_database()`,
  values: [],
});
const SCHEMA_SCOPE_QUERY = Object.freeze({
  name: "flowpack_media_source_schema_scope_v1",
  text: `SELECT nspname AS "schemaName" FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname <> 'information_schema' ORDER BY nspname`,
  values: [],
});

export class MediaSourceClientError extends Error {
  constructor(code) {
    super(code);
    this.name = "MediaSourceClientError";
    this.code = code;
  }
}

function fail(code) {
  throw new MediaSourceClientError(code);
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
}

function assertPrivateFile(path, code, maximumBytes = MAX_EVIDENCE_BYTES) {
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
    info.nlink !== 1 ||
    (info.mode & 0o777) !== FILE_MODE ||
    info.size <= 0 ||
    info.size > maximumBytes
  ) {
    fail(code);
  }
  return info;
}

function fsyncDirectory(path, code) {
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

function readCanonicalPrivate(path, code, maximumBytes) {
  const info = assertPrivateFile(path, code, maximumBytes);
  let bytes;
  let value;
  try {
    bytes = readFileSync(path);
    if (bytes.length !== info.size) fail(code);
    value = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    if (error instanceof MediaSourceClientError) throw error;
    fail(code);
  }
  if (!bytes.equals(Buffer.from(`${canonicalMediaJson(value)}\n`, "utf8"))) fail(code);
  return Object.freeze({ bytes, value });
}

function writeAll(descriptor, bytes, code) {
  let offset = 0;
  while (offset < bytes.length) {
    const written = writeSync(descriptor, bytes, offset, bytes.length - offset);
    if (written <= 0) fail(code);
    offset += written;
  }
}

function writeOrVerifyPrivate(path, value) {
  absoluteNormalizedPath(path, "SOURCE_ATTESTATION_PATH_INVALID");
  assertPrivateDirectory(dirname(path), "SOURCE_ATTESTATION_PATH_INVALID");
  const bytes = Buffer.from(`${canonicalMediaJson(value)}\n`, "utf8");
  if (bytes.length > MAX_ATTESTATION_BYTES) fail("SOURCE_ATTESTATION_INVALID");
  if (existsSync(path)) {
    const existing = readCanonicalPrivate(
      path,
      "SOURCE_ATTESTATION_COLLISION",
      MAX_ATTESTATION_BYTES,
    );
    if (!existing.bytes.equals(bytes)) fail("SOURCE_ATTESTATION_COLLISION");
    return Object.freeze({ created: false, sha256: mediaSha256(bytes) });
  }
  let descriptor;
  let created = false;
  try {
    descriptor = openSync(
      path,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0),
      FILE_MODE,
    );
    created = true;
    writeAll(descriptor, bytes, "SOURCE_ATTESTATION_WRITE_FAILED");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    assertPrivateFile(path, "SOURCE_ATTESTATION_WRITE_FAILED", bytes.length);
    fsyncDirectory(dirname(path), "SOURCE_ATTESTATION_WRITE_FAILED");
    return Object.freeze({ created: true, sha256: mediaSha256(bytes) });
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    if (created) unlinkSync(path);
    if (error instanceof MediaSourceClientError) throw error;
    fail("SOURCE_ATTESTATION_WRITE_FAILED");
  }
}

function validSortedUniqueStrings(value, pattern) {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && pattern.test(item)) &&
    value.every((item, index) => index === 0 || value[index - 1].localeCompare(item) < 0)
  );
}

function validateSourceInventory(value) {
  if (
    !exactKeys(value, [
      "database",
      "extensions",
      "largeObjects",
      "objectsSha256",
      "schemaVersion",
      "schemas",
      "sequences",
      "tables",
    ]) ||
    value.schemaVersion !== 1 ||
    !exactKeys(value.database, ["collate", "ctype", "encoding"]) ||
    Object.values(value.database).some(
      (item) => typeof item !== "string" || item.length <= 0 || item.length > 256 || /[\u0000\r\n]/u.test(item),
    ) ||
    !HASH_PATTERN.test(value.objectsSha256 ?? "") ||
    !validSortedUniqueStrings(value.schemas, SCHEMA_PATTERN) ||
    !validSortedUniqueStrings(value.extensions, /^[A-Za-z_][A-Za-z0-9_$-]*$/) ||
    !Array.isArray(value.tables) ||
    !Array.isArray(value.sequences) ||
    !Array.isArray(value.largeObjects)
  ) {
    fail("DATABASE_EVIDENCE_INVALID");
  }
  const relationNames = new Set();
  for (const table of value.tables) {
    if (
      !exactKeys(table, ["dataSha256", "name", "rowCount"]) ||
      !QUALIFIED_NAME_PATTERN.test(table.name ?? "") ||
      !HASH_PATTERN.test(table.dataSha256 ?? "") ||
      !Number.isSafeInteger(table.rowCount) ||
      table.rowCount < 0 ||
      relationNames.has(table.name)
    ) fail("DATABASE_EVIDENCE_INVALID");
    relationNames.add(table.name);
  }
  for (const sequence of value.sequences) {
    if (
      !exactKeys(sequence, ["isCalled", "lastValue", "name"]) ||
      !QUALIFIED_NAME_PATTERN.test(sequence.name ?? "") ||
      typeof sequence.isCalled !== "boolean" ||
      typeof sequence.lastValue !== "string" ||
      !/^-?[0-9]+$/.test(sequence.lastValue) ||
      relationNames.has(sequence.name)
    ) fail("DATABASE_EVIDENCE_INVALID");
    relationNames.add(sequence.name);
  }
  const largeOids = new Set();
  for (const object of value.largeObjects) {
    if (
      !exactKeys(object, ["bytes", "dataSha256", "oid"]) ||
      typeof object.oid !== "string" ||
      !/^[1-9][0-9]*$/.test(object.oid) ||
      !Number.isSafeInteger(object.bytes) ||
      object.bytes < 0 ||
      !HASH_PATTERN.test(object.dataSha256 ?? "") ||
      largeOids.has(object.oid)
    ) fail("DATABASE_EVIDENCE_INVALID");
    largeOids.add(object.oid);
  }
  return Object.freeze(value);
}

function validateEvidenceBundle(value, bytes, migrationId) {
  if (
    !exactKeys(value, [
      "createdAt",
      "dumpListSha256",
      "migrationId",
      "projectId",
      "schemaVersion",
      "sourceInventory",
      "sourceInventorySha256",
      "sourceServerMajor",
    ]) ||
    value.schemaVersion !== 1 ||
    value.projectId !== REMOTE_PROJECT_ID ||
    value.migrationId !== migrationId ||
    typeof value.createdAt !== "string" ||
    Number.isNaN(Date.parse(value.createdAt)) ||
    !HASH_PATTERN.test(value.dumpListSha256 ?? "") ||
    !HASH_PATTERN.test(value.sourceInventorySha256 ?? "") ||
    !Number.isSafeInteger(value.sourceServerMajor) ||
    value.sourceServerMajor < 12 ||
    value.sourceServerMajor > 99
  ) {
    fail("DATABASE_EVIDENCE_INVALID");
  }
  const sourceInventory = validateSourceInventory(value.sourceInventory);
  const inventoryBytes = Buffer.from(`${canonicalMediaJson(sourceInventory)}\n`, "utf8");
  if (mediaSha256(inventoryBytes) !== value.sourceInventorySha256) {
    fail("DATABASE_EVIDENCE_INVALID");
  }
  return Object.freeze({
    bundleSha256: mediaSha256(bytes),
    createdAt: value.createdAt,
    sourceInventory,
    sourceInventorySha256: value.sourceInventorySha256,
    sourceServerMajor: value.sourceServerMajor,
  });
}

function readEvidence(path, migrationId) {
  const document = readCanonicalPrivate(
    path,
    "DATABASE_EVIDENCE_INVALID",
    MAX_EVIDENCE_BYTES,
  );
  return validateEvidenceBundle(document.value, document.bytes, migrationId);
}

function readSourceFreezeReceipt(path, { migrationId, releaseCommit }) {
  const document = readCanonicalPrivate(
    path,
    "SOURCE_FREEZE_RECEIPT_INVALID",
    MAX_ATTESTATION_BYTES,
  );
  const value = document.value;
  if (
    !exactKeys(value, SOURCE_FREEZE_RECEIPT_KEYS) ||
    value.schemaVersion !== 1 ||
    value.projectId !== REMOTE_PROJECT_ID ||
    value.migrationId !== migrationId ||
    value.releaseCommit !== releaseCommit ||
    !ISO_TIMESTAMP_PATTERN.test(value.recordedAt ?? "") ||
    Number.isNaN(Date.parse(value.recordedAt)) ||
    value.sourceWritesDisabled !== true ||
    value.sourceSchedulerDisabled !== true ||
    value.sourceCallbacksDisabled !== true ||
    value.sourceMediaWritesDisabled !== true ||
    value.sourcePaymentsDisabled !== true ||
    value.sourcePublishingDisabled !== true ||
    value.inFlightWrites !== 0 ||
    value.unsafeHttpStatus !== 503 ||
    value.healthHttpStatus !== 200 ||
    !HASH_PATTERN.test(value.providerActionDigest ?? "")
  ) fail("SOURCE_FREEZE_RECEIPT_INVALID");
  return Object.freeze({
    recordedAt: value.recordedAt,
    sha256: mediaSha256(document.bytes),
  });
}

function classifyConnection(config) {
  const values = config.privateValues;
  if (
    !values ||
    values.port !== "5432" ||
    !["require", "verify-ca", "verify-full"].includes(values.sslMode)
  ) {
    fail("SOURCE_CONNECTION_PROFILE_INVALID");
  }
  const host = values.host.toLowerCase();
  if (host.endsWith(".pooler.supabase.com")) {
    if (!values.user.includes(".")) fail("SOURCE_CONNECTION_PROFILE_INVALID");
    return "session";
  }
  if (/(?:pooler|pooling|pgbouncer|supavisor|proxy)/i.test(host)) {
    fail("SOURCE_CONNECTION_PROFILE_INVALID");
  }
  return "direct";
}

function readConnectionProfile(path) {
  assertPrivateFile(path, "SOURCE_CONNECTION_PROFILE_INVALID", 1024 * 1024);
  let config;
  try {
    config = readSourceDatabaseConfig(path);
  } catch {
    fail("SOURCE_CONNECTION_PROFILE_INVALID");
  }
  const connectionMode = classifyConnection(config);
  const sourceTransportProfileSha256 = mediaSha256(canonicalMediaJson({
    channelBinding: config.privateValues.channelBinding,
    connectionMode,
    port: config.privateValues.port,
    protocol: config.protocol,
    sslMode: config.privateValues.sslMode,
  }));
  return Object.freeze({ config, connectionMode, sourceTransportProfileSha256 });
}

function createFactoryRequest(profile) {
  const request = {
    applicationName: "flowpack_media_source_attestation",
    connectionMode: profile.connectionMode,
    sourceTransportProfileSha256: profile.sourceTransportProfileSha256,
    sslMode: profile.config.privateValues.sslMode,
  };
  Object.defineProperty(request, "privateValues", {
    enumerable: false,
    value: profile.config.privateValues,
  });
  return Object.freeze(request);
}

export function createNodePostgresMediaSourceClientFactory({ Client } = {}) {
  if (typeof Client !== "function") fail("SOURCE_CLIENT_FACTORY_INVALID");
  return async (request) => {
    if (
      !exactKeys(request, [
        "applicationName",
        "connectionMode",
        "sourceTransportProfileSha256",
        "sslMode",
      ]) ||
      request.applicationName !== "flowpack_media_source_attestation" ||
      !["direct", "session"].includes(request.connectionMode) ||
      !HASH_PATTERN.test(request.sourceTransportProfileSha256 ?? "") ||
      !["require", "verify-ca", "verify-full"].includes(request.sslMode) ||
      !request.privateValues
    ) fail("SOURCE_CLIENT_FACTORY_INVALID");
    const values = request.privateValues;
    if (
      typeof values.host !== "string" ||
      values.host.length <= 0 ||
      values.host.length > 253 ||
      /[\u0000-\u0020\u007f]/u.test(values.host) ||
      values.port !== "5432" ||
      !DATABASE_PATTERN.test(values.database ?? "") ||
      typeof values.user !== "string" ||
      values.user.length <= 0 ||
      values.user.length > 256 ||
      /[\u0000\r\n]/u.test(values.user) ||
      typeof values.password !== "string" ||
      values.password.length <= 0 ||
      values.password.length > 4096 ||
      /[\u0000\r\n]/u.test(values.password) ||
      values.sslMode !== request.sslMode ||
      !["disable", "prefer", "require"].includes(values.channelBinding)
    ) fail("SOURCE_CLIENT_FACTORY_INVALID");
    const ssl = values.sslMode === "require"
      ? Object.freeze({ rejectUnauthorized: false })
      : values.sslMode === "verify-ca"
        ? Object.freeze({
          checkServerIdentity: () => undefined,
          rejectUnauthorized: true,
        })
        : Object.freeze({ rejectUnauthorized: true });
    const options = Object.freeze({
      application_name: request.applicationName,
      database: values.database,
      enableChannelBinding: values.channelBinding !== "disable",
      host: values.host,
      keepAlive: true,
      password: values.password,
      port: Number(values.port),
      ssl,
      user: values.user,
    });
    try {
      return new Client(options);
    } catch {
      fail("SOURCE_CONNECTION_FAILED");
    }
  };
}

async function queryStrict(client, query) {
  try {
    return await client.query(query);
  } catch {
    fail("SOURCE_ATTESTATION_QUERY_FAILED");
  }
}

function validateIdentityResult(result, client, evidence, config) {
  if (
    !result ||
    result.rowCount !== 1 ||
    !Array.isArray(result.rows) ||
    result.rows.length !== 1 ||
    !exactKeys(result.rows[0], [
      "backendPid",
      "databaseCollation",
      "databaseCtype",
      "databaseEncoding",
      "databaseName",
      "serverVersionNum",
      "systemIdentifier",
    ])
  ) {
    fail("SOURCE_DATABASE_IDENTITY_INVALID");
  }
  const row = result.rows[0];
  if (
    !Number.isSafeInteger(client.processID) ||
    client.processID <= 0 ||
    !Number.isSafeInteger(row.backendPid) ||
    row.backendPid !== client.processID
  ) {
    fail("SOURCE_DEDICATED_SESSION_MISMATCH");
  }
  if (
    !DATABASE_PATTERN.test(row.databaseName ?? "") ||
    row.databaseName !== config.privateValues.database ||
    !Number.isSafeInteger(row.serverVersionNum) ||
    Math.floor(row.serverVersionNum / 10000) !== evidence.sourceServerMajor ||
    row.databaseEncoding !== evidence.sourceInventory.database.encoding ||
    row.databaseCollation !== evidence.sourceInventory.database.collate ||
    row.databaseCtype !== evidence.sourceInventory.database.ctype ||
    typeof row.systemIdentifier !== "string" ||
    !/^[1-9][0-9]{4,31}$/.test(row.systemIdentifier)
  ) {
    fail("SOURCE_DATABASE_IDENTITY_MISMATCH");
  }
  return Object.freeze({ ...row });
}

function validateSchemaResult(result, evidence) {
  if (
    !result ||
    !Number.isSafeInteger(result.rowCount) ||
    result.rowCount < 0 ||
    !Array.isArray(result.rows) ||
    result.rows.length !== result.rowCount ||
    result.rows.some(
      (row) => !exactKeys(row, ["schemaName"]) || !SCHEMA_PATTERN.test(row.schemaName ?? ""),
    )
  ) {
    fail("SOURCE_SCHEMA_SCOPE_INVALID");
  }
  const schemas = result.rows.map((row) => row.schemaName);
  if (
    new Set(schemas).size !== schemas.length ||
    JSON.stringify(schemas) !== JSON.stringify(evidence.sourceInventory.schemas)
  ) {
    fail("SOURCE_SCHEMA_SCOPE_MISMATCH");
  }
  return Object.freeze(schemas);
}

function mediaAttestationDocument({
  databaseName,
  migrationId,
  remoteLockIdentitySha256,
  sourceFreezeReceiptSha256,
  sourceTransportProfileSha256,
}) {
  return Object.freeze({
    databaseName,
    migrationId,
    projectId: MEDIA_PROJECT_ID,
    remoteLockIdentitySha256,
    schemaVersion: ATTESTATION_SCHEMA_VERSION,
    sourceFreezeReceiptSha256,
    sourceTransportProfileSha256,
    targetKind: "source",
  });
}

function bindingDocument({
  evidence,
  freezeReceipt,
  identity,
  migrationId,
  profile,
  remoteLockIdentitySha256,
  schemas,
  snapshotEvidence,
}) {
  const databaseSystemIdentitySha256 = mediaSha256(identity.systemIdentifier);
  const schemaScopeSha256 = mediaSha256(canonicalMediaJson(schemas));
  const databaseIdentitySha256 = mediaSha256(canonicalMediaJson({
    database: evidence.sourceInventory.database,
    databaseNameSha256: mediaSha256(identity.databaseName),
    databaseSystemIdentitySha256,
    schemaScopeSha256,
    serverVersionNum: identity.serverVersionNum,
  }));
  return Object.freeze({
    databaseEvidenceBundleSha256: evidence.bundleSha256,
    databaseIdentitySha256,
    databaseNameSha256: mediaSha256(identity.databaseName),
    databaseSystemIdentitySha256,
    migrationId,
    projectId: MEDIA_PROJECT_ID,
    remoteLockIdentitySha256,
    sameSnapshotMediaInventory: true,
    schemaScopeSha256,
    schemaVersion: ATTESTATION_SCHEMA_VERSION,
    sourceFreezeReceiptSha256: freezeReceipt.sha256,
    sourceInventorySha256: evidence.sourceInventorySha256,
    sourceMediaRecordsSha256: snapshotEvidence.recordsSha256,
    sourceObjectsSha256: evidence.sourceInventory.objectsSha256,
    sourceSnapshotEvidenceSha256: mediaSha256(canonicalMediaJson(snapshotEvidence)),
    sourceTransportProfileSha256: profile.sourceTransportProfileSha256,
    targetKind: "source",
  });
}

function publicResult({ binding, bindingWrite, mediaWrite, profile }) {
  return Object.freeze({
    attestationReused: !bindingWrite.created && !mediaWrite.created,
    connectionMode: profile.connectionMode,
    databaseBindingAttestationSha256: bindingWrite.sha256,
    databaseEvidenceBundleSha256: binding.databaseEvidenceBundleSha256,
    databaseIdentitySha256: binding.databaseIdentitySha256,
    databaseSystemIdentitySha256: binding.databaseSystemIdentitySha256,
    mediaSourceAttestationSha256: mediaWrite.sha256,
    migrationIdSha256: mediaSha256(binding.migrationId),
    ok: true,
    remoteLockIdentitySha256: binding.remoteLockIdentitySha256,
    sameSnapshotMediaInventory: true,
    schemaScopeSha256: binding.schemaScopeSha256,
    sourceFreezeReceiptSha256: binding.sourceFreezeReceiptSha256,
    sourceInventorySha256: binding.sourceInventorySha256,
    sourceMediaRecordsSha256: binding.sourceMediaRecordsSha256,
    sourceObjectsSha256: binding.sourceObjectsSha256,
    sourceSnapshotEvidenceSha256: binding.sourceSnapshotEvidenceSha256,
    sourceTransportProfileSha256: profile.sourceTransportProfileSha256,
    sslMode: profile.config.privateValues.sslMode,
  });
}

export async function withAttestedPostgresMediaSource({
  clientFactory,
  consume,
  databaseBindingAttestationPath,
  databaseEvidenceBundlePath,
  mediaSourceAttestationPath,
  migrationId,
  releaseCommit,
  remoteLockIdentitySha256,
  sourceConfigPath,
  sourceFreezeReceiptPath,
} = {}) {
  if (
    typeof clientFactory !== "function" ||
    typeof consume !== "function" ||
    !MIGRATION_ID_PATTERN.test(migrationId ?? "") ||
    !RELEASE_PATTERN.test(releaseCommit ?? "") ||
    !HASH_PATTERN.test(remoteLockIdentitySha256 ?? "")
  ) {
    fail("SOURCE_CLIENT_INPUT_INVALID");
  }
  const profile = readConnectionProfile(sourceConfigPath);
  const evidence = readEvidence(databaseEvidenceBundlePath, migrationId);
  const freezeReceipt = readSourceFreezeReceipt(sourceFreezeReceiptPath, {
    migrationId,
    releaseCommit,
  });
  if (Date.parse(evidence.createdAt) < Date.parse(freezeReceipt.recordedAt)) {
    fail("DATABASE_EVIDENCE_PRECEDES_SOURCE_FREEZE");
  }
  let client;
  let began = false;
  let mediaWrite;
  let bindingWrite;
  let binding;
  let connectionClosed = false;
  let pendingError;
  try {
    try {
      client = await clientFactory(createFactoryRequest(profile));
    } catch {
      fail("SOURCE_CONNECTION_FAILED");
    }
    if (
      !client ||
      typeof client.connect !== "function" ||
      typeof client.end !== "function" ||
      typeof client.query !== "function"
    ) {
      fail("SOURCE_CLIENT_INVALID");
    }
    try {
      await client.connect();
    } catch {
      fail("SOURCE_CONNECTION_FAILED");
    }
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      began = true;
    } catch {
      fail("SOURCE_ATTESTATION_QUERY_FAILED");
    }
    const identity = validateIdentityResult(
      await queryStrict(client, SYSTEM_IDENTITY_QUERY),
      client,
      evidence,
      profile.config,
    );
    const schemas = validateSchemaResult(
      await queryStrict(client, SCHEMA_SCOPE_QUERY),
      evidence,
    );
    const mediaDocument = mediaAttestationDocument({
      databaseName: identity.databaseName,
      migrationId,
      remoteLockIdentitySha256,
      sourceFreezeReceiptSha256: freezeReceipt.sha256,
      sourceTransportProfileSha256: profile.sourceTransportProfileSha256,
    });
    mediaWrite = writeOrVerifyPrivate(mediaSourceAttestationPath, mediaDocument);
    let records;
    let snapshotEvidence;
    try {
      snapshotEvidence = await capturePostgresMediaSourceSnapshot({
        attestationPath: mediaSourceAttestationPath,
        client,
        consume: async (capturedRecords) => {
          records = capturedRecords;
        },
        transactionScope: "existing",
      });
    } catch {
      fail("SOURCE_MEDIA_SNAPSHOT_FAILED");
    }
    if (!records || snapshotEvidence?.sameSnapshotMediaInventory !== true) {
      fail("SOURCE_MEDIA_SNAPSHOT_FAILED");
    }
    binding = bindingDocument({
      evidence,
      freezeReceipt,
      identity,
      migrationId,
      profile,
      remoteLockIdentitySha256,
      schemas,
      snapshotEvidence,
    });
    try {
      await client.query("COMMIT");
      began = false;
    } catch {
      fail("SOURCE_ATTESTATION_QUERY_FAILED");
    }
    try {
      await client.end();
      connectionClosed = true;
    } catch {
      fail("SOURCE_CONNECTION_CLOSE_FAILED");
    }
    const freezeReceiptAfterCommit = readSourceFreezeReceipt(sourceFreezeReceiptPath, {
      migrationId,
      releaseCommit,
    });
    const evidenceAfterCommit = readEvidence(databaseEvidenceBundlePath, migrationId);
    if (
      freezeReceiptAfterCommit.sha256 !== freezeReceipt.sha256 ||
      evidenceAfterCommit.bundleSha256 !== evidence.bundleSha256 ||
      evidenceAfterCommit.sourceInventorySha256 !== evidence.sourceInventorySha256
    ) {
      fail("SOURCE_BINDING_CHANGED_AFTER_SNAPSHOT");
    }
    const mediaRecheck = writeOrVerifyPrivate(mediaSourceAttestationPath, mediaDocument);
    if (mediaRecheck.created || mediaRecheck.sha256 !== mediaWrite.sha256) {
      fail("SOURCE_BINDING_CHANGED_AFTER_SNAPSHOT");
    }
    bindingWrite = writeOrVerifyPrivate(databaseBindingAttestationPath, binding);
    try {
      await consume(records, snapshotEvidence, Object.freeze({
        committedSourceSnapshot: true,
        databaseBinding: binding,
        databaseBindingAttestationPath,
        mediaSourceAttestationPath,
        sourceFreezeReceiptSha256: freezeReceipt.sha256,
      }));
    } catch {
      fail("SOURCE_CONSUMER_FAILED");
    }
  } catch (error) {
    pendingError = error instanceof MediaSourceClientError
      ? error
      : new MediaSourceClientError("SOURCE_CLIENT_FAILED");
    if (began) await client?.query("ROLLBACK").catch(() => undefined);
  } finally {
    if (!connectionClosed && client && typeof client.end === "function") {
      try {
        await client.end();
      } catch {
        if (!pendingError) pendingError = new MediaSourceClientError("SOURCE_CONNECTION_CLOSE_FAILED");
      }
    }
  }
  if (pendingError) {
    if (bindingWrite?.created) unlinkSync(databaseBindingAttestationPath);
    if (mediaWrite?.created) unlinkSync(mediaSourceAttestationPath);
    throw pendingError;
  }
  return publicResult({ binding, bindingWrite, mediaWrite, profile });
}
