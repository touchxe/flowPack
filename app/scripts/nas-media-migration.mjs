import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  unlink,
} from "node:fs/promises";
import { isAbsolute, join, resolve, sep } from "node:path";

import {
  MEDIA_EVIDENCE_SCHEMA_VERSION,
  MEDIA_PROJECT_ID,
  mediaOwnershipIdentitySha256,
  normalizeMediaOwnershipIdentity,
} from "./nas-media-contract.mjs";
import {
  MediaArtifactHandleError,
  beginSealedMediaArtifact,
  recoverSealedMediaArtifact,
  sealPreparedMediaArtifact,
} from "./nas-media-artifact-handle.mjs";

const PROJECT_ID = MEDIA_PROJECT_ID;
const SCHEMA_VERSION = MEDIA_EVIDENCE_SCHEMA_VERSION;
const URL_PATTERN = /data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+|https?:\/\/[^\s<>"'`]+/giu;
const POLICY_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;
const SAFE_RELATIVE_URL = /^\/(?!\/)[a-zA-Z0-9._~!$&'()*+,;=:@%\/-]+$/;
const CREDENTIAL_QUERY_KEYS = new Set([
  "access_token", "api-key", "api_key", "apikey", "authorization", "credential",
  "key", "password", "secret", "sig", "signature", "token", "x-amz-credential",
  "x-amz-signature",
]);
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

export class MediaMigrationError extends Error {
  constructor(code) {
    super(code);
    this.name = "MediaMigrationError";
    this.code = code;
  }
}

function fail(code) {
  throw new MediaMigrationError(code);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function publicClone(value) {
  return Object.freeze(JSON.parse(canonicalJson(value)));
}

function classificationFor(value) {
  if (typeof value !== "string") return "other";
  if (value.startsWith("data:")) return "data";
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return "other";
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "res.cloudinary.com" || host.endsWith(".cloudinary.com")) return "cloudinary";
  if (host.endsWith(".public.blob.vercel-storage.com")) return "vercel-blob";
  if (
    host === "files.oaiusercontent.com"
    || host.endsWith(".openaiusercontent.com")
    || /^oaidalleapi[a-z0-9-]*\.blob\.core\.windows\.net$/.test(host)
  ) return "openai-temporary";
  return "other";
}

function stripTrailingPunctuation(value) {
  let result = value;
  while (/[.,;:!?\]}]$/.test(result)) result = result.slice(0, -1);
  while (
    result.endsWith(")")
    && (result.match(/\)/gu)?.length ?? 0) > (result.match(/\(/gu)?.length ?? 0)
  ) result = result.slice(0, -1);
  return result;
}

function extractUrls(value) {
  if (typeof value !== "string" || value.length === 0) return [];
  return [...value.matchAll(URL_PATTERN)]
    .map((match) => stripTrailingPunctuation(match[0]))
    .filter(Boolean);
}

function assertRecordsShape(records) {
  if (!records || typeof records !== "object") fail("RECORDS_REQUIRED");
  for (const key of ["mediaFiles", "contentImages", "contents"]) {
    if (records[key] !== undefined && !Array.isArray(records[key])) fail("RECORDS_INVALID");
  }
}

function recordId(record) {
  if (!record || typeof record.id !== "string" || record.id.length === 0 || record.id.length > 512) {
    fail("RECORD_ID_INVALID");
  }
  return record.id;
}

function addField(fields, name, count = 1) {
  if (count > 0) fields.set(name, (fields.get(name) ?? 0) + count);
}

function ownershipIdentities(records) {
  assertRecordsShape(records);
  const contentById = new Map();
  const mediaFileById = new Map();
  const contentImageById = new Map();

  const normalize = (identity) => {
    try {
      return normalizeMediaOwnershipIdentity(identity);
    } catch {
      fail("OWNERSHIP_IDENTITY_INVALID");
    }
  };
  for (const record of records.contents ?? []) {
    const id = recordId(record);
    if (contentById.has(id)) fail("OWNERSHIP_IDENTITY_INVALID");
    contentById.set(id, normalize({
      recordId: id,
      table: "contents",
      userId: record?.userId,
    }));
  }
  for (const record of records.mediaFiles ?? []) {
    const id = recordId(record);
    if (mediaFileById.has(id)) fail("OWNERSHIP_IDENTITY_INVALID");
    mediaFileById.set(id, normalize({
      recordId: id,
      table: "media_files",
      userId: record?.userId,
    }));
  }
  for (const record of records.contentImages ?? []) {
    const id = recordId(record);
    if (contentImageById.has(id)) fail("OWNERSHIP_IDENTITY_INVALID");
    const content = contentById.get(record?.contentId);
    if (!content) fail("OWNERSHIP_IDENTITY_INVALID");
    contentImageById.set(id, normalize({
      contentId: record.contentId,
      contentUserId: content.userId,
      recordId: id,
      table: "content_images",
    }));
  }
  return { contentById, contentImageById, mediaFileById };
}

function collect(records) {
  const identities = ownershipIdentities(records);
  const candidates = new Map();
  const fields = new Map();
  let references = 0;

  const add = (source, location) => {
    if (typeof source !== "string" || source.length === 0) return;
    const key = sha256(source);
    if (!candidates.has(key)) {
      candidates.set(key, {
        source,
        sourceHash: key,
        classification: classificationFor(source),
        locations: [],
      });
    }
    candidates.get(key).locations.push(location);
    addField(fields, `${location.table}.${location.field}`);
    references += 1;
  };

  for (const record of records.mediaFiles ?? []) {
    const id = recordId(record);
    if (typeof record?.blobKey === "string" && record.blobKey.length > 0) {
      addField(fields, "media_files.blobKey");
    }
    add(record?.url, {
      table: "media_files",
      field: "url",
      recordId: id,
      originalValue: record?.url,
      originalBlobKey: record?.blobKey,
      expectedMimeType: record?.mimeType,
      expectedSize: record?.size,
      expectedOwnership: identities.mediaFileById.get(id),
    });
  }

  for (const record of records.contentImages ?? []) {
    const id = recordId(record);
    add(record?.url, {
      table: "content_images",
      field: "url",
      recordId: id,
      originalValue: record?.url,
      expectedOwnership: identities.contentImageById.get(id),
    });
  }

  for (const record of records.contents ?? []) {
    const id = recordId(record);
    add(record?.thumbnailUrl, {
      table: "contents",
      field: "thumbnailUrl",
      recordId: id,
      originalValue: record?.thumbnailUrl,
      expectedOwnership: identities.contentById.get(id),
    });
    for (const field of ["body", "slides"]) {
      const originalValue = record?.[field];
      const perSource = new Map();
      for (const source of extractUrls(originalValue)) {
        perSource.set(source, (perSource.get(source) ?? 0) + 1);
      }
      for (const [source, occurrences] of perSource) {
        add(source, {
          table: "contents",
          field,
          recordId: id,
          originalValue,
          occurrences,
          expectedOwnership: identities.contentById.get(id),
        });
      }
    }
  }

  return { candidates, fields, references };
}

export function inventoryMediaRecords(records) {
  const { candidates, fields, references } = collect(records);
  const classifications = new Map();
  const ownershipIdentities = new Set();
  for (const candidate of candidates.values()) {
    classifications.set(
      candidate.classification,
      (classifications.get(candidate.classification) ?? 0) + candidate.locations.length,
    );
    for (const location of candidate.locations) {
      ownershipIdentities.add(mediaOwnershipIdentitySha256(location.expectedOwnership));
    }
  }
  const identityHashes = [...ownershipIdentities].sort();
  return publicClone({
    classifications: Object.fromEntries([...classifications].sort(([a], [b]) => a.localeCompare(b))),
    fields: Object.fromEntries([...fields].sort(([a], [b]) => a.localeCompare(b))),
    ownership: {
      identityScopeSha256: sha256(canonicalJson(identityHashes)),
      records: identityHashes.length,
    },
    references,
    uniqueSources: candidates.size,
  });
}

function validatePolicy(policy) {
  if (!policy || typeof policy !== "object") fail("POLICY_REQUIRED");
  if (!POLICY_ID_PATTERN.test(policy.policyId ?? "")) fail("POLICY_INVALID");
  if (!POLICY_ID_PATTERN.test(policy.rewritePolicyId ?? "")) fail("POLICY_INVALID");
  if (!Number.isSafeInteger(policy.maxBytes) || policy.maxBytes <= 0 || policy.maxBytes > 1024 ** 3) {
    fail("POLICY_INVALID");
  }
  if (!Array.isArray(policy.allowedMimeTypes) || policy.allowedMimeTypes.length === 0) fail("POLICY_INVALID");
  const allowedMimeTypes = new Set();
  for (const value of policy.allowedMimeTypes) {
    if (typeof value !== "string" || !MIME_EXTENSIONS.has(value)) fail("POLICY_INVALID");
    allowedMimeTypes.add(value);
  }
  if (!Array.isArray(policy.approvedSources) || policy.approvedSources.length === 0) fail("POLICY_INVALID");
  const approvedSources = policy.approvedSources.map((entry) => {
    if (!entry || entry.owned !== true || !POLICY_ID_PATTERN.test(entry.approvalId ?? "")) fail("POLICY_INVALID");
    if (!["cloudinary", "data", "openai-temporary", "vercel-blob", "other"].includes(entry.classification)) {
      fail("POLICY_INVALID");
    }
    if (!Array.isArray(entry.hosts) || !Array.isArray(entry.pathPrefixes)) fail("POLICY_INVALID");
    const hosts = entry.hosts.map((host) => {
      if (typeof host !== "string" || host.length === 0 || host !== host.toLowerCase()) fail("POLICY_INVALID");
      if (host.includes("*") || host.includes(":") || host.includes("/") || host.includes("\\")) fail("POLICY_INVALID");
      return host;
    });
    const pathPrefixes = entry.pathPrefixes.map((prefix) => {
      if (typeof prefix !== "string" || !prefix.startsWith("/") || prefix.includes("..") || prefix.includes("\\")) {
        fail("POLICY_INVALID");
      }
      return prefix;
    });
    if (entry.classification === "data" && (hosts.length !== 0 || pathPrefixes.length !== 0)) fail("POLICY_INVALID");
    if (entry.classification !== "data" && (hosts.length === 0 || pathPrefixes.length === 0)) fail("POLICY_INVALID");
    return {
      approvalIdHash: sha256(entry.approvalId),
      classification: entry.classification,
      hosts,
      pathPrefixes,
    };
  });
  if (typeof policy.replacementFor !== "function") fail("POLICY_INVALID");
  return {
    policyId: policy.policyId,
    rewritePolicyId: policy.rewritePolicyId,
    maxBytes: policy.maxBytes,
    allowedMimeTypes,
    approvedSources,
    replacementFor: policy.replacementFor,
  };
}

function validateMigratableRecords(records) {
  ownershipIdentities(records);
  for (const record of records.mediaFiles ?? []) {
    recordId(record);
    if (typeof record.url !== "string" || record.url.length === 0) fail("SOURCE_URL_INVALID");
    assertSafeBlobKey(record.blobKey);
  }
  for (const record of records.contentImages ?? []) {
    recordId(record);
    if (typeof record.url !== "string" || record.url.length === 0) fail("SOURCE_URL_INVALID");
  }
  for (const record of records.contents ?? []) {
    recordId(record);
    for (const field of ["thumbnailUrl", "body", "slides"]) {
      if (record[field] !== undefined && record[field] !== null && typeof record[field] !== "string") {
        fail("RECORDS_INVALID");
      }
    }
  }
}

function containsEncodedTraversal(value) {
  const lower = value.toLowerCase();
  return lower.includes("\\")
    || /(?:^|\/)(?:\.|%2e)(?:\.|%2e)(?:\/|%2f|$)/i.test(lower)
    || lower.includes("%5c")
    || lower.includes("%00");
}

function assertSafeBlobKey(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) fail("SOURCE_LOCATOR_UNSAFE");
  if (value.startsWith("/") || value.includes("\\") || /[\0-\x1f\x7f]/.test(value)) fail("SOURCE_LOCATOR_UNSAFE");
  if (value.split("/").some((segment) => segment === ".." || segment === ".")) fail("SOURCE_LOCATOR_UNSAFE");
}

function parseSafeNetworkUrl(value) {
  if (containsEncodedTraversal(value)) fail("SOURCE_URL_UNSAFE");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail("SOURCE_URL_INVALID");
  }
  if (parsed.protocol !== "https:") fail("SOURCE_URL_SCHEME");
  if (parsed.username || parsed.password) fail("SOURCE_URL_CREDENTIALS");
  for (const key of parsed.searchParams.keys()) {
    if (CREDENTIAL_QUERY_KEYS.has(key.toLowerCase())) fail("SOURCE_URL_CREDENTIALS");
  }
  return parsed;
}

function matchingApproval(value, classification, approvedSources) {
  if (classification === "data") {
    return approvedSources.find((entry) => entry.classification === "data") ?? null;
  }
  const parsed = parseSafeNetworkUrl(value);
  return approvedSources.find((entry) => (
    entry.classification === classification
    && entry.hosts.includes(parsed.hostname.toLowerCase())
    && entry.pathPrefixes.some((prefix) => parsed.pathname.startsWith(prefix))
  )) ?? null;
}

function anyMatchingApproval(value, approvedSources) {
  const classification = classificationFor(value);
  return matchingApproval(value, classification, approvedSources);
}

function normalizeMime(value) {
  if (typeof value !== "string") return "";
  return value.split(";", 1)[0].trim().toLowerCase();
}

function hasAscii(buffer, offset, value) {
  return buffer.subarray(offset, offset + value.length).toString("ascii") === value;
}

function detectMime(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 6 && (hasAscii(buffer, 0, "GIF87a") || hasAscii(buffer, 0, "GIF89a"))) return "image/gif";
  if (buffer.length >= 12 && hasAscii(buffer, 0, "RIFF") && hasAscii(buffer, 8, "WEBP")) return "image/webp";
  if (buffer.length >= 3 && (hasAscii(buffer, 0, "ID3") || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0))) return "audio/mpeg";
  if (buffer.length >= 12 && hasAscii(buffer, 4, "ftyp")) return "audio/mp4";
  if (buffer.length >= 12 && hasAscii(buffer, 0, "RIFF") && hasAscii(buffer, 8, "WAVE")) return "audio/wav";
  if (buffer.length >= 4 && hasAscii(buffer, 0, "OggS")) return "audio/ogg";
  if (buffer.length >= 5 && hasAscii(buffer, 0, "%PDF-")) return "application/pdf";
  return null;
}

function validateBytes(buffer, declaredMime, policy, expectedSizes, expectedMimes) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) fail("OBJECT_EMPTY");
  if (buffer.length > policy.maxBytes) fail("OBJECT_TOO_LARGE");
  const mimeType = normalizeMime(declaredMime);
  if (!policy.allowedMimeTypes.has(mimeType)) fail("UNSUPPORTED_MIME");
  const detected = detectMime(buffer);
  if (detected !== mimeType) fail("MIME_MISMATCH");
  for (const expectedMime of expectedMimes) {
    if (normalizeMime(expectedMime) !== mimeType) fail("MIME_MISMATCH");
  }
  for (const expectedSize of expectedSizes) {
    if (!Number.isSafeInteger(expectedSize) || expectedSize < 0 || expectedSize !== buffer.length) {
      fail("BYTE_LENGTH_MISMATCH");
    }
  }
  return mimeType;
}

function decodeDataUrl(value, policy, expectedSizes, expectedMimes) {
  const match = /^data:([^;,]+);base64,([a-z0-9+/]*={0,2})$/iu.exec(value);
  if (!match || match[2].length === 0 || match[2].length % 4 !== 0) fail("DATA_URL_INVALID");
  const buffer = Buffer.from(match[2], "base64");
  const normalizedInput = match[2].replace(/=+$/u, "");
  const normalizedDecoded = buffer.toString("base64").replace(/=+$/u, "");
  if (normalizedInput !== normalizedDecoded) fail("DATA_URL_INVALID");
  const mimeType = validateBytes(buffer, match[1], policy, expectedSizes, expectedMimes);
  return { buffer, mimeType };
}

async function readBoundedBody(body, maxBytes) {
  if (Buffer.isBuffer(body)) {
    if (body.length > maxBytes) fail("OBJECT_TOO_LARGE");
    return Buffer.from(body);
  }
  if (body instanceof Uint8Array) {
    if (body.byteLength > maxBytes) fail("OBJECT_TOO_LARGE");
    return Buffer.from(body);
  }
  if (!body || typeof body[Symbol.asyncIterator] !== "function") fail("FETCH_RESPONSE_INVALID");
  const chunks = [];
  let bytes = 0;
  for await (const chunk of body) {
    if (!(Buffer.isBuffer(chunk) || chunk instanceof Uint8Array)) fail("FETCH_RESPONSE_INVALID");
    bytes += chunk.byteLength;
    if (bytes > maxBytes) fail("OBJECT_TOO_LARGE");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks, bytes);
}

async function fetchCandidate(candidate, fetcher, policy) {
  if (typeof fetcher !== "function") fail("FETCHER_REQUIRED");
  try {
    const response = await fetcher(candidate.source, { maxBytes: policy.maxBytes });
    if (!response || typeof response !== "object") fail("FETCH_RESPONSE_INVALID");
    if (!Number.isInteger(response.status) || response.status < 200 || response.status >= 300) fail("FETCH_STATUS_INVALID");
    if (typeof response.finalUrl !== "string" || response.finalUrl.length === 0) fail("FETCH_RESPONSE_INVALID");
    const redirects = response.redirects ?? [];
    if (!Array.isArray(redirects)) fail("FETCH_RESPONSE_INVALID");
    for (const redirect of [...redirects, response.finalUrl]) {
      if (typeof redirect !== "string" || !anyMatchingApproval(redirect, policy.approvedSources)) {
        fail("REDIRECT_NOT_APPROVED");
      }
    }
    const contentLength = response.contentLength === undefined ? null : Number(response.contentLength);
    if (contentLength !== null && (!Number.isSafeInteger(contentLength) || contentLength < 0)) fail("FETCH_RESPONSE_INVALID");
    if (contentLength !== null && contentLength > policy.maxBytes) fail("OBJECT_TOO_LARGE");
    const buffer = await readBoundedBody(response.body, policy.maxBytes);
    if (contentLength !== null && contentLength !== buffer.length) fail("BYTE_LENGTH_MISMATCH");
    const expectedSizes = candidate.locations
      .map((location) => location.expectedSize)
      .filter((value) => value !== undefined && value !== null);
    const expectedMimes = candidate.locations
      .map((location) => location.expectedMimeType)
      .filter((value) => value !== undefined && value !== null);
    const mimeType = validateBytes(buffer, response.contentType, policy, expectedSizes, expectedMimes);
    return { buffer, mimeType };
  } catch (error) {
    if (error instanceof MediaMigrationError) throw error;
    fail("FETCH_FAILED");
  }
}

async function assertPrivateDirectory(path, code = "STORAGE_UNSAFE") {
  const info = await lstat(path).catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (info?.isSymbolicLink()) fail("STORAGE_SYMLINK");
  if (info && !info.isDirectory()) fail(code);
  if (!info) await mkdir(path, { mode: 0o700 });
  const canonical = await realpath(path);
  await chmod(path, 0o700);
  return canonical;
}

async function ensureStorageRoot(storageRoot) {
  if (typeof storageRoot !== "string" || !isAbsolute(storageRoot) || storageRoot.includes("\0")) {
    fail("STORAGE_ROOT_INVALID");
  }
  return assertPrivateDirectory(resolve(storageRoot));
}

async function ensureChildDirectory(parent, name) {
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) fail("STORAGE_UNSAFE");
  const path = join(parent, name);
  await mkdir(path, { mode: 0o700 }).catch((error) => {
    if (error?.code !== "EEXIST") throw error;
  });
  const info = await lstat(path);
  if (info.isSymbolicLink()) fail("STORAGE_SYMLINK");
  if (!info.isDirectory()) fail("STORAGE_UNSAFE");
  const canonical = await realpath(path);
  if (!canonical.startsWith(`${parent}${sep}`)) fail("STORAGE_UNSAFE");
  await chmod(path, 0o700);
  return canonical;
}

async function atomicWritePrivate(path, bytes) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  let created = false;
  try {
    const handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    created = true;
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, path);
    created = false;
    await chmod(path, 0o600);
  } finally {
    if (created) await unlink(temporary).catch(() => undefined);
  }
}

async function stageObject(objectsRoot, object) {
  const bucket = await ensureChildDirectory(objectsRoot, object.sha256.slice(0, 2));
  const extension = MIME_EXTENSIONS.get(object.mimeType);
  if (!extension) fail("UNSUPPORTED_MIME");
  const path = join(bucket, `${object.sha256}.${extension}`);
  const existing = await lstat(path).catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (existing) {
    if (existing.isSymbolicLink()) fail("STORAGE_SYMLINK");
    if (!existing.isFile()) fail("STORAGE_UNSAFE");
    const bytes = await readFile(path);
    if (sha256(bytes) !== object.sha256) fail("STAGED_OBJECT_MISMATCH");
    await chmod(path, 0o600);
  } else {
    await atomicWritePrivate(path, object.buffer);
  }
  return `objects/${object.sha256.slice(0, 2)}/${object.sha256}.${extension}`;
}

function safeReplacement(policy, input) {
  let replacement;
  try {
    replacement = policy.replacementFor(input);
  } catch {
    fail("REPLACEMENT_FAILED");
  }
  if (typeof replacement !== "string" || !SAFE_RELATIVE_URL.test(replacement)) fail("REPLACEMENT_UNSAFE");
  if (replacement.includes("..") || replacement.includes("\\") || replacement.includes("%2e")) fail("REPLACEMENT_UNSAFE");
  return replacement;
}

export function nasOwnedMediaReplacement({ table, recordId, nasKey }) {
  if (table === "media_files") {
    return `/api/media/${encodeURIComponent(recordId)}/content`;
  }
  return `/api/nas-owned-media/${nasKey}`;
}

function operationGroups(candidates) {
  const groups = new Map();
  for (const candidate of candidates.values()) {
    for (const location of candidate.locations) {
      const key = sha256(`${location.table}\0${location.field}\0${location.recordId}`);
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          table: location.table,
          field: location.field,
          recordId: location.recordId,
          originalValue: location.originalValue,
          originalBlobKey: location.originalBlobKey,
          expectedOwnership: location.expectedOwnership,
          ownershipIdentitySha256: mediaOwnershipIdentitySha256(location.expectedOwnership),
          sources: [],
        });
      }
      const group = groups.get(key);
      if (
        group.ownershipIdentitySha256 !== mediaOwnershipIdentitySha256(location.expectedOwnership) ||
        canonicalJson(group.expectedOwnership) !== canonicalJson(location.expectedOwnership)
      ) {
        fail("OWNERSHIP_IDENTITY_INVALID");
      }
      group.sources.push({ candidate, occurrences: location.occurrences ?? 1 });
    }
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function buildRewriteOperations(candidates, policy) {
  const safe = [];
  const secret = [];
  for (const group of operationGroups(candidates)) {
    let replacementValue = group.originalValue;
    let replacementBlobKey;
    let occurrences = 0;
    const objectKeys = [];
    for (const { candidate, occurrences: count } of group.sources) {
      const replacement = safeReplacement(policy, {
        field: group.field,
        mimeType: candidate.object.mimeType,
        nasKey: candidate.object.key,
        recordId: group.recordId,
        sha256: candidate.object.sha256,
        table: group.table,
      });
      if (typeof replacementValue !== "string" || !replacementValue.includes(candidate.source)) fail("REWRITE_PRECONDITION_INVALID");
      replacementValue = replacementValue.split(candidate.source).join(replacement);
      occurrences += count;
      objectKeys.push(candidate.object.key);
      if (group.table === "media_files" && group.field === "url") replacementBlobKey = candidate.object.key;
    }
    const operationId = sha256(
      `${group.key}\0${group.ownershipIdentitySha256}\0${sha256(group.originalValue)}\0${sha256(replacementValue)}`,
    );
    safe.push({
      coupledBlobKey: replacementBlobKey !== undefined,
      expectedValueSha256: sha256(group.originalValue),
      field: group.field,
      locatorSha256: sha256(group.recordId),
      objectKeys: [...new Set(objectKeys)].sort(),
      occurrenceCount: occurrences,
      operationId,
      ownershipIdentitySha256: group.ownershipIdentitySha256,
      replacementValueSha256: sha256(replacementValue),
      table: group.table,
    });
    secret.push({
      expectedValue: group.originalValue,
      field: group.field,
      operationId,
      expectedOwnership: group.expectedOwnership,
      originalBlobKey: group.originalBlobKey,
      recordId: group.recordId,
      replacementBlobKey,
      replacementValue,
      table: group.table,
    });
  }
  return { safe, secret };
}

function encryptRollbackMapping(value, key, reviewDigest) {
  if (!Buffer.isBuffer(key) || key.length !== 32) fail("ROLLBACK_KEY_INVALID");
  const plaintext = Buffer.from(canonicalJson(value), "utf8");
  const iv = randomBytes(12);
  const aad = Buffer.from(canonicalJson({ projectId: PROJECT_ID, reviewDigest, schemaVersion: SCHEMA_VERSION }), "utf8");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const envelope = Buffer.concat([Buffer.from("FPMR2", "ascii"), iv, tag, ciphertext]);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  const verified = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  if (!verified.equals(plaintext)) fail("ROLLBACK_ENCRYPTION_FAILED");
  return envelope;
}

function validateReview(approval, expectedDigest) {
  if (!approval || approval.approved !== true) fail("REVIEW_DENIED");
  if (approval.reviewDigest !== expectedDigest) fail("REVIEW_MISMATCH");
  if (typeof approval.reviewerId !== "string" || approval.reviewerId.length === 0 || approval.reviewerId.length > 256) {
    fail("REVIEW_INVALID");
  }
  if (typeof approval.reviewedAt !== "string" || Number.isNaN(Date.parse(approval.reviewedAt))) fail("REVIEW_INVALID");
  return {
    reviewedAt: new Date(approval.reviewedAt).toISOString(),
    reviewerIdSha256: sha256(approval.reviewerId),
  };
}

async function prepareOwnedMediaMigrationInternal({
  artifactHandle,
  records,
  policy: rawPolicy,
  fetcher,
  storageRoot,
  rollbackKey,
  reviewer,
}) {
  const policy = validatePolicy(rawPolicy);
  if (typeof reviewer !== "function") fail("REVIEW_REQUIRED");
  if (!Buffer.isBuffer(rollbackKey) || rollbackKey.length !== 32) fail("ROLLBACK_KEY_INVALID");
  validateMigratableRecords(records);
  const { candidates } = collect(records);
  const inventory = inventoryMediaRecords(records);

  for (const candidate of candidates.values()) {
    for (const location of candidate.locations) {
      if (location.table === "media_files") assertSafeBlobKey(location.originalBlobKey);
    }
    if (!matchingApproval(candidate.source, candidate.classification, policy.approvedSources)) {
      fail("SOURCE_NOT_APPROVED");
    }
  }

  const root = await ensureStorageRoot(storageRoot);
  const objectsRoot = await ensureChildDirectory(root, "objects");
  const objectsByHash = new Map();
  let duplicateSources = 0;
  let totalBytes = 0;

  for (const candidate of [...candidates.values()].sort((a, b) => a.sourceHash.localeCompare(b.sourceHash))) {
    const expectedSizes = candidate.locations
      .map((location) => location.expectedSize)
      .filter((value) => value !== undefined && value !== null);
    const expectedMimes = candidate.locations
      .map((location) => location.expectedMimeType)
      .filter((value) => value !== undefined && value !== null);
    const fetched = candidate.classification === "data"
      ? decodeDataUrl(candidate.source, policy, expectedSizes, expectedMimes)
      : await fetchCandidate(candidate, fetcher, policy);
    const digest = sha256(fetched.buffer);
    let object = objectsByHash.get(digest);
    if (object) {
      if (object.mimeType !== fetched.mimeType || !object.buffer.equals(fetched.buffer)) fail("DIGEST_COLLISION");
      duplicateSources += 1;
    } else {
      object = {
        buffer: fetched.buffer,
        bytes: fetched.buffer.length,
        classifications: new Set(),
        mimeType: fetched.mimeType,
        sha256: digest,
        sourceCount: 0,
      };
      object.key = await stageObject(objectsRoot, object);
      objectsByHash.set(digest, object);
      totalBytes += object.bytes;
    }
    object.classifications.add(candidate.classification);
    object.sourceCount += 1;
    candidate.object = object;
  }

  const rewrites = buildRewriteOperations(candidates, policy);
  const policyEvidence = {
    allowedMimeTypes: [...policy.allowedMimeTypes].sort(),
    approvals: policy.approvedSources.map((entry) => ({
      approvalIdSha256: entry.approvalIdHash,
      classification: entry.classification,
      hostCount: entry.hosts.length,
      pathPrefixCount: entry.pathPrefixes.length,
      scopeSha256: sha256(canonicalJson({
        classification: entry.classification,
        hosts: [...entry.hosts].sort(),
        pathPrefixes: [...entry.pathPrefixes].sort(),
      })),
    })).sort((a, b) => a.approvalIdSha256.localeCompare(b.approvalIdSha256)),
    maxBytes: policy.maxBytes,
    policyId: policy.policyId,
    rewritePolicyId: policy.rewritePolicyId,
  };
  const objectEvidence = [...objectsByHash.values()].map((object) => ({
    bytes: object.bytes,
    classifications: [...object.classifications].sort(),
    key: object.key,
    mimeType: object.mimeType,
    sha256: object.sha256,
    sourceCount: object.sourceCount,
  })).sort((a, b) => a.sha256.localeCompare(b.sha256));
  const transaction = {
    allOrNothing: true,
    isolation: "serializable",
    mutationPerformed: false,
    precondition: "sha256-current-value-and-source-ownership-must-match",
  };
  const reviewDocument = {
    inventory,
    objects: objectEvidence,
    operations: rewrites.safe,
    policy: policyEvidence,
    projectId: PROJECT_ID,
    schemaVersion: SCHEMA_VERSION,
    transaction,
  };
  const reviewDigest = sha256(canonicalJson(reviewDocument));
  let rawApproval;
  try {
    rawApproval = await reviewer(publicClone({ ...reviewDocument, reviewDigest }));
  } catch {
    fail("REVIEW_FAILED");
  }
  const approval = validateReview(rawApproval, reviewDigest);
  const review = {
    reviewDigest,
    reviewedAt: approval.reviewedAt,
    reviewerIdSha256: approval.reviewerIdSha256,
    state: "approved",
  };
  const rewritePlan = {
    operations: rewrites.safe,
    projectId: PROJECT_ID,
    review,
    schemaVersion: SCHEMA_VERSION,
    transaction,
  };
  const rollbackMapping = {
    operations: rewrites.secret,
    projectId: PROJECT_ID,
    reviewDigest,
    schemaVersion: SCHEMA_VERSION,
  };
  const encryptedRollback = encryptRollbackMapping(rollbackMapping, rollbackKey, reviewDigest);
  const encryptedRollbackSha256 = sha256(encryptedRollback);
  const manifest = {
    encryptedRollbackSha256,
    inventory,
    objects: objectEvidence,
    policy: policyEvidence,
    projectId: PROJECT_ID,
    review,
    rewritePlanSha256: sha256(canonicalJson(rewritePlan)),
    schemaVersion: SCHEMA_VERSION,
  };
  const manifestBytes = Buffer.from(canonicalJson(manifest), "utf8");
  const rewritePlanBytes = Buffer.from(canonicalJson(rewritePlan), "utf8");

  const migrationsRoot = await ensureChildDirectory(root, ".nas-media-migrations");
  const migrationDir = join(migrationsRoot, randomUUID());
  await mkdir(migrationDir, { mode: 0o700 });
  await chmod(migrationDir, 0o700);
  try {
    if (artifactHandle !== undefined) {
      await beginSealedMediaArtifact({
        artifactDirectory: migrationDir,
        binding: artifactHandle.binding,
      });
    }
    await atomicWritePrivate(join(migrationDir, "manifest.json"), manifestBytes);
    await atomicWritePrivate(join(migrationDir, "rewrite-plan.json"), rewritePlanBytes);
    await atomicWritePrivate(join(migrationDir, "rollback-map.enc"), encryptedRollback);
    const preparation = publicClone({
      evidence: {
      encryptedRollbackSha256,
      manifestSha256: sha256(manifestBytes),
      rewritePlanSha256: sha256(rewritePlanBytes),
      },
      inventory,
      objects: {
        bytes: totalBytes,
        duplicateSources,
        staged: objectsByHash.size,
      },
      ok: true,
      review: {
        digest: reviewDigest,
        state: "approved",
      },
      rewrite: {
        mutationPerformed: false,
        operations: rewrites.safe.length,
        transactional: true,
      },
    });
    if (artifactHandle === undefined) return preparation;
    const sealed = await sealPreparedMediaArtifact({
      artifactDirectory: migrationDir,
      binding: artifactHandle.binding,
      handlePath: artifactHandle.handlePath,
      key: artifactHandle.key,
      preparation,
      storageRoot,
    });
    return publicClone({
      ...preparation,
      artifactHandleSha256: sealed.artifactHandleSha256,
    });
  } catch (error) {
    // A sealed-handle migration may have durably written the complete marker
    // and/or handle immediately before an interruption. Preserve that exact
    // private state for bound recovery; the recovery scanner removes only a
    // validated matching incomplete artifact. Legacy unsealed preparation can
    // retain its best-effort cleanup behavior.
    if (artifactHandle === undefined) {
      await rm(migrationDir, { force: true, recursive: true }).catch(() => undefined);
    }
    throw error;
  }
}

export async function prepareOwnedMediaMigration(options) {
  try {
    if (options?.artifactHandle !== undefined) {
      const resumed = await recoverSealedMediaArtifact({
        binding: options.artifactHandle.binding,
        handlePath: options.artifactHandle.handlePath,
        key: options.artifactHandle.key,
        storageRoot: options.storageRoot,
      });
      if (resumed !== undefined) {
        return publicClone({
          ...resumed.preparation,
          artifactHandleSha256: resumed.artifactHandleSha256,
        });
      }
    }
    return await prepareOwnedMediaMigrationInternal(options ?? {});
  } catch (error) {
    if (error instanceof MediaMigrationError) throw error;
    if (error instanceof MediaArtifactHandleError) fail(error.code);
    fail("MIGRATION_FAILED");
  }
}
