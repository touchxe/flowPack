import assert from 'node:assert/strict';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  advanceRemoteDatabasePhase,
  finishRemoteDatabaseRollback,
  prepareRemoteDatabaseLock,
  readRemoteDatabaseStatus,
} from './nas-remote-database.mjs';

const PROJECT_ID = 'flowpack-nas';
const MIGRATION_ID = '11111111-2222-4333-8444-555555555555';
const RELEASE_COMMIT = 'a'.repeat(40);
const TOKEN_DIGEST = 'b'.repeat(64);
const CANDIDATE = 'flowpack_candidate_123456789abc';
const PREVIOUS = 'flowpack_precutover_123456789abc';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'flowpack-remote-database-'));
  chmodSync(root, 0o700);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, '.nas-project-id'), `${PROJECT_ID}\n`, { mode: 0o600 });
  mkdirSync(join(root, 'state'), { mode: 0o700 });
  mkdirSync(join(root, 'releases'), { mode: 0o700 });
  mkdirSync(join(root, 'releases', RELEASE_COMMIT), { mode: 0o700 });
  symlinkSync(join('releases', RELEASE_COMMIT), join(root, 'current'));
  return root;
}

function confirmation(phase) {
  return `${PROJECT_ID}:${MIGRATION_ID}:${phase}`;
}

function identity(projectRoot) {
  return {
    projectId: PROJECT_ID,
    projectRoot,
    migrationId: MIGRATION_ID,
    releaseCommit: RELEASE_COMMIT,
    tokenDigest: TOKEN_DIGEST,
  };
}

function prepare(projectRoot, overrides = {}) {
  return prepareRemoteDatabaseLock({
    ...identity(projectRoot),
    candidateDatabase: CANDIDATE,
    previousDatabase: PREVIOUS,
    confirmation: confirmation('prepare-target'),
    ...overrides,
  });
}

function advance(projectRoot, expectedPhase, targetPhase, phase, overrides = {}) {
  return advanceRemoteDatabasePhase({
    ...identity(projectRoot),
    expectedPhase,
    targetPhase,
    evidenceDigest: 'd'.repeat(64),
    confirmation: confirmation(phase),
    ...overrides,
  });
}

test('exclusive remote lock is release-bound and stores a private canonical state file', (t) => {
  const root = fixture(t);
  assert.deepEqual(prepare(root), {
    ok: true,
    phase: 'LOCKED',
    migrationBound: true,
    releaseBound: true,
  });
  const lockDirectory = join(root, 'state', 'database-migration.lock');
  const statePath = join(lockDirectory, 'state.json');
  assert.equal(lstatSync(lockDirectory).mode & 0o777, 0o700);
  assert.equal(lstatSync(statePath).mode & 0o777, 0o600);
  const raw = readFileSync(statePath, 'utf8');
  assert.equal(raw, `${JSON.stringify(JSON.parse(raw))}\n`);

  assert.throws(() => prepare(root), /DATABASE_MIGRATION_LOCK_HELD/);
  assert.throws(
    () => readRemoteDatabaseStatus({ ...identity(root), tokenDigest: 'c'.repeat(64) }),
    /DATABASE_MIGRATION_IDENTITY_MISMATCH/,
  );
});

test('project sentinel, current release and source deployment lock are mandatory', (t) => {
  const root = fixture(t);
  mkdirSync(join(root, 'state', 'source-deploy.lock'), { mode: 0o700 });
  assert.throws(() => prepare(root), /SOURCE_DEPLOY_LOCK_HELD/);
  rmSync(join(root, 'state', 'source-deploy.lock'), { recursive: true });

  writeFileSync(join(root, '.nas-project-id'), 'documate-nas\n', { mode: 0o600 });
  assert.throws(() => prepare(root), /PROJECT_SENTINEL_INVALID/);
  writeFileSync(join(root, '.nas-project-id'), `${PROJECT_ID}\n`, { mode: 0o600 });
  rmSync(join(root, 'current'));
  symlinkSync(join('releases', 'f'.repeat(40)), join(root, 'current'));
  assert.throws(() => prepare(root), /CURRENT_RELEASE_MISMATCH/);
});

test('database names and exact phase confirmations cannot collide with canonical', (t) => {
  const root = fixture(t);
  assert.throws(
    () => prepare(root, { candidateDatabase: 'flowpack' }),
    /DATABASE_NAME_INVALID/,
  );
  assert.throws(
    () => prepare(root, { confirmation: `${PROJECT_ID}:${MIGRATION_ID}:wrong` }),
    /DATABASE_MIGRATION_CONFIRMATION_REQUIRED/,
  );
  prepare(root);
  assert.throws(
    () => advance(root, 'LOCKED', 'TARGET_PREPARED', 'freeze-source'),
    /DATABASE_MIGRATION_CONFIRMATION_REQUIRED/,
  );
  assert.equal(
    advance(root, 'LOCKED', 'TARGET_PREPARED', 'prepare-target').phase,
    'TARGET_PREPARED',
  );
  assert.throws(
    () => advance(root, 'LOCKED', 'TARGET_PREPARED', 'prepare-target'),
    /DATABASE_MIGRATION_PHASE_MISMATCH/,
  );
});

test('write enable transitions fail closed until reconciliation support exists', (t) => {
  const root = fixture(t);
  prepare(root);
  const transitions = [
    ['LOCKED', 'TARGET_PREPARED', 'prepare-target'],
    ['TARGET_PREPARED', 'SOURCE_FROZEN', 'freeze-source'],
    ['SOURCE_FROZEN', 'FINAL_BOUND', 'bind-final'],
    ['FINAL_BOUND', 'CANDIDATE_RESTORED', 'restore-destination'],
    ['CANDIDATE_RESTORED', 'LIVE_RENAMED', 'restore-destination'],
    ['LIVE_RENAMED', 'CANDIDATE_PROMOTED', 'restore-destination'],
    ['CANDIDATE_PROMOTED', 'DESTINATION_READ_ONLY', 'restore-destination'],
    ['DESTINATION_READ_ONLY', 'ZERO_WRITE_SMOKE_PASSED', 'smoke-readonly'],
  ];
  for (const [from, to, phase] of transitions) advance(root, from, to, phase);
  assert.equal(readRemoteDatabaseStatus(identity(root)).writesEnabled, false);
  assert.throws(
    () => advance(
      root,
      'ZERO_WRITE_SMOKE_PASSED',
      'WRITES_ENABLED_PENDING_LEDGER',
      'commit',
    ),
    /LIVE_WRITE_COMMIT_NOT_IMPLEMENTED/,
  );
  assert.equal(readRemoteDatabaseStatus(identity(root)).phase, 'ZERO_WRITE_SMOKE_PASSED');
});

test('pre-write rollback archives evidence durably and releases the lock', (t) => {
  const root = fixture(t);
  prepare(root);
  advance(root, 'LOCKED', 'TARGET_PREPARED', 'prepare-target');
  writeFileSync(
    join(root, 'state', 'database-migration.lock', 'runtime-env.before'),
    'secret-bearing-runtime-snapshot\n',
    { mode: 0o600 },
  );
  const result = finishRemoteDatabaseRollback({
    ...identity(root),
    rollbackReportDigest: 'e'.repeat(64),
    confirmation: confirmation('pre-write-rollback'),
  });
  assert.deepEqual(result, { ok: true, phase: 'ROLLED_BACK', lockReleased: true });
  assert.equal(existsSync(join(root, 'state', 'database-migration.lock')), false);
  const archivePath = join(
    root,
    'state',
    'database-migrations',
    `${MIGRATION_ID}.json`,
  );
  assert.equal(lstatSync(archivePath).mode & 0o777, 0o600);
  const archive = JSON.parse(readFileSync(archivePath, 'utf8'));
  assert.equal(archive.phase, 'ROLLED_BACK');
  assert.equal(archive.rollbackReportDigest, 'e'.repeat(64));
});
