import assert from 'node:assert/strict';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { canonicalMediaJson, mediaSha256 } from './nas-media-contract.mjs';
import {
  GATEWAY_ACTION_SET_SHA256,
  GATEWAY_IDENTITY_FILENAME,
  GATEWAY_PROJECT_ID,
  GATEWAY_PROTOCOL_SHA256,
  RestrictedGatewayClientError,
  invokeRestrictedGateway,
  readRestrictedGatewayProfile,
  validateRestrictedGatewayResponse,
} from './nas-restricted-gateway-client.mjs';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const MIGRATION_ID = '11111111-2222-4333-8444-555555555555';
const RELEASE_COMMIT = 'c'.repeat(40);
const REQUEST_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function writePrivate(path, value) {
  writeFileSync(path, typeof value === 'string' ? value : `${canonicalMediaJson(value)}\n`, {
    mode: 0o600,
  });
}

function profile(t, overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'flowpack-restricted-gateway-'));
  chmodSync(root, 0o700);
  t.after(() => rmSync(root, { force: true, recursive: true }));
  const legacy = {
    callerControlledPaths: false,
    directDocker: false,
    rawShell: false,
    remoteCommand: false,
    scp: false,
    sftp: false,
  };
  writePrivate(join(root, 'gateway.json'), {
    actionSetSha256: GATEWAY_ACTION_SET_SHA256,
    adapter: 'restricted-gateway-v1',
    alias: 'flowpack-v2-gateway',
    helperSha256: HASH_A,
    legacy,
    policySha256: HASH_B,
    projectId: GATEWAY_PROJECT_ID,
    protocolSha256: GATEWAY_PROTOCOL_SHA256,
    schemaVersion: 2,
    ...overrides,
  });
  writePrivate(join(root, GATEWAY_IDENTITY_FILENAME), [
    '-----BEGIN OPENSSH PRIVATE KEY-----',
    'fixture',
    '-----END OPENSSH PRIVATE KEY-----',
    '',
  ].join('\n'));
  writePrivate(join(root, 'known_hosts'), 'nas.example.ts.net ssh-ed25519 AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=\n');
  writePrivate(join(root, 'ssh_config'), [
    'Host flowpack-v2-gateway',
    'HostName nas.example.ts.net',
    'User flowpack_gateway',
    'Port 22',
    `IdentityFile ${join(root, GATEWAY_IDENTITY_FILENAME)}`,
    `UserKnownHostsFile ${join(root, 'known_hosts')}`,
    'BatchMode yes',
    'ClearAllForwardings yes',
    'IdentitiesOnly yes',
    'KbdInteractiveAuthentication no',
    'PasswordAuthentication no',
    'PermitLocalCommand no',
    'PubkeyAuthentication yes',
    'RequestTTY no',
    'StrictHostKeyChecking yes',
    '',
  ].join('\n'));
  return root;
}

function gatewayResponse(request, overrides = {}) {
  const body = {
    action: request.action,
    code: 'OK',
    evidence: {
      artifactSha256: 'e'.repeat(64),
      objectCount: 1,
      payloadBytes: request.payloadBytes,
      readOnly: true,
      reused: false,
    },
    ok: true,
    projectId: GATEWAY_PROJECT_ID,
    requestId: request.requestId,
    schemaVersion: 1,
    ...overrides,
  };
  return `${canonicalMediaJson({
    ...body,
    receiptSha256: mediaSha256(canonicalMediaJson(body)),
  })}\n`;
}

test('sends one canonical length-prefixed request to the forced-command-only alias', async (t) => {
  const profileDirectory = profile(t);
  const payload = Buffer.from('private-media-bundle');
  const payloadPath = join(profileDirectory, 'media.bundle');
  writeFileSync(payloadPath, payload, { mode: 0o600 });
  let request;
  const result = await invokeRestrictedGateway({
    action: 'media.receive',
    migrationId: MIGRATION_ID,
    payloadPath,
    preflightReceiptSha256: 'f'.repeat(64),
    processRunner: async (candidate) => {
      request = candidate;
      const headerLength = candidate.stdin.prefix.readUInt32BE(0);
      const headerBytes = candidate.stdin.prefix.subarray(4, 4 + headerLength);
      const header = JSON.parse(headerBytes.toString('utf8'));
      assert.equal(headerBytes.toString('utf8'), canonicalMediaJson(header));
      const streamed = Buffer.alloc(candidate.stdin.payloadBytes);
      assert.equal(readSync(
        candidate.stdin.payloadDescriptor,
        streamed,
        0,
        streamed.length,
        0,
      ), streamed.length);
      assert.deepEqual(streamed, payload);
      assert.equal(header.projectId, GATEWAY_PROJECT_ID);
      assert.equal(header.action, 'media.receive');
      assert.equal(header.payloadBytes, payload.length);
      assert.equal(header.payloadSha256, mediaSha256(payload));
      assert.equal(header.requestId, REQUEST_ID);
      return { status: 0, stdout: gatewayResponse(header) };
    },
    profileDirectory,
    releaseCommit: RELEASE_COMMIT,
    requestId: REQUEST_ID,
    tokenDigest: '1'.repeat(64),
  });
  assert.deepEqual(request.args.at(-1), 'flowpack-v2-gateway');
  assert.equal(request.args.includes('RemoteCommand'), false);
  assert.equal(request.args.some((value) => /docker|scp|sftp|\/volume/i.test(value)), false);
  assert.equal(result.ok, true);
  assert.equal(result.receiptSha256, mediaSha256(canonicalMediaJson({
    action: 'media.receive',
    code: 'OK',
    evidence: result.evidence,
    ok: true,
    projectId: GATEWAY_PROJECT_ID,
    requestId: REQUEST_ID,
    schemaVersion: 1,
  })));
});

test('pins schema v2 helper, policy, protocol, action set and disables every legacy route', (t) => {
  const valid = profile(t);
  const parsed = readRestrictedGatewayProfile(valid);
  assert.equal(parsed.helperSha256, HASH_A);
  assert.equal(parsed.policySha256, HASH_B);
  assert.equal(parsed.protocolSha256, GATEWAY_PROTOCOL_SHA256);
  assert.equal(parsed.actionSetSha256, GATEWAY_ACTION_SET_SHA256);

  for (const invalid of [
    { legacy: { ...parsed.legacy, remoteCommand: true } },
    { protocolSha256: '0'.repeat(64) },
    { helperSha256: '0'.repeat(64) },
    { projectId: 'documate' },
  ]) {
    const directory = profile(t, invalid);
    assert.throws(
      () => readRestrictedGatewayProfile(directory),
      (error) => error instanceof RestrictedGatewayClientError &&
        error.code === 'RESTRICTED_GATEWAY_PROFILE_INVALID',
    );
  }
});

test('rejects RemoteCommand, unrestricted profiles, response tamper, and non-digest evidence', async (t) => {
  const remoteCommandProfile = profile(t);
  writePrivate(join(remoteCommandProfile, 'ssh_config'), [
    `Host flowpack-v2-gateway`,
    'HostName nas.example.ts.net',
    'User admin',
    'Port 22',
    `IdentityFile ${join(remoteCommandProfile, GATEWAY_IDENTITY_FILENAME)}`,
    `UserKnownHostsFile ${join(remoteCommandProfile, 'known_hosts')}`,
    'RemoteCommand /volume1/apps/flowpack/current/helper',
    '',
  ].join('\n'));
  assert.throws(() => readRestrictedGatewayProfile(remoteCommandProfile), /RESTRICTED_GATEWAY_PROFILE_INVALID/);

  const profileDirectory = profile(t);
  for (const response of [
    (header) => gatewayResponse(header, { receiptSha256: '0'.repeat(64) }),
    (header) => gatewayResponse(header, { evidence: { path: '/volume1/private' } }),
    (header) => gatewayResponse(header, { evidence: { migrationState: 'free form message' } }),
    (header) => gatewayResponse(header, { requestId: '0'.repeat(64) }),
  ]) {
    await assert.rejects(
      invokeRestrictedGateway({
        action: 'database.collect-evidence',
        migrationId: MIGRATION_ID,
        preflightReceiptSha256: 'f'.repeat(64),
        processRunner: async ({ stdin }) => {
          const length = stdin.readUInt32BE(0);
          const header = JSON.parse(stdin.subarray(4, 4 + length).toString('utf8'));
          return { status: 0, stdout: response(header) };
        },
        profileDirectory,
        releaseCommit: RELEASE_COMMIT,
        requestId: REQUEST_ID,
        tokenDigest: '1'.repeat(64),
      }),
      /RESTRICTED_GATEWAY_RESPONSE_INVALID/,
    );
  }
});

test('ACTION_NOT_ENABLED is a safe fail-closed response', async (t) => {
  const profileDirectory = profile(t);
  await assert.rejects(
    invokeRestrictedGateway({
      action: 'media.promote',
      migrationId: MIGRATION_ID,
      preflightReceiptSha256: 'f'.repeat(64),
      processRunner: async ({ stdin }) => {
        const length = stdin.readUInt32BE(0);
        const header = JSON.parse(stdin.subarray(4, 4 + length).toString('utf8'));
        return {
          status: 1,
          stdout: gatewayResponse(header, {
            code: 'ACTION_NOT_ENABLED',
            evidence: {},
            ok: false,
          }),
        };
      },
      profileDirectory,
      releaseCommit: RELEASE_COMMIT,
      requestId: REQUEST_ID,
      tokenDigest: '1'.repeat(64),
    }),
    (error) => error instanceof RestrictedGatewayClientError &&
      error.code === 'RESTRICTED_GATEWAY_ACTION_NOT_ENABLED',
  );
});

test('migrationState accepts only the canonical final contract enum', () => {
  const expected = {
    action: 'system.preflight',
    projectId: GATEWAY_PROJECT_ID,
    requestId: REQUEST_ID,
    schemaVersion: 1,
  };
  const states = [
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
  for (const migrationState of states) {
    const parsed = validateRestrictedGatewayResponse(
      gatewayResponse(expected, { evidence: { migrationState } }),
      expected,
    );
    assert.equal(parsed.evidence.migrationState, migrationState);
  }
  for (const migrationState of ['ROLLED_BACK', 'DESTINATION_READY', 'free form']) {
    assert.throws(
      () => validateRestrictedGatewayResponse(
        gatewayResponse(expected, { evidence: { migrationState } }),
        expected,
      ),
      /RESTRICTED_GATEWAY_RESPONSE_INVALID/,
    );
  }
});
