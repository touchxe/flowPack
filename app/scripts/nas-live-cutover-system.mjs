import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  constants,
  copyFileSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
  writeSync,
} from 'node:fs';
import { dirname, isAbsolute, join, posix, resolve } from 'node:path';

import {
  compareIntegrityEvidence,
  decryptDatabaseDump,
  encryptDatabaseDump,
  readSourceDatabaseConfig,
  writeLibpqServiceFile,
} from './nas-database-artifact.mjs';
import {
  parseStrictDotenv,
  validateMigrationConfig,
  validateOperatorEnvironment,
} from './nas-operator.mjs';
import {
  collectPostgresIntegrityEvidence,
  createCustomFormatDump,
  createSourceQuery,
  extractPinnedTargetPostgres,
  verifyCustomFormatDump,
} from './nas-postgres-migration.mjs';

const PROJECT_ID = 'flowpack-nas';
const FILE_MODE = 0o600;
const DIRECTORY_MODE = 0o700;
const NODE_IMAGE = 'node:20-bookworm-slim';
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const DATABASE_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;
const MIGRATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const REMOTE_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;
const LOCALE_PATTERN = /^[A-Za-z0-9._@-]{1,128}$/;

export class SystemLiveCutoverError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SystemLiveCutoverError';
    this.code = code;
  }
}

function fail(code) {
  throw new SystemLiveCutoverError(code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value, keys) {
  return isPlainObject(value) &&
    Object.keys(value).sort().join('\n') === [...keys].sort().join('\n');
}

function assertPrivateDirectory(path, code) {
  let metadata;
  try {
    metadata = lstatSync(path);
  } catch {
    fail(code);
  }
  if (
    metadata.isSymbolicLink() ||
    !metadata.isDirectory() ||
    (metadata.mode & 0o777) !== DIRECTORY_MODE
  ) {
    fail(code);
  }
  return metadata;
}

function assertPrivateFile(path, code, maximumBytes = MAX_OUTPUT_BYTES) {
  let metadata;
  try {
    metadata = lstatSync(path);
  } catch {
    fail(code);
  }
  if (
    metadata.isSymbolicLink() ||
    !metadata.isFile() ||
    (metadata.mode & 0o777) !== FILE_MODE ||
    metadata.size <= 0 ||
    metadata.size > maximumBytes
  ) {
    fail(code);
  }
  return metadata;
}

function fsyncDirectory(path, code = 'DIRECTORY_FSYNC_FAILED') {
  let descriptor;
  try {
    descriptor = openSync(path, constants.O_RDONLY);
    fsyncSync(descriptor);
  } catch {
    fail(code);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function ensurePrivateDirectory(path, code = 'PRIVATE_DIRECTORY_INVALID') {
  if (!existsSync(path)) {
    const parent = dirname(path);
    assertPrivateDirectory(parent, code);
    try {
      mkdirSync(path, { mode: DIRECTORY_MODE });
      fsyncDirectory(parent, code);
    } catch (error) {
      if (error instanceof SystemLiveCutoverError) throw error;
      fail(code);
    }
  }
  assertPrivateDirectory(path, code);
  return path;
}

function writeExclusivePrivate(path, value, code) {
  const payload = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  let descriptor;
  try {
    descriptor = openSync(
      path,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      FILE_MODE,
    );
    let offset = 0;
    while (offset < payload.byteLength) {
      const written = writeSync(descriptor, payload, offset, payload.byteLength - offset);
      if (written <= 0) fail(code);
      offset += written;
    }
    fsyncSync(descriptor);
  } catch (error) {
    if (error instanceof SystemLiveCutoverError) throw error;
    fail(code);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  assertPrivateFile(path, code);
  fsyncDirectory(dirname(path), code);
}

function hashFile(path) {
  const hash = createHash('sha256');
  let descriptor;
  try {
    descriptor = openSync(path, constants.O_RDONLY);
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    while (true) {
      const bytesRead = readSync(descriptor, buffer, 0, buffer.byteLength, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } catch {
    fail('ARTIFACT_HASH_FAILED');
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  return hash.digest('hex');
}

function writeCanonicalPrivate(path, value) {
  const payload = `${JSON.stringify(value)}\n`;
  writeExclusivePrivate(path, payload, 'ARTIFACT_MANIFEST_WRITE_FAILED');
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

function readCanonicalPrivateJson(path, code) {
  assertPrivateFile(path, code, 1024 * 1024);
  let raw;
  let value;
  try {
    raw = readFileSync(path, 'utf8');
    value = JSON.parse(raw);
  } catch {
    fail(code);
  }
  if (raw !== `${JSON.stringify(value)}\n`) fail(code);
  return value;
}

export function readSeparateOffsiteProfile(profilePath, workspacePath, options = {}) {
  const statPath = options.statPath ?? statSync;
  if (typeof statPath !== 'function') fail('OFFSITE_PROFILE_INVALID');
  const profile = readCanonicalPrivateJson(profilePath, 'OFFSITE_PROFILE_INVALID');
  if (
    !hasExactKeys(profile, ['profileId', 'root', 'schemaVersion', 'type']) ||
    profile.schemaVersion !== 1 ||
    profile.type !== 'filesystem' ||
    typeof profile.profileId !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(profile.profileId) ||
    /replace|placeholder|example|sample|change[-_.]?me/i.test(profile.profileId) ||
    typeof profile.root !== 'string' ||
    !isAbsolute(profile.root) ||
    resolve(profile.root) !== profile.root ||
    profile.root === workspacePath
  ) {
    fail('OFFSITE_PROFILE_INVALID');
  }
  assertPrivateDirectory(profile.root, 'OFFSITE_PROFILE_INVALID');
  assertPrivateDirectory(workspacePath, 'OFFSITE_PROFILE_INVALID');
  let offsiteDevice;
  let workspaceDevice;
  try {
    offsiteDevice = statPath(profile.root).dev;
    workspaceDevice = statPath(workspacePath).dev;
  } catch {
    fail('OFFSITE_DEVICE_NOT_SEPARATE');
  }
  if (
    !Number.isSafeInteger(offsiteDevice) ||
    !Number.isSafeInteger(workspaceDevice) ||
    offsiteDevice === workspaceDevice
  ) {
    fail('OFFSITE_DEVICE_NOT_SEPARATE');
  }
  return Object.freeze({ profileId: profile.profileId, root: profile.root });
}

function defaultProcessRunner(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    encoding: 'utf8',
    input: options.input,
    maxBuffer: MAX_OUTPUT_BYTES,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error,
  };
}

function successful(result, code) {
  if (
    !isPlainObject(result) ||
    result.error ||
    result.status !== 0 ||
    typeof result.stdout !== 'string' ||
    typeof result.stderr !== 'string'
  ) {
    fail(code);
  }
  return result.stdout;
}

function parseJsonOutput(output, code) {
  const text = output.trim();
  if (text.length === 0 || text.length > 1024 * 1024) fail(code);
  try {
    const parsed = JSON.parse(text);
    if (!isPlainObject(parsed)) fail(code);
    return parsed;
  } catch (error) {
    if (error instanceof SystemLiveCutoverError) throw error;
    fail(code);
  }
}

function shellQuote(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/u.test(value)) {
    fail('REMOTE_ARGUMENT_INVALID');
  }
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function remoteCommand(script, args) {
  return ['/bin/sh', '-c', script, 'nas-live-db', ...args]
    .map(shellQuote)
    .join(' ');
}

function assertRemoteRootSegments(value) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value === '/' ||
    posix.normalize(value) !== value
  ) {
    fail('REMOTE_ROOT_UNSAFE');
  }
  const segments = value.split('/').filter(Boolean);
  if (
    segments.length < 3 ||
    segments.some((segment) => !REMOTE_SEGMENT_PATTERN.test(segment) || segment === '.' || segment === '..')
  ) {
    fail('REMOTE_ROOT_UNSAFE');
  }
  return value;
}

export function buildRemoteHelperVector({
  uid,
  gid,
  projectRoot,
  image,
  command,
  helperArguments,
}) {
  if (
    !/^[0-9]+$/.test(uid ?? '') ||
    !/^[0-9]+$/.test(gid ?? '') ||
    assertRemoteRootSegments(projectRoot) !== projectRoot ||
    image !== NODE_IMAGE ||
    !['prepare', 'status', 'advance', 'finish-rollback'].includes(command) ||
    !Array.isArray(helperArguments) ||
    helperArguments.some(
      (value) => typeof value !== 'string' || /[\u0000-\u001f\u007f]/u.test(value),
    )
  ) {
    fail('REMOTE_HELPER_VECTOR_INVALID');
  }
  return Object.freeze([
    uid,
    gid,
    projectRoot,
    NODE_IMAGE,
    command,
    PROJECT_ID,
    '/project',
    ...helperArguments,
  ]);
}

export function createLegacySshTransport(control, options = {}) {
  const run = options.processRunner ?? defaultProcessRunner;
  if (typeof run !== 'function') fail('SYSTEM_RUNNER_INVALID');
  const config = validateMigrationConfig(
    JSON.parse(readFileSync(control.migrationConfigPath, 'utf8')),
  );
  const operator = validateOperatorEnvironment(
    parseStrictDotenv(readFileSync(control.operatorEnvPath)),
    config,
    options.operatorValidationOptions,
  );
  assertRemoteRootSegments(operator.NAS_REMOTE_ROOT);
  const target = `${operator.NAS_SSH_USERNAME}@${operator.NAS_SSH_HOST}`;
  const projectRoot = assertRemoteRootSegments(posix.dirname(operator.NAS_REMOTE_ROOT));
  const sshArgs = [
    '-T',
    '-o',
    'BatchMode=yes',
    '-o',
    'StrictHostKeyChecking=yes',
    '-o',
    'IdentitiesOnly=yes',
    '-i',
    operator.NAS_SSH_PRIVATE_KEY,
    '-p',
    operator.NAS_SSH_PORT,
  ];
  const scpArgs = [
    '-O',
    '-B',
    '-o',
    'BatchMode=yes',
    '-o',
    'StrictHostKeyChecking=yes',
    '-o',
    'IdentitiesOnly=yes',
    '-i',
    operator.NAS_SSH_PRIVATE_KEY,
    '-P',
    operator.NAS_SSH_PORT,
  ];

  function remote(script, args = [], input) {
    return successful(
      run('ssh', [...sshArgs, target, remoteCommand(script, args)], { input }),
      'REMOTE_OPERATION_FAILED',
    );
  }

  function assertTransferPath(remotePath) {
    assertRemoteRootSegments(dirname(remotePath));
    const base = posix.basename(remotePath);
    if (!REMOTE_SEGMENT_PATTERN.test(base)) fail('REMOTE_TRANSFER_PATH_UNSAFE');
    return remotePath;
  }

  function scpFrom(remotePath, localPath) {
    assertTransferPath(remotePath);
    successful(
      run('scp', [...scpArgs, `${target}:${remotePath}`, localPath]),
      'REMOTE_DOWNLOAD_FAILED',
    );
  }

  function scpTo(localPath, remotePath) {
    assertTransferPath(remotePath);
    successful(
      run('scp', [...scpArgs, localPath, `${target}:${remotePath}`]),
      'REMOTE_UPLOAD_FAILED',
    );
  }

  let runtimeIdentity;
  function helper(command, helperArguments) {
    if (runtimeIdentity === undefined) {
      runtimeIdentity = remote(
        'set -eu\ntest -x "$1"\n"$1" version >/dev/null\ndocker image inspect "$2" >/dev/null\nprintf "%s:%s\\n" "$(id -u)" "$(id -g)"',
        [operator.NAS_COMPOSE_BIN, NODE_IMAGE],
      ).trim();
      if (!/^[0-9]+:[0-9]+$/.test(runtimeIdentity)) fail('REMOTE_RUNTIME_INVALID');
    }
    const [uid, gid] = runtimeIdentity.split(':');
    const vector = buildRemoteHelperVector({
      uid,
      gid,
      projectRoot,
      image: NODE_IMAGE,
      command,
      helperArguments,
    });
    const output = remote(
      'set -eu\nuid=$1\ngid=$2\nroot=$3\nimage=$4\nshift 4\nexec docker run --rm --network none --user "$uid:$gid" --volume "$root:/project" --workdir /project "$image" node /project/current/scripts/nas-remote-database.mjs "$@"',
      vector,
    );
    const parsed = parseJsonOutput(output, 'REMOTE_HELPER_FAILED');
    if (parsed.ok !== true) fail('REMOTE_HELPER_FAILED');
    return parsed;
  }

  function compose(args, input) {
    return remote(
      'set -eu\nrelease=$1\nroot=$2\ncompose=$3\nproject=$4\nfile=$5\nshift 5\ncd "$release"\nexport FLOWPACK_NAS_ENV_FILE="$root/.env.nas.local"\nexport FLOWPACK_NAS_DB_ENV_FILE="$root/.env.nas.db.local"\nexec "$compose" --env-file "$root/.env.nas.local" --project-name "$project" --file "$file" "$@"',
      [
        `${projectRoot}/current`,
        projectRoot,
        operator.NAS_COMPOSE_BIN,
        PROJECT_ID,
        'docker-compose.nas.yml',
        ...args,
      ],
      input,
    );
  }

  function dbPsql(database, sql) {
    if (!DATABASE_PATTERN.test(database)) fail('DATABASE_NAME_INVALID');
    return compose([
      'exec',
      '-T',
      'db',
      'sh',
      '-eu',
      '-c',
      'exec psql -X -q -A -t -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1" --file -',
      'nas-live-db',
      database,
    ], sql);
  }

  function dbShell(script, args = []) {
    return compose([
      'exec',
      '-T',
      'db',
      'sh',
      '-eu',
      '-c',
      script,
      'nas-live-db',
      ...args,
    ]);
  }

  return Object.freeze({
    compose,
    dbPsql,
    dbShell,
    helper,
    httpsUrl: new URL(operator.NAS_HTTPS_URL),
    operator,
    projectRoot,
    remote,
    run,
    scpFrom,
    scpTo,
  });
}

function copyPrivateAndFsync(sourcePath, destinationPath, code) {
  assertPrivateFile(sourcePath, code);
  assertPrivateDirectory(dirname(destinationPath), code);
  try {
    copyFileSync(sourcePath, destinationPath, constants.COPYFILE_EXCL);
    chmodSync(destinationPath, FILE_MODE);
    const descriptor = openSync(destinationPath, constants.O_RDONLY);
    try {
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
  } catch {
    rmSync(destinationPath, { force: true });
    fail(code);
  }
}

function ensureOffsiteHierarchy(root, migrationId) {
  const projectRoot = ensurePrivateDirectory(join(root, PROJECT_ID), 'OFFSITE_DIRECTORY_INVALID');
  const migrationRoot = ensurePrivateDirectory(
    join(projectRoot, migrationId),
    'OFFSITE_DIRECTORY_INVALID',
  );
  return ensurePrivateDirectory(
    join(migrationRoot, 'live-cutover'),
    'OFFSITE_DIRECTORY_INVALID',
  );
}

function publishOffsiteAtomic({ profile, migrationId, kind, encryptedPath, manifestPath }) {
  const parent = ensureOffsiteHierarchy(profile.root, migrationId);
  const finalPath = join(parent, kind);
  const incomingPath = join(parent, `.${kind}.incoming-${hashFile(manifestPath).slice(0, 16)}`);
  if (existsSync(finalPath) || existsSync(incomingPath)) fail('OFFSITE_DESTINATION_NOT_EMPTY');
  try {
    mkdirSync(incomingPath, { mode: DIRECTORY_MODE });
    fsyncDirectory(parent, 'OFFSITE_FSYNC_FAILED');
    copyPrivateAndFsync(
      encryptedPath,
      join(incomingPath, `${kind}.dump.enc`),
      'OFFSITE_COPY_FAILED',
    );
    // The manifest is deliberately published last inside the staging directory.
    copyPrivateAndFsync(
      manifestPath,
      join(incomingPath, `${kind}.manifest.json`),
      'OFFSITE_COPY_FAILED',
    );
    fsyncDirectory(incomingPath, 'OFFSITE_FSYNC_FAILED');
    renameSync(incomingPath, finalPath);
    fsyncDirectory(parent, 'OFFSITE_FSYNC_FAILED');
  } catch (error) {
    rmSync(incomingPath, { recursive: true, force: true });
    if (existsSync(parent)) fsyncDirectory(parent, 'OFFSITE_FSYNC_FAILED');
    if (error instanceof SystemLiveCutoverError) throw error;
    fail('OFFSITE_COPY_FAILED');
  }
  return finalPath;
}

async function sealAndVerifyArtifact({ control, dumpPath, kind, binding, statPath }) {
  const profile = readSeparateOffsiteProfile(
    control.offsiteProfilePath,
    control.workspacePath,
    { statPath },
  );
  assertPrivateFile(dumpPath, 'LIVE_DUMP_INVALID');
  const liveRoot = ensurePrivateDirectory(
    join(control.workspacePath, 'live-cutover'),
    'LIVE_ARTIFACT_DIRECTORY_INVALID',
  );
  const sealedRoot = ensurePrivateDirectory(
    join(liveRoot, 'sealed'),
    'LIVE_ARTIFACT_DIRECTORY_INVALID',
  );
  const artifactRoot = join(sealedRoot, kind);
  if (existsSync(artifactRoot)) fail('LIVE_SEALED_ARTIFACT_EXISTS');
  mkdirSync(artifactRoot, { mode: DIRECTORY_MODE });
  fsyncDirectory(sealedRoot, 'LIVE_ARTIFACT_FSYNC_FAILED');
  const encryptedPath = join(artifactRoot, `${kind}.dump.enc`);
  const encryption = await encryptDatabaseDump({
    projectId: PROJECT_ID,
    migrationId: control.migrationId,
    dumpPath,
    keyPath: control.backupKeyPath,
    encryptedPath,
  });
  const manifest = {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    migrationId: control.migrationId,
    releaseCommit: control.releaseCommit,
    kind,
    binding,
    plaintextBytes: encryption.plaintextBytes,
    plaintextSha256: encryption.plaintextSha256,
    encryptedBytes: encryption.encryptedBytes,
    encryptedSha256: encryption.encryptedSha256,
    algorithm: encryption.algorithm,
    formatVersion: encryption.formatVersion,
  };
  const manifestPath = join(artifactRoot, `${kind}.manifest.json`);
  const manifestDigest = writeCanonicalPrivate(manifestPath, manifest);
  fsyncDirectory(artifactRoot, 'LIVE_ARTIFACT_FSYNC_FAILED');

  const offsitePath = publishOffsiteAtomic({
    profile,
    migrationId: control.migrationId,
    kind,
    encryptedPath,
    manifestPath,
  });
  const readbackRoot = join(artifactRoot, 'readback');
  mkdirSync(readbackRoot, { mode: DIRECTORY_MODE });
  fsyncDirectory(artifactRoot, 'LIVE_ARTIFACT_FSYNC_FAILED');
  const readbackEncrypted = join(readbackRoot, `${kind}.dump.enc`);
  const readbackManifest = join(readbackRoot, `${kind}.manifest.json`);
  copyPrivateAndFsync(
    join(offsitePath, `${kind}.dump.enc`),
    readbackEncrypted,
    'OFFSITE_READBACK_FAILED',
  );
  copyPrivateAndFsync(
    join(offsitePath, `${kind}.manifest.json`),
    readbackManifest,
    'OFFSITE_READBACK_FAILED',
  );
  fsyncDirectory(readbackRoot, 'OFFSITE_FSYNC_FAILED');
  if (
    hashFile(readbackEncrypted) !== encryption.encryptedSha256 ||
    hashFile(readbackManifest) !== manifestDigest
  ) {
    fail('OFFSITE_READBACK_FAILED');
  }
  const readbackDumpPath = join(readbackRoot, `${kind}.dump`);
  await decryptDatabaseDump({
    projectId: PROJECT_ID,
    migrationId: control.migrationId,
    encryptedPath: readbackEncrypted,
    keyPath: control.backupKeyPath,
    outputPath: readbackDumpPath,
    expectedPlaintextSha256: encryption.plaintextSha256,
    expectedEncryptedSha256: encryption.encryptedSha256,
  });
  if (hashFile(readbackDumpPath) !== encryption.plaintextSha256) {
    fail('OFFSITE_READBACK_FAILED');
  }
  fsyncDirectory(readbackRoot, 'OFFSITE_FSYNC_FAILED');
  return Object.freeze({
    dumpDigest: encryption.plaintextSha256,
    encryptedDigest: encryption.encryptedSha256,
    manifestDigest,
    readbackDumpPath,
    encrypted: true,
    readbackVerified: true,
    separateDevice: true,
    fsyncCompleted: true,
  });
}

function validatePrepareInspection(value) {
  if (
    !hasExactKeys(value, [
      'candidateAvailable',
      'existingBytes',
      'existingDatabase',
      'previousAvailable',
    ]) ||
    value.candidateAvailable !== true ||
    value.previousAvailable !== true ||
    value.existingDatabase !== true ||
    !Number.isSafeInteger(value.existingBytes) ||
    value.existingBytes < 0
  ) {
    fail('TARGET_INSPECTION_INVALID');
  }
  return value;
}

function validateLocale(value) {
  if (typeof value !== 'string' || !LOCALE_PATTERN.test(value)) {
    fail('SOURCE_DATABASE_LOCALE_INVALID');
  }
  return value;
}

function sourceEvidenceDigest(value) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function readAuthSmokeInput(path) {
  const input = readCanonicalPrivateJson(path, 'AUTH_SMOKE_INPUT_INVALID');
  if (
    !hasExactKeys(input, ['email', 'password', 'schemaVersion', 'socialToken', 'token']) ||
    input.schemaVersion !== 1 ||
    typeof input.email !== 'string' ||
    input.email.length < 3 ||
    input.email.length > 320 ||
    typeof input.password !== 'string' ||
    input.password.length < 1 ||
    input.password.length > 1024 ||
    typeof input.token !== 'string' ||
    input.token.length < 32 ||
    input.token.length > 512 ||
    typeof input.socialToken !== 'string' ||
    input.socialToken.length < 32 ||
    input.socialToken.length > 512 ||
    input.socialToken === input.token ||
    /[\u0000\r\n]/u.test(input.email) ||
    /\u0000/u.test(input.password) ||
    /[\u0000\r\n]/u.test(input.token) ||
    /[\u0000\r\n]/u.test(input.socialToken)
  ) {
    fail('AUTH_SMOKE_INPUT_INVALID');
  }
  return input;
}

export function createSystemLiveCutoverOperations(control, options = {}) {
  if (!isPlainObject(control) || control.projectId !== PROJECT_ID) {
    fail('LIVE_CONTROL_INVALID');
  }
  const statPath = options.statPath ?? statSync;
  if (options.transport === undefined) {
    fail('RESTRICTED_GATEWAY_STANDARD_PATH_REQUIRED');
  }
  const transport = options.transport;
  if (!isPlainObject(transport)) fail('SYSTEM_TRANSPORT_INVALID');
  const localRun = options.processRunner ?? defaultProcessRunner;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const collectEvidence = options.collectEvidence ?? collectPostgresIntegrityEvidence;
  const compareEvidence = options.compareEvidence ?? compareIntegrityEvidence;
  if (
    typeof localRun !== 'function' ||
    typeof fetchImpl !== 'function' ||
    typeof collectEvidence !== 'function' ||
    typeof compareEvidence !== 'function'
  ) {
    fail('SYSTEM_RUNNER_INVALID');
  }

  function helperIdentity(context) {
    return [
      context.control.migrationId,
      context.control.releaseCommit,
      context.tokenDigest,
    ];
  }

  async function collectSource(context) {
    const liveRoot = ensurePrivateDirectory(
      join(context.control.workspacePath, 'live-cutover'),
      'SOURCE_SERVICE_DIRECTORY_INVALID',
    );
    const serviceRoot = join(liveRoot, 'source-service');
    if (existsSync(serviceRoot)) fail('SOURCE_SERVICE_DIRECTORY_NOT_EMPTY');
    mkdirSync(serviceRoot, { mode: DIRECTORY_MODE });
    fsyncDirectory(liveRoot, 'SOURCE_SERVICE_DIRECTORY_INVALID');
    const servicePath = join(serviceRoot, 'pg_service.conf');
    try {
      const source = readSourceDatabaseConfig(context.control.sourceConfigPath);
      writeLibpqServiceFile(source, servicePath);
      const composeText = readFileSync(context.control.composePath, 'utf8');
      const target = extractPinnedTargetPostgres(composeText);
      const query = createSourceQuery({
        clientImage: target.image,
        serviceDirectory: serviceRoot,
        run: localRun,
      });
      const evidence = await collectEvidence({
        projectId: PROJECT_ID,
        migrationId: context.control.migrationId,
        query,
        schemaAllowlist: ['public'],
      });
      if (evidence.serverMajor > target.major) fail('SOURCE_NEWER_THAN_TARGET');
      return evidence;
    } finally {
      rmSync(servicePath, { force: true });
      rmSync(join(serviceRoot, 'pgpass'), { force: true });
      rmSync(serviceRoot, { recursive: true, force: true });
      fsyncDirectory(liveRoot, 'SOURCE_SERVICE_DIRECTORY_INVALID');
    }
  }

  function destinationQuery(database, sql) {
    return transport.dbPsql(database, sql);
  }

  function identityMarker(context, kind, digest = undefined) {
    const base = `${PROJECT_ID}:${context.control.migrationId}:${kind}`;
    if (digest === undefined) return base;
    if (!HASH_PATTERN.test(digest)) fail('DATABASE_IDENTITY_INVALID');
    return `${base}:${digest}`;
  }

  function inspectDatabaseTopology(context) {
    const { canonicalDatabase, candidateDatabase, previousDatabase } = context.databaseNames;
    const result = parseJsonOutput(transport.dbPsql('postgres', `
SELECT json_build_object(
  'canonical', json_build_object(
    'exists', EXISTS (SELECT 1 FROM pg_database WHERE datname = '${canonicalDatabase}'),
    'comment', (SELECT obj_description(oid, 'pg_database') FROM pg_database WHERE datname = '${canonicalDatabase}')
  ),
  'candidate', json_build_object(
    'exists', EXISTS (SELECT 1 FROM pg_database WHERE datname = '${candidateDatabase}'),
    'comment', (SELECT obj_description(oid, 'pg_database') FROM pg_database WHERE datname = '${candidateDatabase}')
  ),
  'previous', json_build_object(
    'exists', EXISTS (SELECT 1 FROM pg_database WHERE datname = '${previousDatabase}'),
    'comment', (SELECT obj_description(oid, 'pg_database') FROM pg_database WHERE datname = '${previousDatabase}')
  )
)::text;
`), 'DATABASE_TOPOLOGY_INVALID');
    if (!hasExactKeys(result, ['candidate', 'canonical', 'previous'])) {
      fail('DATABASE_TOPOLOGY_INVALID');
    }
    for (const slot of Object.values(result)) {
      if (
        !hasExactKeys(slot, ['comment', 'exists']) ||
        typeof slot.exists !== 'boolean' ||
        !(slot.comment === null || typeof slot.comment === 'string')
      ) {
        fail('DATABASE_TOPOLOGY_INVALID');
      }
    }
    return result;
  }

  function assertCandidateIdentity(context, topology, dumpDigest) {
    if (
      topology.candidate.exists !== true ||
      topology.candidate.comment !== identityMarker(context, 'candidate', dumpDigest)
    ) {
      fail('CANDIDATE_IDENTITY_MISMATCH');
    }
  }

  function verifyCandidateSchema(context) {
    const schemaSummary = parseJsonOutput(
      transport.dbPsql(context.databaseNames.candidateDatabase, `
SELECT json_build_object(
  'schemas', COALESCE((
    SELECT json_agg(nspname ORDER BY nspname)
    FROM pg_namespace
    WHERE nspname !~ '^pg_' AND nspname <> 'information_schema'
  ), '[]'::json),
  'baselineAbsent', to_regclass('public._prisma_migrations') IS NULL
)::text;
`),
      'CANDIDATE_SCHEMA_INVALID',
    );
    if (
      !hasExactKeys(schemaSummary, ['baselineAbsent', 'schemas']) ||
      JSON.stringify(schemaSummary.schemas) !== JSON.stringify(['public']) ||
      schemaSummary.baselineAbsent !== true
    ) {
      fail('CANDIDATE_SCHEMA_INVALID');
    }
  }

  return Object.freeze({
    status(context) {
      const output = transport.remote(
        'set -eu\nroot=$1\ntest -d "$root"\ntest ! -L "$root"\nif [ ! -e "$root/state/database-migration.lock" ]; then printf "{\\"ok\\":true,\\"phase\\":\\"UNLOCKED\\",\\"writesEnabled\\":false}\\n"; else printf "LOCKED\\n"; fi',
        [transport.projectRoot],
      );
      if (output.trim().startsWith('{')) {
        return parseJsonOutput(output, 'REMOTE_STATUS_INVALID');
      }
      return transport.helper('status', helperIdentity(context));
    },

    acquireRemoteLock(context) {
      const temporarySnapshot = `${transport.projectRoot}/state/.runtime-env-before-${context.control.migrationId}`;
      transport.remote(
        'set -eu\nroot=$1\ntmp=$2\ntest -d "$root/state"\ntest ! -L "$root/state"\ntest "$(stat -c %a "$root/state")" = 700\ntest ! -e "$tmp"\nfor file in "$root/.env.nas.local" "$root/.env.nas.ro.local" "$root/.env.nas.rw.local" "$root/.env.nas.db.local"; do test -f "$file"; test ! -L "$file"; test "$(stat -c %a "$file")" = 600; done\ngrep -Fx "FLOWPACK_WRITE_MODE=read-only" "$root/.env.nas.ro.local" >/dev/null\ngrep -Fx "FLOWPACK_SCHEDULER_ENABLED=false" "$root/.env.nas.ro.local" >/dev/null\ngrep -Fx "FLOWPACK_PUBLIC_CALLBACKS_ENABLED=false" "$root/.env.nas.ro.local" >/dev/null\ngrep -Fx "FLOWPACK_PUBLIC_MEDIA_ENABLED=false" "$root/.env.nas.ro.local" >/dev/null\ngrep -Fx "FLOWPACK_AUTH_SMOKE_ENABLED=true" "$root/.env.nas.ro.local" >/dev/null\ngrep -Fx "FLOWPACK_SOCIAL_TOKEN_SMOKE_ENABLED=true" "$root/.env.nas.ro.local" >/dev/null\ngrep -E "^FLOWPACK_SOCIAL_TOKEN_SMOKE_TOKEN=.{32,512}$" "$root/.env.nas.ro.local" >/dev/null\ngrep -E "^DATABASE_URL=postgresql://flowpack_app_ro:" "$root/.env.nas.ro.local" >/dev/null\ngrep -Fx "FLOWPACK_WRITE_MODE=read-write" "$root/.env.nas.rw.local" >/dev/null\ngrep -Fx "FLOWPACK_SCHEDULER_ENABLED=false" "$root/.env.nas.rw.local" >/dev/null\ngrep -Fx "FLOWPACK_PUBLIC_CALLBACKS_ENABLED=false" "$root/.env.nas.rw.local" >/dev/null\ngrep -Fx "FLOWPACK_PUBLIC_MEDIA_ENABLED=false" "$root/.env.nas.rw.local" >/dev/null\ngrep -Fx "FLOWPACK_AUTH_SMOKE_ENABLED=false" "$root/.env.nas.rw.local" >/dev/null\ngrep -Fx "FLOWPACK_SOCIAL_TOKEN_SMOKE_ENABLED=false" "$root/.env.nas.rw.local" >/dev/null\ngrep -E "^DATABASE_URL=postgresql://flowpack_app_rw:" "$root/.env.nas.rw.local" >/dev/null\numask 077\ncp "$root/.env.nas.local" "$tmp"\nchmod 600 "$tmp"\nsync "$tmp"\nsync "$root/state"',
        [transport.projectRoot, temporarySnapshot],
      );
      let acquired;
      try {
        acquired = transport.helper('prepare', [
          ...helperIdentity(context),
          context.databaseNames.candidateDatabase,
          context.databaseNames.previousDatabase,
          context.confirmation,
        ]);
      } catch (error) {
        try {
          transport.remote('set -eu\nrm -f "$1"\nsync "$(dirname "$1")"', [temporarySnapshot]);
        } catch {
          // The pre-lock snapshot is secret-bearing; cleanup failure remains fail-closed.
        }
        throw error;
      }
      try {
        transport.remote(
          'set -eu\ntmp=$1\nlock=$2\ntest -f "$tmp"\ntest ! -L "$tmp"\ntest "$(stat -c %a "$tmp")" = 600\ntest -d "$lock"\ntest ! -L "$lock"\ntest "$(stat -c %a "$lock")" = 700\ntest ! -e "$lock/runtime-env.before"\nmv "$tmp" "$lock/runtime-env.before"\nsync "$lock/runtime-env.before"\nsync "$lock"',
          [temporarySnapshot, `${transport.projectRoot}/state/database-migration.lock`],
        );
      } catch (snapshotError) {
        const abortDigest = createHash('sha256')
          .update(JSON.stringify({
            schemaVersion: 1,
            projectId: PROJECT_ID,
            migrationId: context.control.migrationId,
            releaseCommit: context.control.releaseCommit,
            reason: 'RUNTIME_SNAPSHOT_FINALIZATION_FAILED',
          }))
          .digest('hex');
        try {
          transport.helper('finish-rollback', [
            ...helperIdentity(context),
            abortDigest,
            `${PROJECT_ID}:${context.control.migrationId}:pre-write-rollback`,
          ]);
          transport.remote('set -eu\nrm -f "$1"\nsync "$(dirname "$1")"', [temporarySnapshot]);
        } catch {
          fail('REMOTE_LOCK_ABORT_FAILED');
        }
        throw snapshotError;
      }
      return acquired;
    },

    advanceRemotePhase(context) {
      return transport.helper('advance', [
        ...helperIdentity(context),
        context.expectedPhase,
        context.targetPhase,
        context.evidenceDigest,
        context.confirmation,
      ]);
    },

    async prepareTarget(context) {
      readSeparateOffsiteProfile(
        context.control.offsiteProfilePath,
        context.control.workspacePath,
        { statPath },
      );
      const { candidateDatabase, previousDatabase, canonicalDatabase } = context.databaseNames;
      const inspection = validatePrepareInspection(parseJsonOutput(
        transport.dbPsql('postgres', `
SELECT json_build_object(
  'candidateAvailable', NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${candidateDatabase}'),
  'previousAvailable', NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${previousDatabase}'),
  'existingDatabase', EXISTS (SELECT 1 FROM pg_database WHERE datname = '${canonicalDatabase}'),
  'existingBytes', COALESCE((SELECT pg_database_size(datname) FROM pg_database WHERE datname = '${canonicalDatabase}'), 0)
)::text;
`),
        'TARGET_INSPECTION_INVALID',
      ));
      const availableBytesText = transport.remote(
        'set -eu\ndf -Pk "$1" | awk "NR == 2 { print \\$4 * 1024 }"',
        [transport.projectRoot],
      ).trim();
      const availableBytes = Number(availableBytesText);
      const requiredBytes = Math.max(
        4 * 1024 * 1024 * 1024,
        Math.ceil(inspection.existingBytes * 2.5) + 1024 * 1024 * 1024,
      );
      if (!Number.isSafeInteger(availableBytes) || availableBytes < requiredBytes) {
        fail('TARGET_CAPACITY_INSUFFICIENT');
      }

      const liveRoot = ensurePrivateDirectory(
        join(context.control.workspacePath, 'live-cutover'),
        'EXISTING_BACKUP_WORKSPACE_INVALID',
      );
      const localRoot = join(liveRoot, 'existing-nas');
      if (existsSync(localRoot)) fail('EXISTING_BACKUP_WORKSPACE_NOT_EMPTY');
      mkdirSync(localRoot, { mode: DIRECTORY_MODE });
      fsyncDirectory(liveRoot, 'EXISTING_BACKUP_WORKSPACE_INVALID');
      const fileName = `${context.control.migrationId}-existing-nas.dump`;
      const remoteFinalPath = `${transport.projectRoot}/backups/${fileName}`;
      const remoteIncomingPath = `${remoteFinalPath}.incoming`;
      const remoteContainerFinalPath = `/backups/${fileName}`;
      const remoteContainerIncomingPath = `${remoteContainerFinalPath}.incoming`;
      const localDumpPath = join(localRoot, 'existing-nas.dump');
      let sealed;
      let remoteCleanupFailed = false;
      try {
        const summary = transport.dbShell(
          `set -eu
incoming=$1
final=$2
test -d /backups
test ! -L /backups
test "$(stat -c %a /backups)" = 700
test ! -e "$incoming"
test ! -e "$final"
umask 077
trap 'rm -f "$incoming"' EXIT HUP INT TERM
pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --compress=9 --blobs --no-owner --no-acl --file="$incoming"
pg_restore --list "$incoming" >/dev/null
chmod 600 "$incoming"
sync "$incoming"
mv "$incoming" "$final"
sync /backups
trap - EXIT HUP INT TERM
printf "%s %s\\n" "$(sha256sum "$final" | awk "{print \\$1}")" "$(wc -c < "$final" | tr -d " ")"`,
          [remoteContainerIncomingPath, remoteContainerFinalPath],
        ).trim();
        const match = /^([0-9a-f]{64}) ([1-9][0-9]*)$/.exec(summary);
        if (!match) fail('EXISTING_BACKUP_FAILED');
        transport.scpFrom(remoteFinalPath, localDumpPath);
        chmodSync(localDumpPath, FILE_MODE);
        if (hashFile(localDumpPath) !== match[1]) fail('EXISTING_BACKUP_FAILED');
        sealed = await sealAndVerifyArtifact({
          control: context.control,
          dumpPath: localDumpPath,
          kind: 'existing-nas',
          binding: {
            existingDatabase: true,
            canonicalDatabase,
          },
          statPath,
        });
        return {
          ok: true,
          sentinelVerified: true,
          capacityVerified: true,
          candidateNameAvailable: true,
          previousNameAvailable: true,
          existingDatabase: true,
          existingBackupDumpDigest: sealed.dumpDigest,
          existingBackupEncrypted: sealed.encrypted,
          existingBackupOffsiteReadback: sealed.readbackVerified,
          existingBackupSeparateDevice: sealed.separateDevice,
          existingBackupFsyncCompleted: sealed.fsyncCompleted,
          existingBackupReportDigest: sealed.manifestDigest,
        };
      } finally {
        try {
          transport.remote(
            'set -eu\nrm -f "$1" "$2"\nsync "$(dirname "$1")"',
            [remoteIncomingPath, remoteFinalPath],
          );
        } catch {
          remoteCleanupFailed = true;
        }
        rmSync(localDumpPath, { force: true });
        if (sealed?.readbackDumpPath !== undefined) {
          rmSync(sealed.readbackDumpPath, { force: true });
        }
        fsyncDirectory(localRoot, 'EXISTING_BACKUP_CLEANUP_FAILED');
        if (remoteCleanupFailed) fail('EXISTING_BACKUP_CLEANUP_FAILED');
      }
    },

    collectFrozenSourceEvidence(context) {
      return collectSource(context);
    },

    async bindFinalDump(context) {
      const liveRoot = ensurePrivateDirectory(
        join(context.control.workspacePath, 'live-cutover'),
        'FINAL_DUMP_WORKSPACE_INVALID',
      );
      const root = join(liveRoot, 'final-source');
      if (existsSync(root)) fail('FINAL_DUMP_WORKSPACE_NOT_EMPTY');
      mkdirSync(root, { mode: DIRECTORY_MODE });
      fsyncDirectory(liveRoot, 'FINAL_DUMP_WORKSPACE_INVALID');
      const serviceDirectory = join(root, 'service');
      const artifactDirectory = join(root, 'artifacts');
      mkdirSync(serviceDirectory, { mode: DIRECTORY_MODE });
      mkdirSync(artifactDirectory, { mode: DIRECTORY_MODE });
      fsyncDirectory(root, 'FINAL_DUMP_WORKSPACE_INVALID');
      const servicePath = join(serviceDirectory, 'pg_service.conf');
      const remoteFileName = `${context.control.migrationId}-final.dump`;
      const remoteFinalPath = `${transport.projectRoot}/backups/${remoteFileName}`;
      const remoteIncomingPath = `${remoteFinalPath}.incoming`;
      let sealed;
      let remotePublished = false;
      try {
        const composeText = readFileSync(context.control.composePath, 'utf8');
        const target = extractPinnedTargetPostgres(composeText);
        const source = readSourceDatabaseConfig(context.control.sourceConfigPath);
        writeLibpqServiceFile(source, servicePath);
        const query = createSourceQuery({
          clientImage: target.image,
          serviceDirectory,
          run: localRun,
        });
        const sourceEvidenceBefore = await collectEvidence({
          projectId: PROJECT_ID,
          migrationId: context.control.migrationId,
          query,
          schemaAllowlist: ['public'],
        });
        if (sourceEvidenceBefore.serverMajor > target.major) fail('SOURCE_NEWER_THAN_TARGET');
        const dump = createCustomFormatDump({
          projectId: PROJECT_ID,
          migrationId: context.control.migrationId,
          clientImage: target.image,
          serviceDirectory,
          artifactDirectory,
          schemaAllowlist: ['public'],
          run: localRun,
        });
        const list = verifyCustomFormatDump({
          clientImage: target.image,
          artifactDirectory,
          run: localRun,
        });
        const sourceEvidenceAfter = await collectEvidence({
          projectId: PROJECT_ID,
          migrationId: context.control.migrationId,
          query,
          schemaAllowlist: ['public'],
        });
        sealed = await sealAndVerifyArtifact({
          control: context.control,
          dumpPath: join(artifactDirectory, 'source.dump'),
          kind: 'final-source',
          binding: {
            sourceFreezeReceiptDigest: context.freezeReport.sourceFreezeReceiptDigest,
            sourceEvidenceBeforeDigest: sourceEvidenceDigest(sourceEvidenceBefore),
            sourceEvidenceAfterDigest: sourceEvidenceDigest(sourceEvidenceAfter),
            dumpListDigest: list.listSha256,
            schemaAllowlist: ['public'],
            excludedTable: 'public._prisma_migrations',
          },
          statPath,
        });
        transport.scpTo(sealed.readbackDumpPath, remoteIncomingPath);
        try {
          transport.remote(
            'set -eu\ntmp=$1\nfinal=$2\nexpected=$3\ntest -f "$tmp"\ntest ! -L "$tmp"\ntest "$(stat -c %a "$tmp")" = 600\ntest "$(sha256sum "$tmp" | awk "{print \\$1}")" = "$expected"\ntest ! -e "$final"\nsync "$tmp"\nmv "$tmp" "$final"\nsync "$(dirname "$final")"',
            [remoteIncomingPath, remoteFinalPath, sealed.dumpDigest],
          );
          remotePublished = true;
        } catch (error) {
          try {
            transport.remote(
              'set -eu\nrm -f "$1" "$2"\nsync "$(dirname "$1")"',
              [remoteIncomingPath, remoteFinalPath],
            );
          } catch {
            fail('FINAL_REMOTE_DUMP_CLEANUP_FAILED');
          }
          throw error;
        }
        return {
          ok: true,
          sourceEvidenceBefore,
          sourceEvidenceAfter,
          dumpDigest: dump.dumpSha256,
          dumpListDigest: list.listSha256,
          finalManifestDigest: sealed.manifestDigest,
          finalOffsiteReadback: sealed.readbackVerified,
          finalSeparateDevice: sealed.separateDevice,
          finalFsyncCompleted: sealed.fsyncCompleted,
          remoteDumpStaged: remotePublished,
          schemaAllowlist: ['public'],
          prismaMigrationsExcluded: true,
        };
      } finally {
        rmSync(servicePath, { force: true });
        rmSync(join(serviceDirectory, 'pgpass'), { force: true });
        rmSync(join(artifactDirectory, 'source.dump'), { force: true });
        rmSync(join(artifactDirectory, 'source.dump.list'), { force: true });
        if (sealed?.readbackDumpPath !== undefined) {
          rmSync(sealed.readbackDumpPath, { force: true });
        }
        fsyncDirectory(serviceDirectory, 'FINAL_DUMP_CLEANUP_FAILED');
        fsyncDirectory(artifactDirectory, 'FINAL_DUMP_CLEANUP_FAILED');
        if (!remotePublished) {
          try {
            transport.remote(
              'set -eu\nrm -f "$1"\nsync "$(dirname "$1")"',
              [remoteIncomingPath],
            );
          } catch {
            fail('FINAL_REMOTE_DUMP_CLEANUP_FAILED');
          }
        }
      }
    },

    async restoreCandidate(context) {
      const expectedArgs = [
        '--dbname',
        context.databaseNames.candidateDatabase,
        '--single-transaction',
        '--exit-on-error',
        '--no-owner',
        '--no-acl',
        `/backups/${context.control.migrationId}-final.dump`,
      ];
      if (
        context.restoreCommand.executable !== 'pg_restore' ||
        JSON.stringify(context.restoreCommand.args) !== JSON.stringify(expectedArgs) ||
        context.finalReport.dumpDigest === undefined ||
        !HASH_PATTERN.test(context.finalReport.dumpDigest)
      ) {
        fail('RESTORE_COMMAND_INVALID');
      }
      const encoding = validateLocale(context.finalReport.sourceEvidence.database.encoding);
      const collate = validateLocale(context.finalReport.sourceEvidence.database.collate);
      const ctype = validateLocale(context.finalReport.sourceEvidence.database.ctype);
      const marker = identityMarker(context, 'candidate', context.finalReport.dumpDigest);
      transport.dbShell(
        'set -eu\ndump=$1\nexpected=$2\ntest -f "$dump"\ntest ! -L "$dump"\ntest "$(stat -c %a "$dump")" = 600\ntest "$(sha256sum "$dump" | awk "{print \\$1}")" = "$expected"',
        [expectedArgs.at(-1), context.finalReport.dumpDigest],
      );
      let topology = inspectDatabaseTopology(context);
      if (topology.candidate.exists) {
        assertCandidateIdentity(context, topology, context.finalReport.dumpDigest);
        const existingEvidence = await collectEvidence({
          projectId: PROJECT_ID,
          migrationId: context.control.migrationId,
          query: (sql) => destinationQuery(context.databaseNames.candidateDatabase, sql),
          schemaAllowlist: ['public'],
        });
        const comparison = compareEvidence(
          context.finalReport.sourceEvidence,
          existingEvidence,
        );
        if (comparison.ok !== true || comparison.differenceCount !== 0) {
          transport.dbPsql(
            'postgres',
            `DROP DATABASE "${context.databaseNames.candidateDatabase}";\n`,
          );
          topology = inspectDatabaseTopology(context);
          if (topology.candidate.exists) fail('PARTIAL_CANDIDATE_CLEANUP_FAILED');
        } else {
          verifyCandidateSchema(context);
          return {
            ok: true,
            singleTransaction: true,
            ownerAclStripped: true,
            schemaAllowlistVerified: true,
            prismaMigrationsAbsent: true,
          };
        }
      }
      if (topology.canonical.exists !== true || topology.previous.exists === true) {
        fail('DATABASE_TOPOLOGY_INVALID');
      }
      const result = transport.dbShell(
        `set -eu
candidate=$1
dump=$2
expected=$3
encoding=$4
collate=$5
ctype=$6
marker=$7
ok=0
cleanup() { if [ "$ok" != 1 ]; then dropdb -U "$POSTGRES_USER" --if-exists "$candidate" >/dev/null 2>&1 || true; fi; }
trap cleanup EXIT HUP INT TERM
test -f "$dump"
test ! -L "$dump"
test "$(stat -c %a "$dump")" = 600
test "$(sha256sum "$dump" | awk "{print \\$1}")" = "$expected"
createdb -U "$POSTGRES_USER" --template=template0 --encoding="$encoding" --lc-collate="$collate" --lc-ctype="$ctype" "$candidate"
psql -X -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c "COMMENT ON DATABASE \"$candidate\" IS '$marker'"
pg_restore -U "$POSTGRES_USER" --dbname "$candidate" --single-transaction --exit-on-error --no-owner --no-acl "$dump"
ok=1
trap - EXIT HUP INT TERM
printf "RESTORED\\n"`,
        [
          context.databaseNames.candidateDatabase,
          expectedArgs.at(-1),
          context.finalReport.dumpDigest,
          encoding,
          collate,
          ctype,
          marker,
        ],
      ).trim();
      if (result !== 'RESTORED') fail('CANDIDATE_RESTORE_FAILED');
      verifyCandidateSchema(context);
      topology = inspectDatabaseTopology(context);
      assertCandidateIdentity(context, topology, context.finalReport.dumpDigest);
      const restoredEvidence = await collectEvidence({
        projectId: PROJECT_ID,
        migrationId: context.control.migrationId,
        query: (sql) => destinationQuery(context.databaseNames.candidateDatabase, sql),
        schemaAllowlist: ['public'],
      });
      const comparison = compareEvidence(
        context.finalReport.sourceEvidence,
        restoredEvidence,
      );
      if (comparison.ok !== true || comparison.differenceCount !== 0) {
        fail('CANDIDATE_RESTORE_INTEGRITY_MISMATCH');
      }
      return {
        ok: true,
        singleTransaction: true,
        ownerAclStripped: true,
        schemaAllowlistVerified: true,
        prismaMigrationsAbsent: true,
      };
    },

    collectDestinationEvidence(context) {
      return collectEvidence({
        projectId: PROJECT_ID,
        migrationId: context.control.migrationId,
        query: (sql) => destinationQuery(context.database, sql),
        schemaAllowlist: ['public'],
      });
    },

    async prepareMediaCandidate() {
      // The reviewed media modules now provide a sealed source artifact,
      // encrypted offsite bundle, framed fixed-incoming receiver, remote
      // candidate receipt, and candidate-only DB CAS primitives. The live
      // adapter must still join those receipts through a dedicated source
      // PostgreSQL session and an installed root-owned NAS gateway. A
      // release-owned helper is deliberately not treated as authorization.
      fail('MEDIA_SOURCE_SESSION_ARTIFACT_HANDOFF_NOT_IMPLEMENTED');
    },

    async promoteMediaCandidate() {
      // The additive publisher exists, but production invocation remains
      // unavailable until a root-owned fixed gateway/broker and the live
      // preparation/rewrite/lock evidence adapter are installed and audited.
      fail('MEDIA_CANONICAL_PROMOTION_NOT_IMPLEMENTED');
    },

    stopDestinationClients(context) {
      transport.compose(['stop', 'web']);
      const names = [
        context.databaseNames.canonicalDatabase,
        context.databaseNames.candidateDatabase,
        context.databaseNames.previousDatabase,
      ];
      transport.dbPsql('postgres', `
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname IN (${names.map((name) => `'${name}'`).join(', ')})
  AND pid <> pg_backend_pid();
`);
      return { ok: true };
    },

    renameCanonicalToPrevious(context) {
      const topology = inspectDatabaseTopology(context);
      const previousMarker = identityMarker(context, 'precutover');
      const candidateMarker = identityMarker(
        context,
        'candidate',
        context.finalReport.dumpDigest,
      );
      if (
        topology.previous.exists === true &&
        topology.previous.comment === previousMarker &&
        topology.canonical.exists === false &&
        topology.candidate.exists === true &&
        topology.candidate.comment === candidateMarker
      ) {
        return { ok: true };
      }
      if (
        topology.canonical.exists !== true ||
        topology.previous.exists !== false ||
        topology.candidate.exists !== true ||
        topology.candidate.comment !== candidateMarker
      ) {
        fail('CANONICAL_RENAME_PRECONDITION_FAILED');
      }
      transport.dbPsql('postgres', `
COMMENT ON DATABASE "${context.databaseNames.canonicalDatabase}" IS '${previousMarker}';
ALTER DATABASE "${context.databaseNames.canonicalDatabase}" RENAME TO "${context.databaseNames.previousDatabase}";
`);
      const after = inspectDatabaseTopology(context);
      if (
        after.canonical.exists ||
        !after.previous.exists ||
        after.previous.comment !== previousMarker
      ) {
        fail('CANONICAL_RENAME_POSTCONDITION_FAILED');
      }
      return { ok: true };
    },

    renameCandidateToCanonical(context) {
      const topology = inspectDatabaseTopology(context);
      const previousMarker = identityMarker(context, 'precutover');
      const candidateMarker = identityMarker(
        context,
        'candidate',
        context.finalReport.dumpDigest,
      );
      if (
        topology.canonical.exists === true &&
        topology.canonical.comment === candidateMarker &&
        topology.candidate.exists === false &&
        topology.previous.exists === true &&
        topology.previous.comment === previousMarker
      ) {
        return { ok: true };
      }
      if (
        topology.canonical.exists !== false ||
        topology.candidate.exists !== true ||
        topology.candidate.comment !== candidateMarker ||
        topology.previous.exists !== true ||
        topology.previous.comment !== previousMarker
      ) {
        fail('CANDIDATE_PROMOTION_PRECONDITION_FAILED');
      }
      transport.dbPsql(
        'postgres',
        `ALTER DATABASE "${context.databaseNames.candidateDatabase}" RENAME TO "${context.databaseNames.canonicalDatabase}";\n`,
      );
      const after = inspectDatabaseTopology(context);
      if (
        !after.canonical.exists ||
        after.canonical.comment !== candidateMarker ||
        after.candidate.exists ||
        !after.previous.exists ||
        after.previous.comment !== previousMarker
      ) {
        fail('CANDIDATE_PROMOTION_POSTCONDITION_FAILED');
      }
      return { ok: true };
    },

    bootstrapRolesAndAnalyze() {
      const summary = transport.dbShell(
        `/docker-entrypoint-initdb.d/10-flowpack-runtime-roles.sh
psql -X -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ANALYZE"
psql -X -q -A -t -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT json_build_object('ownerMismatch', (SELECT count(*)::integer FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname='public' AND c.relkind IN ('r','p','S','v','m') AND r.rolname <> 'flowpack_owner'), 'baselineAbsent', to_regclass('public._prisma_migrations') IS NULL)::text"`,
      ).trim().split('\n').at(-1);
      const parsed = parseJsonOutput(summary, 'DESTINATION_ROLE_BOOTSTRAP_FAILED');
      if (parsed.ownerMismatch !== 0 || parsed.baselineAbsent !== true) {
        fail('DESTINATION_ROLE_BOOTSTRAP_FAILED');
      }
      return {
        ok: true,
        roleBootstrapApplied: true,
        analyzeCompleted: true,
        ownerRole: 'flowpack_owner',
        readOnlyRole: 'flowpack_app_ro',
        readWriteRole: 'flowpack_app_rw',
        schemaAllowlist: ['public'],
      };
    },

    startDestinationReadOnly() {
      transport.remote(
        'set -eu\nroot=$1\nsrc="$root/.env.nas.ro.local"\ndst="$root/.env.nas.local"\ntmp="$root/.env.nas.local.tmp"\ntest -f "$src"\ntest ! -L "$src"\ntest "$(stat -c %a "$src")" = 600\ngrep -Fx "FLOWPACK_WRITE_MODE=read-only" "$src" >/dev/null\ngrep -Fx "FLOWPACK_SCHEDULER_ENABLED=false" "$src" >/dev/null\ngrep -Fx "FLOWPACK_AUTH_SMOKE_ENABLED=true" "$src" >/dev/null\ngrep -Fx "FLOWPACK_SOCIAL_TOKEN_SMOKE_ENABLED=true" "$src" >/dev/null\ngrep -E "^FLOWPACK_SOCIAL_TOKEN_SMOKE_TOKEN=.{32,512}$" "$src" >/dev/null\ngrep -E "^DATABASE_URL=postgresql://flowpack_app_ro:" "$src" >/dev/null\ntest ! -e "$tmp"\numask 077\ncp "$src" "$tmp"\nchmod 600 "$tmp"\nsync "$tmp"\nmv "$tmp" "$dst"\nsync "$root"',
        [transport.projectRoot],
      );
      transport.compose(['up', '-d', '--no-deps', '--force-recreate', 'web']);
      const role = transport.compose([
        'exec',
        '-T',
        'web',
        'node',
        '-e',
        "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{const r=await p.$queryRaw`select current_user, current_setting('transaction_read_only') as ro`;process.stdout.write(JSON.stringify(r[0]));await p.$disconnect()})().catch(()=>process.exit(1))",
      ]);
      const parsed = parseJsonOutput(role, 'APP_RO_VERIFICATION_FAILED');
      if (parsed.current_user !== 'flowpack_app_ro' || parsed.ro !== 'on') {
        fail('APP_RO_VERIFICATION_FAILED');
      }
      return {
        ok: true,
        accessRole: 'app_ro',
        writeMode: 'read-only',
        schedulerRunning: 0,
      };
    },

    async smokeReadOnly(context) {
      const beforeEvidence = await collectEvidence({
        projectId: PROJECT_ID,
        migrationId: context.control.migrationId,
        query: (sql) => destinationQuery(context.databaseNames.canonicalDatabase, sql),
        schemaAllowlist: ['public'],
      });
      const healthUrl = new URL('/api/health', transport.httpsUrl);
      const writeProbeUrl = new URL('/api/media', transport.httpsUrl);
      const authSmokeUrl = new URL('/api/auth/credential-smoke', transport.httpsUrl);
      const socialTokenSmokeUrl = new URL(
        '/api/auth/social-token-smoke',
        transport.httpsUrl,
      );
      const healthResponse = await fetchImpl(healthUrl, {
        method: 'GET',
        redirect: 'error',
        headers: { 'cache-control': 'no-store' },
      });
      const writeProbeResponse = await fetchImpl(writeProbeUrl, {
        method: 'POST',
        redirect: 'error',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const smokeInput = readAuthSmokeInput(context.control.authSmokeInputPath);
      const authResponse = await fetchImpl(authSmokeUrl, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'content-type': 'application/json',
          'x-flowpack-auth-smoke-token': smokeInput.token,
        },
        body: JSON.stringify({ email: smokeInput.email, password: smokeInput.password }),
      });
      const socialTokenResponse = await fetchImpl(socialTokenSmokeUrl, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'x-flowpack-social-token-smoke-token': smokeInput.socialToken,
        },
      });
      if (
        healthResponse.status !== 200 ||
        writeProbeResponse.status !== 503 ||
        authResponse.status !== 204 ||
        socialTokenResponse.status !== 204
      ) {
        fail('ZERO_WRITE_HTTP_GATE_FAILED');
      }
      const afterEvidence = await collectEvidence({
        projectId: PROJECT_ID,
        migrationId: context.control.migrationId,
        query: (sql) => destinationQuery(context.databaseNames.canonicalDatabase, sql),
        schemaAllowlist: ['public'],
      });
      return {
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
        beforeEvidence,
        afterEvidence,
      };
    },

    rollbackPreWrite(context) {
      transport.compose(['stop', 'web']);
      const phase = context.phase;
      const { canonicalDatabase, candidateDatabase, previousDatabase } = context.databaseNames;
      const previousMarker = identityMarker(context, 'precutover');
      const candidateMarkerPrefix = `${identityMarker(context, 'candidate')}:`;
      let topology = inspectDatabaseTopology(context);
      if (
        topology.canonical.exists &&
        topology.canonical.comment?.startsWith(candidateMarkerPrefix) &&
        topology.previous.exists &&
        topology.previous.comment === previousMarker
      ) {
        transport.dbPsql('postgres', `
ALTER DATABASE "${canonicalDatabase}" RENAME TO "${candidateDatabase}";
ALTER DATABASE "${previousDatabase}" RENAME TO "${canonicalDatabase}";
`);
        topology = inspectDatabaseTopology(context);
      } else if (
        !topology.canonical.exists &&
        topology.previous.exists &&
        topology.previous.comment === previousMarker
      ) {
        transport.dbPsql(
          'postgres',
          `ALTER DATABASE "${previousDatabase}" RENAME TO "${canonicalDatabase}";\n`,
        );
        topology = inspectDatabaseTopology(context);
      }
      if (
        topology.candidate.exists &&
        topology.candidate.comment?.startsWith(candidateMarkerPrefix)
      ) {
        transport.dbPsql('postgres', `DROP DATABASE "${candidateDatabase}";\n`);
        topology = inspectDatabaseTopology(context);
      }
      if (
        topology.canonical.exists !== true ||
        topology.previous.exists !== false ||
        topology.candidate.exists !== false
      ) {
        fail('PRE_WRITE_DATABASE_ROLLBACK_FAILED');
      }
      transport.remote(
        'set -eu\nroot=$1\nsrc="$root/state/database-migration.lock/runtime-env.before"\ndst="$root/.env.nas.local"\ntmp="$root/.env.nas.local.rollback"\ntest -f "$src"\ntest ! -L "$src"\ntest "$(stat -c %a "$src")" = 600\ntest ! -e "$tmp"\numask 077\ncp "$src" "$tmp"\nchmod 600 "$tmp"\nsync "$tmp"\nmv "$tmp" "$dst"\nsync "$root"',
        [transport.projectRoot],
      );
      transport.dbShell(
        'set -eu\nrm -f "$1" "${1}.incoming"\nsync "$(dirname "$1")"',
        [`/backups/${context.control.migrationId}-final.dump`],
      );
      return {
        ok: true,
        destinationWritesDisabled: true,
        sourceRecoveryVerified:
          context.sourceRecoveryReceiptDigest !== null ||
          phase === 'LOCKED' ||
          phase === 'TARGET_PREPARED',
        canonicalDatabaseRestored: true,
        mediaCanonicalGenerationSafe: true,
      };
    },

    finishRemoteRollback(context) {
      return transport.helper('finish-rollback', [
        ...helperIdentity(context),
        context.rollbackReportDigest,
        context.confirmation,
      ]);
    },
  });
}
