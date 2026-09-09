#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  statSync,
  writeSync,
} from 'node:fs';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  copyEncryptedBackupOffsite,
  createBackupManifest,
  encryptDatabaseDump,
  readSourceDatabaseConfig,
  verifyOffsiteFilesystemBoundary,
  verifyOffsiteReadback,
  writeLibpqServiceFile,
} from './nas-database-artifact.mjs';
import {
  advanceLedger,
  canonicalStringify,
  verifyLedger,
} from './nas-migration-ledger.mjs';
import {
  collectPostgresIntegrityEvidence,
  createCustomFormatDump,
  createSourceQuery,
  extractPinnedTargetPostgres,
  runScratchRestoreDrill,
  verifyCustomFormatDump,
} from './nas-postgres-migration.mjs';

export const PROJECT_ID = 'flowpack-nas';

const FILE_MODE = 0o600;
const DIRECTORY_MODE = 0o700;
const MAX_TEXT_FILE_BYTES = 1024 * 1024;
const COPY_CHUNK_BYTES = 1024 * 1024;
const MIGRATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const SAFE_PATH_PATTERN = /^[A-Za-z0-9_./-]+$/;
const QUALIFIED_NAME_PATTERN =
  /^[A-Za-z_][A-Za-z0-9_$]*\.[A-Za-z_][A-Za-z0-9_$]*$/;
const INPUT_KEYS = Object.freeze([
  'backupKeyPath',
  'composePath',
  'journalPath',
  'migrationId',
  'offsiteProfilePath',
  'sourceConfigPath',
  'workspacePath',
]);
const CLI_OPTIONS = Object.freeze({
  '--backup-key': 'backupKeyPath',
  '--compose': 'composePath',
  '--journal': 'journalPath',
  '--migration-id': 'migrationId',
  '--offsite-profile': 'offsiteProfilePath',
  '--source-config': 'sourceConfigPath',
  '--workspace': 'workspacePath',
});
const PLACEHOLDER_PROFILE_PATTERN =
  /(?:replace|placeholder|change[-_.]?me|example|sample|todo|your[-_.]?profile)/i;
const GENERIC_PROFILE_IDS = new Set([
  'backup',
  'default',
  'filesystem',
  'offsite',
  'profile',
  'test',
]);

export class DatabaseRehearsalOperatorError extends Error {
  constructor(code) {
    super(code);
    this.name = 'DatabaseRehearsalOperatorError';
    this.code = code;
  }
}

function fail(code) {
  throw new DatabaseRehearsalOperatorError(code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validateAbsolutePath(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 4096 ||
    !isAbsolute(value) ||
    resolve(value) !== value ||
    !SAFE_PATH_PATTERN.test(value) ||
    value.includes('\0') ||
    value.includes('//') ||
    value.split(sep).includes('..')
  ) {
    fail('INVALID_PATH');
  }
  return value;
}

function safeLstat(path, missingIsNull = false) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (missingIsNull && error?.code === 'ENOENT') return null;
    fail('FILESYSTEM_CHECK_FAILED');
  }
}

function assertPrivateDirectory(path, code = 'INVALID_PRIVATE_DIRECTORY') {
  const metadata = safeLstat(path);
  if (
    metadata.isSymbolicLink() ||
    !metadata.isDirectory() ||
    (metadata.mode & 0o777) !== DIRECTORY_MODE
  ) {
    fail(code);
  }
  return metadata;
}

function assertPrivateFile(path, code = 'INVALID_PRIVATE_FILE') {
  const metadata = safeLstat(path);
  if (
    metadata.isSymbolicLink() ||
    !metadata.isFile() ||
    (metadata.mode & 0o777) !== FILE_MODE ||
    metadata.size <= 0
  ) {
    fail(code);
  }
  return metadata;
}

function assertComposeFile(path) {
  const metadata = safeLstat(path);
  if (
    metadata.isSymbolicLink() ||
    !metadata.isFile() ||
    metadata.size <= 0 ||
    metadata.size > MAX_TEXT_FILE_BYTES ||
    (metadata.mode & 0o022) !== 0
  ) {
    fail('INVALID_COMPOSE_FILE');
  }
}

function readBoundedText(path, code) {
  let metadata;
  let value;
  try {
    metadata = statSync(path);
    if (metadata.size <= 0 || metadata.size > MAX_TEXT_FILE_BYTES) fail(code);
    value = readFileSync(path, 'utf8');
  } catch (error) {
    if (error instanceof DatabaseRehearsalOperatorError) throw error;
    fail(code);
  }
  if (/\u0000|\r/u.test(value)) fail(code);
  return value;
}

function hashFile(path) {
  const hash = createHash('sha256');
  let descriptor;
  try {
    descriptor = openSync(path, constants.O_RDONLY);
    const buffer = Buffer.allocUnsafe(COPY_CHUNK_BYTES);
    while (true) {
      const bytesRead = readSync(descriptor, buffer, 0, buffer.byteLength, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } catch {
    fail('FILESYSTEM_HASH_FAILED');
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  return hash.digest('hex');
}

function writeCanonicalPrivate(path, value, code) {
  assertPrivateDirectory(dirname(path));
  if (existsSync(path)) fail(code);
  let payload;
  try {
    payload = Buffer.from(`${canonicalStringify(value)}\n`, 'utf8');
  } catch {
    fail(code);
  }
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
    if (error instanceof DatabaseRehearsalOperatorError) throw error;
    fail(code);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  assertPrivateFile(path, code);
  return hashFile(path);
}

function isNestedPath(candidate, parent) {
  return candidate === parent || candidate.startsWith(`${parent}${sep}`);
}

function readNamedOffsiteProfile(profilePath, workspacePath) {
  const raw = readBoundedText(profilePath, 'INVALID_OFFSITE_PROFILE');
  let profile;
  try {
    profile = JSON.parse(raw);
  } catch {
    fail('INVALID_OFFSITE_PROFILE');
  }
  if (
    raw !== `${JSON.stringify(profile)}\n` ||
    !hasExactKeys(profile, ['profileId', 'root', 'schemaVersion', 'type']) ||
    profile.schemaVersion !== 1 ||
    profile.type !== 'filesystem' ||
    typeof profile.profileId !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(profile.profileId) ||
    PLACEHOLDER_PROFILE_PATTERN.test(profile.profileId) ||
    GENERIC_PROFILE_IDS.has(profile.profileId.toLowerCase())
  ) {
    fail('INVALID_OFFSITE_PROFILE');
  }
  let root;
  try {
    root = validateAbsolutePath(profile.root);
  } catch {
    fail('INVALID_OFFSITE_PROFILE');
  }
  try {
    assertPrivateDirectory(root, 'INVALID_OFFSITE_PROFILE');
  } catch {
    fail('INVALID_OFFSITE_PROFILE');
  }
  if (isNestedPath(root, workspacePath) || isNestedPath(workspacePath, root)) {
    fail('INVALID_OFFSITE_PROFILE');
  }
  return Object.freeze({ profileId: profile.profileId, root });
}

function assertLedgerIdentity(journalPath, migrationId) {
  const raw = readBoundedText(journalPath, 'INVALID_LEDGER');
  const firstLine = raw.split('\n', 1)[0];
  let event;
  try {
    event = JSON.parse(firstLine);
  } catch {
    fail('INVALID_LEDGER');
  }
  if (
    !isPlainObject(event) ||
    event.projectId !== PROJECT_ID ||
    event.migrationId !== migrationId
  ) {
    fail('LEDGER_IDENTITY_MISMATCH');
  }
}

function validateInput(input) {
  if (!hasExactKeys(input, INPUT_KEYS)) fail('INVALID_INPUT');
  if (typeof input.migrationId !== 'string' || !MIGRATION_ID_PATTERN.test(input.migrationId)) {
    fail('INVALID_MIGRATION_ID');
  }
  for (const key of INPUT_KEYS.filter((key) => key.endsWith('Path'))) {
    validateAbsolutePath(input[key]);
  }
  if (new Set(INPUT_KEYS.filter((key) => key.endsWith('Path')).map((key) => input[key])).size !== 6) {
    fail('INVALID_INPUT');
  }

  assertComposeFile(input.composePath);
  assertPrivateFile(input.sourceConfigPath);
  assertPrivateFile(input.backupKeyPath);
  assertPrivateFile(input.offsiteProfilePath);
  assertPrivateFile(input.journalPath);
  assertPrivateDirectory(dirname(input.workspacePath));
  if (safeLstat(input.workspacePath, true) !== null) fail('WORKSPACE_NOT_EMPTY');
  readNamedOffsiteProfile(input.offsiteProfilePath, input.workspacePath);
  assertLedgerIdentity(input.journalPath, input.migrationId);
  return input;
}

function createPrivateWorkspace(workspacePath) {
  try {
    mkdirSync(workspacePath, { mode: DIRECTORY_MODE });
    for (const name of ['service', 'artifacts', 'readback']) {
      mkdirSync(join(workspacePath, name), { mode: DIRECTORY_MODE });
    }
  } catch {
    fail('WORKSPACE_CREATE_FAILED');
  }
  assertPrivateDirectory(workspacePath);
  for (const name of ['service', 'artifacts', 'readback']) {
    assertPrivateDirectory(join(workspacePath, name));
  }
}

function validateSha256(value, code) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) fail(code);
  return value;
}

function validateTarget(value) {
  if (
    !hasExactKeys(value, ['image', 'major']) ||
    typeof value.image !== 'string' ||
    !/^postgres:[1-9][0-9]*\.[0-9]+-bookworm$/.test(value.image) ||
    !Number.isSafeInteger(value.major) ||
    value.major < 12 ||
    value.major > 99 ||
    Number(value.image.slice('postgres:'.length).split('.')[0]) !== value.major
  ) {
    fail('TARGET_IMAGE_INVALID');
  }
  return value;
}

function validateSourceEvidence(value) {
  if (
    !hasExactKeys(value, [
      'extensions',
      'database',
      'largeObjects',
      'objectsSha256',
      'schemaVersion',
      'schemas',
      'sequences',
      'tables',
    ]) ||
    value.schemaVersion !== 1 ||
    JSON.stringify(value.schemas) !== JSON.stringify(['public']) ||
    !hasExactKeys(value.database, ['collate', 'ctype', 'encoding']) ||
    Object.values(value.database).some((entry) => typeof entry !== 'string') ||
    !Array.isArray(value.extensions) ||
    !Array.isArray(value.tables) ||
    !Array.isArray(value.sequences) ||
    !Array.isArray(value.largeObjects) ||
    !Number.isSafeInteger(value.serverMajor) ||
    value.serverMajor < 12 ||
    value.serverMajor > 99
  ) {
    fail('SOURCE_INVENTORY_FAILED');
  }
  validateSha256(value.objectsSha256, 'SOURCE_INVENTORY_FAILED');
  if (
    value.extensions.some(
      (extension) => typeof extension !== 'string' || !/^[A-Za-z_][A-Za-z0-9_$-]*$/.test(extension),
    ) ||
    new Set(value.extensions).size !== value.extensions.length
  ) {
    fail('SOURCE_INVENTORY_FAILED');
  }
  const tableNames = new Set();
  for (const record of value.tables) {
    if (
      !hasExactKeys(record, ['dataSha256', 'name', 'rowCount']) ||
      !QUALIFIED_NAME_PATTERN.test(record.name ?? '') ||
      tableNames.has(record.name) ||
      !Number.isSafeInteger(record.rowCount) ||
      record.rowCount < 0
    ) {
      fail('SOURCE_INVENTORY_FAILED');
    }
    validateSha256(record.dataSha256, 'SOURCE_INVENTORY_FAILED');
    tableNames.add(record.name);
  }
  const sequenceNames = new Set();
  for (const record of value.sequences) {
    if (
      !hasExactKeys(record, ['isCalled', 'lastValue', 'name']) ||
      !QUALIFIED_NAME_PATTERN.test(record.name ?? '') ||
      sequenceNames.has(record.name) ||
      typeof record.lastValue !== 'string' ||
      !/^-?[0-9]+$/.test(record.lastValue) ||
      typeof record.isCalled !== 'boolean'
    ) {
      fail('SOURCE_INVENTORY_FAILED');
    }
    sequenceNames.add(record.name);
  }
  const largeObjectOids = new Set();
  for (const record of value.largeObjects) {
    if (
      !hasExactKeys(record, ['bytes', 'dataSha256', 'oid']) ||
      typeof record.oid !== 'string' ||
      !/^[1-9][0-9]*$/.test(record.oid) ||
      largeObjectOids.has(record.oid) ||
      !Number.isSafeInteger(record.bytes) ||
      record.bytes < 0
    ) {
      fail('SOURCE_INVENTORY_FAILED');
    }
    validateSha256(record.dataSha256, 'SOURCE_INVENTORY_FAILED');
    largeObjectOids.add(record.oid);
  }
  return value;
}

function validateDumpResult(value, dumpPath) {
  assertPrivateFile(dumpPath, 'DUMP_CREATE_FAILED');
  const bytes = statSync(dumpPath).size;
  const digest = hashFile(dumpPath);
  if (
    !hasExactKeys(value, ['dumpBytes', 'dumpSha256', 'ok']) ||
    value.ok !== true ||
    !Number.isSafeInteger(value.dumpBytes) ||
    value.dumpBytes !== bytes ||
    value.dumpBytes <= 0 ||
    value.dumpSha256 !== digest
  ) {
    fail('DUMP_CREATE_FAILED');
  }
  return value;
}

function validateListResult(value, listPath, code) {
  assertPrivateFile(listPath, code);
  const digest = hashFile(listPath);
  if (
    !hasExactKeys(value, ['listSha256', 'ok']) ||
    value.ok !== true ||
    value.listSha256 !== digest
  ) {
    fail(code);
  }
  validateSha256(digest, code);
  return value;
}

function validateEncryption(value, dump, encryptedPath) {
  assertPrivateFile(encryptedPath, 'BACKUP_ENCRYPTION_FAILED');
  const encryptedBytes = statSync(encryptedPath).size;
  const encryptedSha256 = hashFile(encryptedPath);
  if (
    !hasExactKeys(value, [
      'algorithm',
      'encryptedBytes',
      'encryptedSha256',
      'formatVersion',
      'plaintextBytes',
      'plaintextSha256',
    ]) ||
    value.algorithm !== 'aes-256-gcm' ||
    value.formatVersion !== 1 ||
    value.plaintextBytes !== dump.dumpBytes ||
    value.plaintextSha256 !== dump.dumpSha256 ||
    value.encryptedBytes !== encryptedBytes ||
    value.encryptedSha256 !== encryptedSha256
  ) {
    fail('BACKUP_ENCRYPTION_FAILED');
  }
  validateSha256(value.plaintextSha256, 'BACKUP_ENCRYPTION_FAILED');
  validateSha256(value.encryptedSha256, 'BACKUP_ENCRYPTION_FAILED');
  return value;
}

function expectedManifest({ migrationId, createdAt, sourceServerMajor, targetServerMajor, inventorySha256, encryption, evidenceEncryption }) {
  return {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    migrationId,
    createdAt,
    source: { serverMajor: sourceServerMajor },
    target: { serverMajor: targetServerMajor },
    inventory: { sha256: inventorySha256 },
    dump: {
      format: 'postgresql-custom',
      plaintextBytes: encryption.plaintextBytes,
      plaintextSha256: encryption.plaintextSha256,
      encryption: {
        algorithm: encryption.algorithm,
        formatVersion: encryption.formatVersion,
        encryptedBytes: encryption.encryptedBytes,
        encryptedSha256: encryption.encryptedSha256,
      },
    },
    evidence: {
      format: 'canonical-json',
      plaintextBytes: evidenceEncryption.plaintextBytes,
      plaintextSha256: evidenceEncryption.plaintextSha256,
      encryption: {
        algorithm: evidenceEncryption.algorithm,
        formatVersion: evidenceEncryption.formatVersion,
        encryptedBytes: evidenceEncryption.encryptedBytes,
        encryptedSha256: evidenceEncryption.encryptedSha256,
      },
    },
  };
}

function validateManifest(actual, expected) {
  let actualCanonical;
  let expectedCanonical;
  try {
    actualCanonical = canonicalStringify(actual);
    expectedCanonical = canonicalStringify(expected);
  } catch {
    fail('MANIFEST_CREATE_FAILED');
  }
  if (actualCanonical !== expectedCanonical) fail('MANIFEST_CREATE_FAILED');
  return actual;
}

function validateLedgerStatus(value, state, minimumEventCount, code) {
  if (
    !hasExactKeys(value, ['currentState', 'eventCount', 'ok', 'rolledBack']) ||
    value.ok !== true ||
    value.rolledBack !== false ||
    value.currentState !== state ||
    !Number.isSafeInteger(value.eventCount) ||
    value.eventCount < minimumEventCount
  ) {
    fail(code);
  }
  return value;
}

function validateComparison(value, sourceEvidence) {
  if (
    !hasExactKeys(value, [
      'differenceCount',
      'largeObjectCount',
      'ok',
      'sequenceCount',
      'tableCount',
    ]) ||
    value.ok !== true ||
    value.differenceCount !== 0 ||
    value.tableCount !== sourceEvidence.tables.length ||
    value.sequenceCount !== sourceEvidence.sequences.length ||
    value.largeObjectCount !== sourceEvidence.largeObjects.length
  ) {
    fail('SCRATCH_RESTORE_FAILED');
  }
  return value;
}

function validateOffsiteBoundary(value) {
  if (
    !hasExactKeys(value, ['ok', 'separateDevice']) ||
    value.ok !== true ||
    value.separateDevice !== true
  ) {
    fail('OFFSITE_STORAGE_BOUNDARY_FAILED');
  }
  return value;
}

function timestampFrom(dependencies) {
  let value;
  try {
    value = dependencies.now();
  } catch {
    fail('CLOCK_FAILED');
  }
  const createdAt = value instanceof Date ? value.toISOString() : value;
  if (
    typeof createdAt !== 'string' ||
    Number.isNaN(Date.parse(createdAt)) ||
    new Date(createdAt).toISOString() !== createdAt
  ) {
    fail('CLOCK_FAILED');
  }
  return createdAt;
}

async function stage(code, operation) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof DatabaseRehearsalOperatorError && error.code === code) throw error;
    fail(code);
  }
}

const DEFAULT_DEPENDENCIES = Object.freeze({
  advanceLedger,
  collectPostgresIntegrityEvidence,
  copyEncryptedBackupOffsite,
  createBackupManifest,
  createCustomFormatDump,
  createSourceQuery,
  encryptDatabaseDump,
  extractPinnedTargetPostgres,
  now: () => new Date(),
  readSourceDatabaseConfig,
  runScratchRestoreDrill,
  verifyCustomFormatDump,
  verifyLedger,
  verifyOffsiteFilesystemBoundary,
  verifyOffsiteReadback,
  writeLibpqServiceFile,
});

function resolveDependencies(overrides) {
  if (overrides === undefined) return DEFAULT_DEPENDENCIES;
  if (!isPlainObject(overrides)) fail('INVALID_DEPENDENCIES');
  const allowed = new Set(Object.keys(DEFAULT_DEPENDENCIES));
  if (Object.keys(overrides).some((key) => !allowed.has(key))) fail('INVALID_DEPENDENCIES');
  const result = { ...DEFAULT_DEPENDENCIES, ...overrides };
  if (Object.values(result).some((value) => typeof value !== 'function')) {
    fail('INVALID_DEPENDENCIES');
  }
  return Object.freeze(result);
}

export async function rehearseDatabaseMigration(input, dependencyOverrides) {
  validateInput(input);
  const dependencies = resolveDependencies(dependencyOverrides);
  const composeText = readBoundedText(input.composePath, 'INVALID_COMPOSE_FILE');
  const target = validateTarget(
    await stage('TARGET_IMAGE_INVALID', () =>
      dependencies.extractPinnedTargetPostgres(composeText),
    ),
  );
  const initialLedger = validateLedgerStatus(
    await stage('INVALID_LEDGER_STATE', () =>
      dependencies.verifyLedger({ journalPath: input.journalPath }),
    ),
    'STAGED',
    2,
    'INVALID_LEDGER_STATE',
  );
  const createdAt = timestampFrom(dependencies);

  createPrivateWorkspace(input.workspacePath);
  const serviceDirectory = join(input.workspacePath, 'service');
  const artifactDirectory = join(input.workspacePath, 'artifacts');
  const readbackDirectory = join(input.workspacePath, 'readback');
  const servicePath = join(serviceDirectory, 'pg_service.conf');
  const dumpPath = join(artifactDirectory, 'source.dump');
  const dumpListPath = join(artifactDirectory, 'source.dump.list');
  const encryptedPath = join(artifactDirectory, 'source.dump.enc');
  const inventoryPath = join(artifactDirectory, 'source.inventory.json');
  const evidenceBundlePath = join(artifactDirectory, 'evidence.bundle.json');
  const encryptedEvidencePath = join(artifactDirectory, 'evidence.bundle.enc');
  const manifestPath = join(artifactDirectory, 'backup.manifest.json');
  const sensitivePlaintextPaths = [
    servicePath,
    join(serviceDirectory, 'pgpass'),
    dumpPath,
    dumpListPath,
    inventoryPath,
    evidenceBundlePath,
    join(readbackDirectory, 'source.dump'),
    join(readbackDirectory, 'source.dump.list'),
    join(readbackDirectory, 'evidence.bundle.json'),
  ];

  try {

  validateOffsiteBoundary(
    await stage('OFFSITE_STORAGE_BOUNDARY_FAILED', () =>
      dependencies.verifyOffsiteFilesystemBoundary({
        localPath: input.workspacePath,
        profilePath: input.offsiteProfilePath,
      }),
    ),
  );

  const sourceConfig = await stage('SOURCE_CONFIGURATION_FAILED', () =>
    dependencies.readSourceDatabaseConfig(input.sourceConfigPath),
  );
  const serviceResult = await stage('SOURCE_CONFIGURATION_FAILED', () =>
    dependencies.writeLibpqServiceFile(sourceConfig, servicePath),
  );
  if (
    !hasExactKeys(serviceResult, ['ok', 'serviceName']) ||
    serviceResult.ok !== true ||
    serviceResult.serviceName !== 'source'
  ) {
    fail('SOURCE_CONFIGURATION_FAILED');
  }
  assertPrivateFile(servicePath, 'SOURCE_CONFIGURATION_FAILED');
  assertPrivateFile(join(serviceDirectory, 'pgpass'), 'SOURCE_CONFIGURATION_FAILED');

  const query = await stage('SOURCE_CONFIGURATION_FAILED', () =>
    dependencies.createSourceQuery({
      clientImage: target.image,
      serviceDirectory,
    }),
  );
  if (typeof query !== 'function') fail('SOURCE_CONFIGURATION_FAILED');
  const sourceEvidence = validateSourceEvidence(
    await stage('SOURCE_INVENTORY_FAILED', () =>
      dependencies.collectPostgresIntegrityEvidence({
        projectId: PROJECT_ID,
        migrationId: input.migrationId,
        query,
      }),
    ),
  );
  if (sourceEvidence.serverMajor > target.major) fail('SOURCE_NEWER_THAN_TARGET');
  const inventorySha256 = writeCanonicalPrivate(
    inventoryPath,
    sourceEvidence,
    'SOURCE_INVENTORY_FAILED',
  );

  const dump = validateDumpResult(
    await stage('DUMP_CREATE_FAILED', () =>
      dependencies.createCustomFormatDump({
        projectId: PROJECT_ID,
        migrationId: input.migrationId,
        clientImage: target.image,
        serviceDirectory,
        artifactDirectory,
      }),
    ),
    dumpPath,
  );
  const originalList = validateListResult(
    await stage('DUMP_LIST_FAILED', () =>
      dependencies.verifyCustomFormatDump({
        clientImage: target.image,
        artifactDirectory,
      }),
    ),
    dumpListPath,
    'DUMP_LIST_FAILED',
  );
  const encryption = validateEncryption(
    await stage('BACKUP_ENCRYPTION_FAILED', () =>
      dependencies.encryptDatabaseDump({
        projectId: PROJECT_ID,
        migrationId: input.migrationId,
        dumpPath,
        keyPath: input.backupKeyPath,
        encryptedPath,
      }),
    ),
    dump,
    encryptedPath,
  );

  const evidenceBundleSha256 = writeCanonicalPrivate(
    evidenceBundlePath,
    {
      schemaVersion: 1,
      projectId: PROJECT_ID,
      migrationId: input.migrationId,
      createdAt,
      sourceServerMajor: sourceEvidence.serverMajor,
      sourceInventory: sourceEvidence,
      sourceInventorySha256: inventorySha256,
      dumpListSha256: originalList.listSha256,
    },
    'EVIDENCE_BUNDLE_FAILED',
  );
  const evidenceEncryption = validateEncryption(
    await stage('EVIDENCE_BUNDLE_ENCRYPTION_FAILED', () =>
      dependencies.encryptDatabaseDump({
        projectId: PROJECT_ID,
        migrationId: input.migrationId,
        dumpPath: evidenceBundlePath,
        keyPath: input.backupKeyPath,
        encryptedPath: encryptedEvidencePath,
      }),
    ),
    {
      dumpBytes: statSync(evidenceBundlePath).size,
      dumpSha256: evidenceBundleSha256,
    },
    encryptedEvidencePath,
  );

  const manifestValues = {
    projectId: PROJECT_ID,
    migrationId: input.migrationId,
    createdAt,
    sourceServerMajor: sourceEvidence.serverMajor,
    targetServerMajor: target.major,
    inventorySha256,
    encryption,
    evidenceEncryption,
  };
  const manifest = validateManifest(
    await stage('MANIFEST_CREATE_FAILED', () =>
      dependencies.createBackupManifest(manifestValues),
    ),
    expectedManifest(manifestValues),
  );
  const manifestSha256 = writeCanonicalPrivate(
    manifestPath,
    manifest,
    'MANIFEST_CREATE_FAILED',
  );

  const copyResult = await stage('OFFSITE_COPY_FAILED', () =>
    dependencies.copyEncryptedBackupOffsite({
      projectId: PROJECT_ID,
      migrationId: input.migrationId,
      encryptedPath,
      encryptedEvidencePath,
      manifestPath,
      profilePath: input.offsiteProfilePath,
    }),
  );
  if (
    !hasExactKeys(copyResult, ['copiedFileCount', 'ok']) ||
    copyResult.ok !== true ||
    copyResult.copiedFileCount !== 3
  ) {
    fail('OFFSITE_COPY_FAILED');
  }

  const readback = await stage('OFFSITE_READBACK_FAILED', () =>
    dependencies.verifyOffsiteReadback({
      projectId: PROJECT_ID,
      migrationId: input.migrationId,
      profilePath: input.offsiteProfilePath,
      keyPath: input.backupKeyPath,
      readbackDirectory,
    }),
  );
  if (
    !hasExactKeys(readback, ['dumpSha256', 'evidenceSha256', 'ok']) ||
    readback.ok !== true ||
    readback.dumpSha256 !== dump.dumpSha256 ||
    readback.evidenceSha256 !== evidenceBundleSha256
  ) {
    fail('OFFSITE_READBACK_FAILED');
  }
  for (const name of [
    'source.dump',
    'source.dump.enc',
    'evidence.bundle.json',
    'evidence.bundle.enc',
    'backup.manifest.json',
  ]) {
    assertPrivateFile(join(readbackDirectory, name), 'OFFSITE_READBACK_FAILED');
  }
  if (
    hashFile(join(readbackDirectory, 'source.dump')) !== dump.dumpSha256 ||
    statSync(join(readbackDirectory, 'source.dump')).size !== dump.dumpBytes ||
    hashFile(join(readbackDirectory, 'source.dump.enc')) !== encryption.encryptedSha256 ||
    statSync(join(readbackDirectory, 'source.dump.enc')).size !== encryption.encryptedBytes ||
    hashFile(join(readbackDirectory, 'evidence.bundle.json')) !== evidenceBundleSha256 ||
    hashFile(join(readbackDirectory, 'evidence.bundle.enc')) !== evidenceEncryption.encryptedSha256 ||
    statSync(join(readbackDirectory, 'evidence.bundle.enc')).size !== evidenceEncryption.encryptedBytes ||
    hashFile(join(readbackDirectory, 'backup.manifest.json')) !== manifestSha256
  ) {
    fail('OFFSITE_READBACK_FAILED');
  }
  const readbackList = validateListResult(
    await stage('OFFSITE_DUMP_LIST_FAILED', () =>
      dependencies.verifyCustomFormatDump({
        clientImage: target.image,
        artifactDirectory: readbackDirectory,
      }),
    ),
    join(readbackDirectory, 'source.dump.list'),
    'OFFSITE_DUMP_LIST_FAILED',
  );
  if (readbackList.listSha256 !== originalList.listSha256) {
    fail('OFFSITE_DUMP_LIST_FAILED');
  }

  const artifactVerificationReportSha256 = writeCanonicalPrivate(
    join(artifactDirectory, 'artifact-verification-report.json'),
    {
      schemaVersion: 1,
      projectId: PROJECT_ID,
      migrationId: input.migrationId,
      createdAt,
      dumpSha256: dump.dumpSha256,
      dumpListSha256: originalList.listSha256,
      evidenceBundleSha256,
      encryptedEvidenceSha256: evidenceEncryption.encryptedSha256,
      manifestSha256,
      offsiteReadbackVerified: true,
    },
    'ARTIFACT_REPORT_FAILED',
  );
  const artifactsLedger = validateLedgerStatus(
    await stage('LEDGER_ADVANCE_FAILED', () =>
      dependencies.advanceLedger({
        journalPath: input.journalPath,
        targetState: 'ARTIFACTS_VERIFIED',
        evidence: {
          databaseArtifactReportDigest: artifactVerificationReportSha256,
          databaseDumpDigest: dump.dumpSha256,
          offNasBackupVerified: true,
          storageManifestDigest: manifestSha256,
        },
        now: createdAt,
      }),
    ),
    'ARTIFACTS_VERIFIED',
    initialLedger.eventCount + 1,
    'LEDGER_ADVANCE_FAILED',
  );
  validateLedgerStatus(
    await stage('LEDGER_VERIFY_FAILED', () =>
      dependencies.verifyLedger({ journalPath: input.journalPath }),
    ),
    'ARTIFACTS_VERIFIED',
    artifactsLedger.eventCount,
    'LEDGER_VERIFY_FAILED',
  );

  const comparison = validateComparison(
    await stage('SCRATCH_RESTORE_FAILED', () =>
      dependencies.runScratchRestoreDrill({
        projectId: PROJECT_ID,
        migrationId: input.migrationId,
        targetImage: target.image,
        artifactDirectory: readbackDirectory,
        sourceServerMajor: sourceEvidence.serverMajor,
        sourceEvidence,
      }),
    ),
    sourceEvidence,
  );

  const integrityReportPath = join(artifactDirectory, 'integrity-report.json');
  const integrityReportSha256 = writeCanonicalPrivate(
    integrityReportPath,
    {
      schemaVersion: 1,
      projectId: PROJECT_ID,
      migrationId: input.migrationId,
      createdAt,
      sourceInventorySha256: inventorySha256,
      restoredDumpSha256: readback.dumpSha256,
      sourceObjectsSha256: sourceEvidence.objectsSha256,
      comparison,
    },
    'INTEGRITY_REPORT_FAILED',
  );
  const restoreDrillReportSha256 = writeCanonicalPrivate(
    join(artifactDirectory, 'restore-drill-report.json'),
    {
      schemaVersion: 1,
      projectId: PROJECT_ID,
      migrationId: input.migrationId,
      createdAt,
      sourceServerMajor: sourceEvidence.serverMajor,
      targetServerMajor: target.major,
      inventorySha256,
      dumpSha256: dump.dumpSha256,
      dumpListSha256: originalList.listSha256,
      encryptedSha256: encryption.encryptedSha256,
      manifestSha256,
      offsiteProfileSha256: hashFile(input.offsiteProfilePath),
      offsiteCopiedFileCount: copyResult.copiedFileCount,
      offsiteReadbackVerified: true,
      scratchNetwork: 'none',
      scratchRestoredFromOffsiteReadback: true,
      integrityReportSha256,
      comparison,
    },
    'RESTORE_DRILL_REPORT_FAILED',
  );

  const advancedLedger = validateLedgerStatus(
    await stage('LEDGER_ADVANCE_FAILED', () =>
      dependencies.advanceLedger({
        journalPath: input.journalPath,
        targetState: 'RESTORE_DRILL_PASSED',
        evidence: {
          integrityReportDigest: integrityReportSha256,
          offNasBackupVerified: true,
          restoreDrillReportDigest: restoreDrillReportSha256,
        },
        now: createdAt,
      }),
    ),
    'RESTORE_DRILL_PASSED',
    artifactsLedger.eventCount + 1,
    'LEDGER_ADVANCE_FAILED',
  );
  const finalLedger = validateLedgerStatus(
    await stage('LEDGER_VERIFY_FAILED', () =>
      dependencies.verifyLedger({ journalPath: input.journalPath }),
    ),
    'RESTORE_DRILL_PASSED',
    advancedLedger.eventCount,
    'LEDGER_VERIFY_FAILED',
  );
  if (finalLedger.eventCount !== advancedLedger.eventCount) fail('LEDGER_VERIFY_FAILED');

  return Object.freeze({
    ok: true,
    status: 'RESTORE_DRILL_PASSED',
    sourceServerMajor: sourceEvidence.serverMajor,
    targetServerMajor: target.major,
    tableCount: comparison.tableCount,
    sequenceCount: comparison.sequenceCount,
    largeObjectCount: comparison.largeObjectCount,
    differenceCount: comparison.differenceCount,
    dumpBytes: dump.dumpBytes,
    encryptedBytes: encryption.encryptedBytes,
    copiedFileCount: copyResult.copiedFileCount,
    ledgerEventCount: finalLedger.eventCount,
    offsiteReadback: true,
    scratchRestore: true,
    inventorySha256,
    dumpSha256: dump.dumpSha256,
    dumpListSha256: originalList.listSha256,
    encryptedSha256: encryption.encryptedSha256,
    encryptedEvidenceSha256: evidenceEncryption.encryptedSha256,
    evidenceBundleSha256,
    manifestSha256,
    artifactVerificationReportSha256,
    integrityReportSha256,
    restoreDrillReportSha256,
  });
  } finally {
    for (const path of sensitivePlaintextPaths) rmSync(path, { force: true });
  }
}

export function parseRehearsalArguments(argv) {
  if (!Array.isArray(argv) || argv[0] !== 'rehearse' || argv.length !== 15) fail('USAGE');
  const values = {};
  for (let index = 1; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    const key = CLI_OPTIONS[option];
    if (
      key === undefined ||
      Object.hasOwn(values, key) ||
      typeof value !== 'string' ||
      value.length === 0 ||
      /[\u0000\r\n]/u.test(value)
    ) {
      fail('USAGE');
    }
    values[key] = value;
  }
  if (!hasExactKeys(values, INPUT_KEYS)) fail('USAGE');
  return {
    migrationId: values.migrationId,
    composePath: values.composePath,
    sourceConfigPath: values.sourceConfigPath,
    backupKeyPath: values.backupKeyPath,
    offsiteProfilePath: values.offsiteProfilePath,
    journalPath: values.journalPath,
    workspacePath: values.workspacePath,
  };
}

export async function runCli(argv = process.argv.slice(2), dependencyOverrides) {
  if (Array.isArray(argv) && argv.length === 1 && argv[0] === 'cutover') {
    fail('LIVE_CUTOVER_OPERATOR_UNAVAILABLE');
  }
  return rehearseDatabaseMigration(parseRehearsalArguments(argv), dependencyOverrides);
}

const invokedPath = process.argv[1] === undefined ? undefined : pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  try {
    process.stdout.write(`${JSON.stringify(await runCli())}\n`);
  } catch {
    process.stderr.write('{"ok":false}\n');
    process.exitCode = 1;
  }
}
