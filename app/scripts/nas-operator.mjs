#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import {
  accessSync,
  constants,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import {
  delimiter,
  dirname,
  isAbsolute,
  join,
  resolve,
} from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  createReleaseArtifact,
  validateReleasePath,
  verifyReleaseArtifact,
} from './nas-release-artifact.mjs';
import {
  GATEWAY_ACTIONS,
  GATEWAY_ACTION_SET_SHA256,
  GATEWAY_PROJECT_ID,
  GATEWAY_PROTOCOL_SHA256,
  preflightRestrictedGateway,
  readRestrictedGatewayProfile,
} from './nas-restricted-gateway-client.mjs';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROJECT_ROOT = resolve(SCRIPT_DIRECTORY, '..');
const MAX_COMMAND_OUTPUT = 64 * 1024 * 1024;
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const CONFIG_SCHEMA_VERSION = 2;
const COMPOSE_PROJECT_ID = 'flowpack-nas';
const LEDGER_PROJECT_ID = 'flowpack-nas';
const GATEWAY_ADAPTER = 'restricted-gateway-v1';
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const EXPECTED_QUALITY_GATES = Object.freeze([
  ['npm', 'run', 'lint'],
  ['npm', 'run', 'typecheck'],
  ['npx', 'prisma', 'validate'],
  ['npm', 'run', 'test:nas'],
  ['npm', 'run', 'build'],
  ['npm', 'run', 'test:e2e'],
]);
const EXPECTED_SERVICES = Object.freeze(['db', 'web']);
const EXPECTED_HEALTH_CHECKS = Object.freeze([
  'compose-config',
  'postgres-ready',
  'postgres-baseline-evidence',
  'application-database',
  'tailscale-https',
  'public-callbacks-disabled',
]);
const LEGACY_KEYS = Object.freeze([
  'callerControlledPaths',
  'directDocker',
  'rawShell',
  'remoteCommand',
  'scp',
  'sftp',
]);
const OPERATOR_KEYS = Object.freeze([
  'NAS_GATEWAY_ACTION_SET_SHA256',
  'NAS_GATEWAY_HELPER_SHA256',
  'NAS_GATEWAY_POLICY_SHA256',
  'NAS_GATEWAY_PROFILE_DIR',
  'NAS_GATEWAY_PROTOCOL_SHA256',
]);
const TOP_LEVEL_CONFIG_KEYS = Object.freeze([
  'applicationRoot',
  'composeFile',
  'composeProject',
  'cutover',
  'database',
  'gateway',
  'healthChecks',
  'ledgerProject',
  'packageManager',
  'projectId',
  'qualityGates',
  'schemaVersion',
  'services',
  'storage',
]);
const GATEWAY_CONFIG_KEYS = Object.freeze([
  'actions',
  'adapter',
  'legacy',
  'pins',
  'projectId',
  'protocolContractSha256',
  'schemaVersion',
]);
const REQUIRED_LOCAL_COMMANDS = Object.freeze(['git']);

class OperatorError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OperatorError';
  }
}

function fail(message) {
  throw new OperatorError(message);
}

function decodeUtf8(value, failureMessage) {
  if (typeof value === 'string') return value;
  if (!Buffer.isBuffer(value)) fail(failureMessage);
  try {
    return UTF8_DECODER.decode(value);
  } catch {
    fail(failureMessage);
  }
}

function execute(executable, args, options = {}) {
  try {
    return execFileSync(executable, args, {
      cwd: options.cwd,
      encoding: options.encoding,
      env: options.env,
      input: options.input,
      maxBuffer: MAX_COMMAND_OUTPUT,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    fail(options.failureMessage ?? 'local command failed');
  }
}

function commandText(executable, args, options = {}) {
  return execute(executable, args, { ...options, encoding: 'utf8' }).trim();
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
  return (
    isPlainObject(value) &&
    Object.keys(value).sort().join('\n') === [...expectedKeys].sort().join('\n')
  );
}

function exactJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isSafeToken(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 160 &&
    /^[A-Za-z0-9@._/:+=,-]+$/.test(value) &&
    !value.includes('..')
  );
}

export function parseStrictDotenv(contents) {
  const text = decodeUtf8(contents, 'operator environment is invalid');
  if (/\r|[\u0000-\u0009\u000b-\u001f\u007f]/u.test(text)) {
    fail('operator environment is invalid');
  }
  const allowed = new Set(OPERATOR_KEYS);
  const parsed = {};
  for (const line of text.split('\n')) {
    if (line === '' || line.startsWith('#')) continue;
    const match = /^([A-Z][A-Z0-9_]*)=([^\s]+)$/.exec(line);
    if (
      !match ||
      !allowed.has(match[1]) ||
      Object.hasOwn(parsed, match[1]) ||
      /['"`$;\\|&<>!(){}\[\]*?]/u.test(match[2])
    ) {
      fail('operator environment is invalid');
    }
    parsed[match[1]] = match[2];
  }
  if (!hasExactKeys(parsed, OPERATOR_KEYS)) fail('operator environment is invalid');
  return parsed;
}

function validateQualityGates(value) {
  if (!exactJson(value, EXPECTED_QUALITY_GATES)) fail('migration config is invalid');
  for (const argv of value) {
    for (const argument of argv) {
      if (!isSafeToken(argument) || argument === '-c') fail('migration config is invalid');
    }
  }
}

function validateGatewayConfig(gateway) {
  if (
    !hasExactKeys(gateway, GATEWAY_CONFIG_KEYS) ||
    gateway.schemaVersion !== CONFIG_SCHEMA_VERSION ||
    gateway.adapter !== GATEWAY_ADAPTER ||
    gateway.projectId !== GATEWAY_PROJECT_ID ||
    gateway.protocolContractSha256 !== GATEWAY_PROTOCOL_SHA256 ||
    !hasExactKeys(gateway.pins, [
      'actionSetRequired',
      'algorithm',
      'helperRequired',
      'hexLength',
      'policyRequired',
      'protocolRequired',
    ]) ||
    gateway.pins.algorithm !== 'sha256' ||
    gateway.pins.hexLength !== 64 ||
    gateway.pins.actionSetRequired !== true ||
    gateway.pins.helperRequired !== true ||
    gateway.pins.policyRequired !== true ||
    gateway.pins.protocolRequired !== true ||
    !exactJson(gateway.actions, GATEWAY_ACTIONS) ||
    !hasExactKeys(gateway.legacy, LEGACY_KEYS) ||
    LEGACY_KEYS.some((key) => gateway.legacy[key] !== false)
  ) {
    fail('migration config is invalid');
  }
}

export function validateMigrationConfig(config) {
  if (!hasExactKeys(config, TOP_LEVEL_CONFIG_KEYS)) fail('migration config is invalid');
  if (
    config.schemaVersion !== CONFIG_SCHEMA_VERSION ||
    config.projectId !== GATEWAY_PROJECT_ID ||
    config.ledgerProject !== LEDGER_PROJECT_ID ||
    config.composeProject !== COMPOSE_PROJECT_ID ||
    config.composeProject !== config.ledgerProject ||
    config.composeFile !== 'docker-compose.nas.yml' ||
    config.applicationRoot !== '.' ||
    config.packageManager !== 'npm' ||
    !exactJson(config.services, EXPECTED_SERVICES) ||
    !exactJson(config.healthChecks, EXPECTED_HEALTH_CHECKS)
  ) {
    fail('migration config is invalid');
  }
  validateQualityGates(config.qualityGates);
  validateGatewayConfig(config.gateway);
  if (
    !hasExactKeys(config.database, [
      'adapter',
      'legacySqliteMigrationsAllowedOnTarget',
      'publishedPortAllowed',
      'restoreRequiresScratchDrill',
      'service',
    ]) ||
    config.database.adapter !== 'prisma-postgresql-baseline' ||
    config.database.service !== 'db' ||
    config.database.publishedPortAllowed !== false ||
    config.database.restoreRequiresScratchDrill !== true ||
    config.database.legacySqliteMigrationsAllowedOnTarget !== false
  ) {
    fail('migration config is invalid');
  }
  if (
    !hasExactKeys(config.storage, ['adapter', 'manifestRequired', 'mount']) ||
    config.storage.adapter !== 'nas-owned-media' ||
    config.storage.mount !== '/app/data/media' ||
    config.storage.manifestRequired !== true
  ) {
    fail('migration config is invalid');
  }
  if (
    !hasExactKeys(config.cutover, [
      'automaticRollbackBeforeDestinationWriteOnly',
      'destinationStartsReadOnly',
      'sourceSchedulerDisableRequired',
      'sourceWebhookDisableRequired',
      'sourceWriteFreezeRequired',
    ]) ||
    Object.values(config.cutover).some((value) => value !== true)
  ) {
    fail('migration config is invalid');
  }
  return config;
}

function assertPrivateDirectory(path, failureMessage) {
  if (!isAbsolute(path) || resolve(path) !== path) fail(failureMessage);
  try {
    const metadata = lstatSync(path);
    if (
      metadata.isSymbolicLink() ||
      !metadata.isDirectory() ||
      (metadata.mode & 0o777) !== 0o700
    ) {
      fail(failureMessage);
    }
  } catch (error) {
    if (error instanceof OperatorError) throw error;
    fail(failureMessage);
  }
}

export function validateOperatorEnvironment(environment, config) {
  validateMigrationConfig(config);
  if (!hasExactKeys(environment, OPERATOR_KEYS)) fail('operator coordinates are invalid');
  if (
    environment.NAS_GATEWAY_ACTION_SET_SHA256 !== GATEWAY_ACTION_SET_SHA256 ||
    environment.NAS_GATEWAY_PROTOCOL_SHA256 !== GATEWAY_PROTOCOL_SHA256 ||
    !HASH_PATTERN.test(environment.NAS_GATEWAY_HELPER_SHA256) ||
    !HASH_PATTERN.test(environment.NAS_GATEWAY_POLICY_SHA256) ||
    /^0{64}$/u.test(environment.NAS_GATEWAY_HELPER_SHA256) ||
    /^0{64}$/u.test(environment.NAS_GATEWAY_POLICY_SHA256) ||
    environment.NAS_GATEWAY_HELPER_SHA256 === environment.NAS_GATEWAY_POLICY_SHA256
  ) {
    fail('operator coordinates are invalid');
  }
  const profileDirectory = resolve(environment.NAS_GATEWAY_PROFILE_DIR);
  if (profileDirectory !== environment.NAS_GATEWAY_PROFILE_DIR) {
    fail('operator coordinates are invalid');
  }
  assertPrivateDirectory(profileDirectory, 'operator gateway profile is invalid');
  let profile;
  try {
    profile = readRestrictedGatewayProfile(profileDirectory);
  } catch {
    fail('operator gateway profile is invalid');
  }
  if (
    profile.projectId !== config.gateway.projectId ||
    profile.schemaVersion !== config.gateway.schemaVersion ||
    profile.actionSetSha256 !== environment.NAS_GATEWAY_ACTION_SET_SHA256 ||
    profile.protocolSha256 !== environment.NAS_GATEWAY_PROTOCOL_SHA256 ||
    profile.helperSha256 !== environment.NAS_GATEWAY_HELPER_SHA256 ||
    profile.policySha256 !== environment.NAS_GATEWAY_POLICY_SHA256 ||
    profile.sshUsername === 'root' ||
    LEGACY_KEYS.some((key) => profile.legacy[key] !== false)
  ) {
    fail('operator gateway profile is invalid');
  }
  return Object.freeze({
    ...environment,
    NAS_GATEWAY_PROFILE_DIR: profileDirectory,
  });
}

function extractServiceBlocks(composeText) {
  const lines = composeText.split('\n');
  const servicesIndex = lines.findIndex((line) => line === 'services:');
  if (servicesIndex === -1) fail('Compose boundary is invalid');
  const blocks = new Map();
  for (let index = servicesIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.length > 0 && !line.startsWith(' ') && !line.startsWith('#')) break;
    const match = /^  ([A-Za-z0-9_-]+):$/.exec(line);
    if (!match) continue;
    const start = index;
    let end = index + 1;
    while (end < lines.length && !/^  [A-Za-z0-9_-]+:$/.test(lines[end])) {
      if (lines[end].length > 0 && !lines[end].startsWith(' ')) break;
      end += 1;
    }
    if (blocks.has(match[1])) fail('Compose boundary is invalid');
    blocks.set(match[1], lines.slice(start, end).join('\n'));
    index = end - 1;
  }
  return blocks;
}

function setsEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

export function validateComposeBoundary(composeText, runtimeEnvironmentTemplate, config) {
  validateMigrationConfig(config);
  if (
    typeof composeText !== 'string' ||
    typeof runtimeEnvironmentTemplate !== 'string' ||
    !/^version: ["']2\.4["']$/m.test(composeText) ||
    /privileged:\s*(?:true|yes)|network_mode:\s*["']?host|\/var\/run\/docker\.sock/iu.test(
      composeText,
    ) ||
    !/^  database:\n    internal: true$/m.test(composeText) ||
    /^\s+[A-Z0-9_]*(?:PUBLIC|SCHEDULER)[A-Z0-9_]*:\s*["']?true["']?\s*$/m.test(
      composeText,
    ) ||
    /^[A-Z0-9_]*(?:PUBLIC|SCHEDULER)[A-Z0-9_]*=true\s*$/m.test(
      runtimeEnvironmentTemplate,
    )
  ) {
    fail('Compose boundary is invalid');
  }
  const blocks = extractServiceBlocks(composeText);
  if (
    !setsEqual(new Set(blocks.keys()), new Set(config.services)) ||
    !blocks.has('web') ||
    !blocks.has(config.database.service)
  ) {
    fail('Compose boundary is invalid');
  }
  for (const [service, block] of blocks) {
    if (!/^    security_opt:\n      - no-new-privileges:true$/m.test(block)) {
      fail('Compose boundary is invalid');
    }
    if (service !== 'web' && /^    ports:/m.test(block)) fail('Compose boundary is invalid');
    if (service === config.database.service) {
      if (
        !/^    env_file:\n      - \$\{[A-Z][A-Z0-9_]*_NAS_DB_ENV_FILE:-\.env\.nas\.db\.local\}$/m.test(
          block,
        ) ||
        block.includes('.env.nas.local')
      ) {
        fail('Compose boundary is invalid');
      }
    } else if (
      !/^    env_file:\n      - \$\{[A-Z][A-Z0-9_]*_NAS_ENV_FILE:-\.env\.nas\.local\}$/m.test(
        block,
      ) ||
      block.includes('.env.nas.db.local')
    ) {
      fail('Compose boundary is invalid');
    }
  }
  const webLines = blocks.get('web').split('\n');
  const portLines = webLines.filter((line) =>
    /^      - 127\.0\.0\.1:\$\{[A-Z][A-Z0-9_]*\}:3000$/.test(line)
  );
  if (portLines.length !== 1) fail('Compose boundary is invalid');
  const projectMatches = [
    ...runtimeEnvironmentTemplate.matchAll(/^COMPOSE_PROJECT_NAME=([^\r\n]+)$/gm),
  ];
  if (projectMatches.length !== 1 || projectMatches[0][1] !== config.composeProject) {
    fail('Compose boundary is invalid');
  }
  return true;
}

function findExecutable(command, pathEnvironment) {
  if (typeof pathEnvironment !== 'string') fail('required local tool is unavailable');
  for (const directory of pathEnvironment.split(delimiter)) {
    if (directory.length === 0) continue;
    const candidate = join(directory, command);
    try {
      accessSync(candidate, constants.X_OK);
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // Continue without returning local paths.
    }
  }
  fail('required local tool is unavailable');
}

function validateNodeExecutable(executable) {
  try {
    accessSync(executable, constants.X_OK);
    if (!statSync(executable).isFile()) fail('required local tool is unavailable');
  } catch (error) {
    if (error instanceof OperatorError) throw error;
    fail('required local tool is unavailable');
  }
}

function readRegularUtf8File(filePath, failureMessage) {
  try {
    const metadata = lstatSync(filePath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) fail(failureMessage);
    return decodeUtf8(readFileSync(filePath), failureMessage);
  } catch (error) {
    if (error instanceof OperatorError) throw error;
    fail(failureMessage);
  }
}

function parseJsonFile(filePath) {
  try {
    return JSON.parse(readRegularUtf8File(filePath, 'migration config is invalid'));
  } catch (error) {
    if (error instanceof OperatorError) throw error;
    fail('migration config is invalid');
  }
}

function isForbiddenTrackedPath(releasePath) {
  const segments = releasePath.toLowerCase().split('/');
  const name = segments.at(-1);
  if (segments.some((segment) => ['secret', 'secrets', '.secret', '.secrets'].includes(segment))) {
    return true;
  }
  if (name === '.env.example') return false;
  if (name === '.env' || name.startsWith('.env.')) return true;
  if (
    ['.pgpass', 'credentials.json', 'id_dsa', 'id_ecdsa', 'id_ed25519', 'id_rsa',
      'service-account.json'].includes(name)
  ) {
    return true;
  }
  return ['.key', '.p12', '.pfx', '.pkcs12', '.pem'].some((suffix) =>
    name.endsWith(suffix)
  );
}

function splitNullTerminated(buffer) {
  const values = [];
  let start = 0;
  for (let index = 0; index < buffer.byteLength; index += 1) {
    if (buffer[index] !== 0) continue;
    if (index > start) values.push(buffer.subarray(start, index));
    start = index + 1;
  }
  if (start !== buffer.byteLength) fail('Git HEAD tree is invalid');
  return values;
}

function inspectTrackedTree(gitExecutable, repositoryRoot) {
  const tree = execute(
    gitExecutable,
    ['-C', repositoryRoot, 'ls-tree', '-r', '-z', '--full-tree', 'HEAD'],
    { failureMessage: 'unable to inspect Git HEAD tree' },
  );
  let trackedFileCount = 0;
  for (const rawEntry of splitNullTerminated(tree)) {
    const separator = rawEntry.indexOf(9);
    if (separator <= 0) fail('Git HEAD tree is invalid');
    const header = rawEntry.subarray(0, separator).toString('ascii').split(' ');
    if (header.length !== 3) fail('Git HEAD tree is invalid');
    const [mode, type, objectId] = header;
    if (!/^[0-7]{6}$/.test(mode) || !/^[0-9a-f]{40,64}$/.test(objectId)) {
      fail('Git HEAD tree is invalid');
    }
    let releasePath;
    try {
      releasePath = UTF8_DECODER.decode(rawEntry.subarray(separator + 1));
      validateReleasePath(releasePath);
    } catch {
      fail('tracked path is invalid');
    }
    if (isForbiddenTrackedPath(releasePath)) fail('tracked secret path is not allowed');
    if (mode === '120000') fail('tracked symbolic links are not allowed');
    if (mode === '160000' || type === 'commit') fail('tracked submodules are not allowed');
    if (type !== 'blob' || (mode !== '100644' && mode !== '100755')) {
      fail('tracked entry type is not allowed');
    }
    trackedFileCount += 1;
  }
  return trackedFileCount;
}

function inspectLocal(options = {}) {
  const projectRoot = resolve(options.projectRoot ?? DEFAULT_PROJECT_ROOT);
  const pathEnvironment = options.pathEnv ?? process.env.PATH ?? '';
  const executables = new Map();
  for (const command of REQUIRED_LOCAL_COMMANDS) {
    executables.set(command, findExecutable(command, pathEnvironment));
  }
  validateNodeExecutable(options.nodeExecutable ?? process.execPath);
  const repositoryRoot = resolve(
    commandText(executables.get('git'), ['-C', projectRoot, 'rev-parse', '--show-toplevel'], {
      failureMessage: 'unable to resolve Git repository',
    }),
  );
  const config = validateMigrationConfig(
    parseJsonFile(options.configPath ?? join(projectRoot, 'deploy', 'nas-migration.config.json')),
  );
  const operator = validateOperatorEnvironment(
    parseStrictDotenv(readRegularUtf8File(
      options.operatorEnvPath ?? join(projectRoot, '.env.nas-operator.local'),
      'operator environment is invalid',
    )),
    config,
  );
  validateComposeBoundary(
    readRegularUtf8File(
      options.composePath ?? join(projectRoot, config.composeFile),
      'Compose boundary is invalid',
    ),
    readRegularUtf8File(
      options.runtimeEnvExamplePath ?? join(projectRoot, 'ops', 'nas', 'env.example'),
      'Compose boundary is invalid',
    ),
    config,
  );
  const trackedFileCount = inspectTrackedTree(executables.get('git'), repositoryRoot);
  return {
    config,
    executables,
    operator,
    projectRoot,
    repositoryRoot,
    result: {
      ok: true,
      checkCount: REQUIRED_LOCAL_COMMANDS.length + config.qualityGates.length + 6,
      qualityGateCount: config.qualityGates.length,
      trackedFileCount,
    },
  };
}

export function localCheck(options = {}) {
  return inspectLocal(options).result;
}

function readHeadCommit(gitExecutable, repositoryRoot) {
  const commit = commandText(
    gitExecutable,
    ['-C', repositoryRoot, 'rev-parse', '--verify', 'HEAD^{commit}'],
    { failureMessage: 'unable to resolve Git HEAD commit' },
  );
  if (!/^[0-9a-f]{40,64}$/.test(commit)) fail('Git HEAD commit is invalid');
  return commit;
}

function hasWorktreeChanges(gitExecutable, repositoryRoot) {
  return execute(
    gitExecutable,
    ['-C', repositoryRoot, 'status', '--porcelain=v1', '-z', '--untracked-files=all'],
    { failureMessage: 'unable to inspect worktree state' },
  ).byteLength > 0;
}

export function dryRun(options = {}) {
  if (
    typeof options.artifactDirectory !== 'string' ||
    typeof options.stagingDirectory !== 'string' ||
    options.artifactDirectory.length === 0 ||
    options.stagingDirectory.length === 0
  ) {
    fail('dry-run directories are required');
  }
  const inspection = inspectLocal(options);
  const gitExecutable = inspection.executables.get('git');
  const commitBefore = readHeadCommit(gitExecutable, inspection.repositoryRoot);
  const dirtyBefore = hasWorktreeChanges(gitExecutable, inspection.repositoryRoot);
  const created = createReleaseArtifact({
    artifactDirectory: options.artifactDirectory,
    repositoryRoot: inspection.repositoryRoot,
  });
  const verified = verifyReleaseArtifact({
    artifactDirectory: options.artifactDirectory,
    stagingDirectory: options.stagingDirectory,
  });
  const commitAfter = readHeadCommit(gitExecutable, inspection.repositoryRoot);
  const dirtyAfter = hasWorktreeChanges(gitExecutable, inspection.repositoryRoot);
  if (
    commitBefore !== commitAfter ||
    created.commit !== commitBefore ||
    verified.commit !== commitBefore
  ) {
    fail('Git HEAD changed during dry-run');
  }
  const trackedDirty = dirtyBefore || dirtyAfter;
  return {
    ...inspection.result,
    ok: !trackedDirty,
    commit: commitBefore,
    dirtyExcluded: trackedDirty,
    fileCount: verified.fileCount,
    trackedDirty,
  };
}

export function createSystemOperations() {
  fail('RESTRICTED_GATEWAY_LEGACY_TRANSPORT_DISABLED');
}

function validatePreflight(result, operator) {
  if (
    !isPlainObject(result) ||
    result.ok !== true ||
    result.action !== 'system.preflight' ||
    !HASH_PATTERN.test(result.receiptSha256 ?? '') ||
    result.actionSetSha256 !== operator.NAS_GATEWAY_ACTION_SET_SHA256 ||
    result.protocolSha256 !== operator.NAS_GATEWAY_PROTOCOL_SHA256 ||
    result.helperSha256 !== operator.NAS_GATEWAY_HELPER_SHA256 ||
    result.policySha256 !== operator.NAS_GATEWAY_POLICY_SHA256
  ) {
    fail('restricted gateway preflight is invalid');
  }
}

export async function check(options = {}) {
  const inspection = inspectLocal(options);
  const preflight = options.preflight ?? preflightRestrictedGateway;
  if (typeof preflight !== 'function') fail('restricted gateway preflight is invalid');
  let result;
  try {
    result = await preflight({
      processRunner: options.gatewayProcessRunner,
      profileDirectory: inspection.operator.NAS_GATEWAY_PROFILE_DIR,
    });
  } catch {
    fail('restricted gateway preflight failed');
  }
  validatePreflight(result, inspection.operator);
  return { ...inspection.result, preflightChecked: true };
}

export function deploy(options = {}) {
  inspectLocal(options);
  fail('RESTRICTED_GATEWAY_RELEASE_STREAMING_NOT_ENABLED');
}

export function verify(options = {}) {
  inspectLocal(options);
  fail('RESTRICTED_GATEWAY_VERIFY_ACTION_NOT_ENABLED');
}

function serializePublicResult(result) {
  const allowedKeys = new Set([
    'checkCount',
    'commit',
    'dirtyExcluded',
    'fileCount',
    'ok',
    'preflightChecked',
    'qualityGateCount',
    'trackedDirty',
    'trackedFileCount',
  ]);
  if (!isPlainObject(result) || Object.keys(result).some((key) => !allowedKeys.has(key))) {
    fail('public result is invalid');
  }
  for (const [key, value] of Object.entries(result)) {
    if (key === 'commit') {
      if (typeof value !== 'string' || !/^[0-9a-f]{40,64}$/.test(value)) {
        fail('public result is invalid');
      }
    } else if (key.endsWith('Count')) {
      if (!Number.isSafeInteger(value) || value < 0) fail('public result is invalid');
    } else if (typeof value !== 'boolean') {
      fail('public result is invalid');
    }
  }
  return `${JSON.stringify(result)}\n`;
}

async function runCli() {
  const [command, ...args] = process.argv.slice(2);
  if ((command === 'check' || command === 'local-check') && args.length === 0) {
    const result = command === 'check' ? await check() : localCheck();
    process.stdout.write(serializePublicResult(result));
    return;
  }
  if (command === 'dry-run' && (args.length === 0 || args.length === 2)) {
    let temporaryRoot;
    try {
      let artifactDirectory = args[0];
      let stagingDirectory = args[1];
      if (args.length === 0) {
        temporaryRoot = mkdtempSync(join(tmpdir(), 'flowpack-v2-dry-run-'));
        artifactDirectory = join(temporaryRoot, 'artifact');
        stagingDirectory = join(temporaryRoot, 'staging');
        mkdirSync(artifactDirectory, { mode: 0o700 });
        mkdirSync(stagingDirectory, { mode: 0o700 });
      }
      const result = dryRun({ artifactDirectory, stagingDirectory });
      process.stdout.write(serializePublicResult(result));
      if (!result.ok) process.exitCode = 1;
    } finally {
      if (temporaryRoot) rmSync(temporaryRoot, { recursive: true, force: true });
    }
    return;
  }
  if (command === 'deploy' && args.length === 0) {
    deploy();
  }
  if (command === 'verify' && args.length === 0) {
    verify();
  }
  fail('operator command is invalid');
}

function isDirectInvocation() {
  if (!process.argv[1]) return false;
  try {
    return (
      realpathSync(fileURLToPath(import.meta.url)) ===
      realpathSync(fileURLToPath(pathToFileURL(resolve(process.argv[1]))))
    );
  } catch {
    return false;
  }
}

if (isDirectInvocation()) {
  runCli().catch(() => {
    process.stdout.write('{"ok":false}\n');
    process.exitCode = 1;
  });
}
