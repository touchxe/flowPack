import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const OBJECT_KEY_PATTERN = /^objects\/([a-f0-9]{2})\/([a-f0-9]{64})\.(?:jpg|png|gif|webp|mp3|m4a|wav|ogg|pdf)$/;
const DEFAULT_MAX_OBJECT_BYTES = 1024 ** 3;

export class MediaIoError extends Error {
  constructor(code) {
    super(code);
    this.name = "MediaIoError";
    this.code = code;
  }
}

function fail(code) {
  throw new MediaIoError(code);
}

function absoluteNormalizedPath(path, code) {
  if (
    typeof path !== "string" ||
    !isAbsolute(path) ||
    resolve(path) !== path ||
    path.includes("\0")
  ) {
    fail(code);
  }
  return path;
}

async function readPrivateRegularFile(path, { code, exactBytes, maxBytes }) {
  absoluteNormalizedPath(path, code);
  let parentInfo;
  try {
    parentInfo = await lstat(dirname(path));
  } catch {
    fail(code);
  }
  if (
    parentInfo.isSymbolicLink() ||
    !parentInfo.isDirectory() ||
    (parentInfo.mode & 0o777) !== 0o700
  ) {
    fail(code);
  }
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  } catch {
    fail(code);
  }
  try {
    const info = await handle.stat();
    if (
      !info.isFile() ||
      info.nlink !== 1 ||
      (info.mode & 0o777) !== 0o600 ||
      info.size <= 0 ||
      (exactBytes !== undefined && info.size !== exactBytes) ||
      (maxBytes !== undefined && info.size > maxBytes)
    ) {
      fail(code);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (
      bytes.length !== info.size ||
      !after.isFile() ||
      after.dev !== info.dev ||
      after.ino !== info.ino ||
      after.nlink !== 1 ||
      after.size !== info.size ||
      (after.mode & 0o777) !== 0o600 ||
      (exactBytes !== undefined && bytes.length !== exactBytes) ||
      (maxBytes !== undefined && bytes.length > maxBytes)
    ) {
      fail(code);
    }
    return bytes;
  } catch (error) {
    if (error instanceof MediaIoError) throw error;
    fail(code);
  } finally {
    await handle.close().catch(() => undefined);
  }
}

async function privateDirectory(path, code) {
  absoluteNormalizedPath(path, code);
  let info;
  try {
    info = await lstat(path);
  } catch {
    fail(code);
  }
  if (info.isSymbolicLink() || !info.isDirectory() || (info.mode & 0o777) !== 0o700) {
    fail(code);
  }
  try {
    return await realpath(path);
  } catch {
    fail(code);
  }
}

function isContained(parent, child) {
  const path = relative(parent, child);
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

export async function readPrivateMediaKey(path) {
  try {
    return await readPrivateRegularFile(path, {
      code: "MEDIA_KEY_UNSAFE",
      exactBytes: 32,
    });
  } catch (error) {
    if (error instanceof MediaIoError) throw error;
    fail("MEDIA_KEY_UNSAFE");
  }
}

export async function createNasStagedObjectReader({
  storageRoot,
  maxObjectBytes = DEFAULT_MAX_OBJECT_BYTES,
} = {}) {
  try {
    if (
      !Number.isSafeInteger(maxObjectBytes) ||
      maxObjectBytes <= 0 ||
      maxObjectBytes > DEFAULT_MAX_OBJECT_BYTES
    ) {
      fail("STAGED_STORAGE_UNSAFE");
    }
    const canonicalRoot = await privateDirectory(storageRoot, "STAGED_STORAGE_UNSAFE");
    const objectsPath = join(canonicalRoot, "objects");
    const canonicalObjects = await privateDirectory(objectsPath, "STAGED_STORAGE_UNSAFE");
    if (!isContained(canonicalRoot, canonicalObjects)) fail("STAGED_STORAGE_UNSAFE");

    return async function readStagedObject(key) {
      const match = OBJECT_KEY_PATTERN.exec(key ?? "");
      if (!match) fail("STAGED_OBJECT_KEY_INVALID");
      const [, bucketName] = match;
      const bucketPath = join(canonicalObjects, bucketName);
      const canonicalBucket = await privateDirectory(bucketPath, "STAGED_OBJECT_UNSAFE");
      if (!isContained(canonicalObjects, canonicalBucket)) fail("STAGED_OBJECT_UNSAFE");
      const objectPath = join(canonicalBucket, key.slice(`objects/${bucketName}/`.length));
      const bytes = await readPrivateRegularFile(objectPath, {
        code: "STAGED_OBJECT_UNSAFE",
        maxBytes: maxObjectBytes,
      });
      return { buffer: bytes, size: bytes.length };
    };
  } catch (error) {
    if (error instanceof MediaIoError) throw error;
    fail("STAGED_STORAGE_UNSAFE");
  }
}

export async function createNasMediaOperatorIo({
  rollbackKeyPath,
  storageRoot,
  maxObjectBytes,
} = {}) {
  const [rollbackKey, objectReader] = await Promise.all([
    readPrivateMediaKey(rollbackKeyPath),
    createNasStagedObjectReader({ storageRoot, maxObjectBytes }),
  ]);
  return Object.freeze({ objectReader, rollbackKey });
}
