import {
  MEDIA_EVIDENCE_SCHEMA_VERSION,
  MEDIA_PROJECT_ID,
  canonicalMediaJson,
  mediaCandidateIdentitySha256,
  mediaSha256,
} from './nas-media-contract.mjs';
import {
  MEDIA_BUNDLE_FORMAT,
  MEDIA_TRANSFER_SCHEMA_VERSION,
} from './nas-media-transfer-bundle.mjs';

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MIGRATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RELEASE_PATTERN = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const CANDIDATE_DATABASE_PATTERN = /^flowpack_candidate_[a-f0-9]{12}$/;
const REQUEST_ID_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

export class LiveMediaBindingError extends Error {
  constructor(code) {
    super(code);
    this.name = 'LiveMediaBindingError';
    this.code = code;
  }
}

function fail() {
  throw new LiveMediaBindingError('MEDIA_PREPARATION_EVIDENCE_INVALID');
}

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hash(value) {
  return typeof value === 'string' && HASH_PATTERN.test(value);
}

function positive(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function same(value, expected) {
  if (value !== expected) fail();
}

function validateExpected(expected) {
  if (
    !plain(expected) ||
    !CANDIDATE_DATABASE_PATTERN.test(expected.candidateDatabase ?? '') ||
    !MIGRATION_ID_PATTERN.test(expected.migrationId ?? '') ||
    !RELEASE_PATTERN.test(expected.releaseCommit ?? '') ||
    !hash(expected.remoteLockIdentitySha256) ||
    !hash(expected.sourceFreezeReceiptSha256) ||
    !plain(expected.sourceFrozenEvidence)
  ) {
    fail();
  }
  return Object.freeze({ ...expected });
}

export function bindMediaCandidatePreparationEvidence(raw = {}) {
  if (!plain(raw)) fail();
  const expected = validateExpected(raw.expected);
  const migrationIdSha256 = mediaSha256(expected.migrationId);
  const sourceInventorySha256 = mediaSha256(Buffer.from(
    `${canonicalMediaJson(expected.sourceFrozenEvidence)}\n`,
    'utf8',
  ));
  const candidateDatabaseNameSha256 = mediaSha256(expected.candidateDatabase);
  const candidateIdentitySha256 = mediaCandidateIdentitySha256({
    candidateDatabaseNameSha256,
    migrationId: expected.migrationId,
    projectId: MEDIA_PROJECT_ID,
    remoteLockIdentitySha256: expected.remoteLockIdentitySha256,
  });
  const {
    candidateAttestation,
    candidateRewrite,
    mediaPreparation,
    mediaSource,
    offsite,
    remoteReceive,
    sourceSnapshot,
    transfer,
    upload,
  } = raw;
  if ([
    candidateAttestation,
    candidateRewrite,
    mediaPreparation,
    mediaSource,
    offsite,
    remoteReceive,
    sourceSnapshot,
    transfer,
    upload,
  ].some((value) => !plain(value) || value.ok !== true)) {
    fail();
  }

  for (const value of [mediaSource, sourceSnapshot, transfer, offsite, upload, remoteReceive]) {
    same(value.remoteLockIdentitySha256, expected.remoteLockIdentitySha256);
    same(value.migrationIdSha256, migrationIdSha256);
  }
  same(candidateAttestation.remoteLockIdentitySha256, expected.remoteLockIdentitySha256);
  same(candidateAttestation.migrationIdSha256, migrationIdSha256);
  same(candidateRewrite.migrationIdSha256, migrationIdSha256);
  same(sourceSnapshot.attestationSha256, mediaSource.mediaSourceAttestationSha256);
  if (
    mediaSource.sameSnapshotMediaInventory !== true ||
    sourceSnapshot.sameSnapshotMediaInventory !== true ||
    mediaSource.sourceFreezeReceiptSha256 !== expected.sourceFreezeReceiptSha256 ||
    sourceSnapshot.sourceFreezeReceiptSha256 !== expected.sourceFreezeReceiptSha256 ||
    mediaSource.sourceInventorySha256 !== sourceInventorySha256 ||
    mediaSource.sourceObjectsSha256 !== expected.sourceFrozenEvidence.objectsSha256 ||
    mediaSource.sourceMediaRecordsSha256 !== sourceSnapshot.recordsSha256 ||
    mediaSource.sourceSnapshotEvidenceSha256 !==
      mediaSha256(canonicalMediaJson(sourceSnapshot)) ||
    mediaSource.sourceTransportProfileSha256 !==
      sourceSnapshot.sourceTransportProfileSha256 ||
    !hash(sourceSnapshot.recordsSha256) ||
    !positive(sourceSnapshot.rows?.total) ||
    [
      mediaSource.databaseBindingAttestationSha256,
      mediaSource.databaseEvidenceBundleSha256,
      mediaSource.databaseIdentitySha256,
      mediaSource.databaseSystemIdentitySha256,
      mediaSource.schemaScopeSha256,
      mediaSource.sourceFreezeReceiptSha256,
      mediaSource.sourceInventorySha256,
      mediaSource.sourceObjectsSha256,
      mediaSource.sourceSnapshotEvidenceSha256,
      mediaSource.sourceTransportProfileSha256,
    ].some((value) => !hash(value))
  ) fail();

  if (
    !plain(mediaPreparation.evidence) ||
    !plain(mediaPreparation.objects) ||
    !plain(mediaPreparation.rewrite) ||
    !hash(mediaPreparation.evidence.manifestSha256) ||
    !hash(mediaPreparation.artifactHandleSha256) ||
    !positive(mediaPreparation.objects.bytes) ||
    !positive(mediaPreparation.objects.staged) ||
    !positive(mediaPreparation.rewrite.operations) ||
    mediaPreparation.rewrite.transactional !== true ||
    mediaPreparation.rewrite.mutationPerformed !== false
  ) {
    fail();
  }

  const manifestSha256 = mediaPreparation.evidence.manifestSha256;
  same(transfer.mediaEvidenceManifestSha256, manifestSha256);
  same(offsite.mediaEvidenceManifestSha256, manifestSha256);
  same(remoteReceive.mediaEvidenceManifestSha256, manifestSha256);
  same(candidateRewrite.manifestSha256, manifestSha256);
  for (const value of [transfer, offsite, remoteReceive]) {
    same(value.releaseCommit, expected.releaseCommit);
  }
  same(offsite.bundleSha256, transfer.bundleSha256);
  same(upload.bundleSha256, transfer.bundleSha256);
  same(remoteReceive.bundleSha256, transfer.bundleSha256);
  same(offsite.transferManifestSha256, transfer.transferManifestSha256);
  same(upload.transferManifestSha256, transfer.transferManifestSha256);
  same(remoteReceive.transferManifestSha256, transfer.transferManifestSha256);
  same(upload.mediaEvidenceManifestSha256, manifestSha256);
  const transferCompletionReceiptSha256 = mediaSha256(Buffer.from(
    `${canonicalMediaJson({
      bundleBytes: transfer.bundleBytes,
      bundleSha256: transfer.bundleSha256,
      format: MEDIA_BUNDLE_FORMAT,
      mediaEvidenceManifestSha256: manifestSha256,
      migrationId: expected.migrationId,
      objectBytes: transfer.objectBytes,
      objects: transfer.objects,
      projectId: MEDIA_PROJECT_ID,
      releaseCommit: expected.releaseCommit,
      remoteLockIdentitySha256: expected.remoteLockIdentitySha256,
      schemaVersion: MEDIA_TRANSFER_SCHEMA_VERSION,
      state: 'complete',
      transferManifestSha256: transfer.transferManifestSha256,
    })}\n`,
    'utf8',
  ));
  if (
    !hash(transfer.bundleSha256) ||
    !hash(transfer.transferManifestSha256) ||
    !positive(transfer.bundleBytes) ||
    !positive(transfer.objects) ||
    !positive(transfer.objectBytes) ||
    transfer.objects !== mediaPreparation.objects.staged ||
    transfer.objectBytes !== mediaPreparation.objects.bytes ||
    offsite.readbackVerified !== true ||
    !hash(offsite.encryptedSha256) ||
    upload.state !== 'gateway-media-received' ||
    upload.bundleBytes !== transfer.bundleBytes ||
    upload.payloadBytes !== transfer.bundleBytes ||
    upload.payloadSha256 !== transfer.bundleSha256 ||
    upload.completionReceiptSha256 !== transferCompletionReceiptSha256 ||
    !hash(upload.uploadReceiptSha256) ||
    !hash(upload.gatewayActionSetSha256) ||
    !hash(upload.gatewayArtifactSha256) ||
    !hash(upload.gatewayHelperSha256) ||
    !hash(upload.gatewayPolicySha256) ||
    !hash(upload.gatewayPreflightReceiptSha256) ||
    !hash(upload.gatewayProtocolSha256) ||
    !hash(upload.gatewayReceiveReceiptSha256) ||
    !REQUEST_ID_PATTERN.test(upload.gatewayReceiveRequestId ?? '') ||
    !positive(upload.gatewayObjectCount) ||
    typeof upload.gatewayReused !== 'boolean' ||
    remoteReceive.state !== 'candidate-complete' ||
    !hash(remoteReceive.completionReceiptSha256) ||
    !hash(remoteReceive.candidateVerificationSha256) ||
    remoteReceive.filesVerified !== transfer.objects ||
    remoteReceive.objectBytes !== transfer.objectBytes ||
    upload.gatewayObjectCount !== remoteReceive.filesVerified ||
    upload.gatewayArtifactSha256 !== remoteReceive.completionReceiptSha256
  ) {
    fail();
  }

  if (
    candidateAttestation.candidateDatabaseNameSha256 !== candidateDatabaseNameSha256 ||
    candidateAttestation.candidateIdentitySha256 !== candidateIdentitySha256 ||
    !hash(candidateAttestation.attestationSha256) ||
    candidateRewrite.mode !== 'apply-candidate' ||
    !hash(candidateRewrite.executionDigest) ||
    !hash(candidateRewrite.receiptSha256) ||
    candidateRewrite.postWriteRollbackAllowed !== false ||
    candidateRewrite.operationsVerified !== mediaPreparation.rewrite.operations ||
    candidateRewrite.objectsVerified !== transfer.objects ||
    candidateRewrite.objectBytes !== transfer.objectBytes
  ) {
    fail();
  }

  return Object.freeze({
    artifactHandleSha256: mediaPreparation.artifactHandleSha256,
    bundleSha256: transfer.bundleSha256,
    candidateAttestationSha256: candidateAttestation.attestationSha256,
    candidateDatabaseNameSha256,
    candidateIdentitySha256,
    candidateRewriteExecutionDigest: candidateRewrite.executionDigest,
    candidateRewriteOperationsVerified: candidateRewrite.operationsVerified,
    candidateRewriteReceiptSha256: candidateRewrite.receiptSha256,
    candidateVerificationSha256: remoteReceive.candidateVerificationSha256,
    completionReceiptSha256: remoteReceive.completionReceiptSha256,
    databaseBindingAttestationSha256: mediaSource.databaseBindingAttestationSha256,
    databaseEvidenceBundleSha256: mediaSource.databaseEvidenceBundleSha256,
    databaseIdentitySha256: mediaSource.databaseIdentitySha256,
    databaseSystemIdentitySha256: mediaSource.databaseSystemIdentitySha256,
    evidenceSchemaVersion: MEDIA_EVIDENCE_SCHEMA_VERSION,
    mediaEvidenceManifestSha256: manifestSha256,
    offsiteAuthenticatedReadback: true,
    offsiteEncryptedSha256: offsite.encryptedSha256,
    offsiteFsyncCompleted: true,
    offsiteReadbackBundleSha256: transfer.bundleSha256,
    offsiteSeparateDevice: true,
    ok: true,
    remoteCandidateVerified: true,
    remoteLockIdentitySha256: expected.remoteLockIdentitySha256,
    schemaScopeSha256: mediaSource.schemaScopeSha256,
    sourceFreezeReceiptSha256: mediaSource.sourceFreezeReceiptSha256,
    sourceInventorySha256: mediaSource.sourceInventorySha256,
    sourceMediaRecordsSha256: sourceSnapshot.recordsSha256,
    sourceObjectsSha256: mediaSource.sourceObjectsSha256,
    sourceSnapshotEvidenceSha256: mediaSource.sourceSnapshotEvidenceSha256,
    sourceTransportProfileSha256: mediaSource.sourceTransportProfileSha256,
    gatewayActionSetSha256: upload.gatewayActionSetSha256,
    gatewayArtifactSha256: upload.gatewayArtifactSha256,
    gatewayHelperSha256: upload.gatewayHelperSha256,
    gatewayObjectCount: upload.gatewayObjectCount,
    gatewayPolicySha256: upload.gatewayPolicySha256,
    gatewayPreflightReceiptSha256: upload.gatewayPreflightReceiptSha256,
    gatewayProtocolSha256: upload.gatewayProtocolSha256,
    gatewayReceiveReceiptSha256: upload.gatewayReceiveReceiptSha256,
    gatewayReceiveRequestId: upload.gatewayReceiveRequestId,
    gatewayReused: upload.gatewayReused,
    gatewayUploadReceiptSha256: upload.uploadReceiptSha256,
    gatewayUploadCompletionReceiptSha256: upload.completionReceiptSha256,
    transferManifestSha256: transfer.transferManifestSha256,
  });
}
