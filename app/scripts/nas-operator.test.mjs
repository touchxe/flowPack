import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
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

import { canonicalMediaJson, mediaSha256 } from './nas-media-contract.mjs';
import {
  GATEWAY_ACTIONS,
  GATEWAY_ACTION_SET_SHA256,
  GATEWAY_IDENTITY_FILENAME,
  GATEWAY_PROJECT_ID,
  GATEWAY_PROTOCOL_SHA256,
  GATEWAY_PROTOCOL_STATUS,
} from './nas-restricted-gateway-client.mjs';
import {
  check,
  createSystemOperations,
  deploy,
  dryRun,
  localCheck,
  parseStrictDotenv,
  validateComposeBoundary,
  validateMigrationConfig,
  validateOperatorEnvironment,
  verify,
} from './nas-operator.mjs';

const BASE_CONFIG = JSON.parse(
  readFileSync(new URL('../deploy/nas-migration.config.json', import.meta.url), 'utf8'),
);
const BASE_COMPOSE = readFileSync(new URL('../docker-compose.nas.yml', import.meta.url), 'utf8');
const BASE_RUNTIME_ENV = readFileSync(new URL('../ops/nas/env.example', import.meta.url), 'utf8');
const OPERATOR_ENV_EXAMPLE = readFileSync(
  new URL('../ops/nas/operator.env.example', import.meta.url),
  'utf8',
);
const OPERATOR_SOURCE = readFileSync(new URL('./nas-operator.mjs', import.meta.url), 'utf8');
const PROTOCOL_CONTRACT_BYTES = readFileSync(
  new URL('../deploy/restricted-gateway-v1.contract.json', import.meta.url),
);
const HELPER_SHA256 = 'a'.repeat(64);
const POLICY_SHA256 = 'b'.repeat(64);

function git(cwd, ...args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function writePrivate(path, value) {
  writeFileSync(path, typeof value === 'string' ? value : `${canonicalMediaJson(value)}\n`, {
    mode: 0o600,
  });
  chmodSync(path, 0o600);
}

function operatorText(values) {
  return `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n')}\n`;
}

function createGatewayProfile(root) {
  const profileDirectory = join(root, 'flowpack-v2-gateway-profile');
  mkdirSync(profileDirectory, { mode: 0o700 });
  chmodSync(profileDirectory, 0o700);
  writePrivate(join(profileDirectory, 'gateway.json'), {
    actionSetSha256: GATEWAY_ACTION_SET_SHA256,
    adapter: 'restricted-gateway-v1',
    alias: 'flowpack-v2-gateway',
    helperSha256: HELPER_SHA256,
    legacy: {
      callerControlledPaths: false,
      directDocker: false,
      rawShell: false,
      remoteCommand: false,
      scp: false,
      sftp: false,
    },
    policySha256: POLICY_SHA256,
    projectId: GATEWAY_PROJECT_ID,
    protocolSha256: GATEWAY_PROTOCOL_SHA256,
    schemaVersion: 2,
  });
  writePrivate(join(profileDirectory, GATEWAY_IDENTITY_FILENAME), [
    '-----BEGIN OPENSSH PRIVATE KEY-----',
    'fixture',
    '-----END OPENSSH PRIVATE KEY-----',
    '',
  ].join('\n'));
  writePrivate(
    join(profileDirectory, 'known_hosts'),
    'flowpack.example.ts.net ssh-ed25519 AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=\n',
  );
  writePrivate(join(profileDirectory, 'ssh_config'), [
    'Host flowpack-v2-gateway',
    'HostName flowpack.example.ts.net',
    'User admin',
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
  return profileDirectory;
}

function createFixture(t) {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'flowpack-gateway-operator-'));
  t.after(() => rmSync(temporaryRoot, { force: true, recursive: true }));
  const projectRoot = join(temporaryRoot, 'repository');
  const profileDirectory = createGatewayProfile(temporaryRoot);
  mkdirSync(join(projectRoot, 'deploy'), { recursive: true });
  mkdirSync(join(projectRoot, 'ops', 'nas'), { recursive: true });
  const values = {
    NAS_GATEWAY_ACTION_SET_SHA256: GATEWAY_ACTION_SET_SHA256,
    NAS_GATEWAY_HELPER_SHA256: HELPER_SHA256,
    NAS_GATEWAY_POLICY_SHA256: POLICY_SHA256,
    NAS_GATEWAY_PROFILE_DIR: profileDirectory,
    NAS_GATEWAY_PROTOCOL_SHA256: GATEWAY_PROTOCOL_SHA256,
  };
  writeFileSync(
    join(projectRoot, 'deploy', 'nas-migration.config.json'),
    `${JSON.stringify(BASE_CONFIG, null, 2)}\n`,
  );
  writeFileSync(join(projectRoot, 'docker-compose.nas.yml'), BASE_COMPOSE);
  writeFileSync(join(projectRoot, 'ops', 'nas', 'env.example'), BASE_RUNTIME_ENV);
  writeFileSync(join(projectRoot, '.env.nas-operator.local'), operatorText(values), { mode: 0o600 });
  writeFileSync(join(projectRoot, '.gitignore'), '.env.nas-operator.local\n');
  writeFileSync(join(projectRoot, 'app.txt'), 'committed\n');
  git(projectRoot, 'init', '--quiet');
  git(projectRoot, 'config', 'user.name', 'Gateway Operator Test');
  git(projectRoot, 'config', 'user.email', 'gateway-operator@example.invalid');
  git(projectRoot, 'add', '--all');
  git(projectRoot, 'commit', '--quiet', '--message', 'fixture');
  return {
    options: {
      operatorEnvPath: join(projectRoot, '.env.nas-operator.local'),
      projectRoot,
    },
    profileDirectory,
    projectRoot,
    temporaryRoot,
    text: operatorText(values),
    values,
  };
}

function assertPublicResult(result) {
  for (const [key, value] of Object.entries(result)) {
    if (key === 'commit') {
      assert.match(value, /^[a-f0-9]{40,64}$/);
    } else {
      assert.ok(
        typeof value === 'boolean' || (typeof value === 'number' && Number.isSafeInteger(value)),
        `unexpected public result type for ${key}`,
      );
    }
  }
}

test('schema v2 separates gateway identity from compose and ledger identity', () => {
  const config = validateMigrationConfig(structuredClone(BASE_CONFIG));
  assert.equal(config.schemaVersion, 2);
  assert.equal(config.projectId, 'flowpack-v2');
  assert.equal(config.gateway.projectId, 'flowpack-v2');
  assert.equal(config.gateway.adapter, 'restricted-gateway-v1');
  assert.equal(config.gateway.protocolContractSha256, GATEWAY_PROTOCOL_SHA256);
  assert.equal(config.composeProject, 'flowpack-nas');
  assert.equal(config.ledgerProject, 'flowpack-nas');
  assert.deepEqual(config.gateway.actions, GATEWAY_ACTIONS);
  assert.deepEqual(config.gateway.pins, {
    actionSetRequired: true,
    algorithm: 'sha256',
    helperRequired: true,
    hexLength: 64,
    policyRequired: true,
    protocolRequired: true,
  });
  assert.ok(Object.values(config.gateway.legacy).every((value) => value === false));
  assert.equal(JSON.stringify(config).includes(GATEWAY_PROTOCOL_SHA256), true);
  assert.equal(JSON.stringify(config).includes(HELPER_SHA256), false);
  assert.equal(JSON.stringify(config).includes(GATEWAY_ACTION_SET_SHA256), false);
});

test('tracked protocol contract is canonical, no-newline and exact reviewed digest', () => {
  const text = PROTOCOL_CONTRACT_BYTES.toString('utf8');
  assert.equal(GATEWAY_PROTOCOL_STATUS, 'reviewed-common-contract');
  assert.equal(GATEWAY_PROTOCOL_SHA256,
    'aec60b603fc80fa2741e406b133c99cee79206b5419509a3c875e66c71d35cf9');
  assert.equal(PROTOCOL_CONTRACT_BYTES.at(-1), 0x7d);
  assert.equal(text, canonicalMediaJson(JSON.parse(text)));
  assert.equal(
    mediaSha256(PROTOCOL_CONTRACT_BYTES),
    GATEWAY_PROTOCOL_SHA256,
  );
});

test('config rejects identity collapse, action drift, pin weakening and legacy routes', () => {
  for (const mutate of [
    (config) => { config.schemaVersion = 1; },
    (config) => { config.projectId = 'flowpack-nas'; },
    (config) => { config.composeProject = 'flowpack-v2'; },
    (config) => { config.ledgerProject = 'flowpack-v2'; },
    (config) => { config.gateway.actions = config.gateway.actions.filter((action) => action !== 'media.receive'); },
    (config) => { config.gateway.pins.helperRequired = false; },
    (config) => { config.gateway.legacy.remoteCommand = true; },
  ]) {
    const candidate = structuredClone(BASE_CONFIG);
    mutate(candidate);
    assert.throws(() => validateMigrationConfig(candidate), /migration config is invalid/i);
  }
});

test('operator example contains only a profile selector and four private pins', () => {
  const parsed = parseStrictDotenv(OPERATOR_ENV_EXAMPLE);
  assert.deepEqual(Object.keys(parsed).sort(), [
    'NAS_GATEWAY_ACTION_SET_SHA256',
    'NAS_GATEWAY_HELPER_SHA256',
    'NAS_GATEWAY_POLICY_SHA256',
    'NAS_GATEWAY_PROFILE_DIR',
    'NAS_GATEWAY_PROTOCOL_SHA256',
  ]);
  for (const forbidden of [
    'NAS_REMOTE_ROOT=',
    'NAS_COMPOSE_BIN=',
    'NAS_RUNTIME_ENV_FILE=',
    'NAS_HTTPS_URL=',
    'NAS_SSH_HOST=',
    'NAS_SSH_PRIVATE_KEY=',
  ]) {
    assert.equal(OPERATOR_ENV_EXAMPLE.includes(forbidden), false);
  }
  assert.match(OPERATOR_ENV_EXAMPLE, /flowpack_gateway_ed25519/);
  assert.match(OPERATOR_ENV_EXAMPLE, /administrators-group/);
});

test('operator profile binds exact pins, admin user, forced identity name and private modes', (t) => {
  const fixture = createFixture(t);
  const parsed = parseStrictDotenv(fixture.text);
  const validated = validateOperatorEnvironment(parsed, BASE_CONFIG);
  assert.equal(validated.NAS_GATEWAY_PROFILE_DIR, fixture.profileDirectory);

  assert.throws(
    () => validateOperatorEnvironment({
      ...parsed,
      NAS_GATEWAY_HELPER_SHA256: 'c'.repeat(64),
    }, BASE_CONFIG),
    /gateway profile is invalid/i,
  );
  assert.throws(
    () => validateOperatorEnvironment({
      ...parsed,
      NAS_GATEWAY_ACTION_SET_SHA256: 'd'.repeat(64),
    }, BASE_CONFIG),
    /operator coordinates are invalid/i,
  );

  chmodSync(join(fixture.profileDirectory, GATEWAY_IDENTITY_FILENAME), 0o644);
  assert.throws(
    () => validateOperatorEnvironment(parsed, BASE_CONFIG),
    /gateway profile is invalid/i,
  );
});

test('profile directory symlinks and extra operator coordinates fail closed', (t) => {
  const fixture = createFixture(t);
  const parsed = parseStrictDotenv(fixture.text);
  const linked = join(fixture.temporaryRoot, 'linked-profile');
  symlinkSync(fixture.profileDirectory, linked);
  assert.throws(
    () => validateOperatorEnvironment({
      ...parsed,
      NAS_GATEWAY_PROFILE_DIR: linked,
    }, BASE_CONFIG),
    /gateway profile is invalid/i,
  );
  assert.throws(
    () => parseStrictDotenv(`${fixture.text}NAS_REMOTE_ROOT=/volume1/apps/flowpack\n`),
    /operator environment is invalid/i,
  );
});

test('Compose validation stays local and preserves private database and loopback ingress', () => {
  assert.equal(validateComposeBoundary(BASE_COMPOSE, BASE_RUNTIME_ENV, BASE_CONFIG), true);
  assert.throws(
    () => validateComposeBoundary(
      BASE_COMPOSE.replace('127.0.0.1:', '0.0.0.0:'),
      BASE_RUNTIME_ENV,
      BASE_CONFIG,
    ),
    /Compose boundary is invalid/i,
  );
  assert.throws(
    () => validateComposeBoundary(
      BASE_COMPOSE,
      BASE_RUNTIME_ENV.replace('COMPOSE_PROJECT_NAME=flowpack-nas', 'COMPOSE_PROJECT_NAME=flowpack-v2'),
      BASE_CONFIG,
    ),
    /Compose boundary is invalid/i,
  );
});

test('local check uses only Git plus private local artifacts and returns no coordinates', (t) => {
  const fixture = createFixture(t);
  const result = localCheck(fixture.options);
  assert.equal(result.ok, true);
  assert.equal(result.qualityGateCount, BASE_CONFIG.qualityGates.length);
  assert.ok(result.trackedFileCount > 0);
  assertPublicResult(result);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes(fixture.profileDirectory), false);
  assert.equal(serialized.includes(HELPER_SHA256), false);
});

test('dry-run remains a local committed-HEAD artifact verification', (t) => {
  const fixture = createFixture(t);
  const artifactDirectory = join(fixture.temporaryRoot, 'artifact');
  const stagingDirectory = join(fixture.temporaryRoot, 'staging');
  const result = dryRun({ ...fixture.options, artifactDirectory, stagingDirectory });
  assert.equal(result.ok, true);
  assert.equal(result.trackedDirty, false);
  assert.equal(readFileSync(join(stagingDirectory, 'app.txt'), 'utf8'), 'committed\n');
  assertPublicResult(result);
});

test('nas:check performs exactly one restricted gateway preflight', async (t) => {
  const fixture = createFixture(t);
  const calls = [];
  const result = await check({
    ...fixture.options,
    preflight: async (request) => {
      calls.push(request);
      return {
        action: 'system.preflight',
        actionSetSha256: GATEWAY_ACTION_SET_SHA256,
        helperSha256: HELPER_SHA256,
        ok: true,
        policySha256: POLICY_SHA256,
        protocolSha256: GATEWAY_PROTOCOL_SHA256,
        receiptSha256: 'e'.repeat(64),
      };
    },
  });
  assert.equal(result.preflightChecked, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(Object.keys(calls[0]).sort(), ['processRunner', 'profileDirectory']);
  assert.equal(calls[0].profileDirectory, fixture.profileDirectory);
  assert.equal(calls[0].processRunner, undefined);
  assertPublicResult(result);
});

test('deploy and verify are explicit blockers before any remote or quality operation', (t) => {
  const fixture = createFixture(t);
  let called = false;
  const options = {
    ...fixture.options,
    operations: new Proxy({}, {
      get() {
        called = true;
        throw new Error('must not be reached');
      },
    }),
    processRunner() {
      called = true;
      throw new Error('must not be reached');
    },
  };
  assert.throws(() => deploy(options), /RESTRICTED_GATEWAY_RELEASE_STREAMING_NOT_ENABLED/);
  assert.equal(called, false);
  assert.throws(() => verify(options), /RESTRICTED_GATEWAY_VERIFY_ACTION_NOT_ENABLED/);
  assert.equal(called, false);
  assert.throws(() => createSystemOperations(), /RESTRICTED_GATEWAY_LEGACY_TRANSPORT_DISABLED/);
});

test('standard operator source contains no raw SSH, SCP, Docker or caller remote path transport', () => {
  for (const forbidden of [
    /NAS_REMOTE_ROOT/u,
    /NAS_COMPOSE_BIN/u,
    /scpConnectionArgs/u,
    /sshConnectionArgs/u,
    /remoteCommand\s*\(/u,
    /docker\s+run/iu,
    /execFileSync\(['"]ssh/iu,
    /execFileSync\(['"]scp/iu,
  ]) {
    assert.doesNotMatch(OPERATOR_SOURCE, forbidden);
  }
});
