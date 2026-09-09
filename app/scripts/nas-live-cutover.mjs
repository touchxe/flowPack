#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  writeSync,
} from 'node:fs';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { compareIntegrityEvidence } from './nas-database-artifact.mjs';
import {
  advanceLedger,
  canonicalStringify,
  recordFailure,
  recordRollback,
  verifyLedger,
} from './nas-migration-ledger.mjs';
import {
  MEDIA_EVIDENCE_SCHEMA_VERSION,
  MEDIA_PROJECT_ID,
  canonicalMediaJson,
  mediaCandidateIdentitySha256,
  mediaSha256,
} from './nas-media-contract.mjs';
import { readSeparateOffsiteProfile } from './nas-live-cutover-system.mjs';
import { readRetainedProviderManifest } from './nas-provider-manifest.mjs';

export const PROJECT_ID = 'flowpack-nas';

const FILE_MODE = 0o600;
const DIRECTORY_MODE = 0o700;
const MAX_CONTROL_BYTES = 256 * 1024;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const MIGRATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RELEASE_PATTERN = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const DATABASE_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const REQUEST_ID_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const SCHEMA_ALLOWLIST = Object.freeze(['public']);
const EXCLUDED_BASELINE_TABLE = 'public._prisma_migrations';
const CONTROL_KEYS = Object.freeze([
  'authSmokeInputPath',
  'backupKeyPath',
  'composePath',
  'cutoverApprovalPath',
  'journalPath',
  'migrationConfigPath',
  'migrationId',
  'offsiteProfilePath',
  'operatorEnvPath',
  'providerManifestPath',
  'projectId',
  'releaseCommit',
  'restrictedGatewayProfilePath',
  'schemaVersion',
  'sourceConfigPath',
  'sourceFreezeReceiptPath',
  'sourceRecoveryReceiptPath',
  'workspacePath',
]);
const PATH_KEYS = CONTROL_KEYS.filter((key) => key.endsWith('Path'));
const PRIVATE_INPUT_KEYS = Object.freeze([
  'authSmokeInputPath',
  'backupKeyPath',
  'journalPath',
  'offsiteProfilePath',
  'operatorEnvPath',
  'providerManifestPath',
  'sourceConfigPath',
]);
const TRACKED_INPUT_KEYS = Object.freeze(['composePath', 'migrationConfigPath']);
const MUTATING_PHASES = new Set([
  'prepare-target',
  'freeze-source',
  'bind-final',
  'restore-destination',
  'smoke-readonly',
  'commit',
  'finalize',
  'pre-write-rollback',
]);
const ALL_PHASES = new Set(['status', ...MUTATING_PHASES]);
const POST_WRITE_PHASES = new Set([
  'WRITES_ENABLED_PENDING_LEDGER',
  'COMMITTED',
  'FINALIZED',
]);
const PRE_WRITE_PHASES = new Set([
  'LOCKED',
  'TARGET_PREPARED',
  'SOURCE_FROZEN',
  'FINAL_BOUND',
  'CANDIDATE_RESTORED',
  'LIVE_RENAMED',
  'CANDIDATE_PROMOTED',
  'DESTINATION_READ_ONLY',
  'ZERO_WRITE_SMOKE_PASSED',
]);
const SOURCE_FREEZE_RECEIPT_KEYS = Object.freeze([
  'healthHttpStatus',
  'inFlightWrites',
  'migrationId',
  'projectId',
  'providerActionDigest',
  'providerManifestSha256',
  'recordedAt',
  'releaseCommit',
  'schemaVersion',
  'sourceCallbacksDisabled',
  'sourceMediaWritesDisabled',
  'sourcePaymentsDisabled',
  'sourcePublishingDisabled',
  'sourceSchedulerDisabled',
  'sourceWritesDisabled',
  'unsafeHttpStatus',
]);
const SOURCE_RECOVERY_RECEIPT_KEYS = Object.freeze([
  'healthHttpStatus',
  'migrationId',
  'projectId',
  'providerActionDigest',
  'recordedAt',
  'releaseCommit',
  'schemaVersion',
  'sourceCallbacksEnabled',
  'sourceMediaWritesEnabled',
  'sourcePaymentsEnabled',
  'sourcePublishingEnabled',
  'sourceSchedulerEnabled',
  'sourceWritesEnabled',
]);
const CUTOVER_APPROVAL_KEYS = Object.freeze([
  'approvedAt',
  'decision',
  'destinationRestoreReportDigest',
  'migrationId',
  'projectId',
  'releaseCommit',
  'schemaVersion',
  'sourceFreezeReceiptDigest',
  'zeroWriteSmokeReportDigest',
]);
const MEDIA_PREPARATION_KEYS = Object.freeze([
  'artifactHandleSha256',
  'bundleSha256',
  'candidateAttestationSha256',
  'candidateDatabaseNameSha256',
  'candidateIdentitySha256',
  'candidateRewriteExecutionDigest',
  'candidateRewriteOperationsVerified',
  'candidateRewriteReceiptSha256',
  'candidateVerificationSha256',
  'completionReceiptSha256',
  'databaseBindingAttestationSha256',
  'databaseEvidenceBundleSha256',
  'databaseIdentitySha256',
  'databaseSystemIdentitySha256',
  'evidenceSchemaVersion',
  'gatewayActionSetSha256',
  'gatewayArtifactSha256',
  'gatewayHelperSha256',
  'gatewayObjectCount',
  'gatewayPolicySha256',
  'gatewayPreflightReceiptSha256',
  'gatewayProtocolSha256',
  'gatewayReceiveReceiptSha256',
  'gatewayReceiveRequestId',
  'gatewayReused',
  'gatewayUploadCompletionReceiptSha256',
  'gatewayUploadReceiptSha256',
  'mediaEvidenceManifestSha256',
  'offsiteAuthenticatedReadback',
  'offsiteEncryptedSha256',
  'offsiteFsyncCompleted',
  'offsiteReadbackBundleSha256',
  'offsiteSeparateDevice',
  'ok',
  'remoteCandidateVerified',
  'remoteLockIdentitySha256',
  'schemaScopeSha256',
  'sourceFreezeReceiptSha256',
  'sourceInventorySha256',
  'sourceMediaRecordsSha256',
  'sourceObjectsSha256',
  'sourceSnapshotEvidenceSha256',
  'sourceTransportProfileSha256',
  'transferManifestSha256',
]);
const MEDIA_PROMOTION_KEYS = Object.freeze([
  'candidateRewriteReceiptSha256',
  'canonicalObjectsVerified',
  'canonicalVerificationSha256',
  'gatewayActionSetSha256',
  'gatewayHelperSha256',
  'gatewayObjectCount',
  'gatewayPolicySha256',
  'gatewayPreflightReceiptSha256',
  'gatewayPromotionArtifactSha256',
  'gatewayPromotionReceiptSha256',
  'gatewayPromotionRequestId',
  'gatewayProtocolSha256',
  'gatewayReused',
  'mediaGenerationDigest',
  'ok',
  'promotionMode',
  'promotionReceiptSha256',
  'remoteLockIdentitySha256',
]);

export class LiveCutoverError extends Error {
  constructor(code) {
    super(code);
    this.name = 'LiveCutoverError';
    this.code = code;
  }
}

function fail(code) {
  throw new LiveCutoverError(code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value, expected) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index]);
}

function validateAbsolutePath(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 4096 ||
    !isAbsolute(value) ||
    resolve(value) !== value ||
    value.includes('\0') ||
    value.split(sep).includes('..')
  ) {
    fail('LIVE_CONTROL_INVALID');
  }
  return value;
}

function safeLstat(path, missingIsNull = false) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (missingIsNull && error?.code === 'ENOENT') return null;
    fail('LIVE_CONTROL_FILESYSTEM_CHECK_FAILED');
  }
}

function assertPrivateFile(path, code = 'LIVE_CONTROL_PRIVATE_FILE_REQUIRED') {
  const metadata = safeLstat(path);
  if (
    metadata.isSymbolicLink() ||
    !metadata.isFile() ||
    (metadata.mode & 0o777) !== FILE_MODE ||
    metadata.size <= 0 ||
    metadata.size > MAX_CONTROL_BYTES
  ) {
    fail(code);
  }
  return metadata;
}

function assertPrivateDirectory(path, code = 'LIVE_CONTROL_PRIVATE_DIRECTORY_REQUIRED') {
  const metadata = safeLstat(path);
  if (
    metadata.isSymbolicLink() ||
    !metadata.isDirectory() ||
    (metadata.mode & 0o777) !== DIRECTORY_MODE
  ) {
    fail(code);
  }
  return metadata;
}

function assertTrackedFile(path) {
  const metadata = safeLstat(path);
  if (
    metadata.isSymbolicLink() ||
    !metadata.isFile() ||
    metadata.size <= 0 ||
    metadata.size > 1024 * 1024 ||
    (metadata.mode & 0o022) !== 0
  ) {
    fail('LIVE_CONTROL_TRACKED_FILE_INVALID');
  }
}

function assertOptionalPrivateOutput(path) {
  const metadata = safeLstat(path, true);
  if (metadata !== null) {
    assertPrivateFile(path);
    return;
  }
  assertPrivateDirectory(dirname(path));
}

function readCanonicalPrivateJson(path, code) {
  assertPrivateFile(path, code);
  let raw;
  let value;
  try {
    raw = readFileSync(path, 'utf8');
    value = JSON.parse(raw);
  } catch {
    fail(code);
  }
  if (raw !== `${canonicalStringify(value)}\n`) fail(code);
  return value;
}

function digestCanonical(value) {
  try {
    return createHash('sha256')
      .update(canonicalStringify(value), 'utf8')
      .digest('hex');
  } catch {
    fail('LIVE_EVIDENCE_INVALID');
  }
}

function validateTimestamp(value, code) {
  if (
    typeof value !== 'string' ||
    !ISO_TIMESTAMP_PATTERN.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    fail(code);
  }
}

function validateIdentity(value, expected, code) {
  if (
    value.projectId !== PROJECT_ID ||
    value.projectId !== expected.projectId ||
    value.migrationId !== expected.migrationId ||
    value.releaseCommit !== expected.releaseCommit
  ) {
    fail(code);
  }
}

export function readLiveCutoverControl(controlPath) {
  validateAbsolutePath(controlPath);
  const control = readCanonicalPrivateJson(
    controlPath,
    'LIVE_CONTROL_PRIVATE_FILE_REQUIRED',
  );
  if (
    !hasExactKeys(control, CONTROL_KEYS) ||
    control.schemaVersion !== 1 ||
    control.projectId !== PROJECT_ID ||
    !MIGRATION_ID_PATTERN.test(control.migrationId ?? '') ||
    !RELEASE_PATTERN.test(control.releaseCommit ?? '')
  ) {
    fail('LIVE_CONTROL_INVALID');
  }
  for (const key of PATH_KEYS) validateAbsolutePath(control[key]);
  if (new Set(PATH_KEYS.map((key) => control[key])).size !== PATH_KEYS.length) {
    fail('LIVE_CONTROL_INVALID');
  }
  for (const key of PRIVATE_INPUT_KEYS) assertPrivateFile(control[key]);
  for (const key of TRACKED_INPUT_KEYS) assertTrackedFile(control[key]);
  for (const key of [
    'sourceFreezeReceiptPath',
    'sourceRecoveryReceiptPath',
    'cutoverApprovalPath',
  ]) {
    assertOptionalPrivateOutput(control[key]);
  }
  assertPrivateDirectory(control.workspacePath);
  assertPrivateDirectory(control.restrictedGatewayProfilePath);
  return Object.freeze({ ...control });
}

export function parseLiveCutoverArguments(argv) {
  if (!Array.isArray(argv) || argv[0] !== 'cutover') fail('USAGE');
  const phase = argv[1];
  if (!ALL_PHASES.has(phase)) fail('USAGE');
  if (phase === 'status') {
    if (argv.length !== 4 || argv[2] !== '--control') fail('USAGE');
    return { phase, controlPath: argv[3], confirmation: undefined };
  }
  if (
    argv.length !== 6 ||
    argv[2] !== '--control' ||
    argv[4] !== '--confirm' ||
    typeof argv[5] !== 'string' ||
    argv[5].length === 0 ||
    /[\u0000\r\n]/u.test(argv[5])
  ) {
    fail('USAGE');
  }
  return { phase, controlPath: argv[3], confirmation: argv[5] };
}

export function expectedLiveConfirmation(control, phase) {
  if (
    !isPlainObject(control) ||
    control.projectId !== PROJECT_ID ||
    !MIGRATION_ID_PATTERN.test(control.migrationId ?? '') ||
    !MUTATING_PHASES.has(phase)
  ) {
    fail('LIVE_CONFIRMATION_INVALID');
  }
  return `${PROJECT_ID}:${control.migrationId}:${phase}`;
}

function requireConfirmation(control, phase, confirmation) {
  if (confirmation !== expectedLiveConfirmation(control, phase)) {
    fail('LIVE_CONFIRMATION_REQUIRED');
  }
}

export function deriveLiveDatabaseNames(migrationId) {
  if (!MIGRATION_ID_PATTERN.test(migrationId ?? '')) fail('LIVE_MIGRATION_ID_INVALID');
  const suffix = createHash('sha256').update(migrationId, 'utf8').digest('hex').slice(0, 12);
  return Object.freeze({
    canonicalDatabase: 'flowpack',
    candidateDatabase: `flowpack_candidate_${suffix}`,
    previousDatabase: `flowpack_precutover_${suffix}`,
  });
}

export function deriveRemoteMediaLockIdentity({
  databaseNames,
  migrationId,
  releaseCommit,
  tokenDigest,
} = {}) {
  if (
    !isPlainObject(databaseNames) ||
    !DATABASE_PATTERN.test(databaseNames.candidateDatabase ?? '') ||
    !DATABASE_PATTERN.test(databaseNames.previousDatabase ?? '') ||
    !MIGRATION_ID_PATTERN.test(migrationId ?? '') ||
    !RELEASE_PATTERN.test(releaseCommit ?? '') ||
    !HASH_PATTERN.test(tokenDigest ?? '')
  ) {
    fail('MEDIA_REMOTE_LOCK_IDENTITY_INVALID');
  }
  return mediaSha256(canonicalMediaJson({
    candidateDatabase: databaseNames.candidateDatabase,
    migrationId,
    previousDatabase: databaseNames.previousDatabase,
    projectId: PROJECT_ID,
    releaseCommit,
    tokenDigest,
  }));
}

function expectedMediaCandidateIdentity(context) {
  const remoteLockIdentitySha256 = deriveRemoteMediaLockIdentity({
    databaseNames: context.databaseNames,
    migrationId: context.control.migrationId,
    releaseCommit: context.control.releaseCommit,
    tokenDigest: context.tokenDigest,
  });
  const candidateDatabaseNameSha256 = mediaSha256(
    context.databaseNames.candidateDatabase,
  );
  return Object.freeze({
    candidateDatabaseNameSha256,
    candidateIdentitySha256: mediaCandidateIdentitySha256({
      candidateDatabaseNameSha256,
      migrationId: context.control.migrationId,
      projectId: MEDIA_PROJECT_ID,
      remoteLockIdentitySha256,
    }),
    remoteLockIdentitySha256,
  });
}

export function buildCandidateRestoreCommand({ candidateDatabase, dumpPath }) {
  if (
    !DATABASE_PATTERN.test(candidateDatabase ?? '') ||
    typeof dumpPath !== 'string' ||
    !/^\/backups\/[a-z0-9._-]+$/.test(dumpPath)
  ) {
    fail('RESTORE_COMMAND_INVALID');
  }
  return Object.freeze({
    executable: 'pg_restore',
    args: Object.freeze([
      '--dbname',
      candidateDatabase,
      '--single-transaction',
      '--exit-on-error',
      '--no-owner',
      '--no-acl',
      dumpPath,
    ]),
  });
}

export function validateSourceFreezeReceipt(receipt, expected) {
  const providerManifest = readRetainedProviderManifest(expected.providerManifestPath, {
    migrationId: expected.migrationId,
    releaseCommit: expected.releaseCommit,
  });
  if (
    !hasExactKeys(receipt, SOURCE_FREEZE_RECEIPT_KEYS) ||
    receipt.schemaVersion !== 1 ||
    receipt.sourceWritesDisabled !== true ||
    receipt.sourceSchedulerDisabled !== true ||
    receipt.sourceCallbacksDisabled !== true ||
    receipt.sourceMediaWritesDisabled !== true ||
    receipt.sourcePaymentsDisabled !== true ||
    receipt.sourcePublishingDisabled !== true ||
    receipt.inFlightWrites !== 0 ||
    receipt.unsafeHttpStatus !== 503 ||
    receipt.healthHttpStatus !== 200 ||
    !HASH_PATTERN.test(receipt.providerActionDigest ?? '') ||
    receipt.providerManifestSha256 !== providerManifest.sha256
  ) {
    fail('SOURCE_FREEZE_RECEIPT_INVALID');
  }
  validateIdentity(receipt, expected, 'SOURCE_FREEZE_RECEIPT_INVALID');
  validateTimestamp(receipt.recordedAt, 'SOURCE_FREEZE_RECEIPT_INVALID');
  return digestCanonical(receipt);
}

function validateSourceRecoveryReceipt(receipt, expected) {
  if (
    !hasExactKeys(receipt, SOURCE_RECOVERY_RECEIPT_KEYS) ||
    receipt.schemaVersion !== 1 ||
    receipt.sourceWritesEnabled !== true ||
    receipt.sourceSchedulerEnabled !== true ||
    receipt.sourceCallbacksEnabled !== true ||
    receipt.sourceMediaWritesEnabled !== true ||
    receipt.sourcePaymentsEnabled !== true ||
    receipt.sourcePublishingEnabled !== true ||
    receipt.healthHttpStatus !== 200 ||
    !HASH_PATTERN.test(receipt.providerActionDigest ?? '')
  ) {
    fail('SOURCE_RECOVERY_RECEIPT_INVALID');
  }
  validateIdentity(receipt, expected, 'SOURCE_RECOVERY_RECEIPT_INVALID');
  validateTimestamp(receipt.recordedAt, 'SOURCE_RECOVERY_RECEIPT_INVALID');
  return digestCanonical(receipt);
}

export function validateCutoverApproval(approval, expected) {
  if (
    !hasExactKeys(approval, CUTOVER_APPROVAL_KEYS) ||
    approval.schemaVersion !== 1 ||
    approval.decision !== 'ENABLE_DESTINATION_WRITES' ||
    approval.sourceFreezeReceiptDigest !== expected.sourceFreezeReceiptDigest ||
    approval.destinationRestoreReportDigest !== expected.destinationRestoreReportDigest ||
    approval.zeroWriteSmokeReportDigest !== expected.zeroWriteSmokeReportDigest ||
    !HASH_PATTERN.test(approval.sourceFreezeReceiptDigest ?? '') ||
    !HASH_PATTERN.test(approval.destinationRestoreReportDigest ?? '') ||
    !HASH_PATTERN.test(approval.zeroWriteSmokeReportDigest ?? '')
  ) {
    fail('CUTOVER_APPROVAL_INVALID');
  }
  validateIdentity(approval, expected, 'CUTOVER_APPROVAL_INVALID');
  validateTimestamp(approval.approvedAt, 'CUTOVER_APPROVAL_INVALID');
  return digestCanonical(approval);
}

function validateFlowpackIntegrityEvidence(evidence, code) {
  if (
    !hasExactKeys(evidence, [
      'database',
      'extensions',
      'largeObjects',
      'objectsSha256',
      'schemaVersion',
      'schemas',
      'sequences',
      'tables',
    ]) ||
    evidence.schemaVersion !== 1 ||
    !hasExactKeys(evidence.database, ['collate', 'ctype', 'encoding']) ||
    [evidence.database.collate, evidence.database.ctype, evidence.database.encoding]
      .some((value) => typeof value !== 'string' || value.length === 0 || /[\u0000\r\n]/u.test(value)) ||
    JSON.stringify(evidence.schemas) !== JSON.stringify(SCHEMA_ALLOWLIST) ||
    !Array.isArray(evidence.extensions) ||
    !HASH_PATTERN.test(evidence.objectsSha256 ?? '') ||
    !Array.isArray(evidence.tables) ||
    !Array.isArray(evidence.sequences) ||
    !Array.isArray(evidence.largeObjects)
  ) {
    fail(code);
  }
  const names = new Set();
  for (const table of evidence.tables) {
    if (
      !hasExactKeys(table, ['dataSha256', 'name', 'rowCount']) ||
      !/^public\.[A-Za-z_][A-Za-z0-9_$]*$/.test(table.name ?? '') ||
      table.name === EXCLUDED_BASELINE_TABLE ||
      !Number.isSafeInteger(table.rowCount) ||
      table.rowCount < 0 ||
      !HASH_PATTERN.test(table.dataSha256 ?? '') ||
      names.has(table.name)
    ) {
      fail(code);
    }
    names.add(table.name);
  }
  for (const sequence of evidence.sequences) {
    if (
      !hasExactKeys(sequence, ['isCalled', 'lastValue', 'name']) ||
      !/^public\.[A-Za-z_][A-Za-z0-9_$]*$/.test(sequence.name ?? '') ||
      typeof sequence.lastValue !== 'string' ||
      !/^-?[0-9]+$/.test(sequence.lastValue) ||
      typeof sequence.isCalled !== 'boolean' ||
      names.has(sequence.name)
    ) {
      fail(code);
    }
    names.add(sequence.name);
  }
  const objectIdentifiers = new Set();
  for (const object of evidence.largeObjects) {
    if (
      !hasExactKeys(object, ['bytes', 'dataSha256', 'oid']) ||
      typeof object.oid !== 'string' ||
      !/^[1-9][0-9]*$/.test(object.oid) ||
      !Number.isSafeInteger(object.bytes) ||
      object.bytes < 0 ||
      !HASH_PATTERN.test(object.dataSha256 ?? '') ||
      objectIdentifiers.has(object.oid)
    ) {
      fail(code);
    }
    objectIdentifiers.add(object.oid);
  }
  if (
    new Set(evidence.extensions).size !== evidence.extensions.length ||
    evidence.extensions.some((value) => typeof value !== 'string')
  ) {
    fail(code);
  }
  return evidence;
}

function writePrivateReport(control, name, value, code) {
  const reportRoot = join(control.workspacePath, 'live-cutover');
  if (!existsSync(reportRoot)) {
    try {
      mkdirSync(reportRoot, { mode: DIRECTORY_MODE });
    } catch {
      fail(code);
    }
  }
  assertPrivateDirectory(reportRoot, code);
  const reportPath = join(reportRoot, name);
  if (existsSync(reportPath)) fail('LIVE_PHASE_ALREADY_RECORDED');
  const payload = Buffer.from(`${canonicalStringify(value)}\n`, 'utf8');
  let descriptor;
  try {
    descriptor = openSync(
      reportPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      FILE_MODE,
    );
    let offset = 0;
    while (offset < payload.byteLength) {
      const written = writeSync(descriptor, payload, offset, payload.byteLength - offset);
      if (written <= 0) fail(code);
      offset += written;
    }
    fsyncSync(descriptor);
  } catch (error) {
    if (error instanceof LiveCutoverError) throw error;
    fail(code);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  let parentDescriptor;
  try {
    parentDescriptor = openSync(reportRoot, constants.O_RDONLY);
    fsyncSync(parentDescriptor);
  } catch {
    fail(code);
  } finally {
    if (parentDescriptor !== undefined) closeSync(parentDescriptor);
  }
  assertPrivateFile(reportPath, code);
  return {
    path: reportPath,
    digest: createHash('sha256').update(payload).digest('hex'),
  };
}

function readReport(control, name, code) {
  return readCanonicalPrivateJson(join(control.workspacePath, 'live-cutover', name), code);
}

function reportPath(control, name) {
  return join(control.workspacePath, 'live-cutover', name);
}

function reportExists(control, name) {
  return existsSync(reportPath(control, name));
}

function digestReport(control, name, code) {
  const path = reportPath(control, name);
  assertPrivateFile(path, code);
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function validateReportIdentity(report, control, code) {
  if (
    !isPlainObject(report) ||
    report.schemaVersion !== 1 ||
    report.projectId !== PROJECT_ID ||
    report.migrationId !== control.migrationId ||
    report.releaseCommit !== control.releaseCommit
  ) {
    fail(code);
  }
  return report;
}

function nowFrom(dependencies) {
  let value;
  try {
    value = dependencies.now();
  } catch {
    fail('LIVE_CLOCK_INVALID');
  }
  const timestamp = value instanceof Date ? value.toISOString() : value;
  validateTimestamp(timestamp, 'LIVE_CLOCK_INVALID');
  return timestamp;
}

function validateLedgerStatus(status, expectedState, code) {
  if (
    !isPlainObject(status) ||
    status.ok !== true ||
    status.rolledBack !== false ||
    status.currentState !== expectedState ||
    !Number.isSafeInteger(status.eventCount) ||
    status.eventCount < 1
  ) {
    fail(code);
  }
  return status;
}

function validateRemoteStatus(status) {
  if (
    !isPlainObject(status) ||
    status.ok !== true ||
    typeof status.phase !== 'string' ||
    typeof status.writesEnabled !== 'boolean' ||
    (!PRE_WRITE_PHASES.has(status.phase) && !POST_WRITE_PHASES.has(status.phase)) ||
    POST_WRITE_PHASES.has(status.phase) !== status.writesEnabled
  ) {
    fail('REMOTE_DATABASE_STATUS_INVALID');
  }
  return status;
}

function comparisonOrFail(dependencies, source, destination, code) {
  validateFlowpackIntegrityEvidence(source, code);
  validateFlowpackIntegrityEvidence(destination, code);
  let comparison;
  try {
    comparison = dependencies.compareIntegrityEvidence(
      JSON.parse(canonicalStringify(source)),
      JSON.parse(canonicalStringify(destination)),
    );
  } catch {
    fail(code);
  }
  if (
    !isPlainObject(comparison) ||
    comparison.ok !== true ||
    comparison.differenceCount !== 0
  ) {
    fail(code);
  }
  return comparison;
}

function validatePrepareResult(result) {
  if (
    !hasExactKeys(result, [
      'candidateNameAvailable',
      'capacityVerified',
      'existingBackupDumpDigest',
      'existingBackupEncrypted',
      'existingBackupFsyncCompleted',
      'existingBackupOffsiteReadback',
      'existingBackupReportDigest',
      'existingBackupSeparateDevice',
      'existingDatabase',
      'ok',
      'previousNameAvailable',
      'sentinelVerified',
    ]) ||
    result.ok !== true ||
    result.sentinelVerified !== true ||
    result.capacityVerified !== true ||
    result.candidateNameAvailable !== true ||
    result.previousNameAvailable !== true ||
    result.existingDatabase !== true ||
    result.existingBackupEncrypted !== true ||
    result.existingBackupOffsiteReadback !== true ||
    result.existingBackupSeparateDevice !== true ||
    result.existingBackupFsyncCompleted !== true ||
    !HASH_PATTERN.test(result.existingBackupDumpDigest ?? '') ||
    !HASH_PATTERN.test(result.existingBackupReportDigest ?? '')
  ) {
    fail('EXISTING_NAS_BACKUP_REQUIRED');
  }
  return result;
}

function validateFinalBinding(result, dependencies, frozenEvidence) {
  if (
    !hasExactKeys(result, [
      'dumpDigest',
      'dumpListDigest',
      'finalFsyncCompleted',
      'finalManifestDigest',
      'finalOffsiteReadback',
      'finalSeparateDevice',
      'ok',
      'prismaMigrationsExcluded',
      'remoteDumpStaged',
      'schemaAllowlist',
      'sourceEvidenceAfter',
      'sourceEvidenceBefore',
    ]) ||
    result.ok !== true ||
    result.finalOffsiteReadback !== true ||
    result.finalSeparateDevice !== true ||
    result.finalFsyncCompleted !== true ||
    result.remoteDumpStaged !== true ||
    result.prismaMigrationsExcluded !== true ||
    JSON.stringify(result.schemaAllowlist) !== JSON.stringify(SCHEMA_ALLOWLIST) ||
    !HASH_PATTERN.test(result.dumpDigest ?? '') ||
    !HASH_PATTERN.test(result.dumpListDigest ?? '') ||
    !HASH_PATTERN.test(result.finalManifestDigest ?? '')
  ) {
    fail('FINAL_DUMP_BINDING_FAILED');
  }
  comparisonOrFail(
    dependencies,
    frozenEvidence,
    result.sourceEvidenceBefore,
    'SOURCE_CHANGED_AFTER_FREEZE',
  );
  comparisonOrFail(
    dependencies,
    result.sourceEvidenceBefore,
    result.sourceEvidenceAfter,
    'SOURCE_CHANGED_DURING_FINAL_DUMP',
  );
  return result;
}

function validateCandidateRestore(result) {
  if (
    !hasExactKeys(result, [
      'ok',
      'ownerAclStripped',
      'prismaMigrationsAbsent',
      'schemaAllowlistVerified',
      'singleTransaction',
    ]) ||
    result.ok !== true ||
    result.ownerAclStripped !== true ||
    result.prismaMigrationsAbsent !== true ||
    result.schemaAllowlistVerified !== true ||
    result.singleTransaction !== true
  ) {
    fail('CANDIDATE_RESTORE_FAILED');
  }
}

export function validateMediaCandidatePreparation(result, context) {
  const expected = expectedMediaCandidateIdentity(context);
  if (
    !hasExactKeys(result, MEDIA_PREPARATION_KEYS) ||
    result.ok !== true ||
    result.evidenceSchemaVersion !== MEDIA_EVIDENCE_SCHEMA_VERSION ||
    result.candidateDatabaseNameSha256 !== expected.candidateDatabaseNameSha256 ||
    result.candidateIdentitySha256 !== expected.candidateIdentitySha256 ||
    result.remoteLockIdentitySha256 !== expected.remoteLockIdentitySha256 ||
    result.offsiteAuthenticatedReadback !== true ||
    result.offsiteSeparateDevice !== true ||
    result.offsiteFsyncCompleted !== true ||
    result.offsiteReadbackBundleSha256 !== result.bundleSha256 ||
    result.remoteCandidateVerified !== true ||
    !Number.isSafeInteger(result.gatewayObjectCount) ||
    result.gatewayObjectCount <= 0 ||
    typeof result.gatewayReused !== 'boolean' ||
    !REQUEST_ID_PATTERN.test(result.gatewayReceiveRequestId ?? '') ||
    !Number.isSafeInteger(result.candidateRewriteOperationsVerified) ||
    result.candidateRewriteOperationsVerified <= 0 ||
    [
      result.bundleSha256,
      result.artifactHandleSha256,
      result.candidateAttestationSha256,
      result.candidateDatabaseNameSha256,
      result.candidateIdentitySha256,
      result.candidateRewriteExecutionDigest,
      result.candidateRewriteReceiptSha256,
      result.candidateVerificationSha256,
      result.completionReceiptSha256,
      result.databaseBindingAttestationSha256,
      result.databaseEvidenceBundleSha256,
      result.databaseIdentitySha256,
      result.databaseSystemIdentitySha256,
      result.mediaEvidenceManifestSha256,
      result.offsiteEncryptedSha256,
      result.offsiteReadbackBundleSha256,
      result.remoteLockIdentitySha256,
      result.schemaScopeSha256,
      result.sourceFreezeReceiptSha256,
      result.sourceInventorySha256,
      result.sourceMediaRecordsSha256,
      result.sourceObjectsSha256,
      result.sourceSnapshotEvidenceSha256,
      result.sourceTransportProfileSha256,
      result.gatewayActionSetSha256,
      result.gatewayArtifactSha256,
      result.gatewayHelperSha256,
      result.gatewayPolicySha256,
      result.gatewayPreflightReceiptSha256,
      result.gatewayProtocolSha256,
      result.gatewayReceiveReceiptSha256,
      result.gatewayUploadCompletionReceiptSha256,
      result.gatewayUploadReceiptSha256,
      result.transferManifestSha256,
    ].some((value) => !HASH_PATTERN.test(value ?? ''))
  ) {
    fail('MEDIA_CANDIDATE_PREPARATION_INVALID');
  }
  const mediaGenerationDigest = digestCanonical({
    artifactHandleSha256: result.artifactHandleSha256,
    bundleSha256: result.bundleSha256,
    candidateAttestationSha256: result.candidateAttestationSha256,
    candidateIdentitySha256: result.candidateIdentitySha256,
    candidateRewriteExecutionDigest: result.candidateRewriteExecutionDigest,
    candidateRewriteReceiptSha256: result.candidateRewriteReceiptSha256,
    candidateVerificationSha256: result.candidateVerificationSha256,
    completionReceiptSha256: result.completionReceiptSha256,
    databaseBindingAttestationSha256: result.databaseBindingAttestationSha256,
    databaseEvidenceBundleSha256: result.databaseEvidenceBundleSha256,
    databaseIdentitySha256: result.databaseIdentitySha256,
    databaseSystemIdentitySha256: result.databaseSystemIdentitySha256,
    mediaEvidenceManifestSha256: result.mediaEvidenceManifestSha256,
    offsiteEncryptedSha256: result.offsiteEncryptedSha256,
    remoteLockIdentitySha256: result.remoteLockIdentitySha256,
    schemaScopeSha256: result.schemaScopeSha256,
    sourceFreezeReceiptSha256: result.sourceFreezeReceiptSha256,
    sourceInventorySha256: result.sourceInventorySha256,
    sourceMediaRecordsSha256: result.sourceMediaRecordsSha256,
    sourceObjectsSha256: result.sourceObjectsSha256,
    sourceSnapshotEvidenceSha256: result.sourceSnapshotEvidenceSha256,
    sourceTransportProfileSha256: result.sourceTransportProfileSha256,
    gatewayActionSetSha256: result.gatewayActionSetSha256,
    gatewayArtifactSha256: result.gatewayArtifactSha256,
    gatewayHelperSha256: result.gatewayHelperSha256,
    gatewayObjectCount: result.gatewayObjectCount,
    gatewayPolicySha256: result.gatewayPolicySha256,
    gatewayPreflightReceiptSha256: result.gatewayPreflightReceiptSha256,
    gatewayProtocolSha256: result.gatewayProtocolSha256,
    gatewayReceiveReceiptSha256: result.gatewayReceiveReceiptSha256,
    gatewayReceiveRequestId: result.gatewayReceiveRequestId,
    gatewayReused: result.gatewayReused,
    gatewayUploadCompletionReceiptSha256: result.gatewayUploadCompletionReceiptSha256,
    gatewayUploadReceiptSha256: result.gatewayUploadReceiptSha256,
    transferManifestSha256: result.transferManifestSha256,
  });
  return Object.freeze({ ...result, mediaGenerationDigest });
}

export function validateMediaCandidatePromotion(result, preparation) {
  if (
    !hasExactKeys(result, MEDIA_PROMOTION_KEYS) ||
    result.ok !== true ||
    result.promotionMode !== 'additive-content-addressed-before-database' ||
    result.canonicalObjectsVerified !== true ||
    result.mediaGenerationDigest !== preparation.mediaGenerationDigest ||
    result.remoteLockIdentitySha256 !== preparation.remoteLockIdentitySha256 ||
    result.candidateRewriteReceiptSha256 !== preparation.candidateRewriteReceiptSha256 ||
    !Number.isSafeInteger(result.gatewayObjectCount) ||
    result.gatewayObjectCount <= 0 ||
    typeof result.gatewayReused !== 'boolean' ||
    !REQUEST_ID_PATTERN.test(result.gatewayPromotionRequestId ?? '') ||
    !HASH_PATTERN.test(result.candidateRewriteReceiptSha256 ?? '') ||
    !HASH_PATTERN.test(result.canonicalVerificationSha256 ?? '') ||
    [
      result.gatewayActionSetSha256,
      result.gatewayHelperSha256,
      result.gatewayPolicySha256,
      result.gatewayPreflightReceiptSha256,
      result.gatewayPromotionArtifactSha256,
      result.gatewayPromotionReceiptSha256,
      result.gatewayProtocolSha256,
      result.promotionReceiptSha256,
    ].some((value) => !HASH_PATTERN.test(value ?? '')) ||
    result.gatewayPromotionArtifactSha256 !== result.promotionReceiptSha256 ||
    result.canonicalVerificationSha256 !== result.promotionReceiptSha256 ||
    result.gatewayActionSetSha256 !== preparation.gatewayActionSetSha256 ||
    result.gatewayHelperSha256 !== preparation.gatewayHelperSha256 ||
    result.gatewayPolicySha256 !== preparation.gatewayPolicySha256 ||
    result.gatewayProtocolSha256 !== preparation.gatewayProtocolSha256
  ) {
    fail('MEDIA_CANONICAL_PROMOTION_INVALID');
  }
  return result;
}

function validateMediaPreparationAgainstFrozenSource(preparation, finalReport) {
  validateFlowpackIntegrityEvidence(
    finalReport.sourceEvidence,
    'MEDIA_FROZEN_SOURCE_BINDING_INVALID',
  );
  const expectedInventorySha256 = mediaSha256(Buffer.from(
    `${canonicalMediaJson(finalReport.sourceEvidence)}\n`,
    'utf8',
  ));
  if (
    preparation.sourceFreezeReceiptSha256 !==
      finalReport.sourceFreezeReceiptDigest ||
    preparation.sourceInventorySha256 !== expectedInventorySha256
  ) {
    fail('MEDIA_FROZEN_SOURCE_BINDING_INVALID');
  }
  return preparation;
}

function validateBootstrap(result) {
  if (
    !hasExactKeys(result, [
      'analyzeCompleted',
      'ok',
      'ownerRole',
      'readOnlyRole',
      'readWriteRole',
      'roleBootstrapApplied',
      'schemaAllowlist',
    ]) ||
    result.ok !== true ||
    result.roleBootstrapApplied !== true ||
    result.analyzeCompleted !== true ||
    result.ownerRole !== 'flowpack_owner' ||
    result.readOnlyRole !== 'flowpack_app_ro' ||
    result.readWriteRole !== 'flowpack_app_rw' ||
    JSON.stringify(result.schemaAllowlist) !== JSON.stringify(SCHEMA_ALLOWLIST)
  ) {
    fail('DESTINATION_ROLE_BOOTSTRAP_FAILED');
  }
}

function validateReadOnlyStart(result) {
  if (
    !hasExactKeys(result, ['accessRole', 'ok', 'schedulerRunning', 'writeMode']) ||
    result.ok !== true ||
    result.accessRole !== 'app_ro' ||
    result.writeMode !== 'read-only' ||
    result.schedulerRunning !== 0
  ) {
    fail('DESTINATION_READ_ONLY_START_FAILED');
  }
}

function validateSmoke(result, dependencies, finalEvidence) {
  if (
    !hasExactKeys(result, [
      'accessRole',
      'afterEvidence',
      'beforeEvidence',
      'credentialAuthSmokePassed',
      'destinationWritesObserved',
      'healthHttpStatus',
      'ok',
      'schedulerRunning',
      'socialTokenDecryptSmokePassed',
      'tailscaleHttpsVerified',
      'unsafeHttpStatus',
      'writeMode',
      'writeProbeDenied',
    ]) ||
    result.ok !== true ||
    result.accessRole !== 'app_ro' ||
    result.writeMode !== 'read-only' ||
    result.unsafeHttpStatus !== 503 ||
    result.healthHttpStatus !== 200 ||
    result.tailscaleHttpsVerified !== true ||
    result.credentialAuthSmokePassed !== true ||
    result.socialTokenDecryptSmokePassed !== true ||
    result.schedulerRunning !== 0 ||
    result.destinationWritesObserved !== false ||
    result.writeProbeDenied !== true
  ) {
    fail('ZERO_WRITE_SMOKE_FAILED');
  }
  comparisonOrFail(
    dependencies,
    finalEvidence,
    result.beforeEvidence,
    'ZERO_WRITE_SMOKE_INTEGRITY_MISMATCH',
  );
  comparisonOrFail(
    dependencies,
    result.beforeEvidence,
    result.afterEvidence,
    'ZERO_WRITE_SMOKE_INTEGRITY_MISMATCH',
  );
  return result;
}

async function resolveDependencies(overrides, control) {
  const base = {
    advanceLedger,
    compareIntegrityEvidence,
    now: () => new Date(),
    readSeparateOffsiteProfile,
    recordFailure,
    recordRollback,
    statPath: statSync,
    verifyLedger,
  };
  let operations;
  if (overrides?.operations !== undefined) {
    operations = overrides.operations;
  } else {
    const { createSystemLiveCutoverOperations } = await import('./nas-live-cutover-system.mjs');
    operations = createSystemLiveCutoverOperations(control);
  }
  const dependencies = { ...base, ...(overrides ?? {}), operations };
  for (const key of [
    'advanceLedger',
    'compareIntegrityEvidence',
    'now',
    'readSeparateOffsiteProfile',
    'recordFailure',
    'recordRollback',
    'statPath',
    'verifyLedger',
  ]) {
    if (typeof dependencies[key] !== 'function') fail('LIVE_DEPENDENCIES_INVALID');
  }
  const operationMethods = [
    'acquireRemoteLock',
    'advanceRemotePhase',
    'bindFinalDump',
    'bootstrapRolesAndAnalyze',
    'collectDestinationEvidence',
    'collectFrozenSourceEvidence',
    'finishRemoteRollback',
    'prepareMediaCandidate',
    'prepareTarget',
    'promoteMediaCandidate',
    'renameCandidateToCanonical',
    'renameCanonicalToPrevious',
    'restoreCandidate',
    'rollbackPreWrite',
    'smokeReadOnly',
    'startDestinationReadOnly',
    'status',
    'stopDestinationClients',
  ];
  if (
    !isPlainObject(operations) ||
    operationMethods.some((method) => typeof operations[method] !== 'function')
  ) {
    fail('LIVE_OPERATIONS_INVALID');
  }
  return Object.freeze(dependencies);
}

function contextFor(control, confirmation) {
  const databaseNames = deriveLiveDatabaseNames(control.migrationId);
  const tokenDigest = digestCanonical({
    schemaVersion: 1,
    projectId: control.projectId,
    migrationId: control.migrationId,
    releaseCommit: control.releaseCommit,
  });
  return Object.freeze({ control, confirmation, databaseNames, tokenDigest });
}

async function prepareTarget(context, dependencies) {
  const ledger = validateLedgerStatus(
    await dependencies.verifyLedger({ journalPath: context.control.journalPath }),
    'RESTORE_DRILL_PASSED',
    'LIVE_LEDGER_STATE_INVALID',
  );
  let status = await dependencies.operations.status(context);
  if (
    !isPlainObject(status) ||
    status.ok !== true ||
    status.writesEnabled !== false ||
    !['UNLOCKED', 'LOCKED', 'TARGET_PREPARED'].includes(status.phase)
  ) {
    fail('DATABASE_MIGRATION_LOCK_HELD');
  }
  const name = 'prepare-target-report.json';
  let report;
  if (reportExists(context.control, name)) {
    const existing = validateReportIdentity(
      readReport(context.control, name, 'TARGET_PREPARATION_REPORT_INVALID'),
      context.control,
      'TARGET_PREPARATION_REPORT_INVALID',
    );
    if (
      existing.existingDatabase !== true ||
      existing.existingBackupEncrypted !== true ||
      existing.existingBackupOffsiteReadback !== true ||
      existing.existingBackupSeparateDevice !== true ||
      existing.existingBackupFsyncCompleted !== true ||
      !HASH_PATTERN.test(existing.existingBackupDumpDigest ?? '') ||
      !HASH_PATTERN.test(existing.existingBackupReportDigest ?? '')
    ) {
      fail('TARGET_PREPARATION_REPORT_INVALID');
    }
    report = { digest: digestReport(context.control, name, 'TARGET_PREPARATION_REPORT_INVALID') };
    if (status.phase === 'UNLOCKED') fail('LIVE_PHASE_MISMATCH');
  } else {
    if (status.phase === 'TARGET_PREPARED') fail('TARGET_PREPARATION_REPORT_INVALID');
    if (status.phase === 'UNLOCKED') {
      const acquired = await dependencies.operations.acquireRemoteLock(context);
      if (!isPlainObject(acquired) || acquired.ok !== true || acquired.phase !== 'LOCKED') {
        fail('REMOTE_DATABASE_LOCK_FAILED');
      }
      status = { ok: true, phase: 'LOCKED', writesEnabled: false };
    }
    dependencies.readSeparateOffsiteProfile(
      context.control.offsiteProfilePath,
      context.control.workspacePath,
      { statPath: dependencies.statPath },
    );
    const prepared = validatePrepareResult(
      await dependencies.operations.prepareTarget(context),
    );
    report = writePrivateReport(context.control, name, {
      schemaVersion: 1,
      projectId: PROJECT_ID,
      migrationId: context.control.migrationId,
      releaseCommit: context.control.releaseCommit,
      createdAt: nowFrom(dependencies),
      ledgerEventCount: ledger.eventCount,
      databaseNames: context.databaseNames,
      existingDatabase: true,
      existingBackupDumpDigest: prepared.existingBackupDumpDigest,
      existingBackupReportDigest: prepared.existingBackupReportDigest,
      existingBackupEncrypted: true,
      existingBackupOffsiteReadback: true,
      existingBackupSeparateDevice: true,
      existingBackupFsyncCompleted: true,
      capacityVerified: true,
    }, 'TARGET_PREPARATION_REPORT_FAILED');
  }
  if (status.phase === 'LOCKED') {
    const advanced = await dependencies.operations.advanceRemotePhase({
      ...context,
      expectedPhase: 'LOCKED',
      targetPhase: 'TARGET_PREPARED',
      evidenceDigest: report.digest,
    });
    if (
      !isPlainObject(advanced) ||
      advanced.ok !== true ||
      advanced.phase !== 'TARGET_PREPARED'
    ) {
      fail('REMOTE_DATABASE_PHASE_ADVANCE_FAILED');
    }
  }
  return Object.freeze({
    ok: true,
    status: 'TARGET_PREPARED',
    reportDigest: report.digest,
  });
}

async function freezeSource(context, dependencies) {
  const status = validateRemoteStatus(await dependencies.operations.status(context));
  if (!['TARGET_PREPARED', 'SOURCE_FROZEN'].includes(status.phase)) {
    fail('LIVE_PHASE_MISMATCH');
  }
  const ledger = await dependencies.verifyLedger({ journalPath: context.control.journalPath });
  if (
    !isPlainObject(ledger) ||
    ledger.ok !== true ||
    ledger.rolledBack !== false ||
    !['RESTORE_DRILL_PASSED', 'SOURCE_FROZEN'].includes(ledger.currentState)
  ) {
    fail('LIVE_LEDGER_STATE_INVALID');
  }
  const receipt = readCanonicalPrivateJson(
    context.control.sourceFreezeReceiptPath,
    'SOURCE_FREEZE_RECEIPT_INVALID',
  );
  const receiptDigest = validateSourceFreezeReceipt(receipt, context.control);
  const providerManifest = readRetainedProviderManifest(
    context.control.providerManifestPath,
    {
      migrationId: context.control.migrationId,
      releaseCommit: context.control.releaseCommit,
    },
  );
  const name = 'source-freeze-report.json';
  let report;
  if (reportExists(context.control, name)) {
    const existing = validateReportIdentity(
      readReport(context.control, name, 'SOURCE_FREEZE_REPORT_INVALID'),
      context.control,
      'SOURCE_FREEZE_REPORT_INVALID',
    );
    validateFlowpackIntegrityEvidence(existing.sourceEvidence, 'SOURCE_FREEZE_REPORT_INVALID');
    if (
      existing.sourceFreezeReceiptDigest !== receiptDigest ||
      existing.providerManifestSha256 !== providerManifest.sha256 ||
      existing.sourceEvidenceDigest !== digestCanonical(existing.sourceEvidence) ||
      existing.prismaMigrationsExcluded !== true ||
      JSON.stringify(existing.schemaAllowlist) !== JSON.stringify(SCHEMA_ALLOWLIST)
    ) {
      fail('SOURCE_FREEZE_REPORT_INVALID');
    }
    report = { digest: digestReport(context.control, name, 'SOURCE_FREEZE_REPORT_INVALID') };
  } else {
    if (status.phase === 'SOURCE_FROZEN') fail('SOURCE_FREEZE_REPORT_INVALID');
    const sourceEvidence = validateFlowpackIntegrityEvidence(
      await dependencies.operations.collectFrozenSourceEvidence(context),
      'SOURCE_FROZEN_EVIDENCE_INVALID',
    );
    report = writePrivateReport(context.control, name, {
      schemaVersion: 1,
      projectId: PROJECT_ID,
      migrationId: context.control.migrationId,
      releaseCommit: context.control.releaseCommit,
      createdAt: nowFrom(dependencies),
      sourceFreezeReceiptDigest: receiptDigest,
      providerManifestSha256: providerManifest.sha256,
      sourceEvidence,
      sourceEvidenceDigest: digestCanonical(sourceEvidence),
      schemaAllowlist: SCHEMA_ALLOWLIST,
      prismaMigrationsExcluded: true,
    }, 'SOURCE_FREEZE_REPORT_FAILED');
  }
  if (status.phase === 'TARGET_PREPARED') {
    const advanced = await dependencies.operations.advanceRemotePhase({
      ...context,
      expectedPhase: 'TARGET_PREPARED',
      targetPhase: 'SOURCE_FROZEN',
      evidenceDigest: report.digest,
    });
    if (!isPlainObject(advanced) || advanced.ok !== true || advanced.phase !== 'SOURCE_FROZEN') {
      fail('REMOTE_DATABASE_PHASE_ADVANCE_FAILED');
    }
  }
  if (ledger.currentState === 'RESTORE_DRILL_PASSED') {
    validateLedgerStatus(await dependencies.advanceLedger({
      journalPath: context.control.journalPath,
      targetState: 'SOURCE_FROZEN',
      evidence: {
        inFlightWritesDrained: true,
        sourceCallbacksDisabled: true,
        sourceFreezeReceiptDigest: receiptDigest,
        sourceSchedulerDisabled: true,
        sourceWritesDisabled: true,
      },
      now: nowFrom(dependencies),
    }), 'SOURCE_FROZEN', 'LIVE_LEDGER_ADVANCE_FAILED');
  }
  return Object.freeze({
    ok: true,
    status: 'SOURCE_FROZEN',
    reportDigest: report.digest,
    receiptDigest,
  });
}

async function bindFinal(context, dependencies) {
  const status = validateRemoteStatus(await dependencies.operations.status(context));
  if (!['SOURCE_FROZEN', 'FINAL_BOUND'].includes(status.phase)) fail('LIVE_PHASE_MISMATCH');
  validateLedgerStatus(
    await dependencies.verifyLedger({ journalPath: context.control.journalPath }),
    'SOURCE_FROZEN',
    'LIVE_LEDGER_STATE_INVALID',
  );
  const freezeReport = readReport(
    context.control,
    'source-freeze-report.json',
    'SOURCE_FREEZE_REPORT_INVALID',
  );
  const providerManifest = readRetainedProviderManifest(
    context.control.providerManifestPath,
    {
      migrationId: context.control.migrationId,
      releaseCommit: context.control.releaseCommit,
    },
  );
  if (freezeReport.providerManifestSha256 !== providerManifest.sha256) {
    fail('RETAINED_PROVIDER_MANIFEST_CHANGED_AFTER_FREEZE');
  }
  const name = 'final-dump-report.json';
  let report;
  let dumpDigest;
  if (reportExists(context.control, name)) {
    const existing = validateReportIdentity(
      readReport(context.control, name, 'FINAL_DUMP_REPORT_INVALID'),
      context.control,
      'FINAL_DUMP_REPORT_INVALID',
    );
    validateFlowpackIntegrityEvidence(existing.sourceEvidence, 'FINAL_DUMP_REPORT_INVALID');
    if (
      existing.sourceFreezeReceiptDigest !== freezeReport.sourceFreezeReceiptDigest ||
      existing.providerManifestSha256 !== providerManifest.sha256 ||
      existing.sourceEvidenceDigest !== digestCanonical(existing.sourceEvidence) ||
      existing.finalOffsiteReadback !== true ||
      existing.finalSeparateDevice !== true ||
      existing.finalFsyncCompleted !== true ||
      existing.remoteDumpStaged !== true ||
      existing.prismaMigrationsExcluded !== true ||
      JSON.stringify(existing.schemaAllowlist) !== JSON.stringify(SCHEMA_ALLOWLIST) ||
      !HASH_PATTERN.test(existing.dumpDigest ?? '') ||
      !HASH_PATTERN.test(existing.dumpListDigest ?? '') ||
      !HASH_PATTERN.test(existing.finalManifestDigest ?? '')
    ) {
      fail('FINAL_DUMP_REPORT_INVALID');
    }
    report = { digest: digestReport(context.control, name, 'FINAL_DUMP_REPORT_INVALID') };
    dumpDigest = existing.dumpDigest;
  } else {
    if (status.phase === 'FINAL_BOUND') fail('FINAL_DUMP_REPORT_INVALID');
    dependencies.readSeparateOffsiteProfile(
      context.control.offsiteProfilePath,
      context.control.workspacePath,
      { statPath: dependencies.statPath },
    );
    const binding = validateFinalBinding(
      await dependencies.operations.bindFinalDump({ ...context, freezeReport }),
      dependencies,
      freezeReport.sourceEvidence,
    );
    report = writePrivateReport(context.control, name, {
      schemaVersion: 1,
      projectId: PROJECT_ID,
      migrationId: context.control.migrationId,
      releaseCommit: context.control.releaseCommit,
      createdAt: nowFrom(dependencies),
      sourceFreezeReceiptDigest: freezeReport.sourceFreezeReceiptDigest,
      providerManifestSha256: providerManifest.sha256,
      sourceEvidence: binding.sourceEvidenceAfter,
      sourceEvidenceDigest: digestCanonical(binding.sourceEvidenceAfter),
      dumpDigest: binding.dumpDigest,
      dumpListDigest: binding.dumpListDigest,
      finalManifestDigest: binding.finalManifestDigest,
      finalOffsiteReadback: true,
      finalSeparateDevice: true,
      finalFsyncCompleted: true,
      remoteDumpStaged: true,
      schemaAllowlist: SCHEMA_ALLOWLIST,
      prismaMigrationsExcluded: true,
    }, 'FINAL_DUMP_REPORT_FAILED');
    dumpDigest = binding.dumpDigest;
  }
  if (status.phase === 'SOURCE_FROZEN') {
    const advanced = await dependencies.operations.advanceRemotePhase({
      ...context,
      expectedPhase: 'SOURCE_FROZEN',
      targetPhase: 'FINAL_BOUND',
      evidenceDigest: report.digest,
    });
    if (!isPlainObject(advanced) || advanced.ok !== true || advanced.phase !== 'FINAL_BOUND') {
      fail('REMOTE_DATABASE_PHASE_ADVANCE_FAILED');
    }
  }
  return Object.freeze({
    ok: true,
    status: 'FINAL_BOUND',
    reportDigest: report.digest,
    dumpDigest,
  });
}

function mediaPreparationFromReport(report, context, finalReport) {
  validateReportIdentity(report, context.control, 'MEDIA_PREPARATION_REPORT_INVALID');
  if (
    !hasExactKeys(report, [
      'createdAt',
      'finalDumpDigest',
      'mediaGenerationDigest',
      'migrationId',
      'preparation',
      'projectId',
      'releaseCommit',
      'schemaVersion',
    ]) ||
    report.finalDumpDigest !== finalReport.dumpDigest ||
    !HASH_PATTERN.test(report.mediaGenerationDigest ?? '')
  ) {
    fail('MEDIA_PREPARATION_REPORT_INVALID');
  }
  validateTimestamp(report.createdAt, 'MEDIA_PREPARATION_REPORT_INVALID');
  const preparation = validateMediaPreparationAgainstFrozenSource(
    validateMediaCandidatePreparation(report.preparation, context),
    finalReport,
  );
  if (preparation.mediaGenerationDigest !== report.mediaGenerationDigest) {
    fail('MEDIA_PREPARATION_REPORT_INVALID');
  }
  return preparation;
}

async function ensureMediaPreparation(context, dependencies, finalReport, allowCreate) {
  const name = 'candidate-media-preparation-report.json';
  if (reportExists(context.control, name)) {
    const preparation = mediaPreparationFromReport(
      readReport(context.control, name, 'MEDIA_PREPARATION_REPORT_INVALID'),
      context,
      finalReport,
    );
    return Object.freeze({
      digest: digestReport(context.control, name, 'MEDIA_PREPARATION_REPORT_INVALID'),
      preparation,
    });
  }
  if (!allowCreate) fail('MEDIA_PREPARATION_REPORT_REQUIRED');
  const preparation = validateMediaPreparationAgainstFrozenSource(
    validateMediaCandidatePreparation(
      await dependencies.operations.prepareMediaCandidate({ ...context, finalReport }),
      context,
    ),
    finalReport,
  );
  const report = writePrivateReport(context.control, name, {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    migrationId: context.control.migrationId,
    releaseCommit: context.control.releaseCommit,
    createdAt: nowFrom(dependencies),
    finalDumpDigest: finalReport.dumpDigest,
    mediaGenerationDigest: preparation.mediaGenerationDigest,
    preparation: Object.fromEntries(
      MEDIA_PREPARATION_KEYS.map((key) => [key, preparation[key]]),
    ),
  }, 'MEDIA_PREPARATION_REPORT_FAILED');
  return Object.freeze({ digest: report.digest, preparation });
}

function mediaPromotionFromReport(report, context, preparationBinding) {
  validateReportIdentity(report, context.control, 'MEDIA_PROMOTION_REPORT_INVALID');
  if (
    !hasExactKeys(report, [
      'createdAt',
      'mediaGenerationDigest',
      'migrationId',
      'preparationReportDigest',
      'projectId',
      'promotion',
      'releaseCommit',
      'schemaVersion',
    ]) ||
    report.preparationReportDigest !== preparationBinding.digest ||
    report.mediaGenerationDigest !== preparationBinding.preparation.mediaGenerationDigest
  ) {
    fail('MEDIA_PROMOTION_REPORT_INVALID');
  }
  validateTimestamp(report.createdAt, 'MEDIA_PROMOTION_REPORT_INVALID');
  return validateMediaCandidatePromotion(
    report.promotion,
    preparationBinding.preparation,
  );
}

async function ensureMediaPromotion(
  context,
  dependencies,
  preparationBinding,
  allowCreate,
) {
  const name = 'candidate-media-promotion-report.json';
  if (reportExists(context.control, name)) {
    const promotion = mediaPromotionFromReport(
      readReport(context.control, name, 'MEDIA_PROMOTION_REPORT_INVALID'),
      context,
      preparationBinding,
    );
    return Object.freeze({
      digest: digestReport(context.control, name, 'MEDIA_PROMOTION_REPORT_INVALID'),
      promotion,
    });
  }
  if (!allowCreate) fail('MEDIA_PROMOTION_REPORT_REQUIRED');
  const promotion = validateMediaCandidatePromotion(
    await dependencies.operations.promoteMediaCandidate({
      ...context,
      preparation: preparationBinding.preparation,
      preparationReportDigest: preparationBinding.digest,
    }),
    preparationBinding.preparation,
  );
  const report = writePrivateReport(context.control, name, {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    migrationId: context.control.migrationId,
    releaseCommit: context.control.releaseCommit,
    createdAt: nowFrom(dependencies),
    mediaGenerationDigest: preparationBinding.preparation.mediaGenerationDigest,
    preparationReportDigest: preparationBinding.digest,
    promotion,
  }, 'MEDIA_PROMOTION_REPORT_FAILED');
  return Object.freeze({ digest: report.digest, promotion });
}

async function restoreDestination(context, dependencies) {
  let status = validateRemoteStatus(await dependencies.operations.status(context));
  const allowed = new Set([
    'FINAL_BOUND',
    'CANDIDATE_RESTORED',
    'LIVE_RENAMED',
    'CANDIDATE_PROMOTED',
    'DESTINATION_READ_ONLY',
  ]);
  if (!allowed.has(status.phase)) fail('LIVE_PHASE_MISMATCH');
  const ledger = await dependencies.verifyLedger({ journalPath: context.control.journalPath });
  if (
    !isPlainObject(ledger) ||
    ledger.ok !== true ||
    ledger.rolledBack !== false ||
    !['SOURCE_FROZEN', 'DESTINATION_RESTORED'].includes(ledger.currentState)
  ) {
    fail('LIVE_LEDGER_STATE_INVALID');
  }
  const finalReport = readReport(
    context.control,
    'final-dump-report.json',
    'FINAL_DUMP_REPORT_INVALID',
  );
  validateFlowpackIntegrityEvidence(finalReport.sourceEvidence, 'FINAL_DUMP_REPORT_INVALID');
  if (
    JSON.stringify(finalReport.schemaAllowlist) !== JSON.stringify(SCHEMA_ALLOWLIST) ||
    finalReport.prismaMigrationsExcluded !== true
  ) {
    fail('FINAL_DUMP_REPORT_INVALID');
  }
  const restoreCommand = buildCandidateRestoreCommand({
    candidateDatabase: context.databaseNames.candidateDatabase,
    dumpPath: `/backups/${context.control.migrationId}-final.dump`,
  });

  if (status.phase === 'FINAL_BOUND') {
    validateCandidateRestore(await dependencies.operations.restoreCandidate({
      ...context,
      restoreCommand,
      finalReport,
    }));
    const candidateEvidence = await dependencies.operations.collectDestinationEvidence({
      ...context,
      database: context.databaseNames.candidateDatabase,
    });
    const comparison = comparisonOrFail(
      dependencies,
      finalReport.sourceEvidence,
      candidateEvidence,
      'DESTINATION_INTEGRITY_MISMATCH',
    );
    const evidenceDigest = digestCanonical({ candidateEvidence, comparison });
    const advanced = await dependencies.operations.advanceRemotePhase({
      ...context,
      expectedPhase: 'FINAL_BOUND',
      targetPhase: 'CANDIDATE_RESTORED',
      evidenceDigest,
    });
    if (!isPlainObject(advanced) || advanced.ok !== true || advanced.phase !== 'CANDIDATE_RESTORED') {
      fail('REMOTE_DATABASE_PHASE_ADVANCE_FAILED');
    }
    status = { ok: true, phase: 'CANDIDATE_RESTORED', writesEnabled: false };
  }

  const mediaPreparationBinding = await ensureMediaPreparation(
    context,
    dependencies,
    finalReport,
    status.phase === 'CANDIDATE_RESTORED',
  );
  const mediaPromotionBinding = await ensureMediaPromotion(
    context,
    dependencies,
    mediaPreparationBinding,
    status.phase === 'CANDIDATE_RESTORED',
  );
  const promotionBindingDigest = digestCanonical({
    finalDumpDigest: finalReport.dumpDigest,
    mediaGenerationDigest: mediaPreparationBinding.preparation.mediaGenerationDigest,
    mediaPreparationReportDigest: mediaPreparationBinding.digest,
    mediaPromotionReportDigest: mediaPromotionBinding.digest,
    promotionReceiptSha256: mediaPromotionBinding.promotion.promotionReceiptSha256,
    remoteLockIdentitySha256:
      mediaPreparationBinding.preparation.remoteLockIdentitySha256,
  });

  if (status.phase === 'CANDIDATE_RESTORED') {
    const phaseContext = { ...context, finalReport };
    const stopped = await dependencies.operations.stopDestinationClients(phaseContext);
    if (!isPlainObject(stopped) || stopped.ok !== true) fail('DESTINATION_CLIENT_DRAIN_FAILED');
    const renamed = await dependencies.operations.renameCanonicalToPrevious(phaseContext);
    if (!isPlainObject(renamed) || renamed.ok !== true) fail('CANONICAL_RENAME_FAILED');
    const advanced = await dependencies.operations.advanceRemotePhase({
      ...context,
      expectedPhase: 'CANDIDATE_RESTORED',
      targetPhase: 'LIVE_RENAMED',
      evidenceDigest: promotionBindingDigest,
    });
    if (!isPlainObject(advanced) || advanced.ok !== true || advanced.phase !== 'LIVE_RENAMED') {
      fail('REMOTE_DATABASE_PHASE_ADVANCE_FAILED');
    }
    status = { ok: true, phase: 'LIVE_RENAMED', writesEnabled: false };
  }

  if (status.phase === 'LIVE_RENAMED') {
    const promoted = await dependencies.operations.renameCandidateToCanonical({ ...context, finalReport });
    if (!isPlainObject(promoted) || promoted.ok !== true) fail('CANDIDATE_PROMOTION_FAILED');
    const advanced = await dependencies.operations.advanceRemotePhase({
      ...context,
      expectedPhase: 'LIVE_RENAMED',
      targetPhase: 'CANDIDATE_PROMOTED',
      evidenceDigest: promotionBindingDigest,
    });
    if (!isPlainObject(advanced) || advanced.ok !== true || advanced.phase !== 'CANDIDATE_PROMOTED') {
      fail('REMOTE_DATABASE_PHASE_ADVANCE_FAILED');
    }
    status = { ok: true, phase: 'CANDIDATE_PROMOTED', writesEnabled: false };
  }

  if (status.phase === 'CANDIDATE_PROMOTED') {
    const name = 'destination-restore-report.json';
    let report;
    if (reportExists(context.control, name)) {
      const existing = validateReportIdentity(
        readReport(context.control, name, 'DESTINATION_RESTORE_REPORT_INVALID'),
        context.control,
        'DESTINATION_RESTORE_REPORT_INVALID',
      );
      validateFlowpackIntegrityEvidence(
        existing.canonicalEvidence,
        'DESTINATION_RESTORE_REPORT_INVALID',
      );
      comparisonOrFail(
        dependencies,
        finalReport.sourceEvidence,
        existing.canonicalEvidence,
        'DESTINATION_RESTORE_REPORT_INVALID',
      );
      if (
        existing.finalDumpDigest !== finalReport.dumpDigest ||
        existing.mediaGenerationDigest !==
          mediaPreparationBinding.preparation.mediaGenerationDigest ||
        existing.mediaPreparationReportDigest !== mediaPreparationBinding.digest ||
        existing.mediaPromotionReportDigest !== mediaPromotionBinding.digest ||
        existing.promotionBindingDigest !== promotionBindingDigest ||
        existing.gatewayMediaUploadReceiptSha256 !==
          mediaPreparationBinding.preparation.gatewayUploadReceiptSha256 ||
        existing.gatewayMediaReceiveReceiptSha256 !==
          mediaPreparationBinding.preparation.gatewayReceiveReceiptSha256 ||
        existing.gatewayMediaReceivePreflightReceiptSha256 !==
          mediaPreparationBinding.preparation.gatewayPreflightReceiptSha256 ||
        existing.gatewayMediaPromotionReceiptSha256 !==
          mediaPromotionBinding.promotion.gatewayPromotionReceiptSha256 ||
        existing.gatewayMediaPromotionPreflightReceiptSha256 !==
          mediaPromotionBinding.promotion.gatewayPreflightReceiptSha256 ||
        existing.destinationReadOnly !== true ||
        existing.schedulerRunning !== 0 ||
        existing.prismaMigrationsAbsent !== true
      ) {
        fail('DESTINATION_RESTORE_REPORT_INVALID');
      }
      report = {
        digest: digestReport(context.control, name, 'DESTINATION_RESTORE_REPORT_INVALID'),
      };
    } else {
      validateBootstrap(await dependencies.operations.bootstrapRolesAndAnalyze({ ...context, finalReport }));
      validateReadOnlyStart(await dependencies.operations.startDestinationReadOnly({ ...context, finalReport }));
      const canonicalEvidence = await dependencies.operations.collectDestinationEvidence({
        ...context,
        database: context.databaseNames.canonicalDatabase,
      });
      const comparison = comparisonOrFail(
        dependencies,
        finalReport.sourceEvidence,
        canonicalEvidence,
        'DESTINATION_INTEGRITY_MISMATCH',
      );
      report = writePrivateReport(
        context.control,
        name,
        {
        schemaVersion: 1,
        projectId: PROJECT_ID,
        migrationId: context.control.migrationId,
        releaseCommit: context.control.releaseCommit,
        createdAt: nowFrom(dependencies),
        finalDumpDigest: finalReport.dumpDigest,
        finalManifestDigest: finalReport.finalManifestDigest,
        sourceFreezeReceiptDigest: finalReport.sourceFreezeReceiptDigest,
        mediaGenerationDigest:
          mediaPreparationBinding.preparation.mediaGenerationDigest,
        mediaPreparationReportDigest: mediaPreparationBinding.digest,
        mediaPromotionReportDigest: mediaPromotionBinding.digest,
        promotionBindingDigest,
        remoteMediaCompletionReceiptSha256:
          mediaPreparationBinding.preparation.completionReceiptSha256,
        remoteMediaCandidateVerificationSha256:
          mediaPreparationBinding.preparation.candidateVerificationSha256,
        candidateMediaRewriteExecutionDigest:
          mediaPreparationBinding.preparation.candidateRewriteExecutionDigest,
        candidateMediaPromotionReceiptSha256:
          mediaPromotionBinding.promotion.promotionReceiptSha256,
        gatewayMediaUploadReceiptSha256:
          mediaPreparationBinding.preparation.gatewayUploadReceiptSha256,
        gatewayMediaReceiveReceiptSha256:
          mediaPreparationBinding.preparation.gatewayReceiveReceiptSha256,
        gatewayMediaReceivePreflightReceiptSha256:
          mediaPreparationBinding.preparation.gatewayPreflightReceiptSha256,
        gatewayMediaPromotionReceiptSha256:
          mediaPromotionBinding.promotion.gatewayPromotionReceiptSha256,
        gatewayMediaPromotionPreflightReceiptSha256:
          mediaPromotionBinding.promotion.gatewayPreflightReceiptSha256,
        canonicalEvidence,
        canonicalEvidenceDigest: digestCanonical(canonicalEvidence),
        comparison,
        ownerRole: 'flowpack_owner',
        readOnlyRole: 'flowpack_app_ro',
        readWriteRole: 'flowpack_app_rw',
        roleBootstrapApplied: true,
        analyzeCompleted: true,
        destinationReadOnly: true,
        schedulerRunning: 0,
        schemaAllowlist: SCHEMA_ALLOWLIST,
        prismaMigrationsAbsent: true,
        },
        'DESTINATION_RESTORE_REPORT_FAILED',
      );
    }
    const advanced = await dependencies.operations.advanceRemotePhase({
      ...context,
      expectedPhase: 'CANDIDATE_PROMOTED',
      targetPhase: 'DESTINATION_READ_ONLY',
      evidenceDigest: report.digest,
    });
    if (!isPlainObject(advanced) || advanced.ok !== true || advanced.phase !== 'DESTINATION_READ_ONLY') {
      fail('REMOTE_DATABASE_PHASE_ADVANCE_FAILED');
    }
    status = { ok: true, phase: 'DESTINATION_READ_ONLY', writesEnabled: false };
  }

  if (status.phase === 'DESTINATION_READ_ONLY') {
    const reportPath = join(
      context.control.workspacePath,
      'live-cutover',
      'destination-restore-report.json',
    );
    const restoreReport = readReport(
      context.control,
      'destination-restore-report.json',
      'DESTINATION_RESTORE_REPORT_INVALID',
    );
    const reportDigest = createHash('sha256').update(readFileSync(reportPath)).digest('hex');
    if (ledger.currentState === 'SOURCE_FROZEN') {
      validateLedgerStatus(
        await dependencies.advanceLedger({
          journalPath: context.control.journalPath,
          targetState: 'DESTINATION_RESTORED',
          evidence: {
            destinationReadOnly: true,
            destinationRestoreReportDigest: reportDigest,
            finalDumpDigest: restoreReport.finalDumpDigest,
          },
          now: nowFrom(dependencies),
        }),
        'DESTINATION_RESTORED',
        'LIVE_LEDGER_ADVANCE_FAILED',
      );
    }
    return Object.freeze({
      ok: true,
      status: 'DESTINATION_READ_ONLY',
      reportDigest,
    });
  }
  fail('LIVE_PHASE_MISMATCH');
}

async function smokeReadOnly(context, dependencies) {
  const status = validateRemoteStatus(await dependencies.operations.status(context));
  if (!['DESTINATION_READ_ONLY', 'ZERO_WRITE_SMOKE_PASSED'].includes(status.phase)) {
    fail('LIVE_PHASE_MISMATCH');
  }
  const ledger = await dependencies.verifyLedger({ journalPath: context.control.journalPath });
  if (
    !isPlainObject(ledger) ||
    ledger.ok !== true ||
    ledger.rolledBack !== false ||
    !['DESTINATION_RESTORED', 'ZERO_WRITE_SMOKE_PASSED'].includes(ledger.currentState)
  ) {
    fail('LIVE_LEDGER_STATE_INVALID');
  }
  const restoreReport = readReport(
    context.control,
    'destination-restore-report.json',
    'DESTINATION_RESTORE_REPORT_INVALID',
  );
  validateReportIdentity(
    restoreReport,
    context.control,
    'DESTINATION_RESTORE_REPORT_INVALID',
  );
  const finalReport = readReport(
    context.control,
    'final-dump-report.json',
    'FINAL_DUMP_REPORT_INVALID',
  );
  const mediaPreparationBinding = await ensureMediaPreparation(
    context,
    dependencies,
    finalReport,
    false,
  );
  const mediaPromotionBinding = await ensureMediaPromotion(
    context,
    dependencies,
    mediaPreparationBinding,
    false,
  );
  if (
    restoreReport.mediaGenerationDigest !==
      mediaPreparationBinding.preparation.mediaGenerationDigest ||
    restoreReport.mediaPreparationReportDigest !== mediaPreparationBinding.digest ||
    restoreReport.mediaPromotionReportDigest !== mediaPromotionBinding.digest ||
    restoreReport.remoteMediaCompletionReceiptSha256 !==
      mediaPreparationBinding.preparation.completionReceiptSha256 ||
    restoreReport.remoteMediaCandidateVerificationSha256 !==
      mediaPreparationBinding.preparation.candidateVerificationSha256 ||
    restoreReport.candidateMediaRewriteExecutionDigest !==
      mediaPreparationBinding.preparation.candidateRewriteExecutionDigest ||
    restoreReport.candidateMediaPromotionReceiptSha256 !==
      mediaPromotionBinding.promotion.promotionReceiptSha256 ||
    restoreReport.gatewayMediaUploadReceiptSha256 !==
      mediaPreparationBinding.preparation.gatewayUploadReceiptSha256 ||
    restoreReport.gatewayMediaReceiveReceiptSha256 !==
      mediaPreparationBinding.preparation.gatewayReceiveReceiptSha256 ||
    restoreReport.gatewayMediaReceivePreflightReceiptSha256 !==
      mediaPreparationBinding.preparation.gatewayPreflightReceiptSha256 ||
    restoreReport.gatewayMediaPromotionReceiptSha256 !==
      mediaPromotionBinding.promotion.gatewayPromotionReceiptSha256 ||
    restoreReport.gatewayMediaPromotionPreflightReceiptSha256 !==
      mediaPromotionBinding.promotion.gatewayPreflightReceiptSha256
  ) {
    fail('DESTINATION_RESTORE_REPORT_INVALID');
  }
  const name = 'zero-write-smoke-report.json';
  let report;
  if (reportExists(context.control, name)) {
    const existing = validateReportIdentity(
      readReport(context.control, name, 'ZERO_WRITE_SMOKE_REPORT_INVALID'),
      context.control,
      'ZERO_WRITE_SMOKE_REPORT_INVALID',
    );
    if (
      existing.accessRole !== 'app_ro' ||
      existing.writeMode !== 'read-only' ||
      existing.writeProbeDenied !== true ||
      existing.credentialAuthSmokePassed !== true ||
      existing.socialTokenDecryptSmokePassed !== true ||
      existing.destinationWritesObserved !== false ||
      existing.schedulerRunning !== 0 ||
      existing.tailscaleHttpsVerified !== true ||
      !HASH_PATTERN.test(existing.beforeEvidenceDigest ?? '') ||
      !HASH_PATTERN.test(existing.afterEvidenceDigest ?? '')
    ) {
      fail('ZERO_WRITE_SMOKE_REPORT_INVALID');
    }
    report = { digest: digestReport(context.control, name, 'ZERO_WRITE_SMOKE_REPORT_INVALID') };
  } else {
    if (status.phase === 'ZERO_WRITE_SMOKE_PASSED') fail('ZERO_WRITE_SMOKE_REPORT_INVALID');
    const smoke = validateSmoke(
      await dependencies.operations.smokeReadOnly(context),
      dependencies,
      restoreReport.canonicalEvidence,
    );
    report = writePrivateReport(context.control, name, {
      schemaVersion: 1,
      projectId: PROJECT_ID,
      migrationId: context.control.migrationId,
      releaseCommit: context.control.releaseCommit,
      createdAt: nowFrom(dependencies),
      destinationRestoreReportDigest: createHash('sha256')
        .update(readFileSync(join(
          context.control.workspacePath,
          'live-cutover',
          'destination-restore-report.json',
        )))
        .digest('hex'),
      beforeEvidenceDigest: digestCanonical(smoke.beforeEvidence),
      afterEvidenceDigest: digestCanonical(smoke.afterEvidence),
      accessRole: 'app_ro',
      writeMode: 'read-only',
      writeProbeDenied: true,
      credentialAuthSmokePassed: true,
      socialTokenDecryptSmokePassed: true,
      destinationWritesObserved: false,
      schedulerRunning: 0,
      tailscaleHttpsVerified: true,
    }, 'ZERO_WRITE_SMOKE_REPORT_FAILED');
  }
  if (status.phase === 'DESTINATION_READ_ONLY') {
    const advanced = await dependencies.operations.advanceRemotePhase({
      ...context,
      expectedPhase: 'DESTINATION_READ_ONLY',
      targetPhase: 'ZERO_WRITE_SMOKE_PASSED',
      evidenceDigest: report.digest,
    });
    if (!isPlainObject(advanced) || advanced.ok !== true || advanced.phase !== 'ZERO_WRITE_SMOKE_PASSED') {
      fail('REMOTE_DATABASE_PHASE_ADVANCE_FAILED');
    }
  }
  if (ledger.currentState === 'DESTINATION_RESTORED') {
    validateLedgerStatus(await dependencies.advanceLedger({
      journalPath: context.control.journalPath,
      targetState: 'ZERO_WRITE_SMOKE_PASSED',
      evidence: {
        destinationWritesObserved: false,
        tailscaleHttpsVerified: true,
        zeroWriteSmokeReportDigest: report.digest,
      },
      now: nowFrom(dependencies),
    }), 'ZERO_WRITE_SMOKE_PASSED', 'LIVE_LEDGER_ADVANCE_FAILED');
  }
  return Object.freeze({
    ok: true,
    status: 'ZERO_WRITE_SMOKE_PASSED',
    reportDigest: report.digest,
  });
}

async function rollbackPreWrite(context, dependencies) {
  const status = validateRemoteStatus(await dependencies.operations.status(context));
  if (POST_WRITE_PHASES.has(status.phase) || status.writesEnabled) {
    fail('RECONCILIATION_REQUIRED');
  }
  if (!PRE_WRITE_PHASES.has(status.phase)) fail('LIVE_PHASE_MISMATCH');
  const ledger = await dependencies.verifyLedger({ journalPath: context.control.journalPath });
  if (
    !isPlainObject(ledger) ||
    ledger.ok !== true ||
    ledger.rolledBack !== false ||
    !Number.isSafeInteger(ledger.eventCount)
  ) {
    fail('LIVE_LEDGER_STATE_INVALID');
  }
  const sourceWasFrozen = !['LOCKED', 'TARGET_PREPARED'].includes(status.phase) || [
    'SOURCE_FROZEN',
    'DESTINATION_RESTORED',
    'ZERO_WRITE_SMOKE_PASSED',
  ].includes(ledger.currentState);
  let sourceRecoveryReceiptDigest = null;
  if (sourceWasFrozen) {
    const receipt = readCanonicalPrivateJson(
      context.control.sourceRecoveryReceiptPath,
      'SOURCE_RECOVERY_RECEIPT_INVALID',
    );
    sourceRecoveryReceiptDigest = validateSourceRecoveryReceipt(receipt, context.control);
  }
  const rollback = await dependencies.operations.rollbackPreWrite({
    ...context,
    phase: status.phase,
    sourceRecoveryReceiptDigest,
  });
  if (
    !hasExactKeys(rollback, [
      'canonicalDatabaseRestored',
      'destinationWritesDisabled',
      'mediaCanonicalGenerationSafe',
      'ok',
      'sourceRecoveryVerified',
    ]) ||
    rollback.ok !== true ||
    rollback.destinationWritesDisabled !== true ||
    rollback.sourceRecoveryVerified !== true ||
    rollback.canonicalDatabaseRestored !== true ||
    rollback.mediaCanonicalGenerationSafe !== true
  ) {
    fail('PRE_WRITE_ROLLBACK_FAILED');
  }
  const report = writePrivateReport(context.control, 'pre-write-rollback-report.json', {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    migrationId: context.control.migrationId,
    releaseCommit: context.control.releaseCommit,
    createdAt: nowFrom(dependencies),
    failedRemotePhase: status.phase,
    destinationWritesDisabled: true,
    canonicalDatabaseRestored: true,
    mediaCanonicalGenerationSafe: true,
    sourceRecoveryVerified: true,
    sourceRecoveryReceiptDigest,
    dataLossAccepted: false,
  }, 'PRE_WRITE_ROLLBACK_REPORT_FAILED');
  if (sourceWasFrozen) {
    const failedState = ledger.currentState === 'RESTORE_DRILL_PASSED'
      ? 'SOURCE_FROZEN'
      : ledger.currentState === 'SOURCE_FROZEN'
        ? 'DESTINATION_RESTORED'
        : ledger.currentState;
    await dependencies.recordFailure({
      journalPath: context.control.journalPath,
      evidence: {
        failedState,
        failureClass: 'ROLLBACK_SAFETY',
        failureReportDigest: report.digest,
      },
      now: nowFrom(dependencies),
    });
    await dependencies.recordRollback({
      journalPath: context.control.journalPath,
      evidence: {
        dataLossAccepted: false,
        destinationWritesDisabled: true,
        rollbackMode: 'PRE_DESTINATION_WRITES',
        rollbackReportDigest: report.digest,
        sourceRecoveryVerified: true,
      },
      now: nowFrom(dependencies),
    });
  }
  const finished = await dependencies.operations.finishRemoteRollback({
    ...context,
    rollbackReportDigest: report.digest,
  });
  if (
    !isPlainObject(finished) ||
    finished.ok !== true ||
    finished.phase !== 'ROLLED_BACK' ||
    finished.lockReleased !== true
  ) {
    fail('PRE_WRITE_ROLLBACK_FAILED');
  }
  return Object.freeze({
    ok: true,
    status: 'ROLLED_BACK',
    reportDigest: report.digest,
  });
}

export async function runLiveCutoverPhase(input, dependencyOverrides) {
  if (
    !isPlainObject(input) ||
    !hasExactKeys(input, ['confirmation', 'controlPath', 'phase']) ||
    !ALL_PHASES.has(input.phase)
  ) {
    fail('LIVE_INPUT_INVALID');
  }
  const control = readLiveCutoverControl(input.controlPath);
  if (input.phase !== 'status') {
    requireConfirmation(control, input.phase, input.confirmation);
  }
  if (input.phase === 'commit' || input.phase === 'finalize') {
    fail('LIVE_WRITE_COMMIT_NOT_IMPLEMENTED');
  }
  const dependencies = await resolveDependencies(dependencyOverrides, control);
  const context = contextFor(control, input.confirmation);
  if (input.phase === 'status') {
    const status = await dependencies.operations.status(context);
    if (
      isPlainObject(status) &&
      status.ok === true &&
      status.phase === 'UNLOCKED' &&
      status.writesEnabled === false
    ) {
      return Object.freeze({ ok: true, status: 'UNLOCKED', writesEnabled: false });
    }
    const validated = validateRemoteStatus(status);
    return Object.freeze({
      ok: true,
      status: validated.phase,
      writesEnabled: validated.writesEnabled,
    });
  }
  if (input.phase === 'prepare-target') return prepareTarget(context, dependencies);
  if (input.phase === 'freeze-source') return freezeSource(context, dependencies);
  if (input.phase === 'bind-final') return bindFinal(context, dependencies);
  if (input.phase === 'restore-destination') return restoreDestination(context, dependencies);
  if (input.phase === 'smoke-readonly') return smokeReadOnly(context, dependencies);
  return rollbackPreWrite(context, dependencies);
}

export async function runCli(argv = process.argv.slice(2)) {
  const parsed = parseLiveCutoverArguments(argv);
  if (parsed.phase !== 'status') {
    // Application-level sealed handoff and additive publication primitives do
    // not replace an NAS privilege boundary. Keep mutations stopped until the
    // live adapter and the root-owned fixed gateway/restricted-key/sudo-broker
    // installation are attested end to end.
    fail('FLOWPACK_MEDIA_SOURCE_HANDOFF_AND_PROMOTION_NOT_IMPLEMENTED');
  }
  return runLiveCutoverPhase(parsed);
}

const invokedPath = process.argv[1] === undefined
  ? undefined
  : pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  try {
    const result = await runCli();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch {
    process.stderr.write('{"ok":false}\n');
    process.exitCode = 1;
  }
}
