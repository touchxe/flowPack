#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PROJECT_ID = 'flowpack-nas';

export const NORMAL_STATES = Object.freeze([
  'PLANNED',
  'STAGED',
  'ARTIFACTS_VERIFIED',
  'RESTORE_DRILL_PASSED',
  'SOURCE_FROZEN',
  'DESTINATION_RESTORED',
  'ZERO_WRITE_SMOKE_PASSED',
  'CUTOVER_COMMITTED',
  'FINALIZED',
]);

export const EVENT_TYPES = Object.freeze({
  STATE_ADVANCED: 'STATE_ADVANCED',
  FAILURE_RECORDED: 'FAILURE_RECORDED',
  ROLLBACK_RECORDED: 'ROLLBACK_RECORDED',
});

const JOURNAL_SCHEMA_VERSION = 1;
const MAX_JOURNAL_BYTES = 1024 * 1024;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const NO_FOLLOW = fsConstants.O_NOFOLLOW ?? 0;
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

const VALUE_RULES = Object.freeze({
  digest: (value) => typeof value === 'string' && HASH_PATTERN.test(value),
  true: (value) => value === true,
  false: (value) => value === false,
});

export const STATE_EVIDENCE_RULES = Object.freeze({
  PLANNED: Object.freeze({
    planDigest: 'digest',
    scopeApproved: 'true',
  }),
  STAGED: Object.freeze({
    composeConfigDigest: 'digest',
    releaseManifestDigest: 'digest',
  }),
  ARTIFACTS_VERIFIED: Object.freeze({
    databaseArtifactReportDigest: 'digest',
    databaseDumpDigest: 'digest',
    offNasBackupVerified: 'true',
    storageManifestDigest: 'digest',
  }),
  RESTORE_DRILL_PASSED: Object.freeze({
    integrityReportDigest: 'digest',
    offNasBackupVerified: 'true',
    restoreDrillReportDigest: 'digest',
  }),
  SOURCE_FROZEN: Object.freeze({
    inFlightWritesDrained: 'true',
    sourceCallbacksDisabled: 'true',
    sourceFreezeReceiptDigest: 'digest',
    sourceSchedulerDisabled: 'true',
    sourceWritesDisabled: 'true',
  }),
  DESTINATION_RESTORED: Object.freeze({
    destinationReadOnly: 'true',
    destinationRestoreReportDigest: 'digest',
    finalDumpDigest: 'digest',
  }),
  ZERO_WRITE_SMOKE_PASSED: Object.freeze({
    destinationWritesObserved: 'false',
    tailscaleHttpsVerified: 'true',
    zeroWriteSmokeReportDigest: 'digest',
  }),
  CUTOVER_COMMITTED: Object.freeze({
    cutoverApprovalDigest: 'digest',
    destinationSchedulerSingleton: 'true',
    destinationWritesEnabled: 'true',
  }),
  FINALIZED: Object.freeze({
    finalizationReportDigest: 'digest',
    legacyRetentionConfirmed: 'true',
    offNasBackupVerified: 'true',
  }),
});

const FAILURE_CLASSES = new Set([
  'ARTIFACT',
  'AUTH',
  'CUTOVER',
  'DATABASE',
  'HEALTH',
  'OTHER',
  'ROLLBACK_SAFETY',
  'SCHEDULER',
  'STORAGE',
]);

const FAILURE_EVIDENCE_KEYS = Object.freeze([
  'failedState',
  'failureClass',
  'failureReportDigest',
]);

const ROLLBACK_BASE_EVIDENCE_KEYS = Object.freeze([
  'dataLossAccepted',
  'destinationWritesDisabled',
  'rollbackMode',
  'rollbackReportDigest',
  'sourceRecoveryVerified',
]);

const EVENT_KEYS = Object.freeze([
  'eventIndex',
  'eventType',
  'evidence',
  'hash',
  'migrationId',
  'previousHash',
  'projectId',
  'recordedAt',
  'schemaVersion',
  'state',
]);

export class MigrationLedgerError extends Error {
  constructor(code) {
    super(code);
    this.name = 'MigrationLedgerError';
    this.code = code;
  }
}

function fail(code) {
  throw new MigrationLedgerError(code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function compareKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function canonicalize(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) fail('NON_CANONICAL_VALUE');
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry));
  if (!isPlainObject(value)) fail('NON_CANONICAL_VALUE');

  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] === undefined) fail('NON_CANONICAL_VALUE');
    result[key] = canonicalize(value[key]);
  }
  return result;
}

export function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function hashEvent(eventWithoutHash) {
  return createHash('sha256').update(canonicalStringify(eventWithoutHash), 'utf8').digest('hex');
}

function validateMigrationId(migrationId) {
  if (typeof migrationId !== 'string' || !UUID_PATTERN.test(migrationId)) {
    fail('INVALID_MIGRATION_ID');
  }
}

function validateTimestamp(recordedAt) {
  if (
    typeof recordedAt !== 'string' ||
    !ISO_TIMESTAMP_PATTERN.test(recordedAt) ||
    Number.isNaN(Date.parse(recordedAt)) ||
    new Date(recordedAt).toISOString() !== recordedAt
  ) {
    fail('INVALID_TIMESTAMP');
  }
}

function resolveTimestamp(now) {
  const recordedAt = now instanceof Date ? now.toISOString() : now ?? new Date().toISOString();
  validateTimestamp(recordedAt);
  return recordedAt;
}

function validateStateEvidence(state, evidence) {
  const rules = STATE_EVIDENCE_RULES[state];
  if (rules === undefined || !compareKeys(evidence, Object.keys(rules))) {
    fail('INVALID_EVIDENCE');
  }

  for (const [key, rule] of Object.entries(rules)) {
    const validator = VALUE_RULES[rule];
    if (validator === undefined || !validator(evidence[key])) fail('INVALID_EVIDENCE');
  }
}

function validateFailureEvidence(evidence, currentState) {
  if (!compareKeys(evidence, FAILURE_EVIDENCE_KEYS)) fail('INVALID_EVIDENCE');
  if (!HASH_PATTERN.test(evidence.failureReportDigest ?? '')) fail('INVALID_EVIDENCE');
  if (!FAILURE_CLASSES.has(evidence.failureClass)) fail('INVALID_EVIDENCE');

  const currentIndex = NORMAL_STATES.indexOf(currentState);
  const failedIndex = NORMAL_STATES.indexOf(evidence.failedState);
  if (
    failedIndex < NORMAL_STATES.indexOf('SOURCE_FROZEN') ||
    failedIndex < currentIndex ||
    failedIndex > Math.min(currentIndex + 1, NORMAL_STATES.length - 1)
  ) {
    fail('INVALID_EVIDENCE');
  }
}

function validateRollbackEvidence(evidence, currentState) {
  if (!isPlainObject(evidence)) fail('INVALID_EVIDENCE');
  const baseKeys = [...ROLLBACK_BASE_EVIDENCE_KEYS];
  const isReconciled = evidence.rollbackMode === 'RECONCILED_TO_SOURCE';
  const expectedKeys = isReconciled ? [...baseKeys, 'reconciliationReportDigest'] : baseKeys;
  if (!compareKeys(evidence, expectedKeys)) fail('INVALID_EVIDENCE');
  if (!HASH_PATTERN.test(evidence.rollbackReportDigest ?? '')) fail('INVALID_EVIDENCE');
  if (evidence.destinationWritesDisabled !== true || evidence.sourceRecoveryVerified !== true) {
    fail('INVALID_EVIDENCE');
  }
  if (evidence.dataLossAccepted !== false) fail('INVALID_EVIDENCE');

  const committed = NORMAL_STATES.indexOf(currentState) >= NORMAL_STATES.indexOf('CUTOVER_COMMITTED');
  if (committed !== isReconciled) fail('INVALID_EVIDENCE');
  if (isReconciled && !HASH_PATTERN.test(evidence.reconciliationReportDigest ?? '')) {
    fail('INVALID_EVIDENCE');
  }
  if (!isReconciled && evidence.rollbackMode !== 'PRE_DESTINATION_WRITES') {
    fail('INVALID_EVIDENCE');
  }
}

function safeLstat(filePath, missingIsNull = false) {
  try {
    return lstatSync(filePath);
  } catch (error) {
    if (missingIsNull && error?.code === 'ENOENT') return null;
    fail('FILESYSTEM_CHECK_FAILED');
  }
}

function validateStateDirectory(journalPath) {
  if (typeof journalPath !== 'string' || journalPath.length === 0 || journalPath.includes('\0')) {
    fail('INVALID_JOURNAL_PATH');
  }
  const stat = safeLstat(dirname(journalPath));
  if (stat.isSymbolicLink() || !stat.isDirectory()) fail('INVALID_STATE_DIRECTORY');
}

function validateJournalStat(stat) {
  if (stat.isSymbolicLink() || !stat.isFile()) fail('INVALID_JOURNAL_FILE');
  if ((stat.mode & 0o777) !== 0o600) fail('INVALID_JOURNAL_MODE');
  if (stat.size <= 0 || stat.size > MAX_JOURNAL_BYTES) fail('INVALID_JOURNAL_SIZE');
}

function openExistingJournal(journalPath, flags) {
  const before = safeLstat(journalPath);
  validateJournalStat(before);

  let descriptor;
  try {
    descriptor = openSync(journalPath, flags | NO_FOLLOW);
    const after = fstatSync(descriptor);
    validateJournalStat(after);
    if (before.dev !== after.dev || before.ino !== after.ino) fail('JOURNAL_RACE_DETECTED');
    return descriptor;
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    if (error instanceof MigrationLedgerError) throw error;
    fail('JOURNAL_OPEN_FAILED');
  }
}

function acquireLock(journalPath) {
  validateStateDirectory(journalPath);
  const lockPath = `${journalPath}.lock`;
  let descriptor;
  try {
    descriptor = openSync(
      lockPath,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | NO_FOLLOW,
      0o600,
    );
    const payload = Buffer.from('1\n', 'utf8');
    if (writeSync(descriptor, payload, 0, payload.byteLength, null) !== payload.byteLength) {
      fail('LOCK_WRITE_FAILED');
    }
    fsyncSync(descriptor);
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    if (error instanceof MigrationLedgerError) throw error;
    if (error?.code === 'EEXIST') fail('LOCK_HELD');
    fail('LOCK_CREATE_FAILED');
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    let held;
    let current;
    try {
      held = fstatSync(descriptor);
      current = lstatSync(lockPath);
      if (
        current.isSymbolicLink() ||
        !current.isFile() ||
        (current.mode & 0o777) !== 0o600 ||
        held.dev !== current.dev ||
        held.ino !== current.ino
      ) {
        fail('LOCK_INTEGRITY_FAILED');
      }
      closeSync(descriptor);
      descriptor = undefined;
      unlinkSync(lockPath);
    } catch (error) {
      if (descriptor !== undefined) closeSync(descriptor);
      if (error instanceof MigrationLedgerError) throw error;
      fail('LOCK_RELEASE_FAILED');
    }
  };
}

function createEvent({ eventIndex, eventType, evidence, migrationId, previousHash, recordedAt, state }) {
  const eventWithoutHash = {
    eventIndex,
    eventType,
    evidence,
    migrationId,
    previousHash,
    projectId: PROJECT_ID,
    recordedAt,
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    state,
  };
  return { ...eventWithoutHash, hash: hashEvent(eventWithoutHash) };
}

function appendEvent(journalPath, event, create) {
  const payload = Buffer.from(`${canonicalStringify(event)}\n`, 'utf8');
  if (payload.byteLength > 16 * 1024) fail('EVENT_TOO_LARGE');

  let descriptor;
  try {
    if (create) {
      descriptor = openSync(
        journalPath,
        fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | NO_FOLLOW,
        0o600,
      );
    } else {
      descriptor = openExistingJournal(journalPath, fsConstants.O_WRONLY | fsConstants.O_APPEND);
    }
    const beforeWrite = fstatSync(descriptor);
    if (beforeWrite.size + payload.byteLength > MAX_JOURNAL_BYTES) {
      fail('INVALID_JOURNAL_SIZE');
    }
    if (writeSync(descriptor, payload, 0, payload.byteLength, null) !== payload.byteLength) {
      fail('JOURNAL_WRITE_FAILED');
    }
    fsyncSync(descriptor);
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || (stat.mode & 0o777) !== 0o600) fail('INVALID_JOURNAL_FILE');
  } catch (error) {
    if (error instanceof MigrationLedgerError) throw error;
    if (create && error?.code === 'EEXIST') fail('JOURNAL_EXISTS');
    fail('JOURNAL_WRITE_FAILED');
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function parseJournalText(text) {
  if (!text.endsWith('\n')) fail('INVALID_JSONL');
  const rawLines = text.slice(0, -1).split('\n');
  if (rawLines.length === 0 || rawLines.some((line) => line.length === 0)) fail('INVALID_JSONL');

  return rawLines.map((rawLine) => {
    let event;
    try {
      event = JSON.parse(rawLine);
    } catch {
      fail('INVALID_JSONL');
    }
    if (canonicalStringify(event) !== rawLine) fail('NON_CANONICAL_EVENT');
    return event;
  });
}

function readJournalEvents(journalPath) {
  validateStateDirectory(journalPath);
  const descriptor = openExistingJournal(journalPath, fsConstants.O_RDONLY);
  try {
    const buffer = readFileSync(descriptor);
    if (buffer.byteLength > MAX_JOURNAL_BYTES) fail('INVALID_JOURNAL_SIZE');
    let text;
    try {
      text = UTF8_DECODER.decode(buffer);
    } catch {
      fail('INVALID_UTF8');
    }
    return parseJournalText(text);
  } finally {
    closeSync(descriptor);
  }
}

function eventWithoutHash(event) {
  const rest = { ...event };
  delete rest.hash;
  return rest;
}

function verifyEvents(events) {
  let migrationId;
  let currentState;
  let previousHash = null;
  let previousTimestamp;
  let failureRecordedSinceAdvance = false;
  let rolledBack = false;
  const failureFingerprints = new Set();

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (!compareKeys(event, EVENT_KEYS)) fail('INVALID_EVENT_SHAPE');
    if (event.schemaVersion !== JOURNAL_SCHEMA_VERSION) fail('INVALID_SCHEMA_VERSION');
    if (event.projectId !== PROJECT_ID) fail('PROJECT_ID_MISMATCH');
    if (event.eventIndex !== index) fail('INVALID_EVENT_INDEX');
    validateMigrationId(event.migrationId);
    validateTimestamp(event.recordedAt);
    if (event.previousHash !== previousHash) fail('HASH_CHAIN_BROKEN');
    if (!HASH_PATTERN.test(event.hash ?? '') || hashEvent(eventWithoutHash(event)) !== event.hash) {
      fail('HASH_MISMATCH');
    }
    if (migrationId === undefined) migrationId = event.migrationId;
    if (event.migrationId !== migrationId) fail('MIGRATION_ID_MISMATCH');
    if (previousTimestamp !== undefined && event.recordedAt < previousTimestamp) {
      fail('TIMESTAMP_REGRESSION');
    }
    if (rolledBack) fail('EVENT_AFTER_ROLLBACK');

    if (event.eventType === EVENT_TYPES.STATE_ADVANCED) {
      const expectedIndex = currentState === undefined ? 0 : NORMAL_STATES.indexOf(currentState) + 1;
      if (NORMAL_STATES[expectedIndex] !== event.state) fail('INVALID_STATE_TRANSITION');
      validateStateEvidence(event.state, event.evidence);
      currentState = event.state;
      failureRecordedSinceAdvance = false;
    } else if (event.eventType === EVENT_TYPES.FAILURE_RECORDED) {
      if (
        currentState === undefined ||
        NORMAL_STATES.indexOf(currentState) < NORMAL_STATES.indexOf('SOURCE_FROZEN')
      ) {
        fail('FAILURE_EVENT_TOO_EARLY');
      }
      if (event.state !== currentState) fail('AUDIT_STATE_MISMATCH');
      validateFailureEvidence(event.evidence, currentState);
      const fingerprint = canonicalStringify(event.evidence);
      if (failureFingerprints.has(fingerprint)) fail('DUPLICATE_EVENT');
      failureFingerprints.add(fingerprint);
      failureRecordedSinceAdvance = true;
    } else if (event.eventType === EVENT_TYPES.ROLLBACK_RECORDED) {
      if (
        currentState === undefined ||
        NORMAL_STATES.indexOf(currentState) < NORMAL_STATES.indexOf('SOURCE_FROZEN')
      ) {
        fail('ROLLBACK_EVENT_TOO_EARLY');
      }
      if (!failureRecordedSinceAdvance) fail('ROLLBACK_REQUIRES_FAILURE');
      if (event.state !== currentState) fail('AUDIT_STATE_MISMATCH');
      validateRollbackEvidence(event.evidence, currentState);
      rolledBack = true;
    } else {
      fail('INVALID_EVENT_TYPE');
    }

    previousHash = event.hash;
    previousTimestamp = event.recordedAt;
  }

  if (currentState === undefined) fail('EMPTY_JOURNAL');
  return { currentState, eventCount: events.length, migrationId, previousHash, previousTimestamp, rolledBack };
}

function loadLedger(journalPath) {
  const events = readJournalEvents(journalPath);
  return { events, ...verifyEvents(events) };
}

function publicStatus(ledger) {
  return {
    currentState: ledger.currentState,
    eventCount: ledger.eventCount,
    ok: true,
    rolledBack: ledger.rolledBack,
  };
}

function withLock(journalPath, operation) {
  const release = acquireLock(journalPath);
  let result;
  let operationError;
  try {
    result = operation();
  } catch (error) {
    operationError = error;
  }

  try {
    release();
  } catch (releaseError) {
    if (operationError === undefined) throw releaseError;
  }
  if (operationError !== undefined) throw operationError;
  return result;
}

export function initializeLedger({
  journalPath,
  evidence,
  migrationId = randomUUID(),
  now,
}) {
  validateMigrationId(migrationId);
  validateStateEvidence('PLANNED', evidence);
  const recordedAt = resolveTimestamp(now);

  return withLock(journalPath, () => {
    if (safeLstat(journalPath, true) !== null) fail('JOURNAL_EXISTS');
    const event = createEvent({
      eventIndex: 0,
      eventType: EVENT_TYPES.STATE_ADVANCED,
      evidence,
      migrationId,
      previousHash: null,
      recordedAt,
      state: 'PLANNED',
    });
    appendEvent(journalPath, event, true);
    return publicStatus(verifyEvents([event]));
  });
}

function appendToLedger({ journalPath, eventType, evidence, state, now }) {
  return withLock(journalPath, () => {
    const ledger = loadLedger(journalPath);
    if (ledger.rolledBack) fail('MIGRATION_ROLLED_BACK');
    const recordedAt = resolveTimestamp(now);
    if (recordedAt < ledger.previousTimestamp) fail('TIMESTAMP_REGRESSION');
    const event = createEvent({
      eventIndex: ledger.eventCount,
      eventType,
      evidence,
      migrationId: ledger.migrationId,
      previousHash: ledger.previousHash,
      recordedAt,
      state: state ?? ledger.currentState,
    });
    const candidateEvents = [...ledger.events, event];
    const candidate = verifyEvents(candidateEvents);
    appendEvent(journalPath, event, false);
    return publicStatus(candidate);
  });
}

export function advanceLedger({ journalPath, targetState, evidence, now }) {
  if (!NORMAL_STATES.includes(targetState)) fail('INVALID_TARGET_STATE');
  validateStateEvidence(targetState, evidence);
  return appendToLedger({
    journalPath,
    eventType: EVENT_TYPES.STATE_ADVANCED,
    evidence,
    now,
    state: targetState,
  });
}

export function recordFailure({ journalPath, evidence, now }) {
  return appendToLedger({
    journalPath,
    eventType: EVENT_TYPES.FAILURE_RECORDED,
    evidence,
    now,
    state: undefined,
  });
}

export function recordRollback({ journalPath, evidence, now }) {
  return appendToLedger({
    journalPath,
    eventType: EVENT_TYPES.ROLLBACK_RECORDED,
    evidence,
    now,
    state: undefined,
  });
}

export function verifyLedger({ journalPath }) {
  return withLock(journalPath, () => publicStatus(loadLedger(journalPath)));
}

function parseCliArguments(argv) {
  const [command, ...tokens] = argv;
  if (!['advance', 'failure', 'init', 'rollback', 'verify'].includes(command)) fail('USAGE');
  const values = new Map();
  for (let index = 0; index < tokens.length; index += 2) {
    const key = tokens[index];
    const value = tokens[index + 1];
    if (typeof key !== 'string' || !key.startsWith('--') || value === undefined || values.has(key)) {
      fail('USAGE');
    }
    values.set(key, value);
  }
  return { command, values };
}

function parseCliEvidence(values) {
  if (!values.has('--evidence-json')) fail('USAGE');
  try {
    return JSON.parse(values.get('--evidence-json'));
  } catch {
    fail('INVALID_EVIDENCE');
  }
}

function requireOnlyOptions(values, allowed) {
  if ([...values.keys()].some((key) => !allowed.includes(key))) fail('USAGE');
  if (!values.has('--journal')) fail('USAGE');
}

export function runCli(argv = process.argv.slice(2)) {
  const { command, values } = parseCliArguments(argv);
  if (command === 'verify') {
    requireOnlyOptions(values, ['--journal']);
    return verifyLedger({ journalPath: values.get('--journal') });
  }

  const evidence = parseCliEvidence(values);
  if (command === 'init') {
    requireOnlyOptions(values, ['--journal', '--evidence-json']);
    return initializeLedger({
      evidence,
      journalPath: values.get('--journal'),
    });
  }
  if (command === 'advance') {
    requireOnlyOptions(values, ['--journal', '--evidence-json', '--state']);
    if (!values.has('--state')) fail('USAGE');
    const targetState = values.get('--state');
    if (NORMAL_STATES.indexOf(targetState) > NORMAL_STATES.indexOf('RESTORE_DRILL_PASSED')) {
      fail('DEDICATED_OPERATOR_REQUIRED');
    }
    return advanceLedger({
      evidence,
      journalPath: values.get('--journal'),
      targetState,
    });
  }
  if (command === 'failure') {
    requireOnlyOptions(values, ['--journal', '--evidence-json']);
    return recordFailure({ evidence, journalPath: values.get('--journal') });
  }
  requireOnlyOptions(values, ['--journal', '--evidence-json']);
  return recordRollback({ evidence, journalPath: values.get('--journal') });
}

const invokedPath = process.argv[1] === undefined ? undefined : pathToFileURL(process.argv[1]).href;
if (invokedPath === import.meta.url) {
  try {
    process.stdout.write(`${canonicalStringify(runCli())}\n`);
  } catch {
    process.stderr.write('{"ok":false}\n');
    process.exitCode = 1;
  }
}
