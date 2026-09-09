import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  MediaSourceInventoryError,
  capturePostgresMediaSourceSnapshot,
  writePrivateMediaSourceAttestation,
} from "./nas-media-source-inventory.mjs";

const MIGRATION_ID = "0198d821-93d5-7af2-a15e-6d7437f10380";
const DATABASE_NAME = "private_source_database";
const TRANSPORT_PROFILE = "4".repeat(64);
const SOURCE_FREEZE_RECEIPT = "6".repeat(64);
const REMOTE_LOCK_IDENTITY = "5".repeat(64);
const SECRET_URL = "https://owned.example.test/private-object.png";

function expectCode(code) {
  return (error) => {
    assert.ok(error instanceof MediaSourceInventoryError);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    assert.equal(error.message.includes(DATABASE_NAME), false);
    assert.equal(error.message.includes(SECRET_URL), false);
    return true;
  };
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "flowpack-media-source-"));
  await chmod(root, 0o700);
  t.after(() => rm(root, { recursive: true, force: true }));
  const attestationPath = join(root, "source-attestation.json");
  const evidence = await writePrivateMediaSourceAttestation({
    attestationPath,
    databaseName: DATABASE_NAME,
    migrationId: MIGRATION_ID,
    remoteLockIdentitySha256: REMOTE_LOCK_IDENTITY,
    sourceFreezeReceiptSha256: SOURCE_FREEZE_RECEIPT,
    sourceTransportProfileSha256: TRANSPORT_PROFILE,
  });
  return { attestationPath, evidence, root };
}

function sourceRows() {
  return {
    mediaFiles: [{
      id: "private-media-id",
      userId: "private-user-id",
      url: SECRET_URL,
      blobKey: "private/blob-key",
      mimeType: "image/png",
      size: 8,
    }],
    contentImages: [{
      id: "private-image-id",
      contentId: "private-content-id",
      contentUserId: "private-user-id",
      url: SECRET_URL,
    }],
    contents: [{
      id: "private-content-id",
      userId: "private-user-id",
      thumbnailUrl: SECRET_URL,
      body: `private body ${SECRET_URL}`,
      slides: null,
    }],
  };
}

function mockClient({ databaseName = DATABASE_NAME, rows = sourceRows(), failAt } = {}) {
  const calls = [];
  return {
    calls,
    processID: 4242,
    async query(query) {
      calls.push(structuredClone(query));
      const name = typeof query === "object" ? query.name : query;
      if (name === failAt) throw new Error(`private failure ${SECRET_URL}`);
      if (name === "flowpack_media_source_identity_v1") {
        return {
          rowCount: 1,
          rows: [{
            databaseName,
            transactionIsolation: "repeatable read",
            transactionReadOnly: "on",
          }],
        };
      }
      if (name === "flowpack_media_source_media_files_v1") {
        return { rowCount: rows.mediaFiles.length, rows: structuredClone(rows.mediaFiles) };
      }
      if (name === "flowpack_media_source_content_images_v1") {
        return { rowCount: rows.contentImages.length, rows: structuredClone(rows.contentImages) };
      }
      if (name === "flowpack_media_source_contents_v1") {
        return { rowCount: rows.contents.length, rows: structuredClone(rows.contents) };
      }
      return { rowCount: null, rows: [] };
    },
  };
}

test("source attestation is private and public evidence contains only hashes", async (t) => {
  const prepared = await fixture(t);
  assert.deepEqual(Object.keys(prepared.evidence).sort(), [
    "attestationSha256",
    "databaseNameSha256",
    "migrationIdSha256",
    "ok",
    "remoteLockIdentitySha256",
    "sourceFreezeReceiptSha256",
    "sourceTransportProfileSha256",
  ]);
  assert.equal(JSON.stringify(prepared.evidence).includes(DATABASE_NAME), false);
  const bytes = await readFile(prepared.attestationPath);
  assert.equal(bytes.includes(Buffer.from(DATABASE_NAME)), true);
});

test("one dedicated read-only repeatable-read snapshot feeds ownership-complete records only to the consumer", async (t) => {
  const prepared = await fixture(t);
  const client = mockClient();
  let consumed;
  const evidence = await capturePostgresMediaSourceSnapshot({
    attestationPath: prepared.attestationPath,
    client,
    consume: async (records) => {
      consumed = structuredClone(records);
    },
  });

  assert.deepEqual(consumed, {
    mediaFiles: sourceRows().mediaFiles,
    contentImages: sourceRows().contentImages.map(({ contentUserId: _ignored, ...row }) => row),
    contents: sourceRows().contents,
  });
  assert.deepEqual(
    client.calls.filter((call) => typeof call === "string"),
    ["BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY", "COMMIT"],
  );
  const queries = client.calls.filter((call) => typeof call === "object");
  assert.equal(queries.length, 4);
  for (const query of queries) {
    assert.ok(query.name.startsWith("flowpack_media_source_"));
    assert.ok(Array.isArray(query.values));
    assert.equal(query.text.includes(SECRET_URL), false);
    assert.equal(query.text.includes(DATABASE_NAME), false);
  }
  for (const query of queries.slice(1)) {
    assert.deepEqual(query.values, [200001]);
    assert.match(query.text, /ORDER BY .+ LIMIT \$1$/);
  }
  const serialized = JSON.stringify(evidence);
  assert.equal(serialized.includes(SECRET_URL), false);
  assert.equal(serialized.includes("private-user-id"), false);
  assert.equal(serialized.includes("private body"), false);
  assert.deepEqual(evidence.rows, {
    contentImages: 1,
    contents: 1,
    mediaFiles: 1,
    total: 3,
  });
  assert.match(evidence.recordsSha256, /^[a-f0-9]{64}$/);
  assert.equal(evidence.sameSnapshotMediaInventory, true);
  assert.equal(evidence.sourceFreezeReceiptSha256, SOURCE_FREEZE_RECEIPT);
  assert.equal(evidence.sourceTransportProfileSha256, TRANSPORT_PROFILE);
  assert.equal(evidence.remoteLockIdentitySha256, REMOTE_LOCK_IDENTITY);
});

test("an existing attested transaction is consumed without a nested BEGIN or early COMMIT", async (t) => {
  const prepared = await fixture(t);
  const client = mockClient();
  const evidence = await capturePostgresMediaSourceSnapshot({
    attestationPath: prepared.attestationPath,
    client,
    consume: async () => undefined,
    transactionScope: "existing",
  });
  assert.equal(evidence.sameSnapshotMediaInventory, true);
  assert.deepEqual(client.calls.filter((call) => typeof call === "string"), []);
});

test("source database mismatch, non-read-only transaction and non-dedicated clients fail closed", async (t) => {
  const prepared = await fixture(t);
  await assert.rejects(
    capturePostgresMediaSourceSnapshot({
      attestationPath: prepared.attestationPath,
      client: mockClient({ databaseName: "wrong_source" }),
      consume: async () => undefined,
    }),
    expectCode("SOURCE_DATABASE_MISMATCH"),
  );

  const transactionClient = mockClient();
  const original = transactionClient.query;
  transactionClient.query = async (query) => {
    const result = await original(query);
    if (query?.name === "flowpack_media_source_identity_v1") {
      result.rows[0].transactionReadOnly = "off";
    }
    return result;
  };
  await assert.rejects(
    capturePostgresMediaSourceSnapshot({
      attestationPath: prepared.attestationPath,
      client: transactionClient,
      consume: async () => undefined,
    }),
    expectCode("SOURCE_TRANSACTION_ATTESTATION_FAILED"),
  );

  await assert.rejects(
    capturePostgresMediaSourceSnapshot({
      attestationPath: prepared.attestationPath,
      client: { query: async () => ({ rowCount: 0, rows: [] }) },
      consume: async () => undefined,
    }),
    expectCode("POSTGRES_DEDICATED_SESSION_REQUIRED"),
  );
});

test("row shape, byte limits, duplicate ownership and broken content references rollback without disclosure", async (t) => {
  const prepared = await fixture(t);
  const cases = [
    {
      code: "SOURCE_ROW_INVALID",
      rows: { ...sourceRows(), mediaFiles: [{ ...sourceRows().mediaFiles[0], extra: "x" }] },
    },
    {
      code: "SOURCE_ROW_LIMIT_EXCEEDED",
      options: { maxRowsPerTable: 1 },
      rows: { ...sourceRows(), mediaFiles: [sourceRows().mediaFiles[0], { ...sourceRows().mediaFiles[0], id: "second" }] },
    },
    {
      code: "SOURCE_TEXT_LIMIT_EXCEEDED",
      options: { maxTextBytes: 32 },
      rows: sourceRows(),
    },
    {
      code: "SOURCE_OWNERSHIP_INVALID",
      rows: { ...sourceRows(), contents: [{ ...sourceRows().contents[0], userId: "different-user" }] },
    },
    {
      code: "SOURCE_CONTENT_REFERENCE_INVALID",
      rows: { ...sourceRows(), contentImages: [{ ...sourceRows().contentImages[0], contentId: "missing" }] },
    },
  ];

  for (const item of cases) {
    const client = mockClient({ rows: item.rows });
    await assert.rejects(
      capturePostgresMediaSourceSnapshot({
        attestationPath: prepared.attestationPath,
        client,
        consume: async () => undefined,
        ...item.options,
      }),
      expectCode(item.code),
    );
    assert.equal(client.calls.at(-1), "ROLLBACK");
  }
});

test("unsafe attestation and consumer/database failures are redacted and rollback", async (t) => {
  const prepared = await fixture(t);
  await chmod(prepared.attestationPath, 0o644);
  await assert.rejects(
    capturePostgresMediaSourceSnapshot({
      attestationPath: prepared.attestationPath,
      client: mockClient(),
      consume: async () => undefined,
    }),
    expectCode("SOURCE_ATTESTATION_UNSAFE"),
  );
  await chmod(prepared.attestationPath, 0o600);

  const linked = join(prepared.root, "linked.json");
  await symlink(prepared.attestationPath, linked);
  await assert.rejects(
    capturePostgresMediaSourceSnapshot({
      attestationPath: linked,
      client: mockClient(),
      consume: async () => undefined,
    }),
    expectCode("SOURCE_ATTESTATION_UNSAFE"),
  );

  const databaseFailure = mockClient({ failAt: "flowpack_media_source_contents_v1" });
  await assert.rejects(
    capturePostgresMediaSourceSnapshot({
      attestationPath: prepared.attestationPath,
      client: databaseFailure,
      consume: async () => undefined,
    }),
    expectCode("SOURCE_QUERY_FAILED"),
  );
  assert.equal(databaseFailure.calls.at(-1), "ROLLBACK");

  const consumerFailure = mockClient();
  await assert.rejects(
    capturePostgresMediaSourceSnapshot({
      attestationPath: prepared.attestationPath,
      client: consumerFailure,
      consume: async () => { throw new Error(`private consumer ${SECRET_URL}`); },
    }),
    expectCode("SOURCE_CONSUMER_FAILED"),
  );
  assert.equal(consumerFailure.calls.at(-1), "ROLLBACK");
});
