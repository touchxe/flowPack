import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  EVENT_TYPES,
  NORMAL_STATES,
  PROJECT_ID,
  STATE_EVIDENCE_RULES,
  advanceLedger,
  canonicalStringify,
  initializeLedger,
  recordFailure,
  recordRollback,
  runCli as runLedgerCli,
  verifyLedger,
} from './nas-migration-ledger.mjs';

const SCRIPT_PATH = fileURLToPath(new URL('./nas-migration-ledger.mjs', import.meta.url));
const MIGRATION_ID = '018f6f10-6fd4-7c20-8f08-7c94918f7281';
const START_TIME = Date.parse('2026-08-24T00:00:00.000Z');

function digest(label) {
  return createHash('sha256').update(label, 'utf8').digest('hex');
}

function evidenceFor(state) {
  return Object.fromEntries(
    Object.entries(STATE_EVIDENCE_RULES[state]).map(([key, rule]) => {
      if (rule === 'digest') return [key, digest(`${state}:${key}`)];
      if (rule === 'true') return [key, true];
      if (rule === 'false') return [key, false];
      throw new Error('unknown evidence rule');
    }),
  );
}

function timeAt(index) {
  return new Date(START_TIME + index * 1000).toISOString();
}

function makeLedger(t) {
  const directory = mkdtempSync(join(tmpdir(), 'nas-migration-ledger-'));
  t.after(() => rmSync(directory, { force: true, recursive: true }));
  return { directory, journalPath: join(directory, 'migration.jsonl') };
}

function initialize(journalPath) {
  return initializeLedger({
    evidence: evidenceFor('PLANNED'),
    journalPath,
    migrationId: MIGRATION_ID,
    now: timeAt(0),
  });
}

function readEvents(journalPath) {
  return readFileSync(journalPath, 'utf8')
    .trimEnd()
    .split('\n')
    .map((line) => JSON.parse(line));
}

function advanceThrough(journalPath, targetState, startEventIndex = 1) {
  const targetIndex = NORMAL_STATES.indexOf(targetState);
  for (let stateIndex = 1; stateIndex <= targetIndex; stateIndex += 1) {
    advanceLedger({
      evidence: evidenceFor(NORMAL_STATES[stateIndex]),
      journalPath,
      now: timeAt(startEventIndex + stateIndex - 1),
      targetState: NORMAL_STATES[stateIndex],
    });
  }
}

function captureCode(operation) {
  let captured;
  try {
    operation();
  } catch (error) {
    captured = error;
  }
  assert.ok(captured instanceof Error, 'expected operation to throw');
  return captured.code;
}

test('initializes a canonical mode-0600 journal with a fixed project ID and SHA-256 chain root', (t) => {
  const { journalPath } = makeLedger(t);
  const status = initialize(journalPath);

  assert.deepEqual(status, {
    currentState: 'PLANNED',
    eventCount: 1,
    ok: true,
    rolledBack: false,
  });
  assert.equal(lstatSync(journalPath).mode & 0o777, 0o600);

  const raw = readFileSync(journalPath, 'utf8');
  assert.ok(raw.endsWith('\n'));
  const [event] = readEvents(journalPath);
  assert.equal(raw, `${canonicalStringify(event)}\n`);
  assert.equal(event.eventType, EVENT_TYPES.STATE_ADVANCED);
  assert.equal(event.migrationId, MIGRATION_ID);
  assert.equal(event.previousHash, null);
  assert.equal(event.projectId, PROJECT_ID);
  assert.match(event.hash, /^[0-9a-f]{64}$/);
  assert.equal(captureCode(() => initialize(journalPath)), 'JOURNAL_EXISTS');
});

test('generic CLI cannot advance into source freeze or any later cutover state', (t) => {
  const { journalPath } = makeLedger(t);
  initialize(journalPath);
  advanceThrough(journalPath, 'RESTORE_DRILL_PASSED');
  assert.equal(
    captureCode(() =>
      runLedgerCli([
        'advance',
        '--journal',
        journalPath,
        '--state',
        'SOURCE_FROZEN',
        '--evidence-json',
        JSON.stringify(evidenceFor('SOURCE_FROZEN')),
      ]),
    ),
    'DEDICATED_OPERATOR_REQUIRED',
  );
  assert.equal(verifyLedger({ journalPath }).currentState, 'RESTORE_DRILL_PASSED');
});

test('allows every normal state exactly once and only in the required order', (t) => {
  const { journalPath } = makeLedger(t);
  initialize(journalPath);
  advanceThrough(journalPath, 'FINALIZED');

  assert.deepEqual(verifyLedger({ journalPath }), {
    currentState: 'FINALIZED',
    eventCount: NORMAL_STATES.length,
    ok: true,
    rolledBack: false,
  });
  assert.deepEqual(
    readEvents(journalPath).map((event) => event.state),
    NORMAL_STATES,
  );
  assert.equal(
    captureCode(() =>
      advanceLedger({
        evidence: evidenceFor('FINALIZED'),
        journalPath,
        now: timeAt(20),
        targetState: 'FINALIZED',
      }),
    ),
    'INVALID_STATE_TRANSITION',
  );
});

test('rejects duplicate, backward, and skipped transitions without appending', (t) => {
  const { journalPath } = makeLedger(t);
  initialize(journalPath);
  const initial = readFileSync(journalPath);

  for (const targetState of ['PLANNED', 'ARTIFACTS_VERIFIED', 'FINALIZED']) {
    assert.equal(
      captureCode(() =>
        advanceLedger({
          evidence: evidenceFor(targetState),
          journalPath,
          now: timeAt(1),
          targetState,
        }),
      ),
      'INVALID_STATE_TRANSITION',
    );
    assert.deepEqual(readFileSync(journalPath), initial);
  }

  advanceLedger({
    evidence: evidenceFor('STAGED'),
    journalPath,
    now: timeAt(1),
    targetState: 'STAGED',
  });
  const staged = readFileSync(journalPath);
  assert.equal(
    captureCode(() =>
      advanceLedger({
        evidence: evidenceFor('PLANNED'),
        journalPath,
        now: timeAt(2),
        targetState: 'PLANNED',
      }),
    ),
    'INVALID_STATE_TRANSITION',
  );
  assert.deepEqual(readFileSync(journalPath), staged);
});

test('enforces the exact secret-free evidence allowlist and value types for every state', (t) => {
  const { journalPath } = makeLedger(t);
  initialize(journalPath);
  const valid = evidenceFor('STAGED');
  const candidates = [
    { releaseManifestDigest: valid.releaseManifestDigest },
    { ...valid, unexpectedValue: digest('not-allowed') },
    { ...valid, composeConfigDigest: 'A'.repeat(64) },
    { ...valid, releaseManifestDigest: '/private/path/to/manifest' },
  ];

  for (const evidence of candidates) {
    assert.equal(
      captureCode(() =>
        advanceLedger({
          evidence,
          journalPath,
          now: timeAt(1),
          targetState: 'STAGED',
        }),
      ),
      'INVALID_EVIDENCE',
    );
  }
  assert.equal(verifyLedger({ journalPath }).eventCount, 1);
});

test('detects non-canonical JSONL, content tampering, and hash-chain tampering', (t) => {
  const first = makeLedger(t);
  initialize(first.journalPath);
  const [firstEvent] = readEvents(first.journalPath);
  const reversedEvent = Object.fromEntries(Object.entries(firstEvent).reverse());
  writeFileSync(first.journalPath, `${JSON.stringify(reversedEvent)}\n`);
  assert.equal(captureCode(() => verifyLedger({ journalPath: first.journalPath })), 'NON_CANONICAL_EVENT');

  const second = makeLedger(t);
  initialize(second.journalPath);
  const [tampered] = readEvents(second.journalPath);
  tampered.evidence.planDigest = digest('tampered');
  writeFileSync(second.journalPath, `${canonicalStringify(tampered)}\n`);
  assert.equal(captureCode(() => verifyLedger({ journalPath: second.journalPath })), 'HASH_MISMATCH');

  const third = makeLedger(t);
  initialize(third.journalPath);
  advanceThrough(third.journalPath, 'STAGED');
  const events = readEvents(third.journalPath);
  events[1].previousHash = digest('wrong-parent');
  writeFileSync(third.journalPath, `${events.map(canonicalStringify).join('\n')}\n`);
  assert.equal(captureCode(() => verifyLedger({ journalPath: third.journalPath })), 'HASH_CHAIN_BROKEN');
});

test('rejects non-0600 journals, journal symlinks, and an existing exclusive lock', (t) => {
  const modeFixture = makeLedger(t);
  initialize(modeFixture.journalPath);
  chmodSync(modeFixture.journalPath, 0o640);
  assert.equal(
    captureCode(() => verifyLedger({ journalPath: modeFixture.journalPath })),
    'INVALID_JOURNAL_MODE',
  );

  const symlinkFixture = makeLedger(t);
  initialize(symlinkFixture.journalPath);
  const linkPath = join(symlinkFixture.directory, 'linked.jsonl');
  symlinkSync(symlinkFixture.journalPath, linkPath);
  assert.equal(captureCode(() => verifyLedger({ journalPath: linkPath })), 'INVALID_JOURNAL_FILE');

  const lockFixture = makeLedger(t);
  initialize(lockFixture.journalPath);
  writeFileSync(`${lockFixture.journalPath}.lock`, 'held\n', { mode: 0o600 });
  const before = readFileSync(lockFixture.journalPath);
  assert.equal(
    captureCode(() =>
      advanceLedger({
        evidence: evidenceFor('STAGED'),
        journalPath: lockFixture.journalPath,
        now: timeAt(1),
        targetState: 'STAGED',
      }),
    ),
    'LOCK_HELD',
  );
  assert.deepEqual(readFileSync(lockFixture.journalPath), before);
});

test('records post-freeze failure and a pre-write rollback without changing or bypassing state', (t) => {
  const { journalPath } = makeLedger(t);
  initialize(journalPath);
  const earlyFailure = {
    failedState: 'SOURCE_FROZEN',
    failureClass: 'HEALTH',
    failureReportDigest: digest('early-failure'),
  };
  assert.equal(
    captureCode(() => recordFailure({ evidence: earlyFailure, journalPath, now: timeAt(1) })),
    'FAILURE_EVENT_TOO_EARLY',
  );

  advanceThrough(journalPath, 'SOURCE_FROZEN');
  const failure = {
    failedState: 'DESTINATION_RESTORED',
    failureClass: 'DATABASE',
    failureReportDigest: digest('restore-failure'),
  };
  const rollback = {
    dataLossAccepted: false,
    destinationWritesDisabled: true,
    rollbackMode: 'PRE_DESTINATION_WRITES',
    rollbackReportDigest: digest('rollback'),
    sourceRecoveryVerified: true,
  };
  assert.equal(
    captureCode(() => recordRollback({ evidence: rollback, journalPath, now: timeAt(5) })),
    'ROLLBACK_REQUIRES_FAILURE',
  );

  const failedStatus = recordFailure({ evidence: failure, journalPath, now: timeAt(5) });
  assert.equal(failedStatus.currentState, 'SOURCE_FROZEN');
  assert.equal(captureCode(() => recordFailure({ evidence: failure, journalPath, now: timeAt(6) })), 'DUPLICATE_EVENT');

  const rolledBack = recordRollback({ evidence: rollback, journalPath, now: timeAt(6) });
  assert.equal(rolledBack.currentState, 'SOURCE_FROZEN');
  assert.equal(rolledBack.rolledBack, true);
  assert.deepEqual(
    readEvents(journalPath).slice(-2).map((event) => event.eventType),
    [EVENT_TYPES.FAILURE_RECORDED, EVENT_TYPES.ROLLBACK_RECORDED],
  );
  assert.equal(
    captureCode(() =>
      advanceLedger({
        evidence: evidenceFor('DESTINATION_RESTORED'),
        journalPath,
        now: timeAt(7),
        targetState: 'DESTINATION_RESTORED',
      }),
    ),
    'MIGRATION_ROLLED_BACK',
  );
});

test('requires reconciliation evidence when rollback follows cutover commit', (t) => {
  const { journalPath } = makeLedger(t);
  initialize(journalPath);
  advanceThrough(journalPath, 'CUTOVER_COMMITTED');
  recordFailure({
    evidence: {
      failedState: 'FINALIZED',
      failureClass: 'CUTOVER',
      failureReportDigest: digest('post-cutover-failure'),
    },
    journalPath,
    now: timeAt(8),
  });

  const preWriteRollback = {
    dataLossAccepted: false,
    destinationWritesDisabled: true,
    rollbackMode: 'PRE_DESTINATION_WRITES',
    rollbackReportDigest: digest('unsafe-mode'),
    sourceRecoveryVerified: true,
  };
  assert.equal(
    captureCode(() => recordRollback({ evidence: preWriteRollback, journalPath, now: timeAt(9) })),
    'INVALID_EVIDENCE',
  );

  const status = recordRollback({
    evidence: {
      dataLossAccepted: false,
      destinationWritesDisabled: true,
      reconciliationReportDigest: digest('reconciliation'),
      rollbackMode: 'RECONCILED_TO_SOURCE',
      rollbackReportDigest: digest('safe-rollback'),
      sourceRecoveryVerified: true,
    },
    journalPath,
    now: timeAt(9),
  });
  assert.equal(status.currentState, 'CUTOVER_COMMITTED');
  assert.equal(status.rolledBack, true);
});

test('CLI output contains only boolean, event count, and current state fields', (t) => {
  const { journalPath } = makeLedger(t);
  const plannedEvidence = evidenceFor('PLANNED');
  const secretLookingPathFragment = journalPath.split('/').at(-2);
  const result = spawnSync(
    process.execPath,
    [
      SCRIPT_PATH,
      'init',
      '--journal',
      journalPath,
      '--evidence-json',
      JSON.stringify(plannedEvidence),
    ],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(output).sort(), ['currentState', 'eventCount', 'ok', 'rolledBack']);
  assert.deepEqual(output, {
    currentState: 'PLANNED',
    eventCount: 1,
    ok: true,
    rolledBack: false,
  });
  const generatedMigrationId = readEvents(journalPath)[0].migrationId;
  for (const forbidden of [
    PROJECT_ID,
    generatedMigrationId,
    plannedEvidence.planDigest,
    journalPath,
    secretLookingPathFragment,
  ]) {
    assert.equal(result.stdout.includes(forbidden), false);
  }

  const rejected = spawnSync(
    process.execPath,
    [SCRIPT_PATH, 'advance', '--journal', journalPath, '--state', 'STAGED', '--evidence-json', '{"secret":"do-not-echo"}'],
    { encoding: 'utf8' },
  );
  assert.equal(rejected.status, 1);
  assert.equal(rejected.stderr, '{"ok":false}\n');
  assert.equal(rejected.stdout, '');
  assert.equal(rejected.stderr.includes('do-not-echo'), false);
});
