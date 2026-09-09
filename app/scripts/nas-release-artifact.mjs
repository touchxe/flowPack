#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ARCHIVE_FILE = 'release.tar';
const FILE_MANIFEST_FILE = 'release-files.jsonl';
const RELEASE_MANIFEST_FILE = 'release-manifest.json';
const RELEASE_SCHEMA_VERSION = 1;
const TAR_BLOCK_BYTES = 512;
const MAX_SUBPROCESS_OUTPUT = 256 * 1024 * 1024;
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPOSITORY_CANDIDATE = resolve(SCRIPT_DIRECTORY, '..');

class ArtifactError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ArtifactError';
  }
}

function fail(message) {
  throw new ArtifactError(message);
}

function execute(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: options.cwd,
      encoding: options.encoding,
      input: options.input,
      maxBuffer: MAX_SUBPROCESS_OUTPUT,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    fail(options.failureMessage ?? 'release artifact subprocess failed');
  }
}

function gitText(args, options = {}) {
  return execute('git', args, {
    ...options,
    encoding: 'utf8',
    failureMessage: options.failureMessage ?? 'Git release operation failed',
  }).trim();
}

function gitBuffer(args, options = {}) {
  return execute('git', args, {
    ...options,
    failureMessage: options.failureMessage ?? 'Git release operation failed',
  });
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function sha256File(filePath) {
  let descriptor;
  try {
    descriptor = openSync(filePath, 'r');
    const hash = createHash('sha256');
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let bytesRead;
    do {
      bytesRead = readSync(descriptor, buffer, 0, buffer.byteLength, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
    return hash.digest('hex');
  } catch {
    fail('unable to hash release file');
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function decodeUtf8(buffer, failureMessage) {
  try {
    return UTF8_DECODER.decode(buffer);
  } catch {
    fail(failureMessage);
  }
}

function splitNullTerminated(buffer) {
  const values = [];
  let start = 0;
  for (let index = 0; index < buffer.byteLength; index += 1) {
    if (buffer[index] !== 0) continue;
    if (index > start) values.push(buffer.subarray(start, index));
    start = index + 1;
  }
  if (start !== buffer.byteLength) fail('Git tree output is malformed');
  return values;
}

function isForbiddenSecretPath(releasePath) {
  const segments = releasePath.toLowerCase().split('/');
  const basename = segments.at(-1);

  if (segments.some((segment) => ['secret', 'secrets', '.secret', '.secrets'].includes(segment))) {
    return true;
  }

  if (basename === '.env.example') return false;
  if (basename === '.env' || basename.startsWith('.env.')) return true;

  if (
    [
      '.pgpass',
      'credentials.json',
      'id_dsa',
      'id_ecdsa',
      'id_ed25519',
      'id_rsa',
      'service-account.json',
    ].includes(basename)
  ) {
    return true;
  }

  return ['.key', '.p12', '.pfx', '.pkcs12', '.pem'].some((extension) =>
    basename.endsWith(extension),
  );
}

export function validateReleasePath(releasePath) {
  if (
    typeof releasePath !== 'string' ||
    releasePath.length === 0 ||
    Buffer.byteLength(releasePath, 'utf8') > 4096 ||
    releasePath.startsWith('/') ||
    /^[a-z]:\//i.test(releasePath) ||
    releasePath.includes('\\') ||
    /[\u0000-\u001f\u007f]/u.test(releasePath)
  ) {
    fail('unsafe release path');
  }

  const segments = releasePath.split('/');
  if (
    segments.some((segment) => segment === '' || segment === '.' || segment === '..') ||
    posix.normalize(releasePath) !== releasePath
  ) {
    fail('unsafe release path');
  }

  return releasePath;
}

function validateNonSecretPath(releasePath) {
  validateReleasePath(releasePath);
  if (isForbiddenSecretPath(releasePath)) fail('tracked entry uses a forbidden secret path');
  return releasePath;
}

function resolveRepositoryRoot(repositoryRoot) {
  const candidate = resolve(repositoryRoot ?? DEFAULT_REPOSITORY_CANDIDATE);
  const root = gitText(['-C', candidate, 'rev-parse', '--show-toplevel'], {
    failureMessage: 'unable to resolve Git repository',
  });
  if (root.length === 0) fail('unable to resolve Git repository');
  return resolve(root);
}

function readHeadTree(repositoryRoot) {
  const treeOutput = gitBuffer(
    ['-C', repositoryRoot, 'ls-tree', '-r', '-z', '--full-tree', 'HEAD'],
    { failureMessage: 'unable to inspect Git HEAD tree' },
  );
  const entries = [];
  const seen = new Set();

  for (const rawEntry of splitNullTerminated(treeOutput)) {
    const separator = rawEntry.indexOf(9);
    if (separator <= 0 || separator === rawEntry.byteLength - 1) fail('Git tree output is malformed');

    const header = rawEntry.subarray(0, separator).toString('ascii').split(' ');
    if (header.length !== 3) fail('Git tree output is malformed');
    const [mode, type, objectId] = header;
    if (!/^[0-7]{6}$/.test(mode) || !/^[0-9a-f]{40,64}$/.test(objectId)) {
      fail('Git tree output is malformed');
    }

    const releasePath = decodeUtf8(
      rawEntry.subarray(separator + 1),
      'tracked path is not valid UTF-8',
    );
    validateNonSecretPath(releasePath);
    if (seen.has(releasePath)) fail('Git HEAD contains duplicate tracked paths');
    seen.add(releasePath);

    if (mode === '120000') fail('tracked symbolic links are not allowed');
    if (mode === '160000' || type === 'commit') fail('tracked submodules are not allowed');
    if (type !== 'blob' || (mode !== '100644' && mode !== '100755')) {
      fail('tracked entry type is not allowed');
    }

    entries.push({ mode, path: releasePath });
  }

  return entries.sort(compareRecordPaths);
}

function compareRecordPaths(left, right) {
  if (left.path < right.path) return -1;
  if (left.path > right.path) return 1;
  return 0;
}

function trimTarTextField(field) {
  const nullIndex = field.indexOf(0);
  const end = nullIndex === -1 ? field.byteLength : nullIndex;
  return field.subarray(0, end);
}

function decodeTarTextField(header, offset, length) {
  return decodeUtf8(trimTarTextField(header.subarray(offset, offset + length)), 'TAR path is invalid');
}

function parseTarOctal(field, failureMessage) {
  if ((field[0] & 0x80) !== 0) fail(failureMessage);
  const value = trimTarTextField(field).toString('ascii').trim();
  if (value.length === 0) return 0;
  if (!/^[0-7]+$/.test(value)) fail(failureMessage);
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed) || parsed < 0) fail(failureMessage);
  return parsed;
}

function parsePaxDecimal(value, failureMessage) {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) fail(failureMessage);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) fail(failureMessage);
  return parsed;
}

function verifyTarChecksum(header) {
  const recorded = parseTarOctal(header.subarray(148, 156), 'TAR checksum is malformed');
  let calculated = 0;
  for (let index = 0; index < header.byteLength; index += 1) {
    calculated += index >= 148 && index < 156 ? 0x20 : header[index];
  }
  if (recorded !== calculated) fail('TAR checksum verification failed');
}

function parsePaxRecords(data) {
  const records = new Map();
  let offset = 0;

  while (offset < data.byteLength) {
    const space = data.indexOf(0x20, offset);
    if (space <= offset) fail('PAX metadata is malformed');
    const lengthText = data.subarray(offset, space).toString('ascii');
    const recordLength = parsePaxDecimal(lengthText, 'PAX metadata is malformed');
    const recordEnd = offset + recordLength;
    if (recordEnd > data.byteLength || data[recordEnd - 1] !== 0x0a) {
      fail('PAX metadata is malformed');
    }

    const body = data.subarray(space + 1, recordEnd - 1);
    const equals = body.indexOf(0x3d);
    if (equals <= 0) fail('PAX metadata is malformed');
    const key = body.subarray(0, equals).toString('ascii');
    const value = decodeUtf8(body.subarray(equals + 1), 'PAX metadata is malformed');
    if (!/^[A-Za-z0-9_.-]+$/.test(key) || records.has(key)) fail('PAX metadata is malformed');
    records.set(key, value);
    offset = recordEnd;
  }

  return records;
}

function tarDataRange(archive, dataOffset, size) {
  const dataEnd = dataOffset + size;
  const nextHeader = dataOffset + Math.ceil(size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES;
  if (dataEnd > archive.byteLength || nextHeader > archive.byteLength) fail('TAR archive is truncated');
  return { data: archive.subarray(dataOffset, dataEnd), nextHeader };
}

function normalizeTarMemberPath(rawPath, isDirectory) {
  let releasePath = rawPath;
  if (isDirectory) {
    if (!releasePath.endsWith('/')) fail('TAR directory path is malformed');
    releasePath = releasePath.slice(0, -1);
  } else if (releasePath.endsWith('/')) {
    fail('TAR file path is malformed');
  }
  return validateNonSecretPath(releasePath);
}

function isZeroBlock(block) {
  return block.every((byte) => byte === 0);
}

function parseTarArchive(archive) {
  if (!Buffer.isBuffer(archive) || archive.byteLength % TAR_BLOCK_BYTES !== 0) {
    fail('TAR archive length is invalid');
  }

  const files = [];
  const directories = new Set();
  const members = new Set();
  let offset = 0;
  let localPax = null;
  let longPath = null;
  let reachedEnd = false;

  while (offset < archive.byteLength) {
    const header = archive.subarray(offset, offset + TAR_BLOCK_BYTES);
    if (header.byteLength !== TAR_BLOCK_BYTES) fail('TAR archive is truncated');
    if (isZeroBlock(header)) {
      reachedEnd = true;
      if (!archive.subarray(offset).every((byte) => byte === 0)) {
        fail('TAR archive contains data after its end marker');
      }
      break;
    }

    verifyTarChecksum(header);
    const headerSize = parseTarOctal(header.subarray(124, 136), 'TAR size is malformed');
    const headerMode = parseTarOctal(header.subarray(100, 108), 'TAR mode is malformed');
    const typeFlagByte = header[156];
    const typeFlag = typeFlagByte === 0 ? '0' : String.fromCharCode(typeFlagByte);
    const name = decodeTarTextField(header, 0, 100);
    const prefix = decodeTarTextField(header, 345, 155);
    const headerPath = prefix.length > 0 ? `${prefix}/${name}` : name;
    const { data, nextHeader } = tarDataRange(archive, offset + TAR_BLOCK_BYTES, headerSize);

    if (typeFlag === 'g' || typeFlag === 'x') {
      const pax = parsePaxRecords(data);
      if (typeFlag === 'g') {
        if (pax.has('path') || pax.has('linkpath') || pax.has('size')) {
          fail('global PAX path metadata is not allowed');
        }
      } else {
        if (localPax !== null) fail('duplicate local PAX metadata is not allowed');
        localPax = pax;
      }
      offset = nextHeader;
      continue;
    }

    if (typeFlag === 'L') {
      if (longPath !== null) fail('duplicate TAR long path metadata is not allowed');
      const nullIndex = data.indexOf(0);
      const value = nullIndex === -1 ? data : data.subarray(0, nullIndex);
      longPath = decodeUtf8(value, 'TAR long path metadata is malformed');
      offset = nextHeader;
      continue;
    }

    if (localPax?.has('linkpath')) fail('TAR links are not allowed');
    const effectiveSize = localPax?.has('size')
      ? parsePaxDecimal(localPax.get('size'), 'PAX size metadata is malformed')
      : headerSize;
    const effectiveRange = tarDataRange(archive, offset + TAR_BLOCK_BYTES, effectiveSize);
    const rawPath = localPax?.get('path') ?? longPath ?? headerPath;
    const isDirectory = typeFlag === '5';
    if (typeFlag !== '0' && !isDirectory) fail('TAR member type is not allowed');
    const releasePath = normalizeTarMemberPath(rawPath, isDirectory);
    if (members.has(releasePath)) fail('duplicate archive member is not allowed');
    members.add(releasePath);

    if ((headerMode & 0o7000) !== 0) fail('TAR special permission bits are not allowed');
    if (isDirectory) {
      if (effectiveSize !== 0) fail('TAR directory payload is not allowed');
      directories.add(releasePath);
    } else {
      const executeBits = headerMode & 0o111;
      if (executeBits !== 0 && executeBits !== 0o111) fail('TAR executable mode is malformed');
      files.push({
        bytes: effectiveSize,
        mode: executeBits === 0 ? '100644' : '100755',
        path: releasePath,
        sha256: sha256(effectiveRange.data),
      });
    }

    localPax = null;
    longPath = null;
    offset = effectiveRange.nextHeader;
  }

  if (!reachedEnd) fail('TAR archive end marker is missing');
  if (localPax !== null || longPath !== null) fail('orphan TAR metadata is not allowed');
  return { directories, files: files.sort(compareRecordPaths) };
}

function expectedDirectories(records) {
  const directories = new Set();
  for (const record of records) {
    const segments = record.path.split('/');
    for (let length = 1; length < segments.length; length += 1) {
      directories.add(segments.slice(0, length).join('/'));
    }
  }
  return directories;
}

function setsEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function assertArchiveMatchesRecords(parsedArchive, records) {
  const archivePaths = new Set(parsedArchive.files.map((record) => record.path));
  const manifestPaths = new Set(records.map((record) => record.path));
  if (
    !setsEqual(archivePaths, manifestPaths) ||
    !setsEqual(parsedArchive.directories, expectedDirectories(records))
  ) {
    fail('archive member set does not match file manifest');
  }

  const archiveByPath = new Map(parsedArchive.files.map((record) => [record.path, record]));
  for (const record of records) {
    const archived = archiveByPath.get(record.path);
    if (
      archived.mode !== record.mode ||
      archived.bytes !== record.bytes ||
      archived.sha256 !== record.sha256
    ) {
      fail('archive file metadata does not match file manifest');
    }
  }
}

function getArchiveCommit(archive) {
  // Git stores the commit in the first PAX header. Supplying only that header
  // avoids EPIPE when get-tar-commit-id exits before a large archive is written.
  const commitHeader = archive.subarray(0, Math.min(archive.byteLength, TAR_BLOCK_BYTES * 2));
  const commit = gitText(['get-tar-commit-id'], {
    input: commitHeader,
    failureMessage: 'archive is not bound to a Git commit',
  });
  if (!/^[0-9a-f]{40,64}$/.test(commit)) fail('archive Git commit is malformed');
  return commit;
}

function prepareEmptyDirectory(directoryPath, emptyFailureMessage) {
  const absolutePath = resolve(directoryPath);
  try {
    if (!existsSync(absolutePath)) mkdirSync(absolutePath, { mode: 0o700, recursive: true });
    const metadata = lstatSync(absolutePath);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) fail(emptyFailureMessage);
    if (readdirSync(absolutePath).length !== 0) fail(emptyFailureMessage);
    chmodSync(absolutePath, 0o700);
  } catch (error) {
    if (error instanceof ArtifactError) throw error;
    fail(emptyFailureMessage);
  }
  return absolutePath;
}

function serializeFileManifest(records) {
  return `${records.map((record) => JSON.stringify(record)).join('\n')}\n`;
}

function validateFileRecords(records) {
  if (!Array.isArray(records)) fail('file manifest is malformed');
  let previousPath = null;
  const validated = [];

  for (const record of records) {
    if (record === null || typeof record !== 'object' || Array.isArray(record)) {
      fail('file manifest is malformed');
    }
    const keys = Object.keys(record).sort();
    if (keys.join(',') !== 'bytes,mode,path,sha256') fail('file manifest is malformed');
    validateNonSecretPath(record.path);
    if (previousPath !== null && record.path <= previousPath) {
      fail(record.path === previousPath ? 'file manifest contains duplicate paths' : 'file manifest is not sorted');
    }
    if (
      (record.mode !== '100644' && record.mode !== '100755') ||
      !Number.isSafeInteger(record.bytes) ||
      record.bytes < 0 ||
      typeof record.sha256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(record.sha256)
    ) {
      fail('file manifest is malformed');
    }
    validated.push({
      bytes: record.bytes,
      mode: record.mode,
      path: record.path,
      sha256: record.sha256,
    });
    previousPath = record.path;
  }

  return validated;
}

function parseFileManifest(buffer) {
  const contents = decodeUtf8(buffer, 'file manifest is not valid UTF-8');
  if (!contents.endsWith('\n')) fail('file manifest is malformed');
  const lines = contents.slice(0, -1).split('\n');
  if (lines.length === 1 && lines[0] === '') return [];

  let records;
  try {
    records = lines.map((line) => JSON.parse(line));
  } catch {
    fail('file manifest is malformed');
  }
  return validateFileRecords(records);
}

export function readFileManifest(filePath) {
  let buffer;
  try {
    buffer = readFileSync(filePath);
  } catch {
    fail('unable to read file manifest');
  }
  return parseFileManifest(buffer);
}

function validateReleaseManifest(manifest) {
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    fail('release manifest is malformed');
  }
  if (Object.keys(manifest).sort().join(',') !== 'archive,commit,fileManifest,schemaVersion') {
    fail('release manifest is malformed');
  }
  if (
    manifest.schemaVersion !== RELEASE_SCHEMA_VERSION ||
    typeof manifest.commit !== 'string' ||
    !/^[0-9a-f]{40,64}$/.test(manifest.commit)
  ) {
    fail('release manifest is malformed');
  }

  for (const [sectionName, expectedFile, withCount] of [
    ['archive', ARCHIVE_FILE, false],
    ['fileManifest', FILE_MANIFEST_FILE, true],
  ]) {
    const section = manifest[sectionName];
    if (section === null || typeof section !== 'object' || Array.isArray(section)) {
      fail('release manifest is malformed');
    }
    const expectedKeys = withCount ? 'bytes,count,file,sha256' : 'bytes,file,sha256';
    if (
      Object.keys(section).sort().join(',') !== expectedKeys ||
      section.file !== expectedFile ||
      !Number.isSafeInteger(section.bytes) ||
      section.bytes < 0 ||
      typeof section.sha256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(section.sha256) ||
      (withCount && (!Number.isSafeInteger(section.count) || section.count < 0))
    ) {
      fail('release manifest is malformed');
    }
  }

  return manifest;
}

function readReleaseInputs(artifactDirectory) {
  const absoluteDirectory = resolve(artifactDirectory);
  let directoryMetadata;
  let manifestBuffer;
  let fileManifestBuffer;
  let archive;

  try {
    directoryMetadata = lstatSync(absoluteDirectory);
    if (!directoryMetadata.isDirectory() || directoryMetadata.isSymbolicLink()) {
      fail('artifact directory is invalid');
    }
    const expectedNames = [ARCHIVE_FILE, FILE_MANIFEST_FILE, RELEASE_MANIFEST_FILE].sort();
    if (readdirSync(absoluteDirectory).sort().join('\n') !== expectedNames.join('\n')) {
      fail('artifact directory contents are invalid');
    }
    for (const fileName of expectedNames) {
      const metadata = lstatSync(join(absoluteDirectory, fileName));
      if (!metadata.isFile() || metadata.isSymbolicLink()) fail('artifact file type is invalid');
    }
    manifestBuffer = readFileSync(join(absoluteDirectory, RELEASE_MANIFEST_FILE));
    fileManifestBuffer = readFileSync(join(absoluteDirectory, FILE_MANIFEST_FILE));
    archive = readFileSync(join(absoluteDirectory, ARCHIVE_FILE));
  } catch (error) {
    if (error instanceof ArtifactError) throw error;
    fail('unable to read release artifact');
  }

  let manifest;
  try {
    manifest = JSON.parse(decodeUtf8(manifestBuffer, 'release manifest is not valid UTF-8'));
  } catch (error) {
    if (error instanceof ArtifactError) throw error;
    fail('release manifest is malformed');
  }
  validateReleaseManifest(manifest);

  if (
    manifest.archive.bytes !== archive.byteLength ||
    manifest.archive.sha256 !== sha256(archive)
  ) {
    fail('archive checksum or size does not match release manifest');
  }
  if (
    manifest.fileManifest.bytes !== fileManifestBuffer.byteLength ||
    manifest.fileManifest.sha256 !== sha256(fileManifestBuffer)
  ) {
    fail('file manifest checksum or size does not match release manifest');
  }

  const records = parseFileManifest(fileManifestBuffer);
  if (manifest.fileManifest.count !== records.length) fail('file manifest count does not match');
  const archiveCommit = getArchiveCommit(archive);
  if (archiveCommit !== manifest.commit) fail('archive Git commit does not match release manifest');

  return { absoluteDirectory, archive, manifest, records };
}

function collectStagingEntries(stagingDirectory) {
  const files = [];
  const directories = new Set();

  function visit(relativeDirectory) {
    const absoluteDirectory = relativeDirectory
      ? join(stagingDirectory, ...relativeDirectory.split('/'))
      : stagingDirectory;
    let names;
    try {
      names = readdirSync(absoluteDirectory).sort();
    } catch {
      fail('unable to inspect staging directory');
    }

    for (const name of names) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${name}` : name;
      validateNonSecretPath(relativePath);
      const absolutePath = join(stagingDirectory, ...relativePath.split('/'));
      let metadata;
      try {
        metadata = lstatSync(absolutePath);
      } catch {
        fail('unable to inspect staging entry');
      }

      if (metadata.isSymbolicLink()) fail('staging symbolic links are not allowed');
      if (metadata.isDirectory()) {
        directories.add(relativePath);
        visit(relativePath);
      } else if (metadata.isFile()) {
        files.push({
          bytes: metadata.size,
          mode: metadata.mode & 0o777,
          path: relativePath,
          sha256: sha256File(absolutePath),
        });
      } else {
        fail('staging entry type is not allowed');
      }
    }
  }

  visit('');
  return { directories, files: files.sort(compareRecordPaths) };
}

export function verifyStagingFiles(stagingDirectory, records) {
  const validatedRecords = validateFileRecords(records);
  const absoluteDirectory = resolve(stagingDirectory);
  let rootMetadata;
  try {
    rootMetadata = lstatSync(absoluteDirectory);
  } catch {
    fail('staging directory is invalid');
  }
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    fail('staging directory is invalid');
  }

  const staged = collectStagingEntries(absoluteDirectory);
  const stagedPaths = new Set(staged.files.map((file) => file.path));
  const expectedPaths = new Set(validatedRecords.map((record) => record.path));
  if (!setsEqual(stagedPaths, expectedPaths) || !setsEqual(staged.directories, expectedDirectories(validatedRecords))) {
    fail('staging member set does not match file manifest');
  }

  const stagedByPath = new Map(staged.files.map((file) => [file.path, file]));
  for (const record of validatedRecords) {
    const stagedFile = stagedByPath.get(record.path);
    const expectedMode = record.mode === '100755' ? 0o755 : 0o644;
    if (
      stagedFile.bytes !== record.bytes ||
      stagedFile.mode !== expectedMode ||
      stagedFile.sha256 !== record.sha256
    ) {
      fail('staging file metadata does not match file manifest');
    }
  }

  return { fileCount: validatedRecords.length };
}

export function createReleaseArtifact({ artifactDirectory, repositoryRoot } = {}) {
  if (typeof artifactDirectory !== 'string' || artifactDirectory.length === 0) {
    fail('artifact directory is required');
  }
  const root = resolveRepositoryRoot(repositoryRoot);
  const commit = gitText(['-C', root, 'rev-parse', '--verify', 'HEAD^{commit}'], {
    failureMessage: 'unable to resolve Git HEAD commit',
  });
  if (!/^[0-9a-f]{40,64}$/.test(commit)) fail('Git HEAD commit is malformed');
  const treeEntries = readHeadTree(root);
  const outputDirectory = prepareEmptyDirectory(
    artifactDirectory,
    'artifact directory must be empty',
  );
  const archivePath = join(outputDirectory, ARCHIVE_FILE);

  gitBuffer(
    ['-C', root, 'archive', '--format=tar', `--output=${archivePath}`, 'HEAD'],
    { failureMessage: 'unable to create Git HEAD archive' },
  );
  try {
    chmodSync(archivePath, 0o600);
  } catch {
    fail('unable to secure release archive');
  }

  let archive;
  try {
    archive = readFileSync(archivePath);
  } catch {
    fail('unable to read generated release archive');
  }
  if (getArchiveCommit(archive) !== commit) fail('generated archive is not bound to Git HEAD');
  const parsedArchive = parseTarArchive(archive);
  const treeModes = new Map(treeEntries.map((entry) => [entry.path, entry.mode]));
  const archiveModes = new Map(parsedArchive.files.map((entry) => [entry.path, entry.mode]));
  const records = parsedArchive.files.map((entry) => ({
    bytes: entry.bytes,
    mode: treeModes.get(entry.path) ?? entry.mode,
    path: entry.path,
    sha256: entry.sha256,
  }));
  if (records.some((record) => !treeModes.has(record.path))) {
    fail('archive member set does not match Git HEAD');
  }
  if (records.length !== treeEntries.length) fail('archive member set does not match Git HEAD');
  for (const record of records) {
    if (record.mode !== archiveModes.get(record.path)) {
      fail('archive file mode does not match Git HEAD');
    }
  }
  assertArchiveMatchesRecords(parsedArchive, records);

  const fileManifest = Buffer.from(serializeFileManifest(records), 'utf8');
  const fileManifestPath = join(outputDirectory, FILE_MANIFEST_FILE);
  try {
    writeFileSync(fileManifestPath, fileManifest, { flag: 'wx', mode: 0o600 });
  } catch {
    fail('unable to write file manifest');
  }

  const releaseManifest = {
    schemaVersion: RELEASE_SCHEMA_VERSION,
    commit,
    archive: {
      file: ARCHIVE_FILE,
      bytes: archive.byteLength,
      sha256: sha256(archive),
    },
    fileManifest: {
      file: FILE_MANIFEST_FILE,
      count: records.length,
      bytes: fileManifest.byteLength,
      sha256: sha256(fileManifest),
    },
  };
  try {
    writeFileSync(
      join(outputDirectory, RELEASE_MANIFEST_FILE),
      `${JSON.stringify(releaseManifest, null, 2)}\n`,
      { flag: 'wx', mode: 0o600 },
    );
  } catch {
    fail('unable to write release manifest');
  }

  return {
    archiveBytes: archive.byteLength,
    archiveSha256: releaseManifest.archive.sha256,
    commit,
    fileCount: records.length,
  };
}

export function verifyReleaseArtifact({ artifactDirectory, stagingDirectory } = {}) {
  if (typeof artifactDirectory !== 'string' || artifactDirectory.length === 0) {
    fail('artifact directory is required');
  }
  if (typeof stagingDirectory !== 'string' || stagingDirectory.length === 0) {
    fail('staging directory is required');
  }

  const inputs = readReleaseInputs(artifactDirectory);
  const parsedArchive = parseTarArchive(inputs.archive);
  assertArchiveMatchesRecords(parsedArchive, inputs.records);
  const emptyStaging = prepareEmptyDirectory(
    stagingDirectory,
    'staging directory must be empty',
  );

  const previousUmask = process.umask(0o022);
  try {
    execute('tar', ['-xf', '-', '-C', emptyStaging], {
      failureMessage: 'unable to extract release archive',
      input: inputs.archive,
    });
  } finally {
    process.umask(previousUmask);
  }
  verifyStagingFiles(emptyStaging, inputs.records);

  return { commit: inputs.manifest.commit, fileCount: inputs.records.length };
}

function runCli() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'create' && (args.length === 1 || args.length === 2)) {
    const result = createReleaseArtifact({
      artifactDirectory: args[0],
      repositoryRoot: args[1],
    });
    process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
    return;
  }
  if (command === 'verify' && args.length === 2) {
    const result = verifyReleaseArtifact({ artifactDirectory: args[0], stagingDirectory: args[1] });
    process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
    return;
  }
  fail('usage: nas-release-artifact.mjs create <artifact-dir> [repository-root] | verify <artifact-dir> <empty-staging-dir>');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    runCli();
  } catch (error) {
    const message = error instanceof ArtifactError ? error.message : 'unexpected release artifact failure';
    process.stderr.write(`NAS release artifact failed: ${message}\n`);
    process.exitCode = 1;
  }
}
