import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  unlink,
} from "node:fs/promises";
import { isAbsolute, join, resolve, sep } from "node:path";

const MIME_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/gif", "gif"],
  ["image/webp", "webp"],
  ["audio/mpeg", "mp3"],
  ["audio/mp4", "m4a"],
  ["audio/wav", "wav"],
  ["audio/ogg", "ogg"],
  ["application/pdf", "pdf"],
]);

const RUNTIME_OBJECT_KEY_PATTERN = /^[a-f0-9]{16}\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|gif|webp|mp3|m4a|wav|ogg|pdf)$/;
const MIGRATED_OBJECT_KEY_PATTERN = /^objects\/([a-f0-9]{2})\/([a-f0-9]{64})\.(jpg|png|gif|webp|mp3|m4a|wav|ogg|pdf)$/;
const EXTENSION_MIME_TYPES = new Map(
  [...MIME_EXTENSIONS].map(([mimeType, extension]) => [extension, mimeType]),
);

function hasBytes(buffer, offset, bytes) {
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

function hasAscii(buffer, offset, text) {
  return buffer.subarray(offset, offset + text.length).toString("ascii") === text;
}

function signatureMatches(buffer, mimeType) {
  if (mimeType === "image/jpeg") return hasBytes(buffer, 0, [0xff, 0xd8, 0xff]);
  if (mimeType === "image/png") return hasBytes(buffer, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mimeType === "image/gif") return hasAscii(buffer, 0, "GIF87a") || hasAscii(buffer, 0, "GIF89a");
  if (mimeType === "image/webp") return hasAscii(buffer, 0, "RIFF") && hasAscii(buffer, 8, "WEBP");
  if (mimeType === "audio/mpeg") {
    return hasAscii(buffer, 0, "ID3") || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  }
  if (mimeType === "audio/mp4") return hasAscii(buffer, 4, "ftyp");
  if (mimeType === "audio/wav") return hasAscii(buffer, 0, "RIFF") && hasAscii(buffer, 8, "WAVE");
  if (mimeType === "audio/ogg") return hasAscii(buffer, 0, "OggS");
  if (mimeType === "application/pdf") return hasAscii(buffer, 0, "%PDF-");
  return false;
}

async function ensureSafeDirectory(path, label) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const info = await lstat(path);
  if (info.isSymbolicLink()) throw new Error(`${label} must not be a symlink`);
  if (!info.isDirectory()) throw new Error(`${label} must be a directory`);
  return realpath(path);
}

async function ensureSafeRoot(root) {
  if (!root || !isAbsolute(root)) throw new Error("storage root must be an absolute path");
  return ensureSafeDirectory(resolve(root), "storage root");
}

export function isMigratedNasObjectKey(key) {
  if (typeof key !== "string") return false;
  const match = MIGRATED_OBJECT_KEY_PATTERN.exec(key);
  return Boolean(match && match[1] === match[2].slice(0, 2));
}

export function mimeTypeForNasObjectKey(key) {
  const extension = typeof key === "string" ? key.split(".").at(-1) : undefined;
  return extension ? EXTENSION_MIME_TYPES.get(extension) ?? null : null;
}

function validateObjectKey(key) {
  if (!RUNTIME_OBJECT_KEY_PATTERN.test(key) && !isMigratedNasObjectKey(key)) {
    throw new Error("invalid NAS object key");
  }
}

export function isSupportedNasMime(mimeType) {
  return MIME_EXTENSIONS.has(mimeType);
}

export async function storeNasObject({ root, ownerId, buffer, mimeType }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error("file is empty");
  const extension = MIME_EXTENSIONS.get(mimeType);
  if (!extension) throw new Error("unsupported MIME type");
  if (!ownerId) throw new Error("owner is required");

  const safeRoot = await ensureSafeRoot(root);
  const ownerBucket = createHash("sha256").update(ownerId, "utf8").digest("hex").slice(0, 16);
  const safeBucket = await ensureSafeDirectory(join(safeRoot, ownerBucket), "owner bucket");
  const objectName = `${randomUUID()}.${extension}`;
  const key = `${ownerBucket}/${objectName}`;
  const temporaryPath = join(safeBucket, `.${objectName}.${randomUUID()}.tmp`);
  const finalPath = join(safeBucket, objectName);

  let temporaryCreated = false;
  try {
    const handle = await open(temporaryPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    temporaryCreated = true;
    try {
      await handle.writeFile(buffer);
      await handle.sync();
    } finally {
      await handle.close();
    }

    const staged = await readFile(temporaryPath);
    if (!signatureMatches(staged, mimeType)) throw new Error("file signature does not match MIME type");

    await rename(temporaryPath, finalPath);
    temporaryCreated = false;
    await chmod(finalPath, 0o600);

    return {
      key,
      bytes: staged.length,
      sha256: createHash("sha256").update(staged).digest("hex"),
    };
  } finally {
    if (temporaryCreated) await unlink(temporaryPath).catch(() => undefined);
  }
}

export async function resolveNasObject({ root, key }) {
  validateObjectKey(key);
  const safeRoot = await ensureSafeRoot(root);
  const candidate = join(safeRoot, ...key.split("/"));
  const info = await lstat(candidate);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error("NAS object is not a regular file");
  const canonical = await realpath(candidate);
  if (!canonical.startsWith(`${safeRoot}${sep}`)) throw new Error("NAS object escaped the storage root");
  return canonical;
}

export async function readNasObject({ root, key }) {
  const path = await resolveNasObject({ root, key });
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new Error("NAS object is not a regular file");
    const buffer = await handle.readFile();
    if (isMigratedNasObjectKey(key)) {
      const expected = MIGRATED_OBJECT_KEY_PATTERN.exec(key)?.[2];
      const actual = createHash("sha256").update(buffer).digest("hex");
      if (!expected || actual !== expected) throw new Error("migrated NAS object digest mismatch");
    }
    return { buffer, size: info.size };
  } finally {
    await handle.close();
  }
}

export async function deleteNasObject({ root, key }) {
  // Migrated objects are content-addressed and may be shared by multiple DB
  // references. Normal row deletion must not remove shared immutable bytes;
  // a separately reviewed garbage-collection job owns their lifecycle.
  if (isMigratedNasObjectKey(key)) return false;
  try {
    const path = await resolveNasObject({ root, key });
    await unlink(path);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}
