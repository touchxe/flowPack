import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { canonicalStringify } from './nas-migration-ledger.mjs';
import {
  MEDIA_PROJECT_ID,
  canonicalMediaJson,
  mediaCandidateIdentitySha256,
  mediaSha256,
} from './nas-media-contract.mjs';
import {
  buildCandidateRestoreCommand,
  deriveLiveDatabaseNames,
  deriveRemoteMediaLockIdentity,
  expectedLiveConfirmation,
  parseLiveCutoverArguments,
  readLiveCutoverControl,
  runCli,
  runLiveCutoverPhase,
  validateCutoverApproval,
  validateSourceFreezeReceipt,
} from './nas-live-cutover.mjs';
import { readSeparateOffsiteProfile } from './nas-live-cutover-system.mjs';
import { RETAINED_PROVIDER_ENV_NAMES } from './nas-provider-manifest.mjs';

const PROJECT_ID = 'flowpack-nas';
const MIGRATION_ID = '11111111-2222-4333-8444-555555555555';
const RELEASE_COMMIT = 'a'.repeat(40);
const FIXED_NOW = '2026-08-24T03:04:05.000Z';
const PROVIDER_MANIFEST = Object.freeze({
  activeNames: [],
  disabledNames: RETAINED_PROVIDER_ENV_NAMES,
  migrationId: MIGRATION_ID,
  projectId: 'flowpack-v2',
  releaseCommit: RELEASE_COMMIT,
  schemaVersion: 1,
});
const PROVIDER_MANIFEST_SHA256 = mediaSha256(
  `${canonicalMediaJson(PROVIDER_MANIFEST)}\n`,
);

function privateDirectory(prefix) {
  const path = mkdtempSync(join(tmpdir(), prefix));
  chmodSync(path, 0o700);
  return path;
}

function writePrivate(path, value) {
  writeFileSync(path, value, { mode: 0o600 });
  chmodSync(path, 0o600);
}

function writeCanonicalPrivate(path, value) {
  writePrivate(path, `${canonicalStringify(value)}\n`);
}

function evidence(seed = '1') {
  return {
    schemaVersion: 1,
    database: { encoding: 'UTF8', collate: 'C.UTF-8', ctype: 'C.UTF-8' },
    schemas: ['public'],
    extensions: ['plpgsql'],
    objectsSha256: seed.repeat(64),
    tables: [{ name: 'public.Content', rowCount: 2, dataSha256: '2'.repeat(64) }],
    sequences: [],
    largeObjects: [],
  };
}

function fixture(t) {
  const root = privateDirectory('flowpack-live-cutover-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const workspacePath = join(root, 'workspace');
  const offsiteRoot = join(root, 'offsite');
  const restrictedGatewayProfilePath = join(root, 'gateway-profile');
  mkdirSync(workspacePath, { mode: 0o700 });
  mkdirSync(offsiteRoot, { mode: 0o700 });
  mkdirSync(restrictedGatewayProfilePath, { mode: 0o700 });
  const paths = {
    authSmokeInputPath: join(root, 'auth-smoke.json'),
    operatorEnvPath: join(root, 'operator.env'),
    providerManifestPath: join(root, 'retained-provider-manifest.json'),
    sourceConfigPath: join(root, 'source.env'),
    backupKeyPath: join(root, 'backup.key'),
    offsiteProfilePath: join(root, 'offsite.json'),
    journalPath: join(root, 'ledger.jsonl'),
    sourceFreezeReceiptPath: join(root, 'source-freeze.json'),
    sourceRecoveryReceiptPath: join(root, 'source-recovery.json'),
    cutoverApprovalPath: join(root, 'approval.json'),
  };
  for (const path of Object.values(paths)) writeCanonicalPrivate(path, {});
  writeCanonicalPrivate(paths.offsiteProfilePath, {
    schemaVersion: 1,
    profileId: 'external-device-primary',
    type: 'filesystem',
    root: offsiteRoot,
  });
  writeCanonicalPrivate(paths.providerManifestPath, PROVIDER_MANIFEST);
  const composePath = join(root, 'docker-compose.nas.yml');
  const migrationConfigPath = join(root, 'nas-migration.config.json');
  writeFileSync(
    composePath,
    'version: "2.4"\nservices:\n  db:\n    image: postgres:17.11-bookworm\n',
    { mode: 0o644 },
  );
  writeFileSync(migrationConfigPath, '{}\n', { mode: 0o644 });
  const control = {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    releaseCommit: RELEASE_COMMIT,
    composePath,
    migrationConfigPath,
    restrictedGatewayProfilePath,
    workspacePath,
    ...paths,
  };
  const controlPath = join(root, 'control.json');
  writeCanonicalPrivate(controlPath, control);
  return { root, offsiteRoot, control, controlPath };
}

function freezeReceipt(overrides = {}) {
  return {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    releaseCommit: RELEASE_COMMIT,
    recordedAt: FIXED_NOW,
    sourceWritesDisabled: true,
    sourceSchedulerDisabled: true,
    sourceCallbacksDisabled: true,
    sourceMediaWritesDisabled: true,
    sourcePaymentsDisabled: true,
    sourcePublishingDisabled: true,
    inFlightWrites: 0,
    unsafeHttpStatus: 503,
    healthHttpStatus: 200,
    providerActionDigest: '3'.repeat(64),
    providerManifestSha256: PROVIDER_MANIFEST_SHA256,
    ...overrides,
  };
}

function recoveryReceipt() {
  return {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    releaseCommit: RELEASE_COMMIT,
    recordedAt: FIXED_NOW,
    sourceWritesEnabled: true,
    sourceSchedulerEnabled: true,
    sourceCallbacksEnabled: true,
    sourceMediaWritesEnabled: true,
    sourcePaymentsEnabled: true,
    sourcePublishingEnabled: true,
    healthHttpStatus: 200,
    providerActionDigest: '4'.repeat(64),
  };
}

function confirmation(control, phase) {
  return expectedLiveConfirmation(control, phase);
}

test('control, confirmations and restore command are exact and secret-free', (t) => {
  const f = fixture(t);
  assert.deepEqual(readLiveCutoverControl(f.controlPath), f.control);
  assert.deepEqual(parseLiveCutoverArguments([
    'cutover', 'status', '--control', f.controlPath,
  ]), { phase: 'status', controlPath: f.controlPath, confirmation: undefined });
  const confirm = confirmation(f.control, 'prepare-target');
  assert.deepEqual(parseLiveCutoverArguments([
    'cutover', 'prepare-target', '--control', f.controlPath, '--confirm', confirm,
  ]), { phase: 'prepare-target', controlPath: f.controlPath, confirmation: confirm });

  const names = deriveLiveDatabaseNames(MIGRATION_ID);
  assert.match(names.candidateDatabase, /^flowpack_candidate_[0-9a-f]{12}$/);
  assert.match(names.previousDatabase, /^flowpack_precutover_[0-9a-f]{12}$/);
  const remoteLockIdentity = deriveRemoteMediaLockIdentity({
    databaseNames: names,
    migrationId: MIGRATION_ID,
    releaseCommit: RELEASE_COMMIT,
    tokenDigest: 'f'.repeat(64),
  });
  assert.match(remoteLockIdentity, /^[0-9a-f]{64}$/);
  const restore = buildCandidateRestoreCommand({
    candidateDatabase: names.candidateDatabase,
    dumpPath: '/backups/final.dump',
  });
  for (const flag of ['--single-transaction', '--exit-on-error', '--no-owner', '--no-acl']) {
    assert.equal(restore.args.includes(flag), true);
  }
  assert.equal(JSON.stringify(restore).includes('postgresql://'), false);

  chmodSync(f.controlPath, 0o644);
  assert.throws(() => readLiveCutoverControl(f.controlPath), /LIVE_CONTROL_PRIVATE_FILE_REQUIRED/);
  chmodSync(f.controlPath, 0o600);
  const link = join(f.root, 'control-link.json');
  symlinkSync(f.controlPath, link);
  assert.throws(() => readLiveCutoverControl(link), /LIVE_CONTROL_PRIVATE_FILE_REQUIRED/);
});

test('executable mutation path remains stopped until media v2 transfer binding', async (t) => {
  const f = fixture(t);
  await assert.rejects(
    () => runCli([
      'cutover',
      'prepare-target',
      '--control',
      f.controlPath,
      '--confirm',
      confirmation(f.control, 'prepare-target'),
    ]),
    /FLOWPACK_MEDIA_SOURCE_HANDOFF_AND_PROMOTION_NOT_IMPLEMENTED/,
  );
});

test('offsite profile requires a distinct physical device and strict modes', (t) => {
  const f = fixture(t);
  assert.throws(
    () => readSeparateOffsiteProfile(
      f.control.offsiteProfilePath,
      f.control.workspacePath,
      { statPath: () => ({ dev: 101 }) },
    ),
    /OFFSITE_DEVICE_NOT_SEPARATE/,
  );
  const profile = readSeparateOffsiteProfile(
    f.control.offsiteProfilePath,
    f.control.workspacePath,
    { statPath: (path) => ({ dev: path === f.offsiteRoot ? 202 : 101 }) },
  );
  assert.equal(profile.root, f.offsiteRoot);
});

test('Flow-specific freeze receipt binds media, payments, publishing and callbacks', (t) => {
  const f = fixture(t);
  const receipt = freezeReceipt();
  const digest = validateSourceFreezeReceipt(receipt, f.control);
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.throws(
    () => validateSourceFreezeReceipt(
      { ...receipt, sourceMediaWritesDisabled: false },
      f.control,
    ),
    /SOURCE_FREEZE_RECEIPT_INVALID/,
  );
  const approval = {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    releaseCommit: RELEASE_COMMIT,
    approvedAt: FIXED_NOW,
    decision: 'ENABLE_DESTINATION_WRITES',
    sourceFreezeReceiptDigest: digest,
    destinationRestoreReportDigest: '5'.repeat(64),
    zeroWriteSmokeReportDigest: '6'.repeat(64),
  };
  assert.match(validateCutoverApproval(approval, approval), /^[0-9a-f]{64}$/);
});

function phaseHarness(f) {
  let remotePhase = 'UNLOCKED';
  let ledgerState = 'RESTORE_DRILL_PASSED';
  let ledgerEvents = 4;
  const calls = [];
  const sourceEvidence = evidence();
  const operations = {
    status: () => ({
      ok: true,
      phase: remotePhase,
      writesEnabled: ['WRITES_ENABLED_PENDING_LEDGER', 'COMMITTED', 'FINALIZED']
        .includes(remotePhase),
    }),
    acquireRemoteLock: () => {
      calls.push('acquireRemoteLock');
      remotePhase = 'LOCKED';
      return { ok: true, phase: 'LOCKED' };
    },
    advanceRemotePhase: ({ expectedPhase, targetPhase }) => {
      assert.equal(remotePhase, expectedPhase);
      calls.push(`advance:${expectedPhase}->${targetPhase}`);
      remotePhase = targetPhase;
      return { ok: true, phase: targetPhase };
    },
    prepareTarget: () => {
      calls.push('prepareTarget');
      return {
        ok: true,
        sentinelVerified: true,
        capacityVerified: true,
        candidateNameAvailable: true,
        previousNameAvailable: true,
        existingDatabase: true,
        existingBackupDumpDigest: '7'.repeat(64),
        existingBackupEncrypted: true,
        existingBackupOffsiteReadback: true,
        existingBackupSeparateDevice: true,
        existingBackupFsyncCompleted: true,
        existingBackupReportDigest: '8'.repeat(64),
      };
    },
    collectFrozenSourceEvidence: () => {
      calls.push('collectFrozenSourceEvidence');
      return structuredClone(sourceEvidence);
    },
    bindFinalDump: () => {
      calls.push('bindFinalDump');
      return {
        ok: true,
        sourceEvidenceBefore: structuredClone(sourceEvidence),
        sourceEvidenceAfter: structuredClone(sourceEvidence),
        dumpDigest: '9'.repeat(64),
        dumpListDigest: 'a'.repeat(64),
        finalManifestDigest: 'b'.repeat(64),
        finalOffsiteReadback: true,
        finalSeparateDevice: true,
        finalFsyncCompleted: true,
        remoteDumpStaged: true,
        schemaAllowlist: ['public'],
        prismaMigrationsExcluded: true,
      };
    },
    restoreCandidate: () => {
      calls.push('restoreCandidate');
      return {
        ok: true,
        singleTransaction: true,
        ownerAclStripped: true,
        schemaAllowlistVerified: true,
        prismaMigrationsAbsent: true,
      };
    },
    prepareMediaCandidate: (context) => {
      calls.push('prepareMediaCandidate');
      const remoteLockIdentitySha256 = deriveRemoteMediaLockIdentity({
        databaseNames: context.databaseNames,
        migrationId: context.control.migrationId,
        releaseCommit: context.control.releaseCommit,
        tokenDigest: context.tokenDigest,
      });
      const candidateDatabaseNameSha256 = mediaSha256(
        context.databaseNames.candidateDatabase,
      );
      return {
        artifactHandleSha256: '0'.repeat(64),
        ok: true,
        evidenceSchemaVersion: 2,
        sourceMediaRecordsSha256: '1'.repeat(64),
        mediaEvidenceManifestSha256: '2'.repeat(64),
        bundleSha256: '3'.repeat(64),
        transferManifestSha256: '4'.repeat(64),
        offsiteEncryptedSha256: '5'.repeat(64),
        offsiteReadbackBundleSha256: '3'.repeat(64),
        offsiteAuthenticatedReadback: true,
        offsiteSeparateDevice: true,
        offsiteFsyncCompleted: true,
        completionReceiptSha256: '6'.repeat(64),
        candidateVerificationSha256: '7'.repeat(64),
        remoteCandidateVerified: true,
        databaseBindingAttestationSha256: 'a'.repeat(64),
        databaseEvidenceBundleSha256: 'b'.repeat(64),
        databaseIdentitySha256: 'c'.repeat(64),
        databaseSystemIdentitySha256: 'd'.repeat(64),
        schemaScopeSha256: 'e'.repeat(64),
        sourceFreezeReceiptSha256: context.finalReport.sourceFreezeReceiptDigest,
        sourceInventorySha256: mediaSha256(Buffer.from(
          `${canonicalMediaJson(context.finalReport.sourceEvidence)}\n`,
          'utf8',
        )),
        sourceObjectsSha256: context.finalReport.sourceEvidence.objectsSha256,
        sourceSnapshotEvidenceSha256: 'f'.repeat(64),
        sourceTransportProfileSha256: '0'.repeat(64),
        gatewayActionSetSha256: '1'.repeat(64),
        gatewayArtifactSha256: '6'.repeat(64),
        gatewayHelperSha256: '2'.repeat(64),
        gatewayObjectCount: 3,
        gatewayPolicySha256: '3'.repeat(64),
        gatewayPreflightReceiptSha256: '4'.repeat(64),
        gatewayProtocolSha256: '5'.repeat(64),
        gatewayReceiveReceiptSha256: '6'.repeat(64),
        gatewayReceiveRequestId: '12345678-1234-4234-8234-123456789abc',
        gatewayReused: false,
        gatewayUploadCompletionReceiptSha256: '7'.repeat(64),
        gatewayUploadReceiptSha256: '8'.repeat(64),
        candidateAttestationSha256: '8'.repeat(64),
        candidateDatabaseNameSha256,
        candidateIdentitySha256: mediaCandidateIdentitySha256({
          candidateDatabaseNameSha256,
          migrationId: context.control.migrationId,
          projectId: MEDIA_PROJECT_ID,
          remoteLockIdentitySha256,
        }),
        remoteLockIdentitySha256,
        candidateRewriteExecutionDigest: '9'.repeat(64),
        candidateRewriteOperationsVerified: 3,
        candidateRewriteReceiptSha256: 'b'.repeat(64),
      };
    },
    promoteMediaCandidate: ({ preparation }) => {
      calls.push('promoteMediaCandidate');
      return {
        candidateRewriteReceiptSha256: 'b'.repeat(64),
        canonicalVerificationSha256: 'a'.repeat(64),
        gatewayActionSetSha256: preparation.gatewayActionSetSha256,
        gatewayHelperSha256: preparation.gatewayHelperSha256,
        gatewayObjectCount: 3,
        gatewayPolicySha256: preparation.gatewayPolicySha256,
        gatewayPreflightReceiptSha256: 'd'.repeat(64),
        gatewayPromotionArtifactSha256: 'a'.repeat(64),
        gatewayPromotionReceiptSha256: 'e'.repeat(64),
        gatewayPromotionRequestId: '87654321-4321-4321-8321-cba987654321',
        gatewayProtocolSha256: preparation.gatewayProtocolSha256,
        gatewayReused: false,
        ok: true,
        promotionMode: 'additive-content-addressed-before-database',
        canonicalObjectsVerified: true,
        mediaGenerationDigest: preparation.mediaGenerationDigest,
        promotionReceiptSha256: 'a'.repeat(64),
        remoteLockIdentitySha256: preparation.remoteLockIdentitySha256,
      };
    },
    collectDestinationEvidence: ({ database }) => {
      calls.push(`evidence:${database}`);
      return structuredClone(sourceEvidence);
    },
    stopDestinationClients: () => { calls.push('stopClients'); return { ok: true }; },
    renameCanonicalToPrevious: () => { calls.push('renamePrevious'); return { ok: true }; },
    renameCandidateToCanonical: () => { calls.push('promoteCandidate'); return { ok: true }; },
    bootstrapRolesAndAnalyze: () => ({
      ok: true,
      roleBootstrapApplied: true,
      analyzeCompleted: true,
      ownerRole: 'flowpack_owner',
      readOnlyRole: 'flowpack_app_ro',
      readWriteRole: 'flowpack_app_rw',
      schemaAllowlist: ['public'],
    }),
    startDestinationReadOnly: () => ({
      ok: true, accessRole: 'app_ro', writeMode: 'read-only', schedulerRunning: 0,
    }),
    smokeReadOnly: () => ({
      ok: true,
      accessRole: 'app_ro',
      writeMode: 'read-only',
      unsafeHttpStatus: 503,
      healthHttpStatus: 200,
      tailscaleHttpsVerified: true,
      credentialAuthSmokePassed: true,
      socialTokenDecryptSmokePassed: true,
      schedulerRunning: 0,
      destinationWritesObserved: false,
      writeProbeDenied: true,
      beforeEvidence: structuredClone(sourceEvidence),
      afterEvidence: structuredClone(sourceEvidence),
    }),
    rollbackPreWrite: ({ phase }) => {
      calls.push(`rollback:${phase}`);
      return {
        ok: true,
        destinationWritesDisabled: true,
        sourceRecoveryVerified: true,
        canonicalDatabaseRestored: true,
        mediaCanonicalGenerationSafe: true,
      };
    },
    finishRemoteRollback: () => {
      remotePhase = 'ROLLED_BACK';
      return { ok: true, phase: 'ROLLED_BACK', lockReleased: true };
    },
  };
  const dependencies = {
    now: () => FIXED_NOW,
    statPath: (path) => ({ dev: path === f.offsiteRoot ? 202 : 101 }),
    operations,
    verifyLedger: () => ({
      ok: true, currentState: ledgerState, eventCount: ledgerEvents, rolledBack: false,
    }),
    advanceLedger: ({ targetState }) => {
      calls.push(`ledger:${targetState}`);
      ledgerState = targetState;
      ledgerEvents += 1;
      return { ok: true, currentState: ledgerState, eventCount: ledgerEvents, rolledBack: false };
    },
    recordFailure: () => {
      ledgerEvents += 1;
      return { ok: true, currentState: ledgerState, eventCount: ledgerEvents, rolledBack: false };
    },
    recordRollback: () => {
      ledgerEvents += 1;
      return { ok: true, currentState: ledgerState, eventCount: ledgerEvents, rolledBack: true };
    },
  };
  return {
    calls,
    dependencies,
    operations,
    getRemote: () => remotePhase,
    setRemote: (value) => { remotePhase = value; },
    getLedger: () => ledgerState,
    setLedger: (value) => { ledgerState = value; },
  };
}

async function runPhase(f, h, phase) {
  return runLiveCutoverPhase({
    phase,
    controlPath: f.controlPath,
    confirmation: confirmation(f.control, phase),
  }, h.dependencies);
}

test('guarded phases reach read-only Tailscale smoke with app_ro and no scheduler', async (t) => {
  const f = fixture(t);
  writeCanonicalPrivate(f.control.sourceFreezeReceiptPath, freezeReceipt());
  const h = phaseHarness(f);
  for (const phase of [
    'prepare-target', 'freeze-source', 'bind-final', 'restore-destination', 'smoke-readonly',
  ]) {
    assert.equal((await runPhase(f, h, phase)).ok, true);
  }
  assert.equal(h.getRemote(), 'ZERO_WRITE_SMOKE_PASSED');
  assert.equal(h.getLedger(), 'ZERO_WRITE_SMOKE_PASSED');
  assert.equal(h.calls.includes('promoteCandidate'), true);
  assert.deepEqual(
    h.calls.filter((call) => [
      'prepareMediaCandidate',
      'promoteMediaCandidate',
      'stopClients',
      'renamePrevious',
      'promoteCandidate',
    ].includes(call)),
    [
      'prepareMediaCandidate',
      'promoteMediaCandidate',
      'stopClients',
      'renamePrevious',
      'promoteCandidate',
    ],
  );
  await assert.rejects(() => runPhase(f, h, 'commit'), /LIVE_WRITE_COMMIT_NOT_IMPLEMENTED/);
});

test('provider name-only manifest drift after source freeze blocks final binding', async (t) => {
  const f = fixture(t);
  writeCanonicalPrivate(f.control.sourceFreezeReceiptPath, freezeReceipt());
  const h = phaseHarness(f);
  await runPhase(f, h, 'prepare-target');
  await runPhase(f, h, 'freeze-source');
  writeCanonicalPrivate(f.control.providerManifestPath, {
    ...PROVIDER_MANIFEST,
    activeNames: ['OPENAI_API_KEY'],
    disabledNames: RETAINED_PROVIDER_ENV_NAMES.filter((name) => name !== 'OPENAI_API_KEY'),
  });
  await assert.rejects(
    () => runPhase(f, h, 'bind-final'),
    /RETAINED_PROVIDER_MANIFEST_CHANGED_AFTER_FREEZE/,
  );
});

test('zero-write smoke requires encrypted social-token continuity', async (t) => {
  const f = fixture(t);
  writeCanonicalPrivate(f.control.sourceFreezeReceiptPath, freezeReceipt());
  const h = phaseHarness(f);
  for (const phase of [
    'prepare-target', 'freeze-source', 'bind-final', 'restore-destination',
  ]) {
    await runPhase(f, h, phase);
  }
  const smoke = h.operations.smokeReadOnly;
  h.operations.smokeReadOnly = () => ({
    ...smoke(),
    socialTokenDecryptSmokePassed: false,
  });
  await assert.rejects(
    () => runPhase(f, h, 'smoke-readonly'),
    /ZERO_WRITE_SMOKE_FAILED/,
  );
  assert.equal(h.getRemote(), 'DESTINATION_READ_ONLY');
  assert.equal(h.getLedger(), 'DESTINATION_RESTORED');
});

test('invalid media evidence or missing canonical promotion cannot reach a database rename', async (t) => {
  const f = fixture(t);
  writeCanonicalPrivate(f.control.sourceFreezeReceiptPath, freezeReceipt());
  const h = phaseHarness(f);
  await runPhase(f, h, 'prepare-target');
  await runPhase(f, h, 'freeze-source');
  await runPhase(f, h, 'bind-final');

  const prepare = h.operations.prepareMediaCandidate;
  h.operations.prepareMediaCandidate = (context) => ({
    ...prepare(context),
    offsiteAuthenticatedReadback: false,
  });
  await assert.rejects(
    () => runPhase(f, h, 'restore-destination'),
    /MEDIA_CANDIDATE_PREPARATION_INVALID/,
  );
  assert.equal(h.calls.includes('stopClients'), false);
  assert.equal(h.calls.includes('renamePrevious'), false);

  h.operations.prepareMediaCandidate = prepare;
  h.operations.promoteMediaCandidate = () => {
    throw new Error('MEDIA_CANONICAL_PROMOTION_NOT_IMPLEMENTED');
  };
  await assert.rejects(
    () => runPhase(f, h, 'restore-destination'),
    /MEDIA_CANONICAL_PROMOTION_NOT_IMPLEMENTED/,
  );
  assert.equal(h.calls.includes('stopClients'), false);
  assert.equal(h.calls.includes('renamePrevious'), false);
});

test('candidate media rewrite and additive publication resume before any database rename', async (t) => {
  const f = fixture(t);
  writeCanonicalPrivate(f.control.sourceFreezeReceiptPath, freezeReceipt());
  const h = phaseHarness(f);
  await runPhase(f, h, 'prepare-target');
  await runPhase(f, h, 'freeze-source');
  await runPhase(f, h, 'bind-final');

  const realPrepare = h.operations.prepareMediaCandidate;
  let preparationCrash = true;
  h.operations.prepareMediaCandidate = (context) => {
    const result = realPrepare(context);
    if (preparationCrash) {
      preparationCrash = false;
      throw new Error('crash after candidate media rewrite');
    }
    return result;
  };
  await assert.rejects(
    () => runPhase(f, h, 'restore-destination'),
    /crash after candidate media rewrite/,
  );
  assert.equal(h.calls.includes('stopClients'), false);

  const realPromote = h.operations.promoteMediaCandidate;
  let promotionCrash = true;
  h.operations.promoteMediaCandidate = (context) => {
    const result = realPromote(context);
    if (promotionCrash) {
      promotionCrash = false;
      throw new Error('crash after additive media publication');
    }
    return result;
  };
  await assert.rejects(
    () => runPhase(f, h, 'restore-destination'),
    /crash after additive media publication/,
  );
  assert.equal(h.calls.includes('stopClients'), false);

  assert.equal((await runPhase(f, h, 'restore-destination')).status, 'DESTINATION_READ_ONLY');
  assert.equal(h.calls.filter((call) => call === 'prepareMediaCandidate').length, 2);
  assert.equal(h.calls.filter((call) => call === 'promoteMediaCandidate').length, 2);
  const stopIndex = h.calls.indexOf('stopClients');
  assert.equal(stopIndex > h.calls.lastIndexOf('promoteMediaCandidate'), true);
});

test('public-only allowlist rejects Supabase managed schemas and Prisma baseline evidence', async (t) => {
  const f = fixture(t);
  writeCanonicalPrivate(f.control.sourceFreezeReceiptPath, freezeReceipt());
  const h = phaseHarness(f);
  await runPhase(f, h, 'prepare-target');
  h.operations.collectFrozenSourceEvidence = () => ({ ...evidence(), schemas: ['auth', 'public'] });
  await assert.rejects(() => runPhase(f, h, 'freeze-source'), /SOURCE_FROZEN_EVIDENCE_INVALID/);
  h.operations.collectFrozenSourceEvidence = () => ({
    ...evidence(),
    tables: [...evidence().tables, {
      name: 'public._prisma_migrations', rowCount: 1, dataSha256: 'f'.repeat(64),
    }],
  });
  await assert.rejects(() => runPhase(f, h, 'freeze-source'), /SOURCE_FROZEN_EVIDENCE_INVALID/);
});

test('report to remote-state and ledger crash windows resume without duplicate phase work', async (t) => {
  const f = fixture(t);
  writeCanonicalPrivate(f.control.sourceFreezeReceiptPath, freezeReceipt());
  const h = phaseHarness(f);
  let failTarget = 'TARGET_PREPARED';
  const realAdvance = h.operations.advanceRemotePhase;
  h.operations.advanceRemotePhase = (input) => {
    const result = realAdvance(input);
    if (input.targetPhase === failTarget) {
      failTarget = null;
      throw new Error('simulated crash after remote state write');
    }
    return result;
  };
  await assert.rejects(() => runPhase(f, h, 'prepare-target'), /simulated crash/);
  assert.equal((await runPhase(f, h, 'prepare-target')).status, 'TARGET_PREPARED');
  assert.equal(h.calls.filter((call) => call === 'prepareTarget').length, 1);

  failTarget = 'SOURCE_FROZEN';
  await assert.rejects(() => runPhase(f, h, 'freeze-source'), /simulated crash/);
  assert.equal((await runPhase(f, h, 'freeze-source')).status, 'SOURCE_FROZEN');
  assert.equal(h.calls.filter((call) => call === 'collectFrozenSourceEvidence').length, 1);

  failTarget = 'FINAL_BOUND';
  await assert.rejects(() => runPhase(f, h, 'bind-final'), /simulated crash/);
  assert.equal((await runPhase(f, h, 'bind-final')).status, 'FINAL_BOUND');
  assert.equal(h.calls.filter((call) => call === 'bindFinalDump').length, 1);
});

test('restore and smoke report/state/ledger crash windows resume by bound digest', async (t) => {
  const f = fixture(t);
  writeCanonicalPrivate(f.control.sourceFreezeReceiptPath, freezeReceipt());
  const h = phaseHarness(f);
  await runPhase(f, h, 'prepare-target');
  await runPhase(f, h, 'freeze-source');
  await runPhase(f, h, 'bind-final');

  const realAdvance = h.operations.advanceRemotePhase;
  let failTarget = 'DESTINATION_READ_ONLY';
  h.operations.advanceRemotePhase = (input) => {
    const result = realAdvance(input);
    if (input.targetPhase === failTarget) {
      failTarget = null;
      throw new Error('simulated crash after restore report state');
    }
    return result;
  };
  await assert.rejects(() => runPhase(f, h, 'restore-destination'), /simulated crash/);
  assert.equal((await runPhase(f, h, 'restore-destination')).status, 'DESTINATION_READ_ONLY');

  failTarget = 'ZERO_WRITE_SMOKE_PASSED';
  await assert.rejects(() => runPhase(f, h, 'smoke-readonly'), /simulated crash/);
  assert.equal((await runPhase(f, h, 'smoke-readonly')).status, 'ZERO_WRITE_SMOKE_PASSED');

  // A crash after the append fsync but before returning must not append twice.
  h.setRemote('DESTINATION_READ_ONLY');
  h.setLedger('DESTINATION_RESTORED');
  rmSync(join(f.control.workspacePath, 'live-cutover', 'zero-write-smoke-report.json'));
  const realLedgerAdvance = h.dependencies.advanceLedger;
  let ledgerCrash = true;
  h.dependencies.advanceLedger = (input) => {
    const result = realLedgerAdvance(input);
    if (input.targetState === 'ZERO_WRITE_SMOKE_PASSED' && ledgerCrash) {
      ledgerCrash = false;
      throw new Error('simulated crash after ledger fsync');
    }
    return result;
  };
  await assert.rejects(() => runPhase(f, h, 'smoke-readonly'), /simulated crash/);
  assert.equal((await runPhase(f, h, 'smoke-readonly')).status, 'ZERO_WRITE_SMOKE_PASSED');
});

for (const point of ['restoreCandidate', 'renamePrevious', 'promoteCandidate']) {
  test(`database mutation crash resumes idempotently at ${point}`, async (t) => {
    const f = fixture(t);
    writeCanonicalPrivate(f.control.sourceFreezeReceiptPath, freezeReceipt());
    const h = phaseHarness(f);
    await runPhase(f, h, 'prepare-target');
    await runPhase(f, h, 'freeze-source');
    await runPhase(f, h, 'bind-final');
    let crashed = false;
    const realAdvance = h.operations.advanceRemotePhase;
    h.operations.advanceRemotePhase = (input) => {
      const callForTarget = {
        CANDIDATE_RESTORED: 'restoreCandidate',
        LIVE_RENAMED: 'renamePrevious',
        CANDIDATE_PROMOTED: 'promoteCandidate',
      }[input.targetPhase];
      if (callForTarget === point && !crashed) {
        crashed = true;
        throw new Error('simulated crash before remote phase record');
      }
      return realAdvance(input);
    };
    await assert.rejects(() => runPhase(f, h, 'restore-destination'), /simulated crash/);
    assert.equal((await runPhase(f, h, 'restore-destination')).status, 'DESTINATION_READ_ONLY');
    assert.equal(h.calls.filter((call) => call === point).length, 2);
  });
}

test('remote SOURCE_FROZEN requires recovery receipt even when local ledger is older', async (t) => {
  const f = fixture(t);
  const h = phaseHarness(f);
  h.setRemote('SOURCE_FROZEN');
  h.setLedger('RESTORE_DRILL_PASSED');
  await assert.rejects(
    () => runPhase(f, h, 'pre-write-rollback'),
    /SOURCE_RECOVERY_RECEIPT_INVALID/,
  );
  assert.equal(h.calls.some((call) => call.startsWith('rollback:')), false);
  writeCanonicalPrivate(f.control.sourceRecoveryReceiptPath, recoveryReceipt());
  assert.equal((await runPhase(f, h, 'pre-write-rollback')).status, 'ROLLED_BACK');
});

test('public results never expose paths, URLs or secrets', async (t) => {
  const f = fixture(t);
  const h = phaseHarness(f);
  const result = await runPhase(f, h, 'prepare-target');
  const output = JSON.stringify(result);
  for (const value of [f.root, f.controlPath, 'postgresql://', 'private_password']) {
    assert.equal(output.includes(value), false);
  }
});
