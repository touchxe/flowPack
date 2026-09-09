import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
} from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

import { canonicalMediaJson, mediaSha256 } from './nas-media-contract.mjs';

export const RETAINED_PROVIDER_ENV_NAMES = Object.freeze([
  'APPLE_CLIENT_ID',
  'APPLE_CLIENT_SECRET',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'FACEBOOK_APP_ID',
  'FACEBOOK_APP_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'INSTAGRAM_APP_ID',
  'INSTAGRAM_APP_SECRET',
  'KAKAO_CLIENT_ID',
  'KAKAO_CLIENT_SECRET',
  'LINKEDIN_CLIENT_ID',
  'LINKEDIN_CLIENT_SECRET',
  'META_APP_ID',
  'META_APP_SECRET',
  'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
  'NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET',
  'NEXT_PUBLIC_TOSS_CLIENT_KEY',
  'OPENAI_API_KEY',
  'RESEND_API_KEY',
  'THREADS_APP_ID',
  'THREADS_APP_SECRET',
  'TOSS_SECRET_KEY',
  'TWITTER_CLIENT_ID',
  'TWITTER_CLIENT_SECRET',
]);

const PROJECT_ID = 'flowpack-v2';
const FILE_MODE = 0o600;
const DIRECTORY_MODE = 0o700;
const MAX_BYTES = 64 * 1024;
const MIGRATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RELEASE_PATTERN = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const MANIFEST_KEYS = Object.freeze([
  'activeNames',
  'disabledNames',
  'migrationId',
  'projectId',
  'releaseCommit',
  'schemaVersion',
]);

export class RetainedProviderManifestError extends Error {
  constructor(code) {
    super(code);
    this.name = 'RetainedProviderManifestError';
    this.code = code;
  }
}

function fail() {
  throw new RetainedProviderManifestError('RETAINED_PROVIDER_MANIFEST_INVALID');
}

function exactKeys(value, expected) {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join('\n') === [...expected].sort().join('\n');
}

function assertPrivateDirectory(path) {
  let info;
  try {
    info = lstatSync(path);
  } catch {
    fail();
  }
  if (info.isSymbolicLink() || !info.isDirectory() || (info.mode & 0o777) !== DIRECTORY_MODE) {
    fail();
  }
}

function readPrivate(path) {
  if (
    typeof path !== 'string' ||
    !isAbsolute(path) ||
    resolve(path) !== path ||
    path.includes('\0')
  ) fail();
  assertPrivateDirectory(dirname(path));
  let initial;
  try {
    initial = lstatSync(path);
  } catch {
    fail();
  }
  if (
    initial.isSymbolicLink() ||
    !initial.isFile() ||
    initial.nlink !== 1 ||
    (initial.mode & 0o777) !== FILE_MODE ||
    initial.size <= 0 ||
    initial.size > MAX_BYTES
  ) fail();
  let descriptor;
  let bytes;
  try {
    descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = fstatSync(descriptor);
    if (
      opened.dev !== initial.dev ||
      opened.ino !== initial.ino ||
      opened.nlink !== 1 ||
      opened.size !== initial.size ||
      (opened.mode & 0o777) !== FILE_MODE
    ) fail();
    bytes = Buffer.allocUnsafe(opened.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (count <= 0) fail();
      offset += count;
    }
    const after = fstatSync(descriptor);
    if (
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.nlink !== 1 ||
      after.size !== opened.size ||
      (after.mode & 0o777) !== FILE_MODE
    ) fail();
  } catch (error) {
    if (error instanceof RetainedProviderManifestError) throw error;
    fail();
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  const final = lstatSync(path);
  if (
    final.dev !== initial.dev ||
    final.ino !== initial.ino ||
    final.nlink !== 1 ||
    final.size !== initial.size
  ) fail();
  return bytes;
}

function sortedUniqueNames(value) {
  return Array.isArray(value) &&
    value.every((name) => typeof name === 'string') &&
    value.join('\n') === [...value].sort().join('\n') &&
    new Set(value).size === value.length;
}

export function readRetainedProviderManifest(path, expected) {
  if (
    !exactKeys(expected, ['migrationId', 'releaseCommit']) ||
    !MIGRATION_ID_PATTERN.test(expected.migrationId ?? '') ||
    !RELEASE_PATTERN.test(expected.releaseCommit ?? '')
  ) fail();
  const bytes = readPrivate(path);
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail();
  }
  if (
    !bytes.equals(Buffer.from(`${canonicalMediaJson(value)}\n`, 'utf8')) ||
    !exactKeys(value, MANIFEST_KEYS) ||
    value.schemaVersion !== 1 ||
    value.projectId !== PROJECT_ID ||
    value.migrationId !== expected.migrationId ||
    value.releaseCommit !== expected.releaseCommit ||
    !sortedUniqueNames(value.activeNames) ||
    !sortedUniqueNames(value.disabledNames)
  ) fail();
  const combined = [...value.activeNames, ...value.disabledNames].sort();
  if (
    combined.join('\n') !== RETAINED_PROVIDER_ENV_NAMES.join('\n') ||
    value.activeNames.some((name) => value.disabledNames.includes(name))
  ) fail();
  return Object.freeze({
    activeCount: value.activeNames.length,
    disabledCount: value.disabledNames.length,
    sha256: mediaSha256(bytes),
  });
}
