import { canonicalMediaJson, mediaSha256 } from './nas-media-contract.mjs';
import {
  GATEWAY_PROJECT_ID,
  invokeRestrictedGateway,
  preflightRestrictedGateway,
} from './nas-restricted-gateway-client.mjs';

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MIGRATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RELEASE_PATTERN = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const INPUT_KEYS = Object.freeze([
  'candidateRewriteReceiptSha256',
  'completionReceiptSha256',
  'mediaGenerationDigest',
  'migrationId',
  'preparationReportDigest',
  'profileDirectory',
  'releaseCommit',
  'remoteLockIdentitySha256',
  'tokenDigest',
]);

export class MediaGatewayPromotionError extends Error {
  constructor(code) {
    super(code);
    this.name = 'MediaGatewayPromotionError';
    this.code = code;
  }
}

function fail(code) {
  throw new MediaGatewayPromotionError(code);
}

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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

function validateInput(input) {
  if (
    !plain(input) ||
    Object.keys(input).sort().join('\n') !== [...INPUT_KEYS].sort().join('\n') ||
    !MIGRATION_ID_PATTERN.test(input.migrationId ?? '') ||
    !RELEASE_PATTERN.test(input.releaseCommit ?? '') ||
    [
      input.candidateRewriteReceiptSha256,
      input.completionReceiptSha256,
      input.mediaGenerationDigest,
      input.preparationReportDigest,
      input.remoteLockIdentitySha256,
      input.tokenDigest,
    ].some((value) => !HASH_PATTERN.test(value ?? '')) ||
    typeof input.profileDirectory !== 'string'
  ) fail('MEDIA_GATEWAY_PROMOTION_INPUT_INVALID');
  return Object.freeze({ ...input });
}

export async function promoteMediaCandidateViaRestrictedGateway(rawInput, options = {}) {
  const input = validateInput(rawInput);
  if (!plain(options) || Object.keys(options).some((key) => key !== 'processRunner')) {
    fail('MEDIA_GATEWAY_PROMOTION_INPUT_INVALID');
  }
  const preflight = await preflightRestrictedGateway({
    processRunner: options.processRunner,
    profileDirectory: input.profileDirectory,
  });
  const requestId = digestUuidV4({
    action: 'media.promote',
    candidateRewriteReceiptSha256: input.candidateRewriteReceiptSha256,
    completionReceiptSha256: input.completionReceiptSha256,
    mediaGenerationDigest: input.mediaGenerationDigest,
    migrationId: input.migrationId,
    preflightReceiptSha256: preflight.receiptSha256,
    preparationReportDigest: input.preparationReportDigest,
    projectId: GATEWAY_PROJECT_ID,
    releaseCommit: input.releaseCommit,
    remoteLockIdentitySha256: input.remoteLockIdentitySha256,
  });
  const gateway = await invokeRestrictedGateway({
    action: 'media.promote',
    migrationId: input.migrationId,
    preflightReceiptSha256: preflight.receiptSha256,
    processRunner: options.processRunner,
    profileDirectory: input.profileDirectory,
    releaseCommit: input.releaseCommit,
    requestId,
    tokenDigest: input.tokenDigest,
  });
  if (
    !HASH_PATTERN.test(gateway.evidence.artifactSha256 ?? '') ||
    !Number.isSafeInteger(gateway.evidence.objectCount) ||
    gateway.evidence.objectCount <= 0 ||
    typeof gateway.evidence.reused !== 'boolean'
  ) fail('MEDIA_GATEWAY_PROMOTION_RECEIPT_INVALID');
  return Object.freeze({
    candidateRewriteReceiptSha256: input.candidateRewriteReceiptSha256,
    canonicalObjectsVerified: true,
    canonicalVerificationSha256: gateway.evidence.artifactSha256,
    gatewayActionSetSha256: gateway.actionSetSha256,
    gatewayHelperSha256: gateway.helperSha256,
    gatewayObjectCount: gateway.evidence.objectCount,
    gatewayPolicySha256: gateway.policySha256,
    gatewayPreflightReceiptSha256: preflight.receiptSha256,
    gatewayPromotionArtifactSha256: gateway.evidence.artifactSha256,
    gatewayPromotionReceiptSha256: gateway.receiptSha256,
    gatewayPromotionRequestId: gateway.requestId,
    gatewayProtocolSha256: gateway.protocolSha256,
    gatewayReused: gateway.evidence.reused,
    mediaGenerationDigest: input.mediaGenerationDigest,
    ok: true,
    promotionMode: 'additive-content-addressed-before-database',
    promotionReceiptSha256: gateway.evidence.artifactSha256,
    remoteLockIdentitySha256: input.remoteLockIdentitySha256,
  });
}
