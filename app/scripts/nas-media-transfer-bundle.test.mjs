import assert from "node:assert/strict";
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createNasStagedObjectReader } from "./nas-media-io.mjs";
import {
  nasOwnedMediaReplacement,
  prepareOwnedMediaMigration,
} from "./nas-media-migration.mjs";
import {
  MediaTransferBundleError,
  backupMediaTransferBundleOffsite,
  createMediaTransferBundle,
} from "./nas-media-transfer-bundle.mjs";

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const PNG_DATA_URL = `data:image/png;base64,${PNG.toString("base64")}`;
const ROLLBACK_KEY = Buffer.alloc(32, 7);
const OFFSITE_KEY = Buffer.alloc(32, 9);
const MIGRATION_ID = "0198d821-93d5-7af2-a15e-6d7437f10380";
const RELEASE_COMMIT = "a".repeat(40);
const REMOTE_LOCK_IDENTITY = "b".repeat(64);

function expectCode(code) {
  return (error) => {
    assert.ok(error instanceof MediaTransferBundleError);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    assert.equal(error.message.includes(PNG_DATA_URL), false);
    return true;
  };
}

function policy() {
  return {
    policyId: "flowpack-owned-media-v1",
    rewritePolicyId: "flowpack-nas-routes-v1",
    maxBytes: 1024,
    allowedMimeTypes: ["image/png"],
    approvedSources: [{
      approvalId: "database-owned-inline-data",
      classification: "data",
      hosts: [],
      owned: true,
      pathPrefixes: [],
    }],
    replacementFor: nasOwnedMediaReplacement,
  };
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "flowpack-media-transfer-"));
  await chmod(root, 0o700);
  t.after(() => rm(root, { force: true, recursive: true }));
  const storageRoot = join(root, "storage");
  const bundleDirectory = join(root, "bundle");
  const secondBundleDirectory = join(root, "bundle-second");
  const offsiteRoot = join(root, "offsite");
  for (const path of [storageRoot, bundleDirectory, secondBundleDirectory, offsiteRoot]) {
    await mkdir(path, { mode: 0o700 });
  }
  const prepared = await prepareOwnedMediaMigration({
    records: {
      contentImages: [{ id: "private-image", contentId: "private-content", url: PNG_DATA_URL }],
      contents: [{
        id: "private-content",
        userId: "private-user",
        thumbnailUrl: PNG_DATA_URL,
        body: `private ${PNG_DATA_URL}`,
        slides: null,
      }],
      mediaFiles: [{
        id: "private-media",
        userId: "private-user",
        url: PNG_DATA_URL,
        blobKey: "legacy/private.png",
        mimeType: "image/png",
        size: PNG.length,
      }],
    },
    policy: policy(),
    reviewer: async (review) => ({
      approved: true,
      reviewDigest: review.reviewDigest,
      reviewedAt: "2026-08-24T00:00:00.000Z",
      reviewerId: "private-reviewer",
    }),
    rollbackKey: ROLLBACK_KEY,
    storageRoot,
  });
  const migrations = await readdir(join(storageRoot, ".nas-media-migrations"));
  assert.equal(migrations.length, 1);
  const migrationRoot = join(storageRoot, ".nas-media-migrations", migrations[0]);
  return {
    bundleDirectory,
    manifestPath: join(migrationRoot, "manifest.json"),
    objectReader: await createNasStagedObjectReader({ storageRoot }),
    offsiteRoot,
    prepared,
    root,
    secondBundleDirectory,
  };
}

function bundleOptions(fixture, overrides = {}) {
  return {
    bundleDirectory: fixture.bundleDirectory,
    manifestPath: fixture.manifestPath,
    manifestSha256: fixture.prepared.evidence.manifestSha256,
    migrationId: MIGRATION_ID,
    objectReader: fixture.objectReader,
    releaseCommit: RELEASE_COMMIT,
    remoteLockIdentitySha256: REMOTE_LOCK_IDENTITY,
    ...overrides,
  };
}

test("verified v2 objects produce a deterministic immutable length-prefixed bundle and completion receipt", async (t) => {
  const prepared = await fixture(t);
  const first = await createMediaTransferBundle(bundleOptions(prepared));
  const second = await createMediaTransferBundle(bundleOptions(prepared, {
    bundleDirectory: prepared.secondBundleDirectory,
  }));

  assert.equal(first.bundleSha256, second.bundleSha256);
  assert.equal(first.transferManifestSha256, second.transferManifestSha256);
  assert.equal(first.objects, 1);
  assert.equal(first.objectBytes, PNG.length);
  assert.equal(first.remoteLockIdentitySha256, REMOTE_LOCK_IDENTITY);
  assert.match(first.bundleSha256, /^[a-f0-9]{64}$/);
  assert.equal((await stat(first.bundlePath)).mode & 0o777, 0o600);
  assert.equal((await stat(first.transferManifestPath)).mode & 0o777, 0o600);
  assert.equal((await stat(first.completionReceiptPath)).mode & 0o777, 0o600);
  const bundle = await readFile(first.bundlePath);
  assert.equal(bundle.subarray(0, 8).toString("ascii"), "FPMBNDL1");
  assert.equal(bundle.includes(PNG), true);
  const serialized = JSON.stringify(first);
  for (const secret of [PNG_DATA_URL, "private-user", "private-content", "private-reviewer"]) {
    assert.equal(serialized.includes(secret), false);
  }

  await assert.rejects(
    createMediaTransferBundle(bundleOptions(prepared)),
    expectCode("TRANSFER_OUTPUT_COLLISION"),
  );
});

test("manifest/object tampering and size mismatches remove only newly-created partial outputs", async (t) => {
  const prepared = await fixture(t);
  const marker = join(prepared.bundleDirectory, "operator-owned.marker");
  await writeFile(marker, "keep", { mode: 0o600 });
  await assert.rejects(
    createMediaTransferBundle(bundleOptions(prepared, {
      objectReader: async () => ({ buffer: Buffer.from("tampered"), size: 8 }),
    })),
    expectCode("TRANSFER_OBJECT_VERIFICATION_FAILED"),
  );
  assert.equal((await readFile(marker, "utf8")), "keep");
  assert.deepEqual((await readdir(prepared.bundleDirectory)).sort(), ["operator-owned.marker"]);

  const manifest = await readFile(prepared.manifestPath);
  manifest[0] ^= 1;
  await writeFile(prepared.manifestPath, manifest, { mode: 0o600 });
  await assert.rejects(
    createMediaTransferBundle(bundleOptions(prepared)),
    expectCode("MEDIA_EVIDENCE_MANIFEST_HASH_MISMATCH"),
  );
});

test("encrypted offsite copy requires a separate device and verifies readback before its receipt", async (t) => {
  const prepared = await fixture(t);
  const bundle = await createMediaTransferBundle(bundleOptions(prepared));
  const separateStat = async (path) => ({
    dev: path.endsWith("/offsite") ? 200 : 100,
  });
  const result = await backupMediaTransferBundleOffsite({
    bundlePath: bundle.bundlePath,
    completionReceiptPath: bundle.completionReceiptPath,
    encryptionKey: OFFSITE_KEY,
    offsiteProfileId: "external-apfs-backup",
    offsiteRoot: prepared.offsiteRoot,
    statPath: separateStat,
    workspaceRoot: prepared.bundleDirectory,
  });
  assert.equal(result.bundleSha256, bundle.bundleSha256);
  assert.equal(result.readbackVerified, true);
  assert.match(result.encryptedSha256, /^[a-f0-9]{64}$/);
  const encrypted = await readFile(result.encryptedBundlePath);
  assert.equal(encrypted.subarray(0, 8).toString("ascii"), "FPMOFF01");
  assert.equal(encrypted.includes(PNG), false);
  assert.equal((await stat(result.encryptedBundlePath)).mode & 0o777, 0o600);
  assert.equal((await stat(result.offsiteReceiptPath)).mode & 0o777, 0o600);

  const sameDeviceRoot = join(prepared.root, "same-device-offsite");
  await mkdir(sameDeviceRoot, { mode: 0o700 });
  await assert.rejects(
    backupMediaTransferBundleOffsite({
      bundlePath: bundle.bundlePath,
      completionReceiptPath: bundle.completionReceiptPath,
      encryptionKey: OFFSITE_KEY,
      offsiteProfileId: "same-device",
      offsiteRoot: sameDeviceRoot,
      statPath: async () => ({ dev: 100 }),
      workspaceRoot: prepared.bundleDirectory,
    }),
    expectCode("OFFSITE_DEVICE_NOT_SEPARATE"),
  );
  assert.deepEqual(await readdir(sameDeviceRoot), []);
});

test("offsite corruption is detected during authenticated readback and leaves no completion receipt", async (t) => {
  const prepared = await fixture(t);
  const bundle = await createMediaTransferBundle(bundleOptions(prepared));
  let reads = 0;
  await assert.rejects(
    backupMediaTransferBundleOffsite({
      bundlePath: bundle.bundlePath,
      completionReceiptPath: bundle.completionReceiptPath,
      encryptionKey: OFFSITE_KEY,
      offsiteProfileId: "corrupting-device",
      offsiteRoot: prepared.offsiteRoot,
      statPath: async (path) => ({ dev: path.endsWith("/offsite") ? 200 : 100 }),
      workspaceRoot: prepared.bundleDirectory,
      verifyEncryptedReadback: async () => {
        reads += 1;
        throw new Error(`private corruption ${PNG_DATA_URL}`);
      },
    }),
    expectCode("OFFSITE_READBACK_FAILED"),
  );
  assert.equal(reads, 1);
  assert.deepEqual(await readdir(prepared.offsiteRoot), []);
});
