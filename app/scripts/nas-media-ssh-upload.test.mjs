import assert from 'node:assert/strict';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  MEDIA_BUNDLE_FORMAT,
  MEDIA_TRANSFER_SCHEMA_VERSION,
} from './nas-media-transfer-bundle.mjs';
import { MEDIA_PROJECT_ID, canonicalMediaJson, mediaSha256 } from './nas-media-contract.mjs';
import {
  uploadMediaBundleViaPinnedSsh,
  uploadMediaBundleViaRestrictedGateway,
} from './nas-media-ssh-upload.mjs';
import { promoteMediaCandidateViaRestrictedGateway } from './nas-media-gateway-promotion.mjs';
import {
  GATEWAY_ACTION_SET_SHA256,
  GATEWAY_IDENTITY_FILENAME,
  GATEWAY_PROJECT_ID,
  GATEWAY_PROTOCOL_SHA256,
} from './nas-restricted-gateway-client.mjs';

const MIGRATION_ID = '11111111-2222-4333-8444-555555555555';
const RELEASE_COMMIT = 'a'.repeat(40);
const HELPER = 'b'.repeat(64);
const POLICY = 'c'.repeat(64);

function privateWrite(path, value) {
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === 'string' ? value : `${canonicalMediaJson(value)}\n`, 'utf8');
  writeFileSync(path, bytes, { mode: 0o600 });
  return bytes;
}

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'flowpack-media-gateway-'));
  chmodSync(root, 0o700);
  t.after(() => rmSync(root, { force: true, recursive: true }));
  const profileDirectory = join(root, 'profile');
  const artifactDirectory = join(root, 'artifact');
  mkdirSync(profileDirectory, { mode: 0o700 });
  mkdirSync(artifactDirectory, { mode: 0o700 });
  privateWrite(join(profileDirectory, 'gateway.json'), {
    actionSetSha256: GATEWAY_ACTION_SET_SHA256,
    adapter: 'restricted-gateway-v1',
    alias: 'flowpack-v2-gateway',
    helperSha256: HELPER,
    legacy: {
      callerControlledPaths: false,
      directDocker: false,
      rawShell: false,
      remoteCommand: false,
      scp: false,
      sftp: false,
    },
    policySha256: POLICY,
    projectId: GATEWAY_PROJECT_ID,
    protocolSha256: GATEWAY_PROTOCOL_SHA256,
    schemaVersion: 2,
  });
  privateWrite(join(profileDirectory, GATEWAY_IDENTITY_FILENAME), [
    '-----BEGIN OPENSSH PRIVATE KEY-----',
    'fixture',
    '-----END OPENSSH PRIVATE KEY-----',
    '',
  ].join('\n'));
  privateWrite(
    join(profileDirectory, 'known_hosts'),
    'nas.example.ts.net ssh-ed25519 AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=\n',
  );
  privateWrite(join(profileDirectory, 'ssh_config'), [
    'Host flowpack-v2-gateway',
    'HostName nas.example.ts.net',
    'User flowpack_gateway',
    'Port 22',
    `IdentityFile ${join(profileDirectory, GATEWAY_IDENTITY_FILENAME)}`,
    `UserKnownHostsFile ${join(profileDirectory, 'known_hosts')}`,
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

  const bundle = Buffer.from('verified-private-flowpack-media-bundle');
  const bundlePath = join(artifactDirectory, 'media.bundle');
  privateWrite(bundlePath, bundle);
  const completion = {
    bundleBytes: bundle.length,
    bundleSha256: mediaSha256(bundle),
    format: MEDIA_BUNDLE_FORMAT,
    mediaEvidenceManifestSha256: 'd'.repeat(64),
    migrationId: MIGRATION_ID,
    objectBytes: 18,
    objects: 2,
    projectId: MEDIA_PROJECT_ID,
    releaseCommit: RELEASE_COMMIT,
    remoteLockIdentitySha256: 'e'.repeat(64),
    schemaVersion: MEDIA_TRANSFER_SCHEMA_VERSION,
    state: 'complete',
    transferManifestSha256: 'f'.repeat(64),
  };
  const completionReceiptPath = join(artifactDirectory, 'media.complete.json');
  privateWrite(completionReceiptPath, completion);
  return {
    artifactDirectory,
    bundle,
    bundlePath,
    completion,
    completionReceiptPath,
    profileDirectory,
    uploadReceiptPath: join(artifactDirectory, 'media.gateway-upload.json'),
  };
}

function decodeRequest(stdin) {
  const prefix = Buffer.isBuffer(stdin) ? stdin : stdin.prefix;
  const length = prefix.readUInt32BE(0);
  const headerBytes = prefix.subarray(4, 4 + length);
  const header = JSON.parse(headerBytes.toString('utf8'));
  assert.equal(headerBytes.toString('utf8'), canonicalMediaJson(header));
  return header;
}

function response(header, evidence, overrides = {}) {
  const body = {
    action: header.action,
    code: 'OK',
    evidence,
    ok: true,
    projectId: GATEWAY_PROJECT_ID,
    requestId: header.requestId,
    schemaVersion: 1,
    ...overrides,
  };
  return `${canonicalMediaJson({
    ...body,
    receiptSha256: mediaSha256(canonicalMediaJson(body)),
  })}\n`;
}

function successfulRunner(prepared, calls) {
  return async (request) => {
    const header = decodeRequest(request.stdin);
    calls.push({ header, request });
    if (header.action === 'system.preflight') {
      return {
        status: 0,
        stdout: response(header, {
          actionSetSha256: GATEWAY_ACTION_SET_SHA256,
          helperSha256: HELPER,
          policySha256: POLICY,
          protocolSha256: GATEWAY_PROTOCOL_SHA256,
        }),
      };
    }
    assert.equal(header.action, 'media.receive');
    assert.equal(Buffer.isBuffer(request.stdin), false);
    const payload = Buffer.alloc(request.stdin.payloadBytes);
    assert.equal(readSync(
      request.stdin.payloadDescriptor,
      payload,
      0,
      payload.length,
      0,
    ), payload.length);
    assert.deepEqual(payload, prepared.bundle);
    return {
      status: 0,
      stdout: response(header, {
        artifactSha256: '1'.repeat(64),
        objectCount: prepared.completion.objects,
        payloadBytes: prepared.bundle.length,
        reused: false,
      }),
    };
  };
}

test('preflights pinned root gateway and streams media.receive without a remote command', async (t) => {
  const prepared = fixture(t);
  const calls = [];
  const result = await uploadMediaBundleViaRestrictedGateway({
    ...prepared,
    processRunner: successfulRunner(prepared, calls),
  });
  assert.deepEqual(calls.map(({ header }) => header.action), [
    'system.preflight',
    'media.receive',
  ]);
  for (const { request } of calls) {
    assert.equal(request.args.at(-1), 'flowpack-v2-gateway');
    assert.equal(request.args.includes('RemoteCommand'), false);
    assert.equal(request.args.some((value) => /docker|scp|sftp|\/volume/i.test(value)), false);
  }
  assert.equal(result.ok, true);
  assert.equal(result.state, 'gateway-media-received');
  assert.equal(result.gatewayArtifactSha256, '1'.repeat(64));
  assert.equal(result.gatewayObjectCount, 2);
  assert.equal(result.payloadSha256, prepared.completion.bundleSha256);
  assert.match(result.gatewayReceiveRequestId, /^[a-f0-9-]{36}$/);
  assert.equal(JSON.stringify(result).includes('nas.example'), false);
});

test('a durable local receipt replays without opening the gateway', async (t) => {
  const prepared = fixture(t);
  const calls = [];
  const first = await uploadMediaBundleViaRestrictedGateway({
    ...prepared,
    processRunner: successfulRunner(prepared, calls),
  });
  const second = await uploadMediaBundleViaRestrictedGateway({
    ...prepared,
    processRunner: async () => {
      throw new Error('gateway must not open');
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(first.localIdempotent, false);
  assert.equal(second.localIdempotent, true);
  assert.equal(second.uploadReceiptSha256, first.uploadReceiptSha256);
});

test('preflight pin drift and action receipt mismatch leave no local receipt', async (t) => {
  const prepared = fixture(t);
  await assert.rejects(
    uploadMediaBundleViaRestrictedGateway({
      ...prepared,
      processRunner: async (request) => {
        const header = decodeRequest(request.stdin);
        return {
          status: 0,
          stdout: response(header, header.action === 'system.preflight'
            ? {
              actionSetSha256: GATEWAY_ACTION_SET_SHA256,
              helperSha256: '0'.repeat(64),
              policySha256: POLICY,
              protocolSha256: GATEWAY_PROTOCOL_SHA256,
            }
            : {}),
        };
      },
    }),
    /RESTRICTED_GATEWAY_PREFLIGHT_INVALID/,
  );
  assert.equal(existsSync(prepared.uploadReceiptPath), false);
});

test('the release-owned pinned SSH entry point is permanently disabled', async () => {
  await assert.rejects(
    uploadMediaBundleViaPinnedSsh(),
    /LEGACY_PINNED_SSH_UPLOAD_DISABLED/,
  );
});

test('media.promote carries no caller path or payload and binds the rewrite receipt', async (t) => {
  const prepared = fixture(t);
  const actions = [];
  const processRunner = async (request) => {
    const header = decodeRequest(request.stdin);
    actions.push(header.action);
    if (header.action === 'system.preflight') {
      return {
        status: 0,
        stdout: response(header, {
          actionSetSha256: GATEWAY_ACTION_SET_SHA256,
          helperSha256: HELPER,
          policySha256: POLICY,
          protocolSha256: GATEWAY_PROTOCOL_SHA256,
        }),
      };
    }
    assert.equal(header.action, 'media.promote');
    assert.equal(Buffer.isBuffer(request.stdin), true);
    assert.equal(request.stdin.length, request.stdin.readUInt32BE(0) + 4);
    return {
      status: 0,
      stdout: response(header, {
        artifactSha256: '2'.repeat(64),
        objectCount: 2,
        reused: false,
      }),
    };
  };
  const result = await promoteMediaCandidateViaRestrictedGateway({
    candidateRewriteReceiptSha256: '3'.repeat(64),
    completionReceiptSha256: '4'.repeat(64),
    mediaGenerationDigest: '5'.repeat(64),
    migrationId: MIGRATION_ID,
    preparationReportDigest: '6'.repeat(64),
    profileDirectory: prepared.profileDirectory,
    releaseCommit: RELEASE_COMMIT,
    remoteLockIdentitySha256: '7'.repeat(64),
    tokenDigest: '8'.repeat(64),
  }, { processRunner });
  assert.deepEqual(actions, ['system.preflight', 'media.promote']);
  assert.equal(result.candidateRewriteReceiptSha256, '3'.repeat(64));
  assert.equal(result.promotionReceiptSha256, '2'.repeat(64));
  assert.equal(result.gatewayPromotionArtifactSha256, '2'.repeat(64));
});
