import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  MediaMigrationError,
  inventoryMediaRecords,
  nasOwnedMediaReplacement,
  prepareOwnedMediaMigration,
} from "./nas-media-migration.mjs";

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const PNG_DATA_URL = `data:image/png;base64,${PNG.toString("base64")}`;
const KEY = Buffer.alloc(32, 7);

function records(overrides = {}) {
  const mediaFiles = (overrides.mediaFiles ?? []).map((record) => ({
    userId: "fixture-owner",
    ...record,
  }));
  const contents = (overrides.contents ?? []).map((record) => ({
    userId: "fixture-owner",
    ...record,
  }));
  const contentIds = new Set(contents.map((record) => record.id));
  const contentImages = (overrides.contentImages ?? []).map((record) => ({ ...record }));
  for (const image of contentImages) {
    if (!contentIds.has(image.contentId)) {
      contents.push({ id: image.contentId, userId: "fixture-owner" });
      contentIds.add(image.contentId);
    }
  }
  return { mediaFiles, contentImages, contents };
}

function policy(overrides = {}) {
  return {
    policyId: "flowpack-owned-media-v1",
    rewritePolicyId: "flowpack-nas-routes-v1",
    maxBytes: 1024,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "audio/mpeg", "application/pdf"],
    approvedSources: [
      {
        classification: "cloudinary",
        owned: true,
        approvalId: "owned-cloudinary-account",
        hosts: ["res.cloudinary.com"],
        pathPrefixes: ["/owned-account/"],
      },
      {
        classification: "vercel-blob",
        owned: true,
        approvalId: "owned-vercel-store",
        hosts: ["owned.public.blob.vercel-storage.com"],
        pathPrefixes: ["/"],
      },
      {
        classification: "data",
        owned: true,
        approvalId: "database-owned-inline-data",
        hosts: [],
        pathPrefixes: [],
      },
    ],
    replacementFor: nasOwnedMediaReplacement,
    ...overrides,
  };
}

async function reviewer(review) {
  return {
    approved: true,
    reviewDigest: review.reviewDigest,
    reviewerId: "migration-operator",
    reviewedAt: "2026-08-24T00:00:00.000Z",
  };
}

function expectCode(code) {
  return (error) => {
    assert.ok(error instanceof MediaMigrationError);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    return true;
  };
}

async function walk(path) {
  const entries = [];
  for (const name of await readdir(path)) {
    const child = join(path, name);
    const info = await stat(child);
    entries.push({ child, info });
    if (info.isDirectory()) entries.push(...await walk(child));
  }
  return entries;
}

test("inventories every documented field and classifies sources without exposing record content", () => {
  const openAi = "https://oaidalleapiprodscus.blob.core.windows.net/private/generated.png";
  const vercel = "https://owned.public.blob.vercel-storage.com/library/item.png";
  const cloudinary = "https://res.cloudinary.com/owned-account/image/upload/item.png";
  const other = "https://images.example.test/public/item.png";
  const secretName = "customer-private-photo.png";
  const source = records({
    mediaFiles: [{ id: "m1", name: secretName, url: vercel, blobKey: "library/item.png", mimeType: "image/png", size: PNG.length }],
    contentImages: [{ id: "i1", contentId: "c1", url: cloudinary }],
    contents: [{
      id: "c1",
      thumbnailUrl: openAi,
      body: `<p><img src="${PNG_DATA_URL}"><img src="${other}"></p>`,
      slides: JSON.stringify([{ imageUrl: cloudinary }, { nested: { src: vercel } }]),
    }],
  });

  const result = inventoryMediaRecords(source);
  assert.deepEqual(result.fields, {
    "content_images.url": 1,
    "contents.body": 2,
    "contents.slides": 2,
    "contents.thumbnailUrl": 1,
    "media_files.blobKey": 1,
    "media_files.url": 1,
  });
  assert.deepEqual(result.classifications, {
    cloudinary: 2,
    data: 1,
    "openai-temporary": 1,
    other: 1,
    "vercel-blob": 2,
  });
  assert.equal(result.references, 7);
  assert.equal(result.uniqueSources, 5);
  assert.equal(result.ownership.records, 3);
  assert.match(result.ownership.identityScopeSha256, /^[a-f0-9]{64}$/);
  const serialized = JSON.stringify(result);
  for (const secret of [openAi, vercel, cloudinary, other, PNG_DATA_URL, secretName, "library/item.png"]) {
    assert.doesNotMatch(serialized, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("stages owned bytes once, creates private canonical evidence, and returns only a safe reviewed summary", async () => {
  const root = await mkdtemp(join(tmpdir(), "flowpack-media-"));
  const cloudinary = "https://res.cloudinary.com/owned-account/image/upload/shared.png";
  const secretName = "named-after-a-real-person.png";
  const source = records({
    mediaFiles: [{ id: "media-secret-id", name: secretName, url: cloudinary, blobKey: "private/folder/shared", mimeType: "image/png", size: PNG.length }],
    contentImages: [{ id: "image-secret-id", contentId: "content-secret-id", url: cloudinary }],
    contents: [{
      id: "content-secret-id",
      thumbnailUrl: PNG_DATA_URL,
      body: `<p>private prose <img src="${cloudinary}"></p>`,
      slides: JSON.stringify([{ title: "private slide", imageUrl: PNG_DATA_URL }]),
    }],
  });
  let fetchCalls = 0;
  const fetcher = async () => {
    fetchCalls += 1;
    return {
      status: 200,
      finalUrl: cloudinary,
      redirects: [],
      contentType: "image/png",
      contentLength: PNG.length,
      body: PNG,
    };
  };

  const result = await prepareOwnedMediaMigration({
    records: source,
    policy: policy(),
    fetcher,
    storageRoot: root,
    rollbackKey: KEY,
    reviewer,
  });

  assert.equal(fetchCalls, 1);
  assert.equal(result.ok, true);
  assert.equal(result.review.state, "approved");
  assert.equal(result.objects.staged, 1);
  assert.equal(result.objects.duplicateSources, 1);
  assert.equal(result.rewrite.operations, 5);
  assert.match(result.evidence.manifestSha256, /^[a-f0-9]{64}$/);
  assert.match(result.evidence.rewritePlanSha256, /^[a-f0-9]{64}$/);
  assert.match(result.evidence.encryptedRollbackSha256, /^[a-f0-9]{64}$/);
  assert.match(result.inventory.ownership.identityScopeSha256, /^[a-f0-9]{64}$/);

  const serialized = JSON.stringify(result);
  for (const secret of [cloudinary, PNG_DATA_URL, secretName, "private prose", "private slide", "media-secret-id", "private/folder/shared"]) {
    assert.equal(serialized.includes(secret), false);
  }

  const entries = await walk(root);
  const directories = entries.filter(({ info }) => info.isDirectory());
  const files = entries.filter(({ info }) => info.isFile());
  assert.ok(directories.length >= 3);
  assert.ok(files.length >= 4);
  for (const { info } of directories) assert.equal(info.mode & 0o777, 0o700);
  for (const { info } of files) assert.equal(info.mode & 0o777, 0o600);

  const textFiles = [];
  for (const { child } of files) {
    const bytes = await readFile(child);
    if (bytes[0] === 0x7b) textFiles.push(bytes.toString("utf8"));
  }
  assert.equal(textFiles.length, 2);
  for (const text of textFiles) {
    for (const secret of [cloudinary, PNG_DATA_URL, secretName, "private prose", "private slide", "media-secret-id", "private/folder/shared"]) {
      assert.equal(text.includes(secret), false);
    }
  }
  assert.ok(textFiles.some((text) => JSON.parse(text).review?.state === "approved"));
  const rewritePlan = textFiles.map((text) => JSON.parse(text)).find((value) => value.operations);
  assert.ok(rewritePlan);
  assert.equal(rewritePlan.schemaVersion, 2);
  assert.equal(
    rewritePlan.operations.every((operation) => /^[a-f0-9]{64}$/.test(operation.ownershipIdentitySha256)),
    true,
  );
});

test("fails closed when source ownership or content-reference identity is incomplete", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "flowpack-media-identity-"));
  const cases = [
    {
      name: "media owner missing",
      source: {
        mediaFiles: [{ id: "m", url: PNG_DATA_URL, blobKey: "legacy/key", mimeType: "image/png", size: PNG.length }],
        contentImages: [],
        contents: [],
      },
    },
    {
      name: "content owner missing",
      source: { mediaFiles: [], contentImages: [], contents: [{ id: "c", thumbnailUrl: PNG_DATA_URL }] },
    },
    {
      name: "content image reference missing",
      source: {
        mediaFiles: [],
        contentImages: [{ id: "i", contentId: "missing", url: PNG_DATA_URL }],
        contents: [],
      },
    },
  ];
  for (const item of cases) {
    await t.test(item.name, async () => {
      await assert.rejects(
        prepareOwnedMediaMigration({
          records: item.source,
          policy: policy(),
          storageRoot: root,
          rollbackKey: KEY,
          reviewer,
        }),
        expectCode("OWNERSHIP_IDENTITY_INVALID"),
      );
    });
  }
});

test("requires explicit ownership policy and an exact human review acknowledgement", async () => {
  const root = await mkdtemp(join(tmpdir(), "flowpack-media-policy-"));
  const source = records({ contents: [{ id: "c1", thumbnailUrl: PNG_DATA_URL }] });
  await assert.rejects(
    prepareOwnedMediaMigration({ records: source, storageRoot: root, rollbackKey: KEY, reviewer }),
    expectCode("POLICY_REQUIRED"),
  );
  await assert.rejects(
    prepareOwnedMediaMigration({ records: source, policy: policy(), storageRoot: root, rollbackKey: KEY }),
    expectCode("REVIEW_REQUIRED"),
  );
  await assert.rejects(
    prepareOwnedMediaMigration({
      records: source,
      policy: policy(),
      storageRoot: root,
      rollbackKey: KEY,
      reviewer: async () => ({ approved: true, reviewDigest: "0".repeat(64), reviewerId: "operator" }),
    }),
    expectCode("REVIEW_MISMATCH"),
  );
});

test("rejects credential URLs, unowned sources, redirect escapes, traversal, and symlink roots", async (t) => {
  const cases = [
    {
      name: "userinfo credentials",
      code: "SOURCE_URL_CREDENTIALS",
      source: records({ contentImages: [{ id: "i", contentId: "c", url: "https://user:pass@res.cloudinary.com/owned-account/image/upload/a.png" }] }),
    },
    {
      name: "query credentials",
      code: "SOURCE_URL_CREDENTIALS",
      source: records({ contentImages: [{ id: "i", contentId: "c", url: "https://res.cloudinary.com/owned-account/image/upload/a.png?token=secret" }] }),
    },
    {
      name: "unowned host",
      code: "SOURCE_NOT_APPROVED",
      source: records({ contentImages: [{ id: "i", contentId: "c", url: "https://unowned.example.test/a.png" }] }),
    },
    {
      name: "source blob traversal",
      code: "SOURCE_LOCATOR_UNSAFE",
      source: records({ mediaFiles: [{ id: "m", url: PNG_DATA_URL, blobKey: "../../private", mimeType: "image/png", size: PNG.length }] }),
    },
  ];

  for (const item of cases) {
    await t.test(item.name, async () => {
      const root = await mkdtemp(join(tmpdir(), "flowpack-media-hostile-"));
      await assert.rejects(
        prepareOwnedMediaMigration({ records: item.source, policy: policy(), storageRoot: root, rollbackKey: KEY, reviewer }),
        expectCode(item.code),
      );
    });
  }

  await t.test("redirect to an unapproved host", async () => {
    const root = await mkdtemp(join(tmpdir(), "flowpack-media-redirect-"));
    const sourceUrl = "https://res.cloudinary.com/owned-account/image/upload/a.png";
    await assert.rejects(
      prepareOwnedMediaMigration({
        records: records({ contentImages: [{ id: "i", contentId: "c", url: sourceUrl }] }),
        policy: policy(), storageRoot: root, rollbackKey: KEY, reviewer,
        fetcher: async () => ({
          status: 200,
          finalUrl: "https://redirected.example.test/a.png",
          redirects: ["https://redirected.example.test/a.png"],
          contentType: "image/png",
          contentLength: PNG.length,
          body: PNG,
        }),
      }),
      expectCode("REDIRECT_NOT_APPROVED"),
    );
  });

  await t.test("fetcher failures are redacted", async () => {
    const root = await mkdtemp(join(tmpdir(), "flowpack-media-fetch-failure-"));
    const sourceUrl = "https://res.cloudinary.com/owned-account/image/upload/private.png";
    await assert.rejects(
      prepareOwnedMediaMigration({
        records: records({ contentImages: [{ id: "i", contentId: "c", url: sourceUrl }] }),
        policy: policy(), storageRoot: root, rollbackKey: KEY, reviewer,
        fetcher: async () => { throw new Error(`upstream leaked ${sourceUrl}?token=secret`); },
      }),
      expectCode("FETCH_FAILED"),
    );
  });

  await t.test("symlink storage root", async () => {
    const parent = await mkdtemp(join(tmpdir(), "flowpack-media-link-"));
    const actual = join(parent, "actual");
    const linked = join(parent, "linked");
    await mkdir(actual, { mode: 0o700 });
    await symlink(actual, linked);
    await assert.rejects(
      prepareOwnedMediaMigration({
        records: records({ contents: [{ id: "c", thumbnailUrl: PNG_DATA_URL }] }),
        policy: policy(), storageRoot: linked, rollbackKey: KEY, reviewer,
      }),
      expectCode("STORAGE_SYMLINK"),
    );
  });
});

test("rejects unsupported, oversized, truncated, and MIME-mismatched responses", async (t) => {
  const sourceUrl = "https://res.cloudinary.com/owned-account/image/upload/a.png";
  const source = records({ contentImages: [{ id: "i", contentId: "c", url: sourceUrl }] });
  const base = { status: 200, finalUrl: sourceUrl, redirects: [], contentType: "image/png", contentLength: PNG.length, body: PNG };
  const cases = [
    ["unsupported MIME", "UNSUPPORTED_MIME", { ...base, contentType: "image/svg+xml" }],
    ["oversized length", "OBJECT_TOO_LARGE", { ...base, contentLength: 2048 }],
    ["truncated bytes", "BYTE_LENGTH_MISMATCH", { ...base, contentLength: PNG.length + 1 }],
    ["signature mismatch", "MIME_MISMATCH", { ...base, body: Buffer.from("not a png"), contentLength: 9 }],
  ];
  for (const [name, code, response] of cases) {
    await t.test(name, async () => {
      const root = await mkdtemp(join(tmpdir(), "flowpack-media-bytes-"));
      await assert.rejects(
        prepareOwnedMediaMigration({
          records: source,
          policy: policy({ maxBytes: 1024 }),
          storageRoot: root,
          rollbackKey: KEY,
          reviewer,
          fetcher: async () => response,
        }),
        expectCode(code),
      );
    });
  }
});
