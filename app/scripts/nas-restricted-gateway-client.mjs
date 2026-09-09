import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  createReadStream,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readSync,
} from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { canonicalMediaJson, mediaSha256 } from './nas-media-contract.mjs';

const REVIEWED_PROTOCOL_SHA256 =
  'aec60b603fc80fa2741e406b133c99cee79206b5419509a3c875e66c71d35cf9';
const CONTRACT_BYTES = readFileSync(
  new URL('../deploy/restricted-gateway-v1.contract.json', import.meta.url),
);
const CONTRACT_SHA256 = mediaSha256(CONTRACT_BYTES);
let CONTRACT_TEXT;
let CONTRACT;
try {
  CONTRACT_TEXT = new TextDecoder('utf-8', { fatal: true }).decode(CONTRACT_BYTES);
  CONTRACT = JSON.parse(CONTRACT_TEXT);
} catch {
  throw new Error('RESTRICTED_GATEWAY_CONTRACT_INVALID');
}
if (
  CONTRACT_BYTES.length === 0 ||
  CONTRACT_BYTES.at(-1) === 0x0a ||
  CONTRACT_BYTES.at(-1) === 0x0d ||
  CONTRACT_SHA256 !== REVIEWED_PROTOCOL_SHA256 ||
  canonicalMediaJson(CONTRACT) !== CONTRACT_TEXT
) {
  throw new Error('RESTRICTED_GATEWAY_CONTRACT_INVALID');
}

export const GATEWAY_PROJECT_ID = 'flowpack-v2';
export const GATEWAY_PROTOCOL_SHA256 = CONTRACT_SHA256;
export const GATEWAY_PROTOCOL_STATUS = 'reviewed-common-contract';
export const GATEWAY_ACTIONS = Object.freeze(
  Object.keys(CONTRACT.actions ?? {})
    .filter((action) => !(CONTRACT.projects?.[GATEWAY_PROJECT_ID]?.forbiddenActionPrefixes ?? [])
      .some((prefix) => action.startsWith(prefix)))
    .sort(),
);

const SSH_ALIAS = 'flowpack-v2-gateway';
export const GATEWAY_IDENTITY_FILENAME = 'flowpack_gateway_ed25519';
const SSH_EXECUTABLE = '/usr/bin/ssh';
const CONFIG_SCHEMA_VERSION = 2;
const WIRE_SCHEMA_VERSION = CONTRACT.schemaVersion;
const FILE_MODE = 0o600;
const DIRECTORY_MODE = 0o700;
const MAX_JSON_BYTES = CONTRACT.framing?.headerMaximumBytes;
const MAX_RESPONSE_BYTES = CONTRACT.framing?.responseMaximumBytes;
const MAX_PAYLOAD_BYTES = 1024 ** 4 + 128 * 1024 * 1024;
const MAX_INLINE_PAYLOAD_BYTES = 64 * 1024;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const REQUEST_ID_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const RELEASE_PATTERN = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const MIGRATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HOST_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/;
const USER_PATTERN = /^[a-z_][a-z0-9_-]{0,63}$/;
const FORBIDDEN_USERS = new Set(['docker', 'root']);
const IO_CHUNK_BYTES = 1024 * 1024;

const CONFIG_KEYS = Object.freeze([
  'actionSetSha256',
  'adapter',
  'alias',
  'helperSha256',
  'legacy',
  'policySha256',
  'projectId',
  'protocolSha256',
  'schemaVersion',
]);
const LEGACY_KEYS = Object.freeze([
  'callerControlledPaths',
  'directDocker',
  'rawShell',
  'remoteCommand',
  'scp',
  'sftp',
]);
const HEADER_ALLOWED_KEYS = Object.freeze([...CONTRACT.request.allowedKeys]);
const RESPONSE_KEYS = Object.freeze([...CONTRACT.response.keys]);
const RESPONSE_BODY_KEYS = Object.freeze(RESPONSE_KEYS.filter((key) => key !== 'receiptSha256'));
const EVIDENCE_KEYS = new Set(CONTRACT.evidence.keys);
const HASH_EVIDENCE_KEYS = new Set([
  'actionSetSha256',
  'artifactSha256',
  'databaseFingerprintSha256',
  'helperSha256',
  'policySha256',
  'protocolSha256',
]);
const COUNT_EVIDENCE_KEYS = new Set(['objectCount', 'payloadBytes', 'recordCount']);
const BOOLEAN_EVIDENCE_KEYS = new Set(['readOnly', 'reused', 'rollbackAvailable']);
const MIGRATION_STATES = new Set(CONTRACT.evidence.migrationStates);
const RESPONSE_CODES = new Set(CONTRACT.response.codes);
const STREAM_ONLY_ACTIONS = new Set(
  GATEWAY_ACTIONS.filter((action) => CONTRACT.actions[action].payload === true),
);
const SSH_FIXED_VALUES = Object.freeze({
  BatchMode: 'yes',
  ClearAllForwardings: 'yes',
  Host: SSH_ALIAS,
  IdentitiesOnly: 'yes',
  KbdInteractiveAuthentication: 'no',
  PasswordAuthentication: 'no',
  PermitLocalCommand: 'no',
  PubkeyAuthentication: 'yes',
  RequestTTY: 'no',
  StrictHostKeyChecking: 'yes',
});

export const GATEWAY_ACTION_SET_SHA256 = mediaSha256(canonicalMediaJson(GATEWAY_ACTIONS));

export class RestrictedGatewayClientError extends Error {
  constructor(code) {
    super(code);
    this.name = 'RestrictedGatewayClientError';
    this.code = code;
  }
}

function fail(code) {
  throw new RestrictedGatewayClientError(code);
}

function plain(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected) {
  return plain(value) &&
    Object.keys(value).sort().join('\n') === [...expected].sort().join('\n');
}

function exactArray(value, expected) {
  return Array.isArray(value) &&
    value.length === expected.length &&
    value.every((entry, index) => entry === expected[index]);
}

function sortedUniqueStrings(value) {
  return Array.isArray(value) &&
    value.every((entry) => typeof entry === 'string' && entry.length > 0) &&
    exactArray(value, [...new Set(value)].sort());
}

function validateReviewedContract() {
  const expectedRequestKeys = [
    'action',
    'migrationId',
    'payloadBytes',
    'payloadSha256',
    'preflightReceiptSha256',
    'projectId',
    'releaseCommit',
    'requestId',
    'schemaVersion',
    'tokenDigest',
  ];
  const expectedResponseKeys = [
    'action',
    'code',
    'evidence',
    'ok',
    'projectId',
    'receiptSha256',
    'requestId',
    'schemaVersion',
  ];
  const expectedEvidenceKeys = [
    'actionSetSha256',
    'artifactSha256',
    'currentCommit',
    'databaseFingerprintSha256',
    'helperSha256',
    'migrationState',
    'objectCount',
    'payloadBytes',
    'policySha256',
    'protocolSha256',
    'readOnly',
    'recordCount',
    'reused',
    'rollbackAvailable',
  ];
  const expectedCodes = [
    'ACTION_NOT_ENABLED',
    'ATTESTATION_MISMATCH',
    'AUTHORIZATION_DENIED',
    'BUSY',
    'HANDLER_FAILED',
    'INTERNAL_ERROR',
    'OK',
    'PRECONDITION_FAILED',
    'REQUEST_ID_CONFLICT',
    'REQUEST_INVALID',
  ];
  const expectedStates = [
    'CANDIDATE_PROMOTED',
    'CANDIDATE_RESTORED',
    'COMMITTED',
    'DESTINATION_READ_ONLY',
    'DESTINATION_RESTORED',
    'FINALIZED',
    'FINAL_BOUND',
    'LIVE_RENAMED',
    'LOCKED',
    'ROLLBACK_COMPLETE',
    'SOURCE_FROZEN',
    'TARGET_PREPARED',
    'UNLOCKED',
    'WRITES_ENABLED_PENDING_LEDGER',
    'ZERO_WRITE_SMOKE_PASSED',
  ];
  if (
    !exactKeys(CONTRACT, [
      'actions',
      'canonicalJson',
      'evidence',
      'framing',
      'projects',
      'request',
      'response',
      'schemaVersion',
    ]) ||
    CONTRACT.schemaVersion !== 1 ||
    !exactKeys(CONTRACT.canonicalJson, [
      'objectKeyOrder',
      'trailingNewline',
      'utf8',
      'whitespace',
    ]) ||
    CONTRACT.canonicalJson.objectKeyOrder !== 'ascii-lexicographic-ascending' ||
    CONTRACT.canonicalJson.trailingNewline !== false ||
    CONTRACT.canonicalJson.utf8 !== true ||
    CONTRACT.canonicalJson.whitespace !== false ||
    !exactKeys(CONTRACT.framing, [
      'headerLength',
      'headerMaximumBytes',
      'payload',
      'responseMaximumBytes',
    ]) ||
    CONTRACT.framing.headerLength !== 'uint32-big-endian' ||
    CONTRACT.framing.headerMaximumBytes !== 65536 ||
    CONTRACT.framing.payload !== 'exact-stream-after-header' ||
    CONTRACT.framing.responseMaximumBytes !== 65536 ||
    !exactKeys(CONTRACT.projects, ['documate', GATEWAY_PROJECT_ID]) ||
    !exactKeys(CONTRACT.projects.documate, ['forbiddenActionPrefixes']) ||
    !exactArray(CONTRACT.projects.documate.forbiddenActionPrefixes, ['media.']) ||
    !exactKeys(CONTRACT.projects[GATEWAY_PROJECT_ID], ['forbiddenActionPrefixes']) ||
    !exactArray(CONTRACT.projects[GATEWAY_PROJECT_ID].forbiddenActionPrefixes, []) ||
    !exactKeys(CONTRACT.request, ['allowedKeys', 'migrationId', 'requestId']) ||
    !exactArray(CONTRACT.request.allowedKeys, expectedRequestKeys) ||
    CONTRACT.request.migrationId !== 'lowercase-rfc4122-version-1-through-8' ||
    CONTRACT.request.requestId !== 'lowercase-rfc4122-version-4' ||
    !exactKeys(CONTRACT.response, ['codes', 'keys', 'receiptSha256']) ||
    !exactArray(CONTRACT.response.codes, expectedCodes) ||
    !exactArray(CONTRACT.response.keys, expectedResponseKeys) ||
    CONTRACT.response.receiptSha256 !==
      'sha256-canonical-response-without-receiptSha256' ||
    !exactKeys(CONTRACT.evidence, ['actionSetSha256', 'keys', 'migrationStates']) ||
    CONTRACT.evidence.actionSetSha256 !==
      'sha256-canonical-json-sorted-enabled-action-array' ||
    !exactArray(CONTRACT.evidence.keys, expectedEvidenceKeys) ||
    !exactArray(CONTRACT.evidence.migrationStates, expectedStates) ||
    !plain(CONTRACT.actions) ||
    !sortedUniqueStrings(GATEWAY_ACTIONS) ||
    GATEWAY_ACTION_SET_SHA256 !==
      mediaSha256(canonicalMediaJson([...GATEWAY_ACTIONS].sort()))
  ) {
    throw new Error('RESTRICTED_GATEWAY_CONTRACT_INVALID');
  }
  for (const action of GATEWAY_ACTIONS) {
    const definition = CONTRACT.actions[action];
    if (
      !/^[a-z]+(?:[.-][a-z]+)*$/u.test(action) ||
      !exactKeys(definition, ['builtin', 'mutation', 'payload', 'required']) ||
      typeof definition.builtin !== 'boolean' ||
      typeof definition.mutation !== 'boolean' ||
      typeof definition.payload !== 'boolean' ||
      !sortedUniqueStrings(definition.required) ||
      !definition.required.includes('action') ||
      !definition.required.includes('projectId') ||
      !definition.required.includes('requestId') ||
      !definition.required.includes('schemaVersion') ||
      definition.required.some((key) => !expectedRequestKeys.includes(key)) ||
      definition.payload !== (
        definition.required.includes('payloadBytes') &&
        definition.required.includes('payloadSha256')
      )
    ) {
      throw new Error('RESTRICTED_GATEWAY_CONTRACT_INVALID');
    }
  }
}

validateReviewedContract();

function nonPlaceholderHash(value) {
  return typeof value === 'string' &&
    HASH_PATTERN.test(value) &&
    value !== '0'.repeat(64);
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
  return info;
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

function readPrivateBytes(path, code, maximumBytes = MAX_JSON_BYTES) {
  const initial = assertPrivateFile(path, code, maximumBytes);
  let descriptor;
  let bytes;
  try {
    descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = fstatSync(descriptor);
    if (
      !opened.isFile() ||
      opened.dev !== initial.dev ||
      opened.ino !== initial.ino ||
      opened.nlink !== 1 ||
      (opened.mode & 0o777) !== FILE_MODE ||
      opened.size !== initial.size
    ) fail(code);
    bytes = Buffer.allocUnsafe(opened.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (count <= 0) fail(code);
      offset += count;
    }
    const after = fstatSync(descriptor);
    if (
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.nlink !== 1 ||
      after.size !== opened.size ||
      (after.mode & 0o777) !== FILE_MODE
    ) fail(code);
  } catch (error) {
    if (error instanceof RestrictedGatewayClientError) throw error;
    fail(code);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  const final = assertPrivateFile(path, code, maximumBytes);
  if (final.dev !== initial.dev || final.ino !== initial.ino || final.size !== initial.size) {
    fail(code);
  }
  return bytes;
}

function readCanonicalPrivate(path, code) {
  const bytes = readPrivateBytes(path, code);
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(code);
  }
  if (!bytes.equals(Buffer.from(`${canonicalMediaJson(value)}\n`, 'utf8'))) fail(code);
  return value;
}

function parseSshConfig(profileDirectory) {
  const path = join(profileDirectory, 'ssh_config');
  const bytes = readPrivateBytes(path, 'RESTRICTED_GATEWAY_PROFILE_INVALID');
  const raw = bytes.toString('utf8');
  if (!raw.endsWith('\n') || /[\0\r]/u.test(raw)) fail('RESTRICTED_GATEWAY_PROFILE_INVALID');
  const values = {};
  for (const line of raw.split('\n')) {
    if (line === '') continue;
    const match = /^([A-Za-z][A-Za-z0-9]*)[ \t]+([^ \t]+)$/.exec(line);
    if (!match || Object.hasOwn(values, match[1])) fail('RESTRICTED_GATEWAY_PROFILE_INVALID');
    values[match[1]] = match[2];
  }
  const expectedKeys = [
    ...Object.keys(SSH_FIXED_VALUES),
    'HostName',
    'IdentityFile',
    'Port',
    'User',
    'UserKnownHostsFile',
  ];
  if (!exactKeys(values, expectedKeys)) fail('RESTRICTED_GATEWAY_PROFILE_INVALID');
  for (const [key, expected] of Object.entries(SSH_FIXED_VALUES)) {
    if (values[key] !== expected) fail('RESTRICTED_GATEWAY_PROFILE_INVALID');
  }
  if (
    !HOST_PATTERN.test(values.HostName ?? '') ||
    !USER_PATTERN.test(values.User ?? '') ||
    FORBIDDEN_USERS.has(values.User) ||
    !/^[1-9][0-9]{0,4}$/.test(values.Port ?? '')
  ) fail('RESTRICTED_GATEWAY_PROFILE_INVALID');
  const port = Number(values.Port);
  if (!Number.isSafeInteger(port) || port > 65535) fail('RESTRICTED_GATEWAY_PROFILE_INVALID');
  if (
    values.IdentityFile !== join(profileDirectory, GATEWAY_IDENTITY_FILENAME) ||
    values.UserKnownHostsFile !== join(profileDirectory, 'known_hosts')
  ) fail('RESTRICTED_GATEWAY_PROFILE_INVALID');
  return Object.freeze({ host: values.HostName, port, user: values.User });
}

function validateIdentity(path) {
  const text = readPrivateBytes(path, 'RESTRICTED_GATEWAY_PROFILE_INVALID', 1024 * 1024)
    .toString('utf8');
  if (
    !/-----BEGIN (?:OPENSSH|RSA|EC) PRIVATE KEY-----/.test(text) ||
    !/-----END (?:OPENSSH|RSA|EC) PRIVATE KEY-----\n?$/.test(text) ||
    /\0/u.test(text)
  ) fail('RESTRICTED_GATEWAY_PROFILE_INVALID');
}

function validateKnownHosts(path, ssh) {
  const raw = readPrivateBytes(path, 'RESTRICTED_GATEWAY_PROFILE_INVALID', 1024 * 1024)
    .toString('utf8');
  if (!raw.endsWith('\n') || /[\0\r]/u.test(raw)) fail('RESTRICTED_GATEWAY_PROFILE_INVALID');
  const lines = raw.trimEnd().split('\n');
  const parts = lines[0]?.split(' ');
  const expectedHost = ssh.port === 22 ? ssh.host : `[${ssh.host}]:${ssh.port}`;
  if (
    lines.length !== 1 ||
    parts?.length !== 3 ||
    parts[0] !== expectedHost ||
    !['ecdsa-sha2-nistp256', 'ssh-ed25519', 'ssh-rsa'].includes(parts[1]) ||
    !/^[A-Za-z0-9+/]{32,8192}={0,2}$/.test(parts[2])
  ) fail('RESTRICTED_GATEWAY_PROFILE_INVALID');
}

export function readRestrictedGatewayProfile(profileDirectory) {
  assertPrivateDirectory(profileDirectory, 'RESTRICTED_GATEWAY_PROFILE_INVALID');
  const config = readCanonicalPrivate(
    join(profileDirectory, 'gateway.json'),
    'RESTRICTED_GATEWAY_PROFILE_INVALID',
  );
  if (
    !exactKeys(config, CONFIG_KEYS) ||
    config.schemaVersion !== CONFIG_SCHEMA_VERSION ||
    config.adapter !== 'restricted-gateway-v1' ||
    config.projectId !== GATEWAY_PROJECT_ID ||
    config.alias !== SSH_ALIAS ||
    config.actionSetSha256 !== GATEWAY_ACTION_SET_SHA256 ||
    config.protocolSha256 !== GATEWAY_PROTOCOL_SHA256 ||
    !nonPlaceholderHash(config.helperSha256) ||
    !nonPlaceholderHash(config.policySha256) ||
    config.helperSha256 === config.policySha256 ||
    !exactKeys(config.legacy, LEGACY_KEYS) ||
    LEGACY_KEYS.some((key) => config.legacy[key] !== false)
  ) fail('RESTRICTED_GATEWAY_PROFILE_INVALID');
  const ssh = parseSshConfig(profileDirectory);
  validateIdentity(join(profileDirectory, GATEWAY_IDENTITY_FILENAME));
  validateKnownHosts(join(profileDirectory, 'known_hosts'), ssh);
  return Object.freeze({
    actionSetSha256: config.actionSetSha256,
    alias: config.alias,
    helperSha256: config.helperSha256,
    legacy: Object.freeze({ ...config.legacy }),
    policySha256: config.policySha256,
    projectId: config.projectId,
    protocolSha256: config.protocolSha256,
    schemaVersion: config.schemaVersion,
    sshUsername: ssh.user,
  });
}

function validateHeader(value) {
  if (!plain(value)) fail('RESTRICTED_GATEWAY_REQUEST_INVALID');
  const actionDefinition = CONTRACT.actions[value.action];
  if (
    !actionDefinition ||
    !exactKeys(value, actionDefinition.required) ||
    Object.keys(value).some((key) => !HEADER_ALLOWED_KEYS.includes(key)) ||
    value.schemaVersion !== WIRE_SCHEMA_VERSION ||
    value.projectId !== GATEWAY_PROJECT_ID ||
    !GATEWAY_ACTIONS.includes(value.action) ||
    !REQUEST_ID_PATTERN.test(value.requestId ?? '') ||
    (value.releaseCommit !== undefined && !RELEASE_PATTERN.test(value.releaseCommit)) ||
    (value.migrationId !== undefined && !MIGRATION_ID_PATTERN.test(value.migrationId)) ||
    (value.tokenDigest !== undefined && !HASH_PATTERN.test(value.tokenDigest)) ||
    (value.preflightReceiptSha256 !== undefined &&
      !HASH_PATTERN.test(value.preflightReceiptSha256)) ||
    ((value.payloadBytes === undefined) !== (value.payloadSha256 === undefined)) ||
    (value.payloadBytes !== undefined && (
      !Number.isSafeInteger(value.payloadBytes) ||
      value.payloadBytes <= 0 ||
      value.payloadBytes > MAX_PAYLOAD_BYTES ||
      !HASH_PATTERN.test(value.payloadSha256)
    ))
  ) fail('RESTRICTED_GATEWAY_REQUEST_INVALID');
  return Object.freeze({ ...value });
}

export function encodeRestrictedGatewayRequest(header, payload = Buffer.alloc(0)) {
  if (!Buffer.isBuffer(payload)) fail('RESTRICTED_GATEWAY_REQUEST_INVALID');
  const validated = validateHeader(header);
  if (STREAM_ONLY_ACTIONS.has(validated.action) && payload.length > 0) {
    fail('RESTRICTED_GATEWAY_STREAM_REQUIRED');
  }
  if (
    (payload.length === 0 && validated.payloadBytes !== undefined) ||
    (payload.length > 0 && (
      validated.payloadBytes !== payload.length ||
      validated.payloadSha256 !== mediaSha256(payload)
    ))
  ) fail('RESTRICTED_GATEWAY_REQUEST_INVALID');
  const bytes = Buffer.from(canonicalMediaJson(validated), 'utf8');
  if (bytes.length <= 0 || bytes.length > MAX_JSON_BYTES) fail('RESTRICTED_GATEWAY_REQUEST_INVALID');
  const prefix = Buffer.allocUnsafe(4 + bytes.length);
  prefix.writeUInt32BE(bytes.length, 0);
  bytes.copy(prefix, 4);
  return payload.length === 0 ? prefix : Buffer.concat([prefix, payload]);
}

function validateEvidence(evidence) {
  if (!plain(evidence)) fail('RESTRICTED_GATEWAY_RESPONSE_INVALID');
  for (const [key, value] of Object.entries(evidence)) {
    if (!EVIDENCE_KEYS.has(key)) fail('RESTRICTED_GATEWAY_RESPONSE_INVALID');
    if (HASH_EVIDENCE_KEYS.has(key) && !HASH_PATTERN.test(value ?? '')) {
      fail('RESTRICTED_GATEWAY_RESPONSE_INVALID');
    }
    if (COUNT_EVIDENCE_KEYS.has(key) && (!Number.isSafeInteger(value) || value < 0)) {
      fail('RESTRICTED_GATEWAY_RESPONSE_INVALID');
    }
    if (BOOLEAN_EVIDENCE_KEYS.has(key) && typeof value !== 'boolean') {
      fail('RESTRICTED_GATEWAY_RESPONSE_INVALID');
    }
    if (key === 'currentCommit' && !RELEASE_PATTERN.test(value ?? '')) {
      fail('RESTRICTED_GATEWAY_RESPONSE_INVALID');
    }
    if (key === 'migrationState' && !MIGRATION_STATES.has(value)) {
      fail('RESTRICTED_GATEWAY_RESPONSE_INVALID');
    }
  }
  return Object.freeze({ ...evidence });
}

export function validateRestrictedGatewayResponse(raw, expected) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > MAX_RESPONSE_BYTES) {
    fail('RESTRICTED_GATEWAY_RESPONSE_INVALID');
  }
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    fail('RESTRICTED_GATEWAY_RESPONSE_INVALID');
  }
  if (
    raw !== `${canonicalMediaJson(value)}\n` ||
    !exactKeys(value, RESPONSE_KEYS) ||
    value.schemaVersion !== WIRE_SCHEMA_VERSION ||
    value.projectId !== GATEWAY_PROJECT_ID ||
    value.requestId !== expected.requestId ||
    value.action !== expected.action ||
    typeof value.ok !== 'boolean' ||
    !RESPONSE_CODES.has(value.code) ||
    (value.ok ? value.code !== 'OK' : value.code === 'OK') ||
    !HASH_PATTERN.test(value.receiptSha256 ?? '')
  ) fail('RESTRICTED_GATEWAY_RESPONSE_INVALID');
  const evidence = validateEvidence(value.evidence);
  const body = Object.fromEntries(RESPONSE_BODY_KEYS.map((key) => [key, {
    ...value,
    evidence,
  }[key]]));
  if (value.receiptSha256 !== mediaSha256(canonicalMediaJson(body))) {
    fail('RESTRICTED_GATEWAY_RESPONSE_INVALID');
  }
  return Object.freeze({ ...body, receiptSha256: value.receiptSha256 });
}

function openPayload(path) {
  const initial = assertPrivateFile(path, 'RESTRICTED_GATEWAY_PAYLOAD_INVALID', MAX_PAYLOAD_BYTES);
  let descriptor;
  try {
    descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = fstatSync(descriptor);
    if (
      opened.dev !== initial.dev ||
      opened.ino !== initial.ino ||
      opened.nlink !== 1 ||
      opened.size !== initial.size ||
      (opened.mode & 0o777) !== FILE_MODE
    ) fail('RESTRICTED_GATEWAY_PAYLOAD_INVALID');
    const sha256 = hashOpenPayload(descriptor, opened, 'RESTRICTED_GATEWAY_PAYLOAD_INVALID');
    return Object.freeze({
      bytes: opened.size,
      descriptor,
      identity: opened,
      path,
      sha256,
    });
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    if (error instanceof RestrictedGatewayClientError) throw error;
    fail('RESTRICTED_GATEWAY_PAYLOAD_INVALID');
  }
}

function hashOpenPayload(descriptor, identity, code) {
  const hash = createHash('sha256');
  const buffer = Buffer.allocUnsafe(IO_CHUNK_BYTES);
  let offset = 0;
  while (offset < identity.size) {
    const count = readSync(
      descriptor,
      buffer,
      0,
      Math.min(buffer.length, identity.size - offset),
      offset,
    );
    if (count <= 0) fail(code);
    hash.update(buffer.subarray(0, count));
    offset += count;
  }
  const eof = readSync(descriptor, buffer, 0, 1, identity.size);
  if (eof !== 0) fail(code);
  return hash.digest('hex');
}

function verifyOpenPayload(payload) {
  const opened = fstatSync(payload.descriptor);
  const final = assertPrivateFile(
    payload.path,
    'RESTRICTED_GATEWAY_PAYLOAD_CHANGED',
    MAX_PAYLOAD_BYTES,
  );
  if (
    opened.dev !== payload.identity.dev ||
    opened.ino !== payload.identity.ino ||
    opened.nlink !== 1 ||
    opened.size !== payload.bytes ||
    (opened.mode & 0o777) !== FILE_MODE ||
    final.dev !== payload.identity.dev ||
    final.ino !== payload.identity.ino ||
    final.size !== payload.bytes ||
    hashOpenPayload(
      payload.descriptor,
      opened,
      'RESTRICTED_GATEWAY_PAYLOAD_CHANGED',
    ) !== payload.sha256
  ) fail('RESTRICTED_GATEWAY_PAYLOAD_CHANGED');
}

async function defaultProcessRunner(request) {
  return await new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    let stdoutBytes = 0;
    const stdout = [];
    let child;
    try {
      child = spawn(request.executable, request.args, {
        cwd: request.cwd,
        env: request.env,
        stdio: ['pipe', 'pipe', 'ignore'],
      });
    } catch {
      rejectPromise(new Error('RESTRICTED_GATEWAY_PROCESS_FAILED'));
      return;
    }
    const failProcess = () => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      rejectPromise(new Error('RESTRICTED_GATEWAY_PROCESS_FAILED'));
    };
    child.on('error', failProcess);
    child.stdout.on('data', (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_RESPONSE_BYTES) return failProcess();
      stdout.push(Buffer.from(chunk));
    });
    child.on('close', (status) => {
      if (settled) return;
      settled = true;
      resolvePromise({
        status: Number.isInteger(status) ? status : 255,
        stdout: Buffer.concat(stdout).toString('utf8'),
      });
    });
    child.stdin.on('error', failProcess);
    if (Buffer.isBuffer(request.stdin)) {
      child.stdin.end(request.stdin);
      return;
    }
    child.stdin.write(request.stdin.prefix, (prefixError) => {
      if (prefixError) return failProcess();
      let source;
      try {
        source = createReadStream('/dev/null', {
          autoClose: false,
          end: request.stdin.payloadBytes - 1,
          fd: request.stdin.payloadDescriptor,
          flags: constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
          start: 0,
        });
      } catch {
        return failProcess();
      }
      source.on('error', failProcess);
      source.pipe(child.stdin);
    });
  });
}

export async function invokeRestrictedGateway({
  action,
  migrationId,
  payload,
  payloadPath,
  preflightReceiptSha256,
  processRunner = defaultProcessRunner,
  profileDirectory,
  releaseCommit,
  requestId,
  tokenDigest,
} = {}) {
  if (typeof processRunner !== 'function') fail('RESTRICTED_GATEWAY_REQUEST_INVALID');
  const profile = readRestrictedGatewayProfile(profileDirectory);
  if (payload !== undefined && payloadPath !== undefined) fail('RESTRICTED_GATEWAY_REQUEST_INVALID');
  if (payload !== undefined && (
    !Buffer.isBuffer(payload) ||
    payload.length === 0 ||
    payload.length > MAX_INLINE_PAYLOAD_BYTES ||
    STREAM_ONLY_ACTIONS.has(action)
  )) {
    fail('RESTRICTED_GATEWAY_REQUEST_INVALID');
  }
  if (STREAM_ONLY_ACTIONS.has(action) && payloadPath === undefined) {
    fail('RESTRICTED_GATEWAY_STREAM_REQUIRED');
  }
  let openedPayload;
  try {
    if (payloadPath !== undefined) openedPayload = openPayload(payloadPath);
    const payloadBytes = openedPayload?.bytes ?? payload?.length;
    const payloadSha256 = openedPayload?.sha256 ?? (payload === undefined ? undefined : mediaSha256(payload));
    const header = validateHeader({
      action,
      ...(migrationId === undefined ? {} : { migrationId }),
      ...(payloadBytes === undefined ? {} : { payloadBytes, payloadSha256 }),
      ...(preflightReceiptSha256 === undefined ? {} : { preflightReceiptSha256 }),
      projectId: GATEWAY_PROJECT_ID,
      ...(releaseCommit === undefined ? {} : { releaseCommit }),
      requestId,
      schemaVersion: WIRE_SCHEMA_VERSION,
      ...(tokenDigest === undefined ? {} : { tokenDigest }),
    });
    const headerBytes = Buffer.from(canonicalMediaJson(header), 'utf8');
    if (headerBytes.length <= 0 || headerBytes.length > MAX_JSON_BYTES) {
      fail('RESTRICTED_GATEWAY_REQUEST_INVALID');
    }
    const prefix = Buffer.allocUnsafe(4 + headerBytes.length);
    prefix.writeUInt32BE(headerBytes.length, 0);
    headerBytes.copy(prefix, 4);
    const stdin = openedPayload === undefined
      ? (payload === undefined ? prefix : Buffer.concat([prefix, payload]))
      : Object.freeze({
        payloadBytes: openedPayload.bytes,
        payloadDescriptor: openedPayload.descriptor,
        prefix,
      });
    let processResult;
    try {
      processResult = await processRunner(Object.freeze({
        args: Object.freeze([
          '-F',
          'ssh_config',
          '-T',
          '-o',
          'BatchMode=yes',
          '-o',
          'ClearAllForwardings=yes',
          '-o',
          'RequestTTY=no',
          profile.alias,
        ]),
        cwd: profileDirectory,
        env: Object.freeze({ LC_ALL: 'C' }),
        executable: SSH_EXECUTABLE,
        stdin,
      }));
    } catch {
      fail('RESTRICTED_GATEWAY_INTERRUPTED');
    }
    if (openedPayload !== undefined) verifyOpenPayload(openedPayload);
    if (
      !plain(processResult) ||
      !Number.isInteger(processResult.status) ||
      typeof processResult.stdout !== 'string'
    ) fail('RESTRICTED_GATEWAY_INTERRUPTED');
    const response = validateRestrictedGatewayResponse(processResult.stdout, header);
    if (response.ok !== true) {
      if (response.code === 'ACTION_NOT_ENABLED') {
        fail('RESTRICTED_GATEWAY_ACTION_NOT_ENABLED');
      }
      fail('RESTRICTED_GATEWAY_ACTION_REJECTED');
    }
    if (processResult.status !== 0) fail('RESTRICTED_GATEWAY_INTERRUPTED');
    return Object.freeze({
      ...response,
      actionSetSha256: profile.actionSetSha256,
      helperSha256: profile.helperSha256,
      policySha256: profile.policySha256,
      protocolSha256: profile.protocolSha256,
    });
  } finally {
    if (openedPayload !== undefined) closeSync(openedPayload.descriptor);
  }
}

export async function preflightRestrictedGateway({
  processRunner = defaultProcessRunner,
  profileDirectory,
} = {}) {
  const profile = readRestrictedGatewayProfile(profileDirectory);
  const digest = mediaSha256(canonicalMediaJson({
    action: 'system.preflight',
    actionSetSha256: profile.actionSetSha256,
    helperSha256: profile.helperSha256,
    policySha256: profile.policySha256,
    projectId: profile.projectId,
    protocolSha256: profile.protocolSha256,
    schemaVersion: WIRE_SCHEMA_VERSION,
  }));
  const requestId = [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `4${digest.slice(13, 16)}`,
    `8${digest.slice(17, 20)}`,
    digest.slice(20, 32),
  ].join('-');
  const result = await invokeRestrictedGateway({
    action: 'system.preflight',
    processRunner,
    profileDirectory,
    requestId,
  });
  if (
    result.evidence.actionSetSha256 !== profile.actionSetSha256 ||
    result.evidence.helperSha256 !== profile.helperSha256 ||
    result.evidence.policySha256 !== profile.policySha256 ||
    result.evidence.protocolSha256 !== profile.protocolSha256
  ) fail('RESTRICTED_GATEWAY_PREFLIGHT_INVALID');
  return Object.freeze(result);
}
