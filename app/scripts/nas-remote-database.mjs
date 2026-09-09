#!/usr/bin/env node

import {
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PROJECT_ID = 'flowpack-nas';

const FILE_MODE = 0o600;
const DIRECTORY_MODE = 0o700;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const MIGRATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RELEASE_PATTERN = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const DATABASE_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;
const STATE_KEYS = Object.freeze([
  'candidateDatabase',
  'evidenceDigest',
  'migrationId',
  'phase',
  'previousDatabase',
  'projectId',
  'releaseCommit',
  'rollbackReportDigest',
  'schemaVersion',
  'tokenDigest',
]);
const PHASE_TRANSITIONS = Object.freeze({
  LOCKED: 'TARGET_PREPARED',
  TARGET_PREPARED: 'SOURCE_FROZEN',
  SOURCE_FROZEN: 'FINAL_BOUND',
  FINAL_BOUND: 'CANDIDATE_RESTORED',
  CANDIDATE_RESTORED: 'LIVE_RENAMED',
  LIVE_RENAMED: 'CANDIDATE_PROMOTED',
  CANDIDATE_PROMOTED: 'DESTINATION_READ_ONLY',
  DESTINATION_READ_ONLY: 'ZERO_WRITE_SMOKE_PASSED',
  ZERO_WRITE_SMOKE_PASSED: 'WRITES_ENABLED_PENDING_LEDGER',
  WRITES_ENABLED_PENDING_LEDGER: 'COMMITTED',
  COMMITTED: 'FINALIZED',
});
const PHASE_CONFIRMATIONS = Object.freeze({
  TARGET_PREPARED: 'prepare-target',
  SOURCE_FROZEN: 'freeze-source',
  FINAL_BOUND: 'bind-final',
  CANDIDATE_RESTORED: 'restore-destination',
  LIVE_RENAMED: 'restore-destination',
  CANDIDATE_PROMOTED: 'restore-destination',
  DESTINATION_READ_ONLY: 'restore-destination',
  ZERO_WRITE_SMOKE_PASSED: 'smoke-readonly',
  WRITES_ENABLED_PENDING_LEDGER: 'commit',
  COMMITTED: 'commit',
  FINALIZED: 'finalize',
});
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
const POST_WRITE_PHASES = new Set([
  'WRITES_ENABLED_PENDING_LEDGER',
  'COMMITTED',
  'FINALIZED',
]);

export class RemoteDatabaseError extends Error {
  constructor(code) {
    super(code);
    this.name = 'RemoteDatabaseError';
    this.code = code;
  }
}

function fail(code) {
  throw new RemoteDatabaseError(code);
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

function assertIdentity({ projectId, migrationId, releaseCommit, tokenDigest }) {
  if (
    projectId !== PROJECT_ID ||
    !MIGRATION_ID_PATTERN.test(migrationId ?? '') ||
    !RELEASE_PATTERN.test(releaseCommit ?? '') ||
    !HASH_PATTERN.test(tokenDigest ?? '')
  ) {
    fail('DATABASE_MIGRATION_IDENTITY_INVALID');
  }
}

function assertDatabaseName(value) {
  if (typeof value !== 'string' || !DATABASE_PATTERN.test(value)) {
    fail('DATABASE_NAME_INVALID');
  }
  return value;
}

function assertProjectRoot(projectRoot) {
  if (
    typeof projectRoot !== 'string' ||
    !isAbsolute(projectRoot) ||
    projectRoot === '/' ||
    resolve(projectRoot) !== projectRoot ||
    projectRoot.includes('\0')
  ) {
    fail('PROJECT_ROOT_INVALID');
  }
  let metadata;
  try {
    metadata = lstatSync(projectRoot);
  } catch {
    fail('PROJECT_ROOT_INVALID');
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) fail('PROJECT_ROOT_INVALID');
  return projectRoot;
}

function assertDirectory(path, code) {
  let metadata;
  try {
    metadata = lstatSync(path);
  } catch {
    fail(code);
  }
  if (
    metadata.isSymbolicLink() ||
    !metadata.isDirectory() ||
    (metadata.mode & 0o777) !== DIRECTORY_MODE
  ) {
    fail(code);
  }
  return metadata;
}

function assertFile(path, code, maximumBytes = 64 * 1024) {
  let metadata;
  try {
    metadata = lstatSync(path);
  } catch {
    fail(code);
  }
  if (
    metadata.isSymbolicLink() ||
    !metadata.isFile() ||
    (metadata.mode & 0o777) !== FILE_MODE ||
    metadata.size <= 0 ||
    metadata.size > maximumBytes
  ) {
    fail(code);
  }
  return metadata;
}

function fsyncDirectory(path, code = 'DATABASE_MIGRATION_STATE_WRITE_FAILED') {
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

function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (Array.isArray(value)) return value.map(canonical);
  if (!isPlainObject(value)) fail('DATABASE_MIGRATION_STATE_INVALID');
  const result = {};
  for (const key of Object.keys(value).sort()) result[key] = canonical(value[key]);
  return result;
}

function canonicalStringify(value) {
  return JSON.stringify(canonical(value));
}

function writeExclusive(path, value, code) {
  const payload = Buffer.from(`${canonicalStringify(value)}\n`, 'utf8');
  let descriptor;
  try {
    descriptor = openSync(
      path,
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
    if (error instanceof RemoteDatabaseError) throw error;
    fail(code);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  assertFile(path, code);
}

function replaceState(lockDirectory, state) {
  const temporaryPath = join(
    lockDirectory,
    `.state.tmp-${state.tokenDigest.slice(0, 16)}`,
  );
  writeExclusive(temporaryPath, state, 'DATABASE_MIGRATION_STATE_WRITE_FAILED');
  try {
    renameSync(temporaryPath, join(lockDirectory, 'state.json'));
    fsyncDirectory(lockDirectory);
  } catch {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    fail('DATABASE_MIGRATION_STATE_WRITE_FAILED');
  }
}

function assertBoundary(projectRoot, releaseCommit) {
  const sentinelPath = join(projectRoot, '.nas-project-id');
  assertFile(sentinelPath, 'PROJECT_SENTINEL_INVALID', 128);
  if (readFileSync(sentinelPath, 'utf8') !== `${PROJECT_ID}\n`) {
    fail('PROJECT_SENTINEL_INVALID');
  }
  assertDirectory(join(projectRoot, 'state'), 'PROJECT_STATE_DIRECTORY_INVALID');
  const currentPath = join(projectRoot, 'current');
  let current;
  try {
    current = lstatSync(currentPath);
  } catch {
    fail('CURRENT_RELEASE_INVALID');
  }
  if (!current.isSymbolicLink()) fail('CURRENT_RELEASE_INVALID');
  const target = resolve(dirname(currentPath), readlinkSync(currentPath));
  const expected = join(projectRoot, 'releases', releaseCommit);
  if (target !== expected) fail('CURRENT_RELEASE_MISMATCH');
  assertDirectory(expected, 'CURRENT_RELEASE_INVALID');
}

function migrationLockPath(projectRoot) {
  return join(projectRoot, 'state', 'database-migration.lock');
}

function readState(projectRoot) {
  const directory = migrationLockPath(projectRoot);
  assertDirectory(directory, 'DATABASE_MIGRATION_LOCK_INVALID');
  const statePath = join(directory, 'state.json');
  assertFile(statePath, 'DATABASE_MIGRATION_STATE_INVALID');
  let state;
  let raw;
  try {
    raw = readFileSync(statePath, 'utf8');
    state = JSON.parse(raw);
  } catch {
    fail('DATABASE_MIGRATION_STATE_INVALID');
  }
  if (
    raw !== `${canonicalStringify(state)}\n` ||
    !hasExactKeys(state, STATE_KEYS) ||
    state.schemaVersion !== 1 ||
    state.projectId !== PROJECT_ID ||
    !MIGRATION_ID_PATTERN.test(state.migrationId ?? '') ||
    !RELEASE_PATTERN.test(state.releaseCommit ?? '') ||
    !HASH_PATTERN.test(state.tokenDigest ?? '') ||
    !DATABASE_PATTERN.test(state.candidateDatabase ?? '') ||
    !DATABASE_PATTERN.test(state.previousDatabase ?? '') ||
    (!Object.hasOwn(PHASE_TRANSITIONS, state.phase) &&
      !['FINALIZED', 'ROLLED_BACK'].includes(state.phase)) ||
    !(state.evidenceDigest === null || HASH_PATTERN.test(state.evidenceDigest ?? '')) ||
    !(state.rollbackReportDigest === null || HASH_PATTERN.test(state.rollbackReportDigest ?? ''))
  ) {
    fail('DATABASE_MIGRATION_STATE_INVALID');
  }
  return state;
}

function assertStateIdentity(state, identity) {
  if (
    state.projectId !== identity.projectId ||
    state.migrationId !== identity.migrationId ||
    state.releaseCommit !== identity.releaseCommit ||
    state.tokenDigest !== identity.tokenDigest
  ) {
    fail('DATABASE_MIGRATION_IDENTITY_MISMATCH');
  }
}

function assertConfirmation(value, migrationId, phase) {
  if (value !== `${PROJECT_ID}:${migrationId}:${phase}`) {
    fail('DATABASE_MIGRATION_CONFIRMATION_REQUIRED');
  }
}

export function prepareRemoteDatabaseLock(input) {
  if (!hasExactKeys(input, [
    'candidateDatabase',
    'confirmation',
    'migrationId',
    'previousDatabase',
    'projectId',
    'projectRoot',
    'releaseCommit',
    'tokenDigest',
  ])) {
    fail('DATABASE_MIGRATION_INPUT_INVALID');
  }
  assertIdentity(input);
  assertProjectRoot(input.projectRoot);
  assertDatabaseName(input.candidateDatabase);
  assertDatabaseName(input.previousDatabase);
  if (
    input.candidateDatabase === 'flowpack' ||
    input.previousDatabase === 'flowpack' ||
    input.candidateDatabase === input.previousDatabase
  ) {
    fail('DATABASE_NAME_INVALID');
  }
  assertConfirmation(input.confirmation, input.migrationId, 'prepare-target');
  assertBoundary(input.projectRoot, input.releaseCommit);
  if (existsSync(join(input.projectRoot, 'state', 'source-deploy.lock'))) {
    fail('SOURCE_DEPLOY_LOCK_HELD');
  }

  const directory = migrationLockPath(input.projectRoot);
  try {
    mkdirSync(directory, { mode: DIRECTORY_MODE });
  } catch (error) {
    if (error?.code === 'EEXIST') fail('DATABASE_MIGRATION_LOCK_HELD');
    fail('DATABASE_MIGRATION_LOCK_CREATE_FAILED');
  }
  assertDirectory(directory, 'DATABASE_MIGRATION_LOCK_INVALID');
  const state = {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    migrationId: input.migrationId,
    releaseCommit: input.releaseCommit,
    tokenDigest: input.tokenDigest,
    candidateDatabase: input.candidateDatabase,
    previousDatabase: input.previousDatabase,
    phase: 'LOCKED',
    evidenceDigest: null,
    rollbackReportDigest: null,
  };
  try {
    writeExclusive(
      join(directory, 'state.json'),
      state,
      'DATABASE_MIGRATION_STATE_WRITE_FAILED',
    );
    fsyncDirectory(directory);
    fsyncDirectory(dirname(directory));
  } catch (error) {
    if (existsSync(join(directory, 'state.json'))) unlinkSync(join(directory, 'state.json'));
    rmdirSync(directory);
    throw error;
  }
  return Object.freeze({
    ok: true,
    phase: 'LOCKED',
    migrationBound: true,
    releaseBound: true,
  });
}

export function readRemoteDatabaseStatus(input) {
  if (!hasExactKeys(input, [
    'migrationId',
    'projectId',
    'projectRoot',
    'releaseCommit',
    'tokenDigest',
  ])) {
    fail('DATABASE_MIGRATION_INPUT_INVALID');
  }
  assertIdentity(input);
  assertProjectRoot(input.projectRoot);
  assertBoundary(input.projectRoot, input.releaseCommit);
  const state = readState(input.projectRoot);
  assertStateIdentity(state, input);
  return Object.freeze({
    ok: true,
    phase: state.phase,
    writesEnabled: POST_WRITE_PHASES.has(state.phase),
  });
}

export function advanceRemoteDatabasePhase(input) {
  if (!hasExactKeys(input, [
    'confirmation',
    'evidenceDigest',
    'expectedPhase',
    'migrationId',
    'projectId',
    'projectRoot',
    'releaseCommit',
    'targetPhase',
    'tokenDigest',
  ])) {
    fail('DATABASE_MIGRATION_INPUT_INVALID');
  }
  assertIdentity(input);
  assertProjectRoot(input.projectRoot);
  assertBoundary(input.projectRoot, input.releaseCommit);
  if (!HASH_PATTERN.test(input.evidenceDigest ?? '')) {
    fail('DATABASE_MIGRATION_EVIDENCE_INVALID');
  }
  if (PHASE_TRANSITIONS[input.expectedPhase] !== input.targetPhase) {
    fail('DATABASE_MIGRATION_PHASE_TRANSITION_INVALID');
  }
  if (POST_WRITE_PHASES.has(input.targetPhase)) {
    fail('LIVE_WRITE_COMMIT_NOT_IMPLEMENTED');
  }
  assertConfirmation(
    input.confirmation,
    input.migrationId,
    PHASE_CONFIRMATIONS[input.targetPhase],
  );
  const state = readState(input.projectRoot);
  assertStateIdentity(state, input);
  if (state.phase !== input.expectedPhase) fail('DATABASE_MIGRATION_PHASE_MISMATCH');
  replaceState(migrationLockPath(input.projectRoot), {
    ...state,
    phase: input.targetPhase,
    evidenceDigest: input.evidenceDigest,
  });
  return Object.freeze({ ok: true, phase: input.targetPhase });
}

export function finishRemoteDatabaseRollback(input) {
  if (!hasExactKeys(input, [
    'confirmation',
    'migrationId',
    'projectId',
    'projectRoot',
    'releaseCommit',
    'rollbackReportDigest',
    'tokenDigest',
  ])) {
    fail('DATABASE_MIGRATION_INPUT_INVALID');
  }
  assertIdentity(input);
  assertProjectRoot(input.projectRoot);
  assertBoundary(input.projectRoot, input.releaseCommit);
  if (!HASH_PATTERN.test(input.rollbackReportDigest ?? '')) {
    fail('DATABASE_MIGRATION_EVIDENCE_INVALID');
  }
  assertConfirmation(input.confirmation, input.migrationId, 'pre-write-rollback');
  const state = readState(input.projectRoot);
  assertStateIdentity(state, input);
  if (!PRE_WRITE_PHASES.has(state.phase)) fail('RECONCILIATION_REQUIRED');

  const archiveRoot = join(input.projectRoot, 'state', 'database-migrations');
  if (!existsSync(archiveRoot)) {
    try {
      mkdirSync(archiveRoot, { mode: DIRECTORY_MODE });
      fsyncDirectory(join(input.projectRoot, 'state'));
    } catch (error) {
      if (error instanceof RemoteDatabaseError) throw error;
      fail('DATABASE_MIGRATION_ARCHIVE_INVALID');
    }
  }
  assertDirectory(archiveRoot, 'DATABASE_MIGRATION_ARCHIVE_INVALID');
  const archived = {
    ...state,
    phase: 'ROLLED_BACK',
    rollbackReportDigest: input.rollbackReportDigest,
  };
  writeExclusive(
    join(archiveRoot, `${input.migrationId}.json`),
    archived,
    'DATABASE_MIGRATION_ARCHIVE_INVALID',
  );
  fsyncDirectory(archiveRoot, 'DATABASE_MIGRATION_ARCHIVE_INVALID');

  const directory = migrationLockPath(input.projectRoot);
  try {
    const runtimeSnapshot = join(directory, 'runtime-env.before');
    if (existsSync(runtimeSnapshot)) {
      assertFile(runtimeSnapshot, 'DATABASE_MIGRATION_RUNTIME_SNAPSHOT_INVALID', 1024 * 1024);
      unlinkSync(runtimeSnapshot);
      fsyncDirectory(directory);
    }
    unlinkSync(join(directory, 'state.json'));
    fsyncDirectory(directory);
    rmdirSync(directory);
    fsyncDirectory(join(input.projectRoot, 'state'));
  } catch (error) {
    if (error instanceof RemoteDatabaseError) throw error;
    fail('DATABASE_MIGRATION_LOCK_RELEASE_FAILED');
  }
  return Object.freeze({ ok: true, phase: 'ROLLED_BACK', lockReleased: true });
}

function parseCli(argv) {
  if (!Array.isArray(argv) || argv.length === 0) fail('USAGE');
  const [command, ...values] = argv;
  if (command === 'prepare' && values.length === 8) {
    const [
      projectId,
      projectRoot,
      migrationId,
      releaseCommit,
      tokenDigest,
      candidateDatabase,
      previousDatabase,
      confirmation,
    ] = values;
    return {
      command,
      input: {
        projectId,
        projectRoot,
        migrationId,
        releaseCommit,
        tokenDigest,
        candidateDatabase,
        previousDatabase,
        confirmation,
      },
    };
  }
  if (command === 'status' && values.length === 5) {
    const [projectId, projectRoot, migrationId, releaseCommit, tokenDigest] = values;
    return {
      command,
      input: { projectId, projectRoot, migrationId, releaseCommit, tokenDigest },
    };
  }
  if (command === 'advance' && values.length === 9) {
    const [
      projectId,
      projectRoot,
      migrationId,
      releaseCommit,
      tokenDigest,
      expectedPhase,
      targetPhase,
      evidenceDigest,
      confirmation,
    ] = values;
    return {
      command,
      input: {
        projectId,
        projectRoot,
        migrationId,
        releaseCommit,
        tokenDigest,
        expectedPhase,
        targetPhase,
        evidenceDigest,
        confirmation,
      },
    };
  }
  if (command === 'finish-rollback' && values.length === 7) {
    const [
      projectId,
      projectRoot,
      migrationId,
      releaseCommit,
      tokenDigest,
      rollbackReportDigest,
      confirmation,
    ] = values;
    return {
      command,
      input: {
        projectId,
        projectRoot,
        migrationId,
        releaseCommit,
        tokenDigest,
        rollbackReportDigest,
        confirmation,
      },
    };
  }
  fail('USAGE');
}

export function runCli(argv = process.argv.slice(2)) {
  const parsed = parseCli(argv);
  if (parsed.command === 'prepare') return prepareRemoteDatabaseLock(parsed.input);
  if (parsed.command === 'status') return readRemoteDatabaseStatus(parsed.input);
  if (parsed.command === 'advance') return advanceRemoteDatabasePhase(parsed.input);
  return finishRemoteDatabaseRollback(parsed.input);
}

const invokedPath = process.argv[1] === undefined
  ? undefined
  : pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  try {
    process.stdout.write(`${JSON.stringify(runCli())}\n`);
  } catch {
    process.stderr.write('{"ok":false}\n');
    process.exitCode = 1;
  }
}
