import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MEDIA_PROJECT_ID,
  canonicalMediaJson,
  mediaCandidateIdentitySha256,
  mediaSha256,
} from './nas-media-contract.mjs';
import {
  MEDIA_BUNDLE_FORMAT,
  MEDIA_TRANSFER_SCHEMA_VERSION,
} from './nas-media-transfer-bundle.mjs';
import { bindMediaCandidatePreparationEvidence } from './nas-live-media-binding.mjs';

const MIGRATION_ID = '11111111-2222-4333-8444-555555555555';
const RELEASE_COMMIT = 'a'.repeat(40);
const REMOTE_LOCK = 'b'.repeat(64);
const CANDIDATE_DATABASE = 'flowpack_candidate_123456789abc';
const MANIFEST = 'c'.repeat(64);
const BUNDLE = 'd'.repeat(64);
const TRANSFER_MANIFEST = 'e'.repeat(64);
const SOURCE_FREEZE_RECEIPT = 'f'.repeat(64);

const FROZEN_SOURCE_EVIDENCE = Object.freeze({
  database: { collate: 'C.UTF-8', ctype: 'C.UTF-8', encoding: 'UTF8' },
  extensions: ['plpgsql'],
  largeObjects: [],
  objectsSha256: 'a'.repeat(64),
  schemaVersion: 1,
  schemas: ['public'],
  sequences: [],
  tables: [],
});

function fixture() {
  const candidateDatabaseNameSha256 = mediaSha256(CANDIDATE_DATABASE);
  const candidateIdentitySha256 = mediaCandidateIdentitySha256({
    candidateDatabaseNameSha256,
    migrationId: MIGRATION_ID,
    projectId: MEDIA_PROJECT_ID,
    remoteLockIdentitySha256: REMOTE_LOCK,
  });
  const sourceSnapshot = {
    ok: true,
    attestationSha256: '1'.repeat(64),
    databaseNameSha256: '9'.repeat(64),
    migrationIdSha256: mediaSha256(MIGRATION_ID),
    recordsSha256: '2'.repeat(64),
    remoteLockIdentitySha256: REMOTE_LOCK,
    rows: { total: 4 },
    sameSnapshotMediaInventory: true,
    snapshot: 'repeatable-read-read-only',
    sourceFreezeReceiptSha256: SOURCE_FREEZE_RECEIPT,
    sourceTransportProfileSha256: '8'.repeat(64),
    textBytes: 200,
  };
  const transfer = {
    ok: true,
    bundleBytes: 512,
    bundleSha256: BUNDLE,
    mediaEvidenceManifestSha256: MANIFEST,
    migrationIdSha256: mediaSha256(MIGRATION_ID),
    objects: 3,
    objectBytes: 120,
    releaseCommit: RELEASE_COMMIT,
    remoteLockIdentitySha256: REMOTE_LOCK,
    transferManifestSha256: TRANSFER_MANIFEST,
    bundlePath: '/private/not-returned.bundle',
  };
  const completionReceiptSha256 = mediaSha256(Buffer.from(
    `${canonicalMediaJson({
      bundleBytes: transfer.bundleBytes,
      bundleSha256: transfer.bundleSha256,
      format: MEDIA_BUNDLE_FORMAT,
      mediaEvidenceManifestSha256: MANIFEST,
      migrationId: MIGRATION_ID,
      objectBytes: transfer.objectBytes,
      objects: transfer.objects,
      projectId: MEDIA_PROJECT_ID,
      releaseCommit: RELEASE_COMMIT,
      remoteLockIdentitySha256: REMOTE_LOCK,
      schemaVersion: MEDIA_TRANSFER_SCHEMA_VERSION,
      state: 'complete',
      transferManifestSha256: TRANSFER_MANIFEST,
    })}\n`,
    'utf8',
  ));
  return {
    expected: {
      candidateDatabase: CANDIDATE_DATABASE,
      migrationId: MIGRATION_ID,
      releaseCommit: RELEASE_COMMIT,
      remoteLockIdentitySha256: REMOTE_LOCK,
      sourceFreezeReceiptSha256: SOURCE_FREEZE_RECEIPT,
      sourceFrozenEvidence: FROZEN_SOURCE_EVIDENCE,
    },
    mediaSource: {
      ok: true,
      databaseBindingAttestationSha256: '7'.repeat(64),
      databaseEvidenceBundleSha256: '6'.repeat(64),
      databaseIdentitySha256: '5'.repeat(64),
      databaseSystemIdentitySha256: '4'.repeat(64),
      mediaSourceAttestationSha256: '1'.repeat(64),
      migrationIdSha256: mediaSha256(MIGRATION_ID),
      remoteLockIdentitySha256: REMOTE_LOCK,
      sameSnapshotMediaInventory: true,
      schemaScopeSha256: '3'.repeat(64),
      sourceFreezeReceiptSha256: SOURCE_FREEZE_RECEIPT,
      sourceInventorySha256: mediaSha256(
        Buffer.from(`${canonicalMediaJson(FROZEN_SOURCE_EVIDENCE)}\n`, 'utf8'),
      ),
      sourceMediaRecordsSha256: sourceSnapshot.recordsSha256,
      sourceObjectsSha256: FROZEN_SOURCE_EVIDENCE.objectsSha256,
      sourceSnapshotEvidenceSha256: mediaSha256(canonicalMediaJson(sourceSnapshot)),
      sourceTransportProfileSha256: sourceSnapshot.sourceTransportProfileSha256,
    },
    sourceSnapshot,
    mediaPreparation: {
      ok: true,
      artifactHandleSha256: 'b'.repeat(64),
      evidence: { manifestSha256: MANIFEST },
      objects: { bytes: 120, staged: 3 },
      rewrite: { operations: 4, transactional: true, mutationPerformed: false },
    },
    transfer,
    offsite: {
      ok: true,
      bundleSha256: BUNDLE,
      encryptedSha256: '3'.repeat(64),
      mediaEvidenceManifestSha256: MANIFEST,
      migrationIdSha256: mediaSha256(MIGRATION_ID),
      readbackVerified: true,
      releaseCommit: RELEASE_COMMIT,
      remoteLockIdentitySha256: REMOTE_LOCK,
      transferManifestSha256: TRANSFER_MANIFEST,
      encryptedBundlePath: '/offsite/not-returned.enc',
    },
    upload: {
      ok: true,
      bundleBytes: transfer.bundleBytes,
      bundleSha256: BUNDLE,
      completionReceiptSha256,
      gatewayActionSetSha256: '6'.repeat(64),
      gatewayArtifactSha256: '5'.repeat(64),
      gatewayHelperSha256: '7'.repeat(64),
      gatewayObjectCount: 3,
      gatewayPolicySha256: '8'.repeat(64),
      gatewayPreflightReceiptSha256: '9'.repeat(64),
      gatewayProtocolSha256: '0'.repeat(64),
      gatewayReceiveReceiptSha256: '1'.repeat(64),
      gatewayReceiveRequestId: '12345678-1234-4234-8234-123456789abc',
      gatewayReused: false,
      localIdempotent: false,
      mediaEvidenceManifestSha256: MANIFEST,
      migrationIdSha256: mediaSha256(MIGRATION_ID),
      payloadBytes: transfer.bundleBytes,
      payloadSha256: BUNDLE,
      projectId: 'flowpack-v2',
      releaseCommit: RELEASE_COMMIT,
      remoteLockIdentitySha256: REMOTE_LOCK,
      schemaVersion: 2,
      state: 'gateway-media-received',
      transferManifestSha256: TRANSFER_MANIFEST,
      uploadReceiptSha256: 'a'.repeat(64),
    },
    remoteReceive: {
      ok: true,
      bundleSha256: BUNDLE,
      candidateVerificationSha256: '4'.repeat(64),
      completionReceiptSha256: '5'.repeat(64),
      filesVerified: 3,
      mediaEvidenceManifestSha256: MANIFEST,
      migrationIdSha256: mediaSha256(MIGRATION_ID),
      objectBytes: 120,
      releaseCommit: RELEASE_COMMIT,
      remoteLockIdentitySha256: REMOTE_LOCK,
      state: 'candidate-complete',
      transferManifestSha256: TRANSFER_MANIFEST,
    },
    candidateAttestation: {
      ok: true,
      attestationSha256: '6'.repeat(64),
      candidateDatabaseNameSha256,
      candidateIdentitySha256,
      migrationIdSha256: mediaSha256(MIGRATION_ID),
      remoteLockIdentitySha256: REMOTE_LOCK,
    },
    candidateRewrite: {
      ok: true,
      mode: 'apply-candidate',
      executionDigest: '7'.repeat(64),
      manifestSha256: MANIFEST,
      migrationIdSha256: mediaSha256(MIGRATION_ID),
      objectBytes: 120,
      objectsVerified: 3,
      operationsVerified: 4,
      postWriteRollbackAllowed: false,
      receiptSha256: '8'.repeat(64),
    },
  };
}

test('binds every source, offsite, remote, candidate-attestation and DB-CAS receipt', () => {
  const result = bindMediaCandidatePreparationEvidence(fixture());
  assert.equal(result.evidenceSchemaVersion, 2);
  assert.equal(result.offsiteAuthenticatedReadback, true);
  assert.equal(result.offsiteSeparateDevice, true);
  assert.equal(result.offsiteFsyncCompleted, true);
  assert.equal(result.remoteCandidateVerified, true);
  assert.equal(result.gatewayArtifactSha256, '5'.repeat(64));
  assert.equal(result.candidateRewriteOperationsVerified, 4);
  assert.equal(result.artifactHandleSha256, 'b'.repeat(64));
  assert.equal(result.gatewayActionSetSha256, '6'.repeat(64));
  assert.equal(result.completionReceiptSha256, '5'.repeat(64));
  assert.equal(result.candidateVerificationSha256, '4'.repeat(64));
  assert.equal(JSON.stringify(result).includes('/private/'), false);
  assert.equal(JSON.stringify(result).includes('/offsite/'), false);
});

for (const [name, mutate] of [
  ['offsite readback', (value) => { value.offsite.readbackVerified = false; }],
  ['remote completion', (value) => { value.remoteReceive.completionReceiptSha256 = 'invalid'; }],
  ['candidate verification', (value) => { value.remoteReceive.filesVerified = 2; }],
  ['candidate database', (value) => { value.candidateAttestation.candidateDatabaseNameSha256 = '0'.repeat(64); }],
  ['candidate DB CAS', (value) => { value.candidateRewrite.postWriteRollbackAllowed = true; }],
  ['remote lock', (value) => { value.transfer.remoteLockIdentitySha256 = '0'.repeat(64); }],
  ['gateway upload', (value) => { value.upload.payloadSha256 = '0'.repeat(64); }],
  ['source freeze', (value) => { value.mediaSource.sourceFreezeReceiptSha256 = '0'.repeat(64); }],
  ['same snapshot', (value) => { value.mediaSource.sameSnapshotMediaInventory = false; }],
  ['frozen DB evidence', (value) => { value.mediaSource.sourceInventorySha256 = '0'.repeat(64); }],
  ['source system identity', (value) => { value.mediaSource.databaseSystemIdentitySha256 = 'invalid'; }],
]) {
  test(`fails closed on a mismatched ${name} receipt`, () => {
    const value = fixture();
    mutate(value);
    assert.throws(
      () => bindMediaCandidatePreparationEvidence(value),
      /MEDIA_PREPARATION_EVIDENCE_INVALID/,
    );
  });
}
