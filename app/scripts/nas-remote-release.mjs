#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, join, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const EXPECTED_PROJECT_ID = 'flowpack-nas';
const PROJECT_SERVICE = Object.freeze({
  'documate-nas': 'svc:documate',
  'flowpack-nas': 'svc:flowpack',
});
const PROJECT_PORT_KEY = Object.freeze({
  'documate-nas': 'DOCUMATE_NAS_HTTP_PORT',
  'flowpack-nas': 'FLOWPACK_NAS_HTTP_PORT',
});
const ARCHIVE_FILE = 'release.tar';
const FILE_MANIFEST_FILE = 'release-files.jsonl';
const RELEASE_MANIFEST_FILE = 'release-manifest.json';
const HELPER_FILE = 'nas-remote-release.mjs';
const HELPER_RELEASE_PATH = 'scripts/nas-remote-release.mjs';
const MAX_JSON_BYTES = 64 * 1024 * 1024;
const TAR_BLOCK_BYTES = 512;

class RemoteReleaseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RemoteReleaseError';
  }
}

function fail(message) {
  throw new RemoteReleaseError(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return (
    isPlainObject(value) &&
    Object.keys(value).sort().join('\n') === [...keys].sort().join('\n')
  );
}

function assertProjectId(projectId) {
  if (projectId !== EXPECTED_PROJECT_ID || !Object.hasOwn(PROJECT_SERVICE, projectId)) {
    fail('project identity is invalid');
  }
}

function assertCommit(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40,64}$/.test(value)) {
    fail('release commit is invalid');
  }
  return value;
}

function assertToken(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{32}$/.test(value)) {
    fail('deployment token is invalid');
  }
  return value;
}

function assertAbsoluteDirectory(value, failureMessage) {
  if (
    typeof value !== 'string' ||
    !isAbsolute(value) ||
    value === '/' ||
    posix.normalize(value) !== value ||
    !/^(?:\/[A-Za-z0-9._-]+)+$/.test(value)
  ) {
    fail(failureMessage);
  }
  let metadata;
  try {
    metadata = lstatSync(value);
  } catch {
    fail(failureMessage);
  }
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) fail(failureMessage);
  return value;
}

function readBoundedFile(filePath, failureMessage) {
  let metadata;
  let contents;
  try {
    metadata = lstatSync(filePath);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_JSON_BYTES) {
      fail(failureMessage);
    }
    contents = readFileSync(filePath);
  } catch (error) {
    if (error instanceof RemoteReleaseError) throw error;
    fail(failureMessage);
  }
  return contents;
}

function readJsonFile(filePath, failureMessage) {
  const contents = readBoundedFile(filePath, failureMessage);
  try {
    return JSON.parse(contents.toString('utf8'));
  } catch {
    fail(failureMessage);
  }
}

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

function validateReleasePath(releasePath) {
  if (
    typeof releasePath !== 'string' ||
    releasePath.length === 0 ||
    releasePath.startsWith('/') ||
    releasePath.includes('\\') ||
    /[\u0000-\u001f\u007f]/u.test(releasePath) ||
    posix.normalize(releasePath) !== releasePath ||
    releasePath.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    fail('release file manifest is invalid');
  }
  return releasePath;
}

function readFileManifest(filePath) {
  const contents = readBoundedFile(filePath, 'release file manifest is invalid').toString('utf8');
  if (!contents.endsWith('\n')) fail('release file manifest is invalid');
  const lines = contents.slice(0, -1).split('\n');
  const records = lines.length === 1 && lines[0] === '' ? [] : lines.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      fail('release file manifest is invalid');
    }
  });
  let previous = null;
  for (const record of records) {
    if (
      !hasExactKeys(record, ['bytes', 'mode', 'path', 'sha256']) ||
      !Number.isSafeInteger(record.bytes) ||
      record.bytes < 0 ||
      (record.mode !== '100644' && record.mode !== '100755') ||
      !/^[0-9a-f]{64}$/.test(record.sha256)
    ) {
      fail('release file manifest is invalid');
    }
    validateReleasePath(record.path);
    if (previous !== null && record.path <= previous) fail('release file manifest is invalid');
    previous = record.path;
  }
  return records;
}

function parseTarNumber(field) {
  if ((field[0] & 0x80) !== 0) fail('release archive header is invalid');
  const zero = field.indexOf(0);
  const text = field.subarray(0, zero === -1 ? field.length : zero).toString('ascii').trim();
  if (!/^[0-7]+$/.test(text)) fail('release archive header is invalid');
  const parsed = Number.parseInt(text, 8);
  if (!Number.isSafeInteger(parsed) || parsed < 0) fail('release archive header is invalid');
  return parsed;
}

function verifyTarChecksum(header) {
  const recorded = parseTarNumber(header.subarray(148, 156));
  let calculated = 0;
  for (let index = 0; index < header.length; index += 1) {
    calculated += index >= 148 && index < 156 ? 0x20 : header[index];
  }
  if (recorded !== calculated) fail('release archive header is invalid');
}

function verifyArchiveCommit(archive, expectedCommit) {
  if (!Buffer.isBuffer(archive) || archive.length < TAR_BLOCK_BYTES * 2) {
    fail('release archive commit binding is invalid');
  }
  const header = archive.subarray(0, TAR_BLOCK_BYTES);
  verifyTarChecksum(header);
  if (String.fromCharCode(header[156]) !== 'g') fail('release archive commit binding is invalid');
  const size = parseTarNumber(header.subarray(124, 136));
  if (size <= 0 || size > TAR_BLOCK_BYTES || TAR_BLOCK_BYTES + size > archive.length) {
    fail('release archive commit binding is invalid');
  }
  const pax = archive.subarray(TAR_BLOCK_BYTES, TAR_BLOCK_BYTES + size).toString('utf8');
  let offset = 0;
  const values = new Map();
  while (offset < pax.length) {
    const space = pax.indexOf(' ', offset);
    if (space <= offset) fail('release archive commit binding is invalid');
    const lengthText = pax.slice(offset, space);
    if (!/^[1-9][0-9]*$/.test(lengthText)) fail('release archive commit binding is invalid');
    const length = Number(lengthText);
    const end = offset + length;
    if (!Number.isSafeInteger(length) || end > pax.length || pax[end - 1] !== '\n') {
      fail('release archive commit binding is invalid');
    }
    const body = pax.slice(space + 1, end - 1);
    const equals = body.indexOf('=');
    if (equals <= 0) fail('release archive commit binding is invalid');
    const key = body.slice(0, equals);
    if (values.has(key)) fail('release archive commit binding is invalid');
    values.set(key, body.slice(equals + 1));
    offset = end;
  }
  if (values.get('comment') !== expectedCommit) fail('release archive commit binding is invalid');
}

function assertMode600Regular(filePath, failureMessage) {
  let metadata;
  try {
    metadata = lstatSync(filePath);
  } catch {
    fail(failureMessage);
  }
  if (
    metadata.isSymbolicLink() ||
    !metadata.isFile() ||
    (metadata.mode & 0o777) !== 0o600
  ) {
    fail(failureMessage);
  }
}

function topology(projectId, projectRoot) {
  assertProjectId(projectId);
  const root = assertAbsoluteDirectory(projectRoot, 'project root is invalid');
  const sentinel = join(root, '.nas-project-id');
  assertMode600Regular(sentinel, 'project sentinel is invalid');
  const sentinelContents = readFileSync(sentinel, 'utf8');
  if (sentinelContents !== projectId && sentinelContents !== `${projectId}\n`) {
    fail('project sentinel is invalid');
  }
  for (const secretFile of ['.env.nas.local', '.env.nas.db.local']) {
    assertMode600Regular(join(root, secretFile), 'NAS environment file is invalid');
  }
  const releases = assertAbsoluteDirectory(join(root, 'releases'), 'release root is invalid');
  const state = assertAbsoluteDirectory(join(root, 'state'), 'deployment state root is invalid');
  const incoming = assertAbsoluteDirectory(join(state, 'incoming'), 'incoming root is invalid');
  return {
    current: join(root, 'current'),
    incoming,
    lock: join(state, 'source-deploy.lock'),
    releases,
    root,
    runtimeEnvironment: join(root, '.env.nas.local'),
  };
}

function readCurrentCommit(paths, allowMissing = true) {
  let metadata;
  try {
    metadata = lstatSync(paths.current);
  } catch (error) {
    if (error?.code === 'ENOENT' && allowMissing) return null;
    fail('current release is invalid');
  }
  if (!metadata.isSymbolicLink()) fail('current release is invalid');
  const target = readlinkSync(paths.current);
  const match = /^releases\/([0-9a-f]{40,64})$/.exec(target);
  if (!match) fail('current release is invalid');
  const release = join(paths.releases, match[1]);
  const releaseMetadata = lstatSync(release);
  if (!releaseMetadata.isDirectory() || releaseMetadata.isSymbolicLink()) {
    fail('current release is invalid');
  }
  return match[1];
}

function writePrivate(filePath, contents) {
  writeFileSync(filePath, contents, { flag: 'wx', mode: 0o600 });
  chmodSync(filePath, 0o600);
}

function readLock(paths, token) {
  assertToken(token);
  const metadata = lstatSync(paths.lock);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) fail('deployment lock is invalid');
  assertMode600Regular(join(paths.lock, 'token'), 'deployment lock is invalid');
  assertMode600Regular(join(paths.lock, 'new-commit'), 'deployment lock is invalid');
  assertMode600Regular(join(paths.lock, 'previous-commit'), 'deployment lock is invalid');
  if (readFileSync(join(paths.lock, 'token'), 'utf8') !== token) fail('deployment lock is invalid');
  const nextCommit = assertCommit(readFileSync(join(paths.lock, 'new-commit'), 'utf8'));
  const previousText = readFileSync(join(paths.lock, 'previous-commit'), 'utf8');
  const previousCommit = previousText === 'NONE' ? null : assertCommit(previousText);
  return { nextCommit, previousCommit };
}

function verifyTransfer(stage, commit) {
  const manifestPath = join(stage, RELEASE_MANIFEST_FILE);
  const fileManifestPath = join(stage, FILE_MANIFEST_FILE);
  const archivePath = join(stage, ARCHIVE_FILE);
  const helperPath = join(stage, HELPER_FILE);
  for (const filePath of [manifestPath, fileManifestPath, archivePath, helperPath]) {
    assertMode600Regular(filePath, 'staged release input is invalid');
  }
  const manifest = readJsonFile(manifestPath, 'release manifest is invalid');
  if (
    !hasExactKeys(manifest, ['archive', 'commit', 'fileManifest', 'schemaVersion']) ||
    manifest.schemaVersion !== 1 ||
    manifest.commit !== commit ||
    !hasExactKeys(manifest.archive, ['bytes', 'file', 'sha256']) ||
    manifest.archive.file !== ARCHIVE_FILE ||
    !Number.isSafeInteger(manifest.archive.bytes) ||
    manifest.archive.bytes < 1 ||
    !/^[0-9a-f]{64}$/.test(manifest.archive.sha256) ||
    !hasExactKeys(manifest.fileManifest, ['bytes', 'count', 'file', 'sha256']) ||
    manifest.fileManifest.file !== FILE_MANIFEST_FILE ||
    !Number.isSafeInteger(manifest.fileManifest.bytes) ||
    manifest.fileManifest.bytes < 1 ||
    !Number.isSafeInteger(manifest.fileManifest.count) ||
    manifest.fileManifest.count < 1 ||
    !/^[0-9a-f]{64}$/.test(manifest.fileManifest.sha256)
  ) {
    fail('release manifest is invalid');
  }
  const fileManifest = readBoundedFile(fileManifestPath, 'release file manifest is invalid');
  const archive = readBoundedFile(archivePath, 'release archive is invalid');
  if (
    fileManifest.length !== manifest.fileManifest.bytes ||
    sha256(fileManifest) !== manifest.fileManifest.sha256 ||
    archive.length !== manifest.archive.bytes ||
    sha256(archive) !== manifest.archive.sha256
  ) {
    fail('release transfer checksum is invalid');
  }
  const records = readFileManifest(fileManifestPath);
  if (records.length !== manifest.fileManifest.count) fail('release file manifest is invalid');
  const helperRecord = records.find((record) => record.path === HELPER_RELEASE_PATH);
  if (!helperRecord || sha256(readFileSync(helperPath)) !== helperRecord.sha256) {
    fail('remote helper is not bound to the release');
  }
  verifyArchiveCommit(archive, commit);
  return { archivePath, records };
}

function listFiles(directory, prefix = '') {
  const records = [];
  for (const name of readdirSync(directory).sort()) {
    const absolute = join(directory, name);
    const relative = prefix === '' ? name : `${prefix}/${name}`;
    const metadata = lstatSync(absolute);
    if (metadata.isSymbolicLink()) fail('extracted release contains a symbolic link');
    if (metadata.isDirectory()) {
      records.push(...listFiles(absolute, relative));
    } else if (metadata.isFile()) {
      records.push({ absolute, metadata, path: relative });
    } else {
      fail('extracted release contains a special file');
    }
  }
  return records;
}

function verifyExtractedRelease(directory, manifestRecords) {
  const actual = listFiles(directory);
  if (actual.length !== manifestRecords.length) fail('extracted release does not match manifest');
  for (let index = 0; index < actual.length; index += 1) {
    const file = actual[index];
    const expected = manifestRecords[index];
    const mode = (file.metadata.mode & 0o111) === 0 ? '100644' : '100755';
    if (
      file.path !== expected.path ||
      file.metadata.size !== expected.bytes ||
      mode !== expected.mode ||
      sha256(readFileSync(file.absolute)) !== expected.sha256
    ) {
      fail('extracted release does not match manifest');
    }
  }
}

export function prepareRelease({ projectId, projectRoot, commit, token }) {
  assertCommit(commit);
  assertToken(token);
  const paths = topology(projectId, projectRoot);
  const stage = join(paths.incoming, `${commit}-${token}`);
  assertAbsoluteDirectory(stage, 'staged release directory is invalid');
  const release = join(paths.releases, commit);
  if (existsSync(paths.lock)) fail('deployment lock already exists');
  let releaseExists = false;
  if (existsSync(release)) {
    const releaseMetadata = lstatSync(release);
    if (!releaseMetadata.isDirectory() || releaseMetadata.isSymbolicLink()) {
      fail('existing release is invalid');
    }
    releaseExists = true;
  }
  const previousCommit = readCurrentCommit(paths);
  const temporaryRelease = join(paths.releases, `.prepare-${commit}-${token}`);
  mkdirSync(paths.lock, { mode: 0o700 });
  try {
    writePrivate(join(paths.lock, 'token'), token);
    writePrivate(join(paths.lock, 'new-commit'), commit);
    writePrivate(join(paths.lock, 'previous-commit'), previousCommit ?? 'NONE');
    const transfer = verifyTransfer(stage, commit);
    if (releaseExists) {
      verifyExtractedRelease(release, transfer.records);
    } else {
      mkdirSync(temporaryRelease, { mode: 0o700 });
      const extracted = spawnSync('tar', ['-xf', transfer.archivePath, '-C', temporaryRelease], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      if (extracted.error || extracted.status !== 0) fail('release extraction failed');
      verifyExtractedRelease(temporaryRelease, transfer.records);
      renameSync(temporaryRelease, release);
    }
    return { ok: true, hadPrevious: previousCommit !== null, previousCommit };
  } catch (error) {
    rmSync(temporaryRelease, { force: true, recursive: true });
    rmSync(paths.lock, { force: true, recursive: true });
    rmSync(stage, { force: true, recursive: true });
    throw error;
  }
}

function atomicallySelect(paths, commit, token) {
  const temporary = join(paths.root, `.current-${token}`);
  rmSync(temporary, { force: true });
  symlinkSync(`releases/${commit}`, temporary);
  renameSync(temporary, paths.current);
}

export function promoteRelease({ projectId, projectRoot, token }) {
  const paths = topology(projectId, projectRoot);
  const lock = readLock(paths, token);
  const current = readCurrentCommit(paths);
  if (current !== lock.previousCommit) fail('current release changed during deployment');
  const nextRelease = lstatSync(join(paths.releases, lock.nextCommit));
  if (!nextRelease.isDirectory() || nextRelease.isSymbolicLink()) fail('next release is invalid');
  atomicallySelect(paths, lock.nextCommit, token);
  return { ok: true, hadPrevious: lock.previousCommit !== null, previousCommit: lock.previousCommit };
}

export function rollbackRelease({ projectId, projectRoot, token }) {
  const paths = topology(projectId, projectRoot);
  const lock = readLock(paths, token);
  const current = readCurrentCommit(paths);
  if (current !== lock.nextCommit && current !== lock.previousCommit) {
    fail('current release changed during rollback');
  }
  if (current === lock.nextCommit) {
    if (lock.previousCommit === null) {
      rmSync(paths.current);
    } else {
      atomicallySelect(paths, lock.previousCommit, token);
    }
  }
  rmSync(paths.lock, { recursive: true });
  rmSync(join(paths.incoming, `${lock.nextCommit}-${token}`), { force: true, recursive: true });
  return { ok: true, hadPrevious: lock.previousCommit !== null, previousCommit: lock.previousCommit };
}

export function finishRelease({ projectId, projectRoot, token }) {
  const paths = topology(projectId, projectRoot);
  const lock = readLock(paths, token);
  if (readCurrentCommit(paths, false) !== lock.nextCommit) {
    fail('current release is not the promoted release');
  }
  rmSync(paths.lock, { recursive: true });
  rmSync(join(paths.incoming, `${lock.nextCommit}-${token}`), { force: true, recursive: true });
  return { ok: true, hadPrevious: lock.previousCommit !== null, previousCommit: lock.previousCommit };
}

function parseRuntimePort(projectId, environmentPath) {
  const key = PROJECT_PORT_KEY[projectId];
  const text = readBoundedFile(environmentPath, 'runtime environment is invalid').toString('utf8');
  if (/\r|[\u0000-\u0009\u000b-\u001f\u007f]/u.test(text)) {
    fail('runtime environment is invalid');
  }
  const matches = text.split('\n').filter((line) => line.startsWith(`${key}=`));
  if (matches.length !== 1) fail('runtime environment is invalid');
  const value = matches[0].slice(key.length + 1);
  const port = Number(value);
  if (!/^[1-9][0-9]{0,4}$/.test(value) || !Number.isSafeInteger(port) || port > 65535) {
    fail('runtime environment is invalid');
  }
  return port;
}

export function validateServeConfig({ config, projectId, backendPort }) {
  assertProjectId(projectId);
  if (
    !hasExactKeys(config, ['services', 'version']) ||
    config.version !== '0.0.1' ||
    !isPlainObject(config.services)
  ) {
    fail('Tailscale Serve configuration is invalid');
  }
  const service = config.services[PROJECT_SERVICE[projectId]];
  if (
    !isPlainObject(service) ||
    Object.keys(service).some((key) => key !== 'endpoints' && key !== 'advertised') ||
    service.advertised === false ||
    !isPlainObject(service.endpoints) ||
    Object.keys(service.endpoints).sort().join(',') !== 'tcp:443' ||
    service.endpoints['tcp:443'] !== `http://127.0.0.1:${backendPort}`
  ) {
    fail('Tailscale Serve service backend is invalid');
  }
  return true;
}

export function validateFunnelStatus(config) {
  if (!isPlainObject(config) || Object.keys(config).length !== 0) {
    fail('Tailscale Funnel must be empty');
  }
  return true;
}

export function verifyNetworkFiles({ projectId, projectRoot, serveConfigPath, funnelStatusPath }) {
  const paths = topology(projectId, projectRoot);
  const backendPort = parseRuntimePort(projectId, paths.runtimeEnvironment);
  validateServeConfig({
    backendPort,
    config: readJsonFile(serveConfigPath, 'Tailscale Serve configuration is invalid'),
    projectId,
  });
  validateFunnelStatus(readJsonFile(funnelStatusPath, 'Tailscale Funnel status is invalid'));
  return { ok: true, networkVerified: true };
}

export function verifyCurrentRelease({ projectId, projectRoot }) {
  const paths = topology(projectId, projectRoot);
  if (existsSync(paths.lock)) fail('deployment is still locked');
  return { ok: true, currentCommit: readCurrentCommit(paths, false) };
}

function serialize(result) {
  const allowedKeys = new Set([
    'currentCommit',
    'hadPrevious',
    'networkVerified',
    'ok',
    'previousCommit',
  ]);
  if (!isPlainObject(result) || Object.keys(result).some((key) => !allowedKeys.has(key))) {
    fail('remote helper result is invalid');
  }
  return `${JSON.stringify(result)}\n`;
}

function runCli() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'prepare' && args.length === 4) {
    return prepareRelease({ projectId: args[0], projectRoot: args[1], commit: args[2], token: args[3] });
  }
  if (command === 'promote' && args.length === 3) {
    return promoteRelease({ projectId: args[0], projectRoot: args[1], token: args[2] });
  }
  if (command === 'rollback' && args.length === 3) {
    return rollbackRelease({ projectId: args[0], projectRoot: args[1], token: args[2] });
  }
  if (command === 'finish' && args.length === 3) {
    return finishRelease({ projectId: args[0], projectRoot: args[1], token: args[2] });
  }
  if (command === 'verify-current' && args.length === 2) {
    return verifyCurrentRelease({ projectId: args[0], projectRoot: args[1] });
  }
  if (command === 'verify-network' && args.length === 4) {
    return verifyNetworkFiles({
      projectId: args[0],
      projectRoot: args[1],
      serveConfigPath: args[2],
      funnelStatusPath: args[3],
    });
  }
  fail('remote helper command is invalid');
}

function isDirectInvocation() {
  if (!process.argv[1]) return false;
  try {
    return (
      resolve(fileURLToPath(import.meta.url)) ===
      resolve(fileURLToPath(pathToFileURL(resolve(process.argv[1]))))
    );
  } catch {
    return false;
  }
}

if (isDirectInvocation()) {
  try {
    process.stdout.write(serialize(runCli()));
  } catch {
    process.stdout.write('{"ok":false}\n');
    process.exitCode = 1;
  }
}
