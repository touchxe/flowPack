import { randomBytes } from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  linkSync,
  lstatSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import {
  MEDIA_BUNDLE_FORMAT,
  MEDIA_TRANSFER_SCHEMA_VERSION,
} from './nas-media-transfer-bundle.mjs';
import {
  MEDIA_PROJECT_ID,
  canonicalMediaJson,
  mediaSha256,
} from './nas-media-contract.mjs';
import {
  GATEWAY_PROJECT_ID,
  invokeRestrictedGateway,
  preflightRestrictedGateway,
  readRestrictedGatewayProfile,
} from './nas-restricted-gateway-client.mjs';

const FILE_MODE = 0o600;
const DIRECTORY_MODE = 0o700;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MIGRATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RELEASE_PATTERN = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const MAX_JSON_BYTES = 64 * 1024;
const MAX_BUNDLE_BYTES = 1024 ** 4 + 128 * 1024 * 1024;

const COMPLETION_KEYS = Object.freeze([
  'bundleBytes',
  'bundleSha256',
  'format',
  'mediaEvidenceManifestSha256',
  'migrationId',
  'objectBytes',
  'objects',
  'projectId',
  'releaseCommit',
  'remoteLockIdentitySha256',
  'schemaVersion',
  'state',
  'transferManifestSha256',
]);
const RECEIPT_KEYS = Object.freeze([
  'bundleBytes',
  'bundleSha256',
  'completionReceiptSha256',
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
  'mediaEvidenceManifestSha256',
  'migrationIdSha256',
  'payloadBytes',
  'payloadSha256',
  'projectId',
  'releaseCommit',
  'remoteLockIdentitySha256',
  'schemaVersion',
  'state',
  'transferManifestSha256',
]);

export class MediaSshUploadError extends Error {
  constructor(code) {
    super(code);
    this.name = 'MediaSshUploadError';
    this.code = code;
  }
}

function fail(code) {
  throw new MediaSshUploadError(code);
}

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, expected) {
  return plain(value) &&
    Object.keys(value).sort().join('\n') === [...expected].sort().join('\n');
}

function assertAbsolute(path, code) {
  if (
    typeof path !== 'string' ||
    !isAbsolute(path) ||
    resolve(path) !== path ||
    path.includes('\0')
  ) fail(code);
}

function assertPrivateDirectory(path, code) {
  assertAbsolute(path, code);
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

function assertPrivateFile(path, code, maximumBytes = MAX_JSON_BYTES) {
  assertAbsolute(path, code);
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
  ) fail(code);
  return info;
}

function readCanonicalPrivate(path, code) {
  const initial = assertPrivateFile(path, code);
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch {
    fail(code);
  }
  const final = assertPrivateFile(path, code);
  if (
    final.dev !== initial.dev ||
    final.ino !== initial.ino ||
    final.nlink !== 1 ||
    final.size !== initial.size
  ) fail(code);
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(code);
  }
  if (!bytes.equals(Buffer.from(`${canonicalMediaJson(value)}\n`, 'utf8'))) fail(code);
  return Object.freeze({ bytes, value });
}

function validateCompletion(value) {
  if (
    !exactKeys(value, COMPLETION_KEYS) ||
    value.schemaVersion !== MEDIA_TRANSFER_SCHEMA_VERSION ||
    value.projectId !== MEDIA_PROJECT_ID ||
    value.format !== MEDIA_BUNDLE_FORMAT ||
    value.state !== 'complete' ||
    !MIGRATION_ID_PATTERN.test(value.migrationId ?? '') ||
    !RELEASE_PATTERN.test(value.releaseCommit ?? '') ||
    !HASH_PATTERN.test(value.bundleSha256 ?? '') ||
    !HASH_PATTERN.test(value.mediaEvidenceManifestSha256 ?? '') ||
    !HASH_PATTERN.test(value.remoteLockIdentitySha256 ?? '') ||
    !HASH_PATTERN.test(value.transferManifestSha256 ?? '') ||
    !Number.isSafeInteger(value.bundleBytes) ||
    value.bundleBytes <= 0 ||
    value.bundleBytes > MAX_BUNDLE_BYTES ||
    !Number.isSafeInteger(value.objects) ||
    value.objects <= 0 ||
    !Number.isSafeInteger(value.objectBytes) ||
    value.objectBytes <= 0
  ) fail('UPLOAD_COMPLETION_RECEIPT_INVALID');
  return Object.freeze({ ...value });
}

function digestUuidV4(value) {
  const hex = mediaSha256(canonicalMediaJson(value)).slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = '8';
  return [
    hex.slice(0, 8).join(''),
    hex.slice(8, 12).join(''),
    hex.slice(12, 16).join(''),
    hex.slice(16, 20).join(''),
    hex.slice(20).join(''),
  ].join('-');
}

function receiveRequestId(completion, completionReceiptSha256, preflightReceiptSha256) {
  return digestUuidV4({
    action: 'media.receive',
    bundleBytes: completion.bundleBytes,
    bundleSha256: completion.bundleSha256,
    completionReceiptSha256,
    mediaEvidenceManifestSha256: completion.mediaEvidenceManifestSha256,
    migrationId: completion.migrationId,
    preflightReceiptSha256,
    projectId: GATEWAY_PROJECT_ID,
    releaseCommit: completion.releaseCommit,
    remoteLockIdentitySha256: completion.remoteLockIdentitySha256,
    transferManifestSha256: completion.transferManifestSha256,
  });
}

function makeReceipt({ completion, completionReceiptSha256, gateway, preflight }) {
  if (
    gateway.evidence.payloadBytes !== completion.bundleBytes ||
    gateway.evidence.objectCount !== completion.objects ||
    typeof gateway.evidence.reused !== 'boolean' ||
    !HASH_PATTERN.test(gateway.evidence.artifactSha256 ?? '')
  ) fail('GATEWAY_MEDIA_RECEIPT_INVALID');
  return Object.freeze({
    bundleBytes: completion.bundleBytes,
    bundleSha256: completion.bundleSha256,
    completionReceiptSha256,
    gatewayActionSetSha256: gateway.actionSetSha256,
    gatewayArtifactSha256: gateway.evidence.artifactSha256,
    gatewayHelperSha256: gateway.helperSha256,
    gatewayObjectCount: gateway.evidence.objectCount,
    gatewayPolicySha256: gateway.policySha256,
    gatewayPreflightReceiptSha256: preflight.receiptSha256,
    gatewayProtocolSha256: gateway.protocolSha256,
    gatewayReceiveReceiptSha256: gateway.receiptSha256,
    gatewayReceiveRequestId: gateway.requestId,
    gatewayReused: gateway.evidence.reused,
    mediaEvidenceManifestSha256: completion.mediaEvidenceManifestSha256,
    migrationIdSha256: mediaSha256(completion.migrationId),
    payloadBytes: completion.bundleBytes,
    payloadSha256: completion.bundleSha256,
    projectId: GATEWAY_PROJECT_ID,
    releaseCommit: completion.releaseCommit,
    remoteLockIdentitySha256: completion.remoteLockIdentitySha256,
    schemaVersion: 2,
    state: 'gateway-media-received',
    transferManifestSha256: completion.transferManifestSha256,
  });
}

function validateReceipt(value) {
  if (
    !exactKeys(value, RECEIPT_KEYS) ||
    value.schemaVersion !== 2 ||
    value.projectId !== GATEWAY_PROJECT_ID ||
    value.state !== 'gateway-media-received' ||
    !Number.isSafeInteger(value.bundleBytes) ||
    value.bundleBytes <= 0 ||
    value.payloadBytes !== value.bundleBytes ||
    value.payloadSha256 !== value.bundleSha256 ||
    !Number.isSafeInteger(value.gatewayObjectCount) ||
    value.gatewayObjectCount <= 0 ||
    typeof value.gatewayReused !== 'boolean' ||
    !RELEASE_PATTERN.test(value.releaseCommit ?? '') ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      value.gatewayReceiveRequestId ?? '',
    ) ||
    [
      value.bundleSha256,
      value.completionReceiptSha256,
      value.gatewayActionSetSha256,
      value.gatewayArtifactSha256,
      value.gatewayHelperSha256,
      value.gatewayPolicySha256,
      value.gatewayPreflightReceiptSha256,
      value.gatewayProtocolSha256,
      value.gatewayReceiveReceiptSha256,
      value.mediaEvidenceManifestSha256,
      value.migrationIdSha256,
      value.remoteLockIdentitySha256,
      value.transferManifestSha256,
    ].some((candidate) => !HASH_PATTERN.test(candidate ?? ''))
  ) fail('GATEWAY_MEDIA_LOCAL_RECEIPT_INVALID');
  return Object.freeze({ ...value });
}

function fsyncDirectory(path) {
  let descriptor;
  try {
    descriptor = openSync(path, constants.O_RDONLY);
    fsyncSync(descriptor);
  } catch {
    fail('GATEWAY_MEDIA_LOCAL_RECEIPT_WRITE_FAILED');
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function writeAll(descriptor, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const count = writeSync(descriptor, bytes, offset, bytes.length - offset);
    if (count <= 0) fail('GATEWAY_MEDIA_LOCAL_RECEIPT_WRITE_FAILED');
    offset += count;
  }
}

function writeReceipt(path, receipt) {
  assertAbsolute(path, 'GATEWAY_MEDIA_LOCAL_RECEIPT_INVALID');
  assertPrivateDirectory(dirname(path), 'GATEWAY_MEDIA_LOCAL_RECEIPT_INVALID');
  const bytes = Buffer.from(`${canonicalMediaJson(receipt)}\n`, 'utf8');
  const temporary = join(dirname(path), `.gateway-media.tmp-${randomBytes(16).toString('hex')}`);
  let descriptor;
  let temporaryCreated = false;
  try {
    descriptor = openSync(
      temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY |
        (constants.O_NOFOLLOW ?? 0),
      FILE_MODE,
    );
    temporaryCreated = true;
    writeAll(descriptor, bytes);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    linkSync(temporary, path);
    unlinkSync(temporary);
    temporaryCreated = false;
    fsyncDirectory(dirname(path));
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    if (temporaryCreated && existsSync(temporary)) unlinkSync(temporary);
    if (error instanceof MediaSshUploadError) throw error;
    if (existsSync(path)) {
      const existing = readCanonicalPrivate(path, 'GATEWAY_MEDIA_LOCAL_RECEIPT_COLLISION');
      if (existing.bytes.equals(bytes)) return mediaSha256(existing.bytes);
      fail('GATEWAY_MEDIA_LOCAL_RECEIPT_COLLISION');
    }
    fail('GATEWAY_MEDIA_LOCAL_RECEIPT_WRITE_FAILED');
  }
  const written = readCanonicalPrivate(path, 'GATEWAY_MEDIA_LOCAL_RECEIPT_WRITE_FAILED');
  if (!written.bytes.equals(bytes)) fail('GATEWAY_MEDIA_LOCAL_RECEIPT_WRITE_FAILED');
  return mediaSha256(written.bytes);
}

function publicResult(receipt, receiptSha256, localIdempotent) {
  return Object.freeze({
    ...receipt,
    localIdempotent,
    ok: true,
    uploadReceiptSha256: receiptSha256,
  });
}

export async function uploadMediaBundleViaRestrictedGateway({
  bundlePath,
  completionReceiptPath,
  processRunner,
  profileDirectory,
  uploadReceiptPath,
} = {}) {
  for (const path of [bundlePath, completionReceiptPath, profileDirectory, uploadReceiptPath]) {
    assertAbsolute(path, 'GATEWAY_MEDIA_INPUT_INVALID');
  }
  const profile = readRestrictedGatewayProfile(profileDirectory);
  const completionDocument = readCanonicalPrivate(
    completionReceiptPath,
    'UPLOAD_COMPLETION_RECEIPT_INVALID',
  );
  const completion = validateCompletion(completionDocument.value);
  const bundle = assertPrivateFile(bundlePath, 'UPLOAD_BUNDLE_INVALID', MAX_BUNDLE_BYTES);
  if (bundle.size !== completion.bundleBytes) fail('UPLOAD_BUNDLE_INVALID');

  if (existsSync(uploadReceiptPath)) {
    const existingDocument = readCanonicalPrivate(
      uploadReceiptPath,
      'GATEWAY_MEDIA_LOCAL_RECEIPT_COLLISION',
    );
    const existing = validateReceipt(existingDocument.value);
    if (
      existing.bundleSha256 !== completion.bundleSha256 ||
      existing.bundleBytes !== completion.bundleBytes ||
      existing.completionReceiptSha256 !== mediaSha256(completionDocument.bytes) ||
      existing.gatewayActionSetSha256 !== profile.actionSetSha256 ||
      existing.gatewayHelperSha256 !== profile.helperSha256 ||
      existing.gatewayPolicySha256 !== profile.policySha256 ||
      existing.gatewayProtocolSha256 !== profile.protocolSha256 ||
      existing.releaseCommit !== completion.releaseCommit ||
      existing.remoteLockIdentitySha256 !== completion.remoteLockIdentitySha256 ||
      existing.transferManifestSha256 !== completion.transferManifestSha256
    ) fail('GATEWAY_MEDIA_LOCAL_RECEIPT_COLLISION');
    return publicResult(existing, mediaSha256(existingDocument.bytes), true);
  }

  const preflight = await preflightRestrictedGateway({ processRunner, profileDirectory });
  const completionReceiptSha256 = mediaSha256(completionDocument.bytes);
  const requestId = receiveRequestId(
    completion,
    completionReceiptSha256,
    preflight.receiptSha256,
  );
  const gateway = await invokeRestrictedGateway({
    action: 'media.receive',
    migrationId: completion.migrationId,
    payloadPath: bundlePath,
    preflightReceiptSha256: preflight.receiptSha256,
    processRunner,
    profileDirectory,
    releaseCommit: completion.releaseCommit,
    requestId,
    tokenDigest: completion.remoteLockIdentitySha256,
  });
  const afterCompletion = readCanonicalPrivate(
    completionReceiptPath,
    'UPLOAD_COMPLETION_RECEIPT_CHANGED',
  );
  if (!afterCompletion.bytes.equals(completionDocument.bytes)) {
    fail('UPLOAD_COMPLETION_RECEIPT_CHANGED');
  }
  const receipt = makeReceipt({ completion, completionReceiptSha256, gateway, preflight });
  const receiptSha256 = writeReceipt(uploadReceiptPath, receipt);
  return publicResult(receipt, receiptSha256, false);
}

export async function uploadMediaBundleViaPinnedSsh() {
  fail('LEGACY_PINNED_SSH_UPLOAD_DISABLED');
}

export function decodeMediaUploadPrefix() {
  fail('LEGACY_MEDIA_UPLOAD_FRAME_DISABLED');
}
