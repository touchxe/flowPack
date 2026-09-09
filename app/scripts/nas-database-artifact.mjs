import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import {
  closeSync,
  constants,
  copyFileSync,
  existsSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

const FILE_MODE = 0o600;
const DIRECTORY_MODE = 0o700;
const MAGIC = Buffer.from('NASPG001', 'ascii');
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.byteLength + IV_BYTES + TAG_BYTES;
const COPY_CHUNK_BYTES = 1024 * 1024;
const PROJECT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*-nas$/;
const MIGRATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

class DatabaseArtifactError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DatabaseArtifactError';
  }
}

function fail(message) {
  throw new DatabaseArtifactError(message);
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

function validateProjectAndMigration(projectId, migrationId) {
  if (!PROJECT_ID_PATTERN.test(projectId) || !MIGRATION_ID_PATTERN.test(migrationId)) {
    fail('database backup identity is invalid');
  }
}

function validateHash(value, message = 'database backup manifest is invalid') {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) fail(message);
  return value;
}

function assertPrivateDirectory(directory, message) {
  try {
    const metadata = lstatSync(directory);
    if (
      metadata.isSymbolicLink() ||
      !metadata.isDirectory() ||
      (metadata.mode & 0o777) !== DIRECTORY_MODE
    ) {
      fail(message);
    }
  } catch (error) {
    if (error instanceof DatabaseArtifactError) throw error;
    fail(message);
  }
}

function assertPrivateRegularFile(filePath, message) {
  try {
    const metadata = lstatSync(filePath);
    if (
      metadata.isSymbolicLink() ||
      !metadata.isFile() ||
      (metadata.mode & 0o777) !== FILE_MODE
    ) {
      fail(message);
    }
  } catch (error) {
    if (error instanceof DatabaseArtifactError) throw error;
    fail(message);
  }
}

function assertOutputParent(filePath, message) {
  if (!isAbsolute(filePath)) fail(message);
  assertPrivateDirectory(dirname(resolve(filePath)), message);
  if (existsSync(filePath)) fail(message);
}

function safeDecode(value) {
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.length === 0 || /[\u0000-\u001f\u007f\r\n]/u.test(decoded)) {
      fail('private source database file is invalid');
    }
    return decoded;
  } catch (error) {
    if (error instanceof DatabaseArtifactError) throw error;
    fail('private source database file is invalid');
  }
}

export function readSourceDatabaseConfig(filePath, options = undefined) {
  if (
    options !== undefined &&
    (!isPlainObject(options) ||
      !hasExactKeys(options, ['allowInsecureLoopback']) ||
      options.allowInsecureLoopback !== true)
  ) {
    fail('private source database file is invalid');
  }
  assertPrivateRegularFile(filePath, 'private source database file is invalid');
  let contents;
  try {
    contents = readFileSync(filePath, 'utf8');
  } catch {
    fail('private source database file is invalid');
  }
  if (/\r|[\u0000-\u0009\u000b-\u001f\u007f]/u.test(contents)) {
    fail('private source database file is invalid');
  }
  const meaningful = contents
    .split('\n')
    .filter((line) => line !== '' && !line.startsWith('#'));
  if (meaningful.length !== 1 || !meaningful[0].startsWith('SOURCE_DATABASE_URL=')) {
    fail('private source database file is invalid');
  }
  const rawUrl = meaningful[0].slice('SOURCE_DATABASE_URL='.length);
  if (
    rawUrl.length === 0 ||
    rawUrl.trim() !== rawUrl ||
    /["'`$;\\|<>!(){}\[\]*\s]/u.test(rawUrl)
  ) {
    fail('private source database file is invalid');
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    fail('private source database file is invalid');
  }
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    parsed.hostname.length === 0 ||
    parsed.username.length === 0 ||
    parsed.password.length === 0 ||
    parsed.pathname.length <= 1 ||
    parsed.hash !== ''
  ) {
    fail('private source database file is invalid');
  }

  const allowedConnectionParameters = new Set(['sslmode', 'channel_binding']);
  for (const key of parsed.searchParams.keys()) {
    if (!allowedConnectionParameters.has(key) || parsed.searchParams.getAll(key).length !== 1) {
      fail('private source database file is invalid');
    }
  }
  const sslMode = parsed.searchParams.get('sslmode') ?? 'require';
  if (!['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'].includes(sslMode)) {
    fail('private source database file is invalid');
  }
  const loopbackHosts = new Set(['127.0.0.1', '[::1]', 'localhost', 'host.docker.internal']);
  if (
    !['require', 'verify-ca', 'verify-full'].includes(sslMode) &&
    !(
      options?.allowInsecureLoopback === true &&
      sslMode === 'disable' &&
      loopbackHosts.has(parsed.hostname.toLowerCase())
    )
  ) {
    fail('private source database file is invalid');
  }
  const channelBinding = parsed.searchParams.get('channel_binding') ?? 'prefer';
  if (!['disable', 'prefer', 'require'].includes(channelBinding)) {
    fail('private source database file is invalid');
  }
  const portExplicit = parsed.port.length > 0;
  const privateValues = {
    host: safeDecode(parsed.hostname),
    port: parsed.port || '5432',
    database: safeDecode(parsed.pathname.slice(1)),
    user: safeDecode(parsed.username),
    password: safeDecode(parsed.password),
    sslMode,
    channelBinding,
  };
  const publicSummary = Object.freeze({ ok: true, sslMode, portExplicit });
  const result = { publicSummary };
  Object.defineProperties(result, {
    protocol: { value: parsed.protocol },
    hasPassword: { value: true },
    privateValues: { value: Object.freeze(privateValues) },
  });
  return Object.freeze(result);
}

function serviceValue(value, pattern) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    fail('private source database file is invalid');
  }
  return value;
}

function pgpassValue(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f\r\n]/u.test(value)) {
    fail('private source database file is invalid');
  }
  return value.replaceAll('\\', '\\\\').replaceAll(':', '\\:');
}

function writeExclusivePrivate(filePath, contents, message) {
  assertOutputParent(filePath, message);
  let descriptor;
  try {
    descriptor = openSync(
      filePath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      FILE_MODE,
    );
    const buffer = Buffer.isBuffer(contents) ? contents : Buffer.from(contents, 'utf8');
    let offset = 0;
    while (offset < buffer.byteLength) {
      offset += writeSync(descriptor, buffer, offset, buffer.byteLength - offset);
    }
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    rmSync(filePath, { force: true });
    if (error instanceof DatabaseArtifactError) throw error;
    fail(message);
  }
}

export function writeLibpqServiceFile(config, filePath) {
  if (!isPlainObject(config) || !isPlainObject(config.privateValues)) {
    fail('private source database file is invalid');
  }
  const values = config.privateValues;
  const host = serviceValue(values.host, /^[A-Za-z0-9._:-]+$/);
  const port = serviceValue(values.port, /^[0-9]{1,5}$/);
  const database = serviceValue(values.database, /^[A-Za-z0-9_.$-]+$/);
  const user = serviceValue(values.user, /^[A-Za-z0-9_.$-]+$/);
  const sslMode = serviceValue(
    values.sslMode,
    /^(?:disable|allow|prefer|require|verify-ca|verify-full)$/,
  );
  const channelBinding = serviceValue(
    values.channelBinding,
    /^(?:disable|prefer|require)$/,
  );
  const passwordPath = join(dirname(filePath), 'pgpass');
  assertOutputParent(filePath, 'private libpq service file is invalid');
  assertOutputParent(passwordPath, 'private libpq password file is invalid');
  const contents = [
    '[source]',
    `host=${host}`,
    `port=${port}`,
    `dbname=${database}`,
    `user=${user}`,
    `sslmode=${sslMode}`,
    `channel_binding=${channelBinding}`,
    'application_name=nas_migration_operator',
    '',
  ].join('\n');
  const passwordContents = [
    pgpassValue(values.host),
    pgpassValue(values.port),
    pgpassValue(values.database),
    pgpassValue(values.user),
    pgpassValue(values.password),
  ].join(':');
  try {
    writeExclusivePrivate(filePath, contents, 'private libpq service file is invalid');
    writeExclusivePrivate(
      passwordPath,
      `${passwordContents}\n`,
      'private libpq password file is invalid',
    );
  } catch (error) {
    rmSync(filePath, { force: true });
    throw error;
  }
  return { ok: true, serviceName: 'source' };
}

export function initializeBackupKey(keyPath) {
  const key = randomBytes(32).toString('base64');
  writeExclusivePrivate(keyPath, `${key}\n`, 'database backup key is invalid');
  return { ok: true };
}

function readBackupKey(keyPath) {
  assertPrivateRegularFile(keyPath, 'database backup key is invalid');
  let encoded;
  try {
    encoded = readFileSync(keyPath, 'utf8');
  } catch {
    fail('database backup key is invalid');
  }
  if (!/^[A-Za-z0-9+/]{43}=$/.test(encoded.trim()) || encoded !== `${encoded.trim()}\n`) {
    fail('database backup key is invalid');
  }
  const key = Buffer.from(encoded.trim(), 'base64');
  if (key.byteLength !== 32) fail('database backup key is invalid');
  return key;
}

function hashFile(filePath) {
  const hash = createHash('sha256');
  const descriptor = openSync(filePath, constants.O_RDONLY);
  const buffer = Buffer.allocUnsafe(COPY_CHUNK_BYTES);
  try {
    while (true) {
      const bytesRead = readSync(descriptor, buffer, 0, buffer.byteLength, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    closeSync(descriptor);
  }
  return hash.digest('hex');
}

function aadFor(projectId, migrationId, plaintextSha256) {
  return Buffer.from(
    JSON.stringify({ formatVersion: 1, projectId, migrationId, plaintextSha256 }),
    'utf8',
  );
}

function copyDescriptor(sourceDescriptor, destinationDescriptor, start = 0) {
  const buffer = Buffer.allocUnsafe(COPY_CHUNK_BYTES);
  let position = start;
  while (true) {
    const bytesRead = readSync(
      sourceDescriptor,
      buffer,
      0,
      buffer.byteLength,
      position,
    );
    if (bytesRead === 0) break;
    let offset = 0;
    while (offset < bytesRead) {
      offset += writeSync(destinationDescriptor, buffer, offset, bytesRead - offset);
    }
    position += bytesRead;
  }
}

function publishPrivateTemporary(temporaryPath, finalPath, message) {
  try {
    linkSync(temporaryPath, finalPath);
    unlinkSync(temporaryPath);
  } catch {
    rmSync(temporaryPath, { force: true });
    fail(message);
  }
}

export async function encryptDatabaseDump({
  projectId,
  migrationId,
  dumpPath,
  keyPath,
  encryptedPath,
}) {
  validateProjectAndMigration(projectId, migrationId);
  assertPrivateRegularFile(dumpPath, 'database dump is invalid');
  assertOutputParent(encryptedPath, 'encrypted database backup is invalid');
  const key = readBackupKey(keyPath);
  const plaintextSha256 = hashFile(dumpPath);
  const plaintextBytes = statSync(dumpPath).size;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aadFor(projectId, migrationId, plaintextSha256));
  const bodyPath = join(
    dirname(encryptedPath),
    `.${basename(encryptedPath)}.body-${randomBytes(8).toString('hex')}`,
  );
  const finalTemporaryPath = join(
    dirname(encryptedPath),
    `.${basename(encryptedPath)}.tmp-${randomBytes(8).toString('hex')}`,
  );
  let inputDescriptor;
  let bodyDescriptor;
  try {
    inputDescriptor = openSync(dumpPath, constants.O_RDONLY);
    bodyDescriptor = openSync(
      bodyPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      FILE_MODE,
    );
    const input = Buffer.allocUnsafe(COPY_CHUNK_BYTES);
    while (true) {
      const bytesRead = readSync(inputDescriptor, input, 0, input.byteLength, null);
      if (bytesRead === 0) break;
      const encrypted = cipher.update(input.subarray(0, bytesRead));
      if (encrypted.byteLength > 0) writeSync(bodyDescriptor, encrypted);
    }
    const finalChunk = cipher.final();
    if (finalChunk.byteLength > 0) writeSync(bodyDescriptor, finalChunk);
    fsyncSync(bodyDescriptor);
    closeSync(inputDescriptor);
    inputDescriptor = undefined;
    closeSync(bodyDescriptor);
    bodyDescriptor = undefined;

    const tag = cipher.getAuthTag();
    const outputDescriptor = openSync(
      finalTemporaryPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      FILE_MODE,
    );
    try {
      writeSync(outputDescriptor, MAGIC);
      writeSync(outputDescriptor, iv);
      writeSync(outputDescriptor, tag);
      const encryptedBodyDescriptor = openSync(bodyPath, constants.O_RDONLY);
      try {
        copyDescriptor(encryptedBodyDescriptor, outputDescriptor);
      } finally {
        closeSync(encryptedBodyDescriptor);
      }
      fsyncSync(outputDescriptor);
    } finally {
      closeSync(outputDescriptor);
    }
    publishPrivateTemporary(
      finalTemporaryPath,
      encryptedPath,
      'encrypted database backup is invalid',
    );
  } catch (error) {
    if (inputDescriptor !== undefined) closeSync(inputDescriptor);
    if (bodyDescriptor !== undefined) closeSync(bodyDescriptor);
    rmSync(finalTemporaryPath, { force: true });
    if (error instanceof DatabaseArtifactError) throw error;
    fail('encrypted database backup is invalid');
  } finally {
    rmSync(bodyPath, { force: true });
  }

  const encryptedBytes = statSync(encryptedPath).size;
  const encryptedSha256 = hashFile(encryptedPath);
  return Object.freeze({
    algorithm: 'aes-256-gcm',
    formatVersion: 1,
    plaintextBytes,
    plaintextSha256,
    encryptedBytes,
    encryptedSha256,
  });
}

export async function decryptDatabaseDump({
  projectId,
  migrationId,
  encryptedPath,
  keyPath,
  outputPath,
  expectedPlaintextSha256,
  expectedEncryptedSha256,
}) {
  validateProjectAndMigration(projectId, migrationId);
  validateHash(expectedPlaintextSha256, 'encrypted database backup is invalid');
  validateHash(expectedEncryptedSha256, 'encrypted database backup is invalid');
  assertPrivateRegularFile(encryptedPath, 'encrypted database backup is invalid');
  assertOutputParent(outputPath, 'database restore output is invalid');
  if (statSync(encryptedPath).size <= HEADER_BYTES) fail('encrypted database backup is invalid');
  if (hashFile(encryptedPath) !== expectedEncryptedSha256) {
    fail('encrypted database backup is invalid');
  }
  const key = readBackupKey(keyPath);
  const inputDescriptor = openSync(encryptedPath, constants.O_RDONLY);
  const header = Buffer.alloc(HEADER_BYTES);
  try {
    if (readSync(inputDescriptor, header, 0, header.byteLength, 0) !== header.byteLength) {
      fail('encrypted database backup is invalid');
    }
  } finally {
    closeSync(inputDescriptor);
  }
  if (!header.subarray(0, MAGIC.byteLength).equals(MAGIC)) {
    fail('encrypted database backup is invalid');
  }
  const iv = header.subarray(MAGIC.byteLength, MAGIC.byteLength + IV_BYTES);
  const tag = header.subarray(MAGIC.byteLength + IV_BYTES, HEADER_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(aadFor(projectId, migrationId, expectedPlaintextSha256));
  decipher.setAuthTag(tag);
  const temporaryPath = join(
    dirname(outputPath),
    `.${basename(outputPath)}.tmp-${randomBytes(8).toString('hex')}`,
  );
  let encryptedDescriptor;
  let outputDescriptor;
  try {
    encryptedDescriptor = openSync(encryptedPath, constants.O_RDONLY);
    outputDescriptor = openSync(
      temporaryPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      FILE_MODE,
    );
    const input = Buffer.allocUnsafe(COPY_CHUNK_BYTES);
    let position = HEADER_BYTES;
    while (true) {
      const bytesRead = readSync(
        encryptedDescriptor,
        input,
        0,
        input.byteLength,
        position,
      );
      if (bytesRead === 0) break;
      position += bytesRead;
      const plaintext = decipher.update(input.subarray(0, bytesRead));
      if (plaintext.byteLength > 0) writeSync(outputDescriptor, plaintext);
    }
    const finalChunk = decipher.final();
    if (finalChunk.byteLength > 0) writeSync(outputDescriptor, finalChunk);
    fsyncSync(outputDescriptor);
    closeSync(encryptedDescriptor);
    encryptedDescriptor = undefined;
    closeSync(outputDescriptor);
    outputDescriptor = undefined;
    if (hashFile(temporaryPath) !== expectedPlaintextSha256) {
      fail('encrypted database backup is invalid');
    }
    publishPrivateTemporary(temporaryPath, outputPath, 'database restore output is invalid');
  } catch (error) {
    if (encryptedDescriptor !== undefined) closeSync(encryptedDescriptor);
    if (outputDescriptor !== undefined) closeSync(outputDescriptor);
    rmSync(temporaryPath, { force: true });
    if (error instanceof DatabaseArtifactError) throw error;
    fail('encrypted database backup is invalid');
  }
  return { ok: true, dumpSha256: expectedPlaintextSha256 };
}

export function createBackupManifest({
  projectId,
  migrationId,
  createdAt,
  sourceServerMajor,
  targetServerMajor,
  inventorySha256,
  encryption,
  evidenceEncryption,
}) {
  validateProjectAndMigration(projectId, migrationId);
  validateHash(inventorySha256);
  if (
    typeof createdAt !== 'string' ||
    new Date(createdAt).toISOString() !== createdAt ||
    !Number.isSafeInteger(sourceServerMajor) ||
    sourceServerMajor < 12 ||
    sourceServerMajor > 99 ||
    !Number.isSafeInteger(targetServerMajor) ||
    targetServerMajor < 12 ||
    targetServerMajor > 99 ||
    !hasExactKeys(encryption, [
      'algorithm',
      'formatVersion',
      'plaintextBytes',
      'plaintextSha256',
      'encryptedBytes',
      'encryptedSha256',
    ]) ||
    encryption.algorithm !== 'aes-256-gcm' ||
    encryption.formatVersion !== 1 ||
    !Number.isSafeInteger(encryption.plaintextBytes) ||
    encryption.plaintextBytes <= 0 ||
    !Number.isSafeInteger(encryption.encryptedBytes) ||
    encryption.encryptedBytes <= HEADER_BYTES ||
    !hasExactKeys(evidenceEncryption, [
      'algorithm',
      'formatVersion',
      'plaintextBytes',
      'plaintextSha256',
      'encryptedBytes',
      'encryptedSha256',
    ]) ||
    evidenceEncryption.algorithm !== 'aes-256-gcm' ||
    evidenceEncryption.formatVersion !== 1 ||
    !Number.isSafeInteger(evidenceEncryption.plaintextBytes) ||
    evidenceEncryption.plaintextBytes <= 0 ||
    !Number.isSafeInteger(evidenceEncryption.encryptedBytes) ||
    evidenceEncryption.encryptedBytes <= HEADER_BYTES
  ) {
    fail('database backup manifest is invalid');
  }
  validateHash(encryption.plaintextSha256);
  validateHash(encryption.encryptedSha256);
  validateHash(evidenceEncryption.plaintextSha256);
  validateHash(evidenceEncryption.encryptedSha256);
  return Object.freeze({
    schemaVersion: 1,
    projectId,
    migrationId,
    createdAt,
    source: Object.freeze({ serverMajor: sourceServerMajor }),
    target: Object.freeze({ serverMajor: targetServerMajor }),
    inventory: Object.freeze({ sha256: inventorySha256 }),
    dump: Object.freeze({
      format: 'postgresql-custom',
      plaintextBytes: encryption.plaintextBytes,
      plaintextSha256: encryption.plaintextSha256,
      encryption: Object.freeze({
        algorithm: encryption.algorithm,
        formatVersion: encryption.formatVersion,
        encryptedBytes: encryption.encryptedBytes,
        encryptedSha256: encryption.encryptedSha256,
      }),
    }),
    evidence: Object.freeze({
      format: 'canonical-json',
      plaintextBytes: evidenceEncryption.plaintextBytes,
      plaintextSha256: evidenceEncryption.plaintextSha256,
      encryption: Object.freeze({
        algorithm: evidenceEncryption.algorithm,
        formatVersion: evidenceEncryption.formatVersion,
        encryptedBytes: evidenceEncryption.encryptedBytes,
        encryptedSha256: evidenceEncryption.encryptedSha256,
      }),
    }),
  });
}

function validateBackupManifest(manifest, projectId, migrationId) {
  if (
    !hasExactKeys(manifest, [
      'schemaVersion',
      'projectId',
      'migrationId',
      'createdAt',
      'source',
      'target',
      'inventory',
      'dump',
      'evidence',
    ]) ||
    manifest.schemaVersion !== 1 ||
    manifest.projectId !== projectId ||
    manifest.migrationId !== migrationId ||
    !hasExactKeys(manifest.source, ['serverMajor']) ||
    !hasExactKeys(manifest.target, ['serverMajor']) ||
    !hasExactKeys(manifest.inventory, ['sha256']) ||
    !hasExactKeys(manifest.dump, [
      'format',
      'plaintextBytes',
      'plaintextSha256',
      'encryption',
    ]) ||
    !hasExactKeys(manifest.dump.encryption, [
      'algorithm',
      'formatVersion',
      'encryptedBytes',
      'encryptedSha256',
    ]) ||
    !hasExactKeys(manifest.evidence, [
      'format',
      'plaintextBytes',
      'plaintextSha256',
      'encryption',
    ]) ||
    manifest.evidence.format !== 'canonical-json' ||
    !hasExactKeys(manifest.evidence.encryption, [
      'algorithm',
      'formatVersion',
      'encryptedBytes',
      'encryptedSha256',
    ])
  ) {
    fail('database backup manifest is invalid');
  }
  createBackupManifest({
    projectId,
    migrationId,
    createdAt: manifest.createdAt,
    sourceServerMajor: manifest.source.serverMajor,
    targetServerMajor: manifest.target.serverMajor,
    inventorySha256: manifest.inventory.sha256,
    encryption: {
      algorithm: manifest.dump.encryption.algorithm,
      formatVersion: manifest.dump.encryption.formatVersion,
      plaintextBytes: manifest.dump.plaintextBytes,
      plaintextSha256: manifest.dump.plaintextSha256,
      encryptedBytes: manifest.dump.encryption.encryptedBytes,
      encryptedSha256: manifest.dump.encryption.encryptedSha256,
    },
    evidenceEncryption: {
      algorithm: manifest.evidence.encryption.algorithm,
      formatVersion: manifest.evidence.encryption.formatVersion,
      plaintextBytes: manifest.evidence.plaintextBytes,
      plaintextSha256: manifest.evidence.plaintextSha256,
      encryptedBytes: manifest.evidence.encryption.encryptedBytes,
      encryptedSha256: manifest.evidence.encryption.encryptedSha256,
    },
  });
  return manifest;
}

function readCanonicalPrivateJson(filePath, message) {
  assertPrivateRegularFile(filePath, message);
  let raw;
  let parsed;
  try {
    raw = readFileSync(filePath, 'utf8');
    parsed = JSON.parse(raw);
  } catch {
    fail(message);
  }
  if (raw !== `${JSON.stringify(parsed)}\n`) fail(message);
  return parsed;
}

function readOffsiteProfile(profilePath) {
  const profile = readCanonicalPrivateJson(profilePath, 'offsite backup profile is invalid');
  if (
    !hasExactKeys(profile, ['schemaVersion', 'profileId', 'type', 'root']) ||
    profile.schemaVersion !== 1 ||
    profile.type !== 'filesystem' ||
    typeof profile.profileId !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(profile.profileId) ||
    typeof profile.root !== 'string' ||
    !isAbsolute(profile.root)
  ) {
    fail('offsite backup profile is invalid');
  }
  const root = resolve(profile.root);
  assertPrivateDirectory(root, 'offsite backup profile is invalid');
  return { ...profile, root };
}

export function verifyOffsiteFilesystemBoundary({ localPath, profilePath }) {
  assertPrivateDirectory(localPath, 'local backup workspace is invalid');
  const profile = readOffsiteProfile(profilePath);
  let localDevice;
  let offsiteDevice;
  try {
    localDevice = statSync(localPath).dev;
    offsiteDevice = statSync(profile.root).dev;
  } catch {
    fail('offsite filesystem boundary is invalid');
  }
  if (
    !Number.isSafeInteger(localDevice) ||
    !Number.isSafeInteger(offsiteDevice) ||
    localDevice === offsiteDevice
  ) {
    fail('offsite backup requires a separate filesystem');
  }
  return { ok: true, separateDevice: true };
}

function fsyncPrivateDirectory(directory, message) {
  assertPrivateDirectory(directory, message);
  let descriptor;
  try {
    descriptor = openSync(directory, constants.O_RDONLY);
    fsyncSync(descriptor);
  } catch {
    fail(message);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function copyPrivateExclusive(sourcePath, destinationPath, message) {
  assertPrivateRegularFile(sourcePath, message);
  assertOutputParent(destinationPath, message);
  try {
    copyFileSync(sourcePath, destinationPath, constants.COPYFILE_EXCL);
    const descriptor = openSync(destinationPath, constants.O_RDONLY);
    try {
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
  } catch {
    rmSync(destinationPath, { force: true });
    fail(message);
  }
}

function createOffsiteDestination(root, projectId, migrationId) {
  const projectRoot = join(root, projectId);
  if (!existsSync(projectRoot)) {
    mkdirSync(projectRoot, { mode: DIRECTORY_MODE });
    fsyncPrivateDirectory(root, 'offsite destination is invalid');
  }
  assertPrivateDirectory(projectRoot, 'offsite destination is invalid');
  const destination = join(projectRoot, migrationId);
  try {
    mkdirSync(destination, { mode: DIRECTORY_MODE });
  } catch {
    fail('offsite destination is not empty');
  }
  fsyncPrivateDirectory(projectRoot, 'offsite destination is invalid');
  return destination;
}

export function copyEncryptedBackupOffsite({
  projectId,
  migrationId,
  encryptedPath,
  encryptedEvidencePath,
  manifestPath,
  profilePath,
}) {
  validateProjectAndMigration(projectId, migrationId);
  const profile = readOffsiteProfile(profilePath);
  const manifest = validateBackupManifest(
    readCanonicalPrivateJson(manifestPath, 'database backup manifest is invalid'),
    projectId,
    migrationId,
  );
  assertPrivateRegularFile(encryptedPath, 'encrypted database backup is invalid');
  assertPrivateRegularFile(encryptedEvidencePath, 'encrypted evidence bundle is invalid');
  if (
    statSync(encryptedPath).size !== manifest.dump.encryption.encryptedBytes ||
    hashFile(encryptedPath) !== manifest.dump.encryption.encryptedSha256
  ) {
    fail('encrypted database backup is invalid');
  }
  if (
    statSync(encryptedEvidencePath).size !== manifest.evidence.encryption.encryptedBytes ||
    hashFile(encryptedEvidencePath) !== manifest.evidence.encryption.encryptedSha256
  ) {
    fail('encrypted evidence bundle is invalid');
  }
  const destination = createOffsiteDestination(profile.root, projectId, migrationId);
  try {
    copyPrivateExclusive(
      encryptedPath,
      join(destination, 'source.dump.enc'),
      'offsite backup copy failed',
    );
    copyPrivateExclusive(
      encryptedEvidencePath,
      join(destination, 'evidence.bundle.enc'),
      'offsite backup copy failed',
    );
    copyPrivateExclusive(
      manifestPath,
      join(destination, 'backup.manifest.json'),
      'offsite backup copy failed',
    );
    fsyncPrivateDirectory(destination, 'offsite backup copy failed');
  } catch (error) {
    rmSync(destination, { recursive: true, force: true });
    throw error;
  }
  return { ok: true, copiedFileCount: 3 };
}

export async function verifyOffsiteReadback({
  projectId,
  migrationId,
  profilePath,
  keyPath,
  readbackDirectory,
}) {
  validateProjectAndMigration(projectId, migrationId);
  const profile = readOffsiteProfile(profilePath);
  assertPrivateDirectory(readbackDirectory, 'offsite readback directory is invalid');
  if (readdirSync(readbackDirectory).length !== 0) {
    fail('offsite readback directory is invalid');
  }
  const sourceDirectory = join(profile.root, projectId, migrationId);
  assertPrivateDirectory(sourceDirectory, 'offsite backup is unavailable');
  const encryptedSource = join(sourceDirectory, 'source.dump.enc');
  const manifestSource = join(sourceDirectory, 'backup.manifest.json');
  const evidenceSource = join(sourceDirectory, 'evidence.bundle.enc');
  const encryptedReadback = join(readbackDirectory, 'source.dump.enc');
  const manifestReadback = join(readbackDirectory, 'backup.manifest.json');
  const evidenceReadback = join(readbackDirectory, 'evidence.bundle.enc');
  copyPrivateExclusive(encryptedSource, encryptedReadback, 'offsite readback failed');
  copyPrivateExclusive(manifestSource, manifestReadback, 'offsite readback failed');
  copyPrivateExclusive(evidenceSource, evidenceReadback, 'offsite readback failed');
  const manifest = validateBackupManifest(
    readCanonicalPrivateJson(manifestReadback, 'database backup manifest is invalid'),
    projectId,
    migrationId,
  );
  if (
    statSync(encryptedReadback).size !== manifest.dump.encryption.encryptedBytes ||
    hashFile(encryptedReadback) !== manifest.dump.encryption.encryptedSha256
  ) {
    fail('offsite readback failed');
  }
  if (
    statSync(evidenceReadback).size !== manifest.evidence.encryption.encryptedBytes ||
    hashFile(evidenceReadback) !== manifest.evidence.encryption.encryptedSha256
  ) {
    fail('offsite readback failed');
  }
  const restoredPath = join(readbackDirectory, 'source.dump');
  await decryptDatabaseDump({
    projectId,
    migrationId,
    encryptedPath: encryptedReadback,
    keyPath,
    outputPath: restoredPath,
    expectedPlaintextSha256: manifest.dump.plaintextSha256,
    expectedEncryptedSha256: manifest.dump.encryption.encryptedSha256,
  });
  await decryptDatabaseDump({
    projectId,
    migrationId,
    encryptedPath: evidenceReadback,
    keyPath,
    outputPath: join(readbackDirectory, 'evidence.bundle.json'),
    expectedPlaintextSha256: manifest.evidence.plaintextSha256,
    expectedEncryptedSha256: manifest.evidence.encryption.encryptedSha256,
  });
  return {
    ok: true,
    dumpSha256: manifest.dump.plaintextSha256,
    evidenceSha256: manifest.evidence.plaintextSha256,
  };
}

function normalizedNamedRecords(value, recordKeys) {
  if (!Array.isArray(value)) fail('database integrity evidence is invalid');
  const map = new Map();
  for (const record of value) {
    if (!hasExactKeys(record, recordKeys) || typeof record.name !== 'string' || map.has(record.name)) {
      fail('database integrity evidence is invalid');
    }
    map.set(record.name, record);
  }
  return map;
}

function normalizedLargeObjects(value) {
  if (!Array.isArray(value)) fail('database integrity evidence is invalid');
  const map = new Map();
  for (const record of value) {
    if (
      !hasExactKeys(record, ['oid', 'bytes', 'dataSha256']) ||
      typeof record.oid !== 'string' ||
      !/^[1-9][0-9]*$/.test(record.oid) ||
      !Number.isSafeInteger(record.bytes) ||
      record.bytes < 0 ||
      !SHA256_PATTERN.test(record.dataSha256) ||
      map.has(record.oid)
    ) fail('database integrity evidence is invalid');
    map.set(record.oid, record);
  }
  return map;
}

export function compareIntegrityEvidence(source, destination) {
  if (
    !hasExactKeys(source, [
      'schemaVersion',
      'database',
      'schemas',
      'extensions',
      'objectsSha256',
      'tables',
      'sequences',
      'largeObjects',
    ]) ||
    !hasExactKeys(destination, [
      'schemaVersion',
      'database',
      'schemas',
      'extensions',
      'objectsSha256',
      'tables',
      'sequences',
      'largeObjects',
    ]) ||
    source.schemaVersion !== 1 ||
    destination.schemaVersion !== 1 ||
    !hasExactKeys(source.database, ['collate', 'ctype', 'encoding']) ||
    !hasExactKeys(destination.database, ['collate', 'ctype', 'encoding']) ||
    Object.values(source.database).some((value) => typeof value !== 'string') ||
    Object.values(destination.database).some((value) => typeof value !== 'string') ||
    !Array.isArray(source.schemas) ||
    !Array.isArray(destination.schemas) ||
    !Array.isArray(source.extensions) ||
    !Array.isArray(destination.extensions) ||
    !SHA256_PATTERN.test(source.objectsSha256) ||
    !SHA256_PATTERN.test(destination.objectsSha256)
  ) {
    fail('database integrity evidence is invalid');
  }
  const sourceTables = normalizedNamedRecords(source.tables, [
    'name',
    'rowCount',
    'dataSha256',
  ]);
  const destinationTables = normalizedNamedRecords(destination.tables, [
    'name',
    'rowCount',
    'dataSha256',
  ]);
  const sourceSequences = normalizedNamedRecords(source.sequences, [
    'name',
    'lastValue',
    'isCalled',
  ]);
  const destinationSequences = normalizedNamedRecords(destination.sequences, [
    'name',
    'lastValue',
    'isCalled',
  ]);
  const sourceLargeObjects = normalizedLargeObjects(source.largeObjects);
  const destinationLargeObjects = normalizedLargeObjects(destination.largeObjects);
  let differenceCount = 0;
  if (JSON.stringify(source.database) !== JSON.stringify(destination.database)) differenceCount += 1;
  if (JSON.stringify(source.schemas) !== JSON.stringify(destination.schemas)) differenceCount += 1;
  if (JSON.stringify(source.extensions) !== JSON.stringify(destination.extensions)) differenceCount += 1;
  if (source.objectsSha256 !== destination.objectsSha256) differenceCount += 1;
  const tableNames = new Set([...sourceTables.keys(), ...destinationTables.keys()]);
  for (const name of tableNames) {
    if (JSON.stringify(sourceTables.get(name)) !== JSON.stringify(destinationTables.get(name))) {
      differenceCount += 1;
    }
  }
  const sequenceNames = new Set([
    ...sourceSequences.keys(),
    ...destinationSequences.keys(),
  ]);
  for (const name of sequenceNames) {
    if (
      JSON.stringify(sourceSequences.get(name)) !== JSON.stringify(destinationSequences.get(name))
    ) {
      differenceCount += 1;
    }
  }
  const largeObjectOids = new Set([...sourceLargeObjects.keys(), ...destinationLargeObjects.keys()]);
  for (const oid of largeObjectOids) {
    if (JSON.stringify(sourceLargeObjects.get(oid)) !== JSON.stringify(destinationLargeObjects.get(oid))) {
      differenceCount += 1;
    }
  }
  return {
    ok: differenceCount === 0,
    differenceCount,
    tableCount: sourceTables.size,
    sequenceCount: sourceSequences.size,
    largeObjectCount: sourceLargeObjects.size,
  };
}

export function validateRestoreConfirmation(projectId, migrationId, confirmation) {
  validateProjectAndMigration(projectId, migrationId);
  if (confirmation !== `RESTORE:${projectId}:${migrationId}`) {
    fail('restore confirmation is invalid');
  }
  return true;
}
