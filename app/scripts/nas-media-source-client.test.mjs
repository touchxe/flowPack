import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { canonicalMediaJson } from "./nas-media-contract.mjs";
import {
  createNodePostgresMediaSourceClientFactory,
  MediaSourceClientError,
  withAttestedPostgresMediaSource,
} from "./nas-media-source-client.mjs";

const MIGRATION_ID = "0198d821-93d5-4af2-a15e-6d7437f10380";
const RELEASE_COMMIT = "a".repeat(40);
const REMOTE_LOCK_IDENTITY = "b".repeat(64);
const SECRET_HOST = "ep-private-ref.ap-southeast-1.aws.neon.tech";
const SECRET_USER = "postgres";
const SECRET_PASSWORD = "private-password";
const SECRET_URL = `postgresql://${SECRET_USER}:${SECRET_PASSWORD}@${SECRET_HOST}:5432/postgres?sslmode=verify-full&channel_binding=require`;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalBytes(value) {
  return Buffer.from(`${canonicalMediaJson(value)}\n`, "utf8");
}

function expectCode(code) {
  return (error) => {
    assert.ok(error instanceof MediaSourceClientError);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    for (const secret of [SECRET_URL, SECRET_HOST, SECRET_USER, SECRET_PASSWORD]) {
      assert.equal(error.message.includes(secret), false);
    }
    return true;
  };
}

function sourceInventory(overrides = {}) {
  return {
    database: {
      collate: "en_US.utf8",
      ctype: "en_US.utf8",
      encoding: "UTF8",
    },
    extensions: ["pgcrypto", "plpgsql"],
    largeObjects: [],
    objectsSha256: "c".repeat(64),
    schemaVersion: 1,
    schemas: ["public"],
    sequences: [],
    tables: [{
      dataSha256: "d".repeat(64),
      name: "public.contents",
      rowCount: 1,
    }],
    ...overrides,
  };
}

function evidenceBundle(inventory = sourceInventory(), overrides = {}) {
  return {
    createdAt: "2026-08-24T00:00:00.000Z",
    dumpListSha256: "e".repeat(64),
    migrationId: MIGRATION_ID,
    projectId: "flowpack-nas",
    schemaVersion: 1,
    sourceInventory: inventory,
    sourceInventorySha256: sha256(canonicalBytes(inventory)),
    sourceServerMajor: 17,
    ...overrides,
  };
}

function freezeReceipt(overrides = {}) {
  return {
    healthHttpStatus: 200,
    inFlightWrites: 0,
    migrationId: MIGRATION_ID,
    projectId: "flowpack-nas",
    providerActionDigest: "f".repeat(64),
    recordedAt: "2026-08-24T00:00:00.000Z",
    releaseCommit: RELEASE_COMMIT,
    schemaVersion: 1,
    sourceCallbacksDisabled: true,
    sourceMediaWritesDisabled: true,
    sourcePaymentsDisabled: true,
    sourcePublishingDisabled: true,
    sourceSchedulerDisabled: true,
    sourceWritesDisabled: true,
    unsafeHttpStatus: 503,
    ...overrides,
  };
}

function sourceRows() {
  return {
    contentImages: [{
      contentId: "content-1",
      contentUserId: "user-1",
      id: "image-1",
      url: "https://private-object.example/image.png",
    }],
    contents: [{
      body: "private body",
      id: "content-1",
      slides: null,
      thumbnailUrl: null,
      userId: "user-1",
    }],
    mediaFiles: [{
      blobKey: "private/object-key",
      id: "media-1",
      mimeType: "image/png",
      size: 8,
      url: "https://private-object.example/image.png",
      userId: "user-1",
    }],
  };
}

function mockClient({
  databaseName = "postgres",
  backendPid = 4242,
  schemas = ["public"],
  serverVersionNum = 170011,
  failAt,
  rows = sourceRows(),
} = {}) {
  const calls = [];
  return {
    calls,
    connectCalls: 0,
    endCalls: 0,
    processID: backendPid,
    async connect() {
      this.connectCalls += 1;
      if (failAt === "connect") throw new Error(`private ${SECRET_URL}`);
    },
    async end() {
      this.endCalls += 1;
    },
    async query(query) {
      calls.push(structuredClone(query));
      const name = typeof query === "object" ? query.name : query;
      if (name === failAt) throw new Error(`private ${SECRET_URL}`);
      if (name === "flowpack_media_source_system_identity_v1") {
        return {
          rowCount: 1,
          rows: [{
            backendPid,
            databaseCollation: "en_US.utf8",
            databaseCtype: "en_US.utf8",
            databaseEncoding: "UTF8",
            databaseName,
            serverVersionNum,
            systemIdentifier: "72623859790382856",
          }],
        };
      }
      if (name === "flowpack_media_source_schema_scope_v1") {
        return {
          rowCount: schemas.length,
          rows: schemas.map((schemaName) => ({ schemaName })),
        };
      }
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

function fixture(t, { url = SECRET_URL, inventory = sourceInventory(), bundleOverrides } = {}) {
  const root = mkdtempSync(join(tmpdir(), "flowpack-media-source-client-"));
  chmodSync(root, 0o700);
  t.after(() => rmSync(root, { force: true, recursive: true }));
  const sourceConfigPath = join(root, "source.env");
  const databaseEvidenceBundlePath = join(root, "evidence.bundle.json");
  const mediaSourceAttestationPath = join(root, "media-source-attestation.json");
  const databaseBindingAttestationPath = join(root, "database-binding-attestation.json");
  const sourceFreezeReceiptPath = join(root, "source-freeze-receipt.json");
  writeFileSync(sourceConfigPath, `SOURCE_DATABASE_URL=${url}\n`, { mode: 0o600 });
  writeFileSync(
    databaseEvidenceBundlePath,
    canonicalBytes(evidenceBundle(inventory, bundleOverrides)),
    { mode: 0o600 },
  );
  writeFileSync(sourceFreezeReceiptPath, canonicalBytes(freezeReceipt()), { mode: 0o600 });
  return {
    databaseBindingAttestationPath,
    databaseEvidenceBundlePath,
    mediaSourceAttestationPath,
    root,
    sourceConfigPath,
    sourceFreezeReceiptPath,
  };
}

function input(prepared, clientFactory, consume = async () => undefined) {
  return {
    clientFactory,
    consume,
    databaseBindingAttestationPath: prepared.databaseBindingAttestationPath,
    databaseEvidenceBundlePath: prepared.databaseEvidenceBundlePath,
    mediaSourceAttestationPath: prepared.mediaSourceAttestationPath,
    migrationId: MIGRATION_ID,
    releaseCommit: RELEASE_COMMIT,
    remoteLockIdentitySha256: REMOTE_LOCK_IDENTITY,
    sourceConfigPath: prepared.sourceConfigPath,
    sourceFreezeReceiptPath: prepared.sourceFreezeReceiptPath,
  };
}

test("direct TLS source opens one dedicated session, binds DB/system/schema evidence, and returns hashes only", async (t) => {
  const prepared = fixture(t);
  const client = mockClient();
  let factoryRequest;
  let consumed;
  const result = await withAttestedPostgresMediaSource(input(
    prepared,
    async (request) => {
      factoryRequest = request;
      assert.equal(request.privateValues.host, SECRET_HOST);
      assert.equal(request.privateValues.user, SECRET_USER);
      assert.equal(request.privateValues.password, SECRET_PASSWORD);
      return client;
    },
    async (records, snapshotEvidence, context) => {
      consumed = context;
      assert.equal(client.calls.includes("COMMIT"), true);
      assert.equal(client.endCalls, 1);
      assert.equal(context.committedSourceSnapshot, true);
      assert.deepEqual(records.mediaFiles, sourceRows().mediaFiles);
      assert.equal(snapshotEvidence.sameSnapshotMediaInventory, true);
      assert.equal(context.databaseBindingAttestationPath, prepared.databaseBindingAttestationPath);
      assert.equal(context.mediaSourceAttestationPath, prepared.mediaSourceAttestationPath);
    },
  ));

  assert.deepEqual(Object.keys(factoryRequest).sort(), [
    "applicationName",
    "connectionMode",
    "sourceTransportProfileSha256",
    "sslMode",
  ]);
  for (const serialized of [JSON.stringify(factoryRequest), JSON.stringify(result)]) {
    for (const secret of [SECRET_URL, SECRET_HOST, SECRET_USER, SECRET_PASSWORD]) {
      assert.equal(serialized.includes(secret), false);
    }
  }
  assert.equal(result.connectionMode, "direct");
  assert.equal(result.attestationReused, false);
  assert.match(result.databaseBindingAttestationSha256, /^[a-f0-9]{64}$/);
  assert.match(result.databaseSystemIdentitySha256, /^[a-f0-9]{64}$/);
  assert.match(result.schemaScopeSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.sameSnapshotMediaInventory, true);
  assert.match(result.sourceFreezeReceiptSha256, /^[a-f0-9]{64}$/);
  assert.match(result.sourceMediaRecordsSha256, /^[a-f0-9]{64}$/);
  assert.match(result.sourceSnapshotEvidenceSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.remoteLockIdentitySha256, REMOTE_LOCK_IDENTITY);
  assert.equal(client.connectCalls, 1);
  assert.equal(client.endCalls, 1);
  assert.deepEqual(
    client.calls.filter((call) => typeof call === "string"),
    ["BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY", "COMMIT"],
  );
  const queries = client.calls.filter((call) => typeof call === "object");
  assert.equal(queries.length, 6);
  const commitIndex = client.calls.indexOf("COMMIT");
  assert.equal(commitIndex > 0, true);
  assert.equal(
    client.calls.every((call, index) => typeof call === "string" || index < commitIndex),
    true,
  );
  for (const query of queries) {
    assert.equal(Array.isArray(query.values), true);
    assert.equal(
      JSON.stringify(query.values) === "[]" || JSON.stringify(query.values) === "[200001]",
      true,
    );
    for (const secret of [SECRET_HOST, SECRET_USER, SECRET_PASSWORD]) {
      assert.equal(query.text.includes(secret), false);
    }
  }
  assert.equal(existsSync(prepared.mediaSourceAttestationPath), true);
  assert.equal(existsSync(prepared.databaseBindingAttestationPath), true);
  assert.equal(consumed.databaseBinding.databaseEvidenceBundleSha256, sha256(
    readFileSync(prepared.databaseEvidenceBundlePath),
  ));
});

test("the Node PostgreSQL factory creates one Client from private fields without a URL or process surface", async (t) => {
  const prepared = fixture(t);
  let clientOptions;
  function Client(options) {
    clientOptions = options;
    return mockClient();
  }
  const clientFactory = createNodePostgresMediaSourceClientFactory({ Client });
  const result = await withAttestedPostgresMediaSource(input(prepared, clientFactory));
  assert.equal(clientOptions.host, SECRET_HOST);
  assert.equal(clientOptions.user, SECRET_USER);
  assert.equal(clientOptions.password, SECRET_PASSWORD);
  assert.equal(clientOptions.port, 5432);
  assert.equal(clientOptions.ssl.rejectUnauthorized, true);
  assert.equal(clientOptions.enableChannelBinding, true);
  assert.equal(Object.hasOwn(clientOptions, "connectionString"), false);
  for (const secret of [SECRET_URL, SECRET_HOST, SECRET_USER, SECRET_PASSWORD]) {
    assert.equal(JSON.stringify(result).includes(secret), false);
  }
});

test("the public transport profile digest is invariant across host, user, and password secrets", async (t) => {
  const first = fixture(t);
  const second = fixture(t, {
    url: "postgresql://alternate_user:alternate-password@different.private.test:5432/postgres?sslmode=verify-full&channel_binding=require",
  });
  let firstRequest;
  let secondRequest;
  const firstResult = await withAttestedPostgresMediaSource(input(first, async (request) => {
    firstRequest = request;
    return mockClient();
  }));
  const secondResult = await withAttestedPostgresMediaSource(input(second, async (request) => {
    secondRequest = request;
    return mockClient();
  }));
  assert.equal(
    firstResult.sourceTransportProfileSha256,
    secondResult.sourceTransportProfileSha256,
  );
  assert.equal(
    firstRequest.sourceTransportProfileSha256,
    secondRequest.sourceTransportProfileSha256,
  );
  for (const serialized of [
    JSON.stringify(firstRequest),
    JSON.stringify(secondRequest),
    JSON.stringify(firstResult),
    JSON.stringify(secondResult),
  ]) {
    for (const secret of [
      SECRET_HOST,
      SECRET_USER,
      SECRET_PASSWORD,
      "alternate_user",
      "alternate-password",
      "different.private.test",
    ]) assert.equal(serialized.includes(secret), false);
  }
});

test("a canonical matching source-freeze receipt is mandatory and evidence cannot predate it", async (t) => {
  const missing = fixture(t);
  rmSync(missing.sourceFreezeReceiptPath);
  let calls = 0;
  await assert.rejects(
    withAttestedPostgresMediaSource(input(missing, async () => {
      calls += 1;
      return mockClient();
    })),
    expectCode("SOURCE_FREEZE_RECEIPT_INVALID"),
  );
  assert.equal(calls, 0);

  const stale = fixture(t);
  writeFileSync(
    stale.sourceFreezeReceiptPath,
    canonicalBytes(freezeReceipt({ recordedAt: "2026-08-24T00:00:01.000Z" })),
    { mode: 0o600 },
  );
  await assert.rejects(
    withAttestedPostgresMediaSource(input(stale, async () => mockClient())),
    expectCode("DATABASE_EVIDENCE_PRECEDES_SOURCE_FREEZE"),
  );
});

test("the frozen-source binding is re-read after COMMIT before any artifact consumer runs", async (t) => {
  const prepared = fixture(t);
  const client = mockClient();
  const query = client.query.bind(client);
  client.query = async (request) => {
    const result = await query(request);
    if (request === "COMMIT") {
      writeFileSync(
        prepared.sourceFreezeReceiptPath,
        canonicalBytes(freezeReceipt({ providerActionDigest: "0".repeat(64) })),
        { mode: 0o600 },
      );
    }
    return result;
  };
  let consumerCalls = 0;
  await assert.rejects(
    withAttestedPostgresMediaSource(input(
      prepared,
      async () => client,
      async () => { consumerCalls += 1; },
    )),
    expectCode("SOURCE_BINDING_CHANGED_AFTER_SNAPSHOT"),
  );
  assert.equal(consumerCalls, 0);
  assert.equal(existsSync(prepared.mediaSourceAttestationPath), false);
  assert.equal(existsSync(prepared.databaseBindingAttestationPath), false);
});

test("Neon direct and Supabase session connections are allowed while transaction poolers and weak TLS fail", async (t) => {
  const neonDirect = fixture(t);
  const neonResult = await withAttestedPostgresMediaSource(input(
    neonDirect,
    async () => mockClient(),
  ));
  assert.equal(neonResult.connectionMode, "direct");

  const session = fixture(t, {
    url: "postgresql://postgres.private-ref:private-password@aws-0-region.pooler.supabase.com:5432/postgres?sslmode=require&channel_binding=require",
  });
  const sessionClient = mockClient();
  const sessionResult = await withAttestedPostgresMediaSource(input(
    session,
    async () => sessionClient,
  ));
  assert.equal(sessionResult.connectionMode, "session");

  const cases = [
    "postgresql://postgres.private-ref:private-password@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require",
    "postgresql://postgres:private-password@generic-pgbouncer.example.test:5432/postgres?sslmode=require",
    "postgresql://postgres:private-password@db.private-ref.supabase.co:5432/postgres?sslmode=prefer",
  ];
  for (const url of cases) {
    const rejected = fixture(t, { url });
    let factoryCalls = 0;
    await assert.rejects(
      withAttestedPostgresMediaSource(input(rejected, async () => {
        factoryCalls += 1;
        return mockClient();
      })),
      expectCode("SOURCE_CONNECTION_PROFILE_INVALID"),
    );
    assert.equal(factoryCalls, 0);
  }
});

test("existing canonical attestations replay idempotently; a collision fails without overwrite", async (t) => {
  const prepared = fixture(t);
  const first = await withAttestedPostgresMediaSource(input(prepared, async () => mockClient()));
  const bindingBefore = readFileSync(prepared.databaseBindingAttestationPath);
  const mediaBefore = readFileSync(prepared.mediaSourceAttestationPath);
  const replay = await withAttestedPostgresMediaSource(input(prepared, async () => mockClient()));
  assert.equal(replay.attestationReused, true);
  assert.equal(replay.databaseBindingAttestationSha256, first.databaseBindingAttestationSha256);
  assert.deepEqual(readFileSync(prepared.databaseBindingAttestationPath), bindingBefore);
  assert.deepEqual(readFileSync(prepared.mediaSourceAttestationPath), mediaBefore);

  writeFileSync(prepared.databaseBindingAttestationPath, "{}\n", { mode: 0o600 });
  await assert.rejects(
    withAttestedPostgresMediaSource(input(prepared, async () => mockClient())),
    expectCode("SOURCE_ATTESTATION_COLLISION"),
  );
});

test("DB evidence, backend PID, locale, server major, and schema mismatch fail closed", async (t) => {
  const cases = [
    {
      prepared: fixture(t, { bundleOverrides: { sourceInventorySha256: "0".repeat(64) } }),
      client: mockClient(),
      code: "DATABASE_EVIDENCE_INVALID",
    },
    {
      prepared: fixture(t),
      client: mockClient({ backendPid: 4242 }),
      mutate: (client) => { client.processID = 9999; },
      code: "SOURCE_DEDICATED_SESSION_MISMATCH",
    },
    {
      prepared: fixture(t),
      client: mockClient({ schemas: ["auth", "public"] }),
      code: "SOURCE_SCHEMA_SCOPE_MISMATCH",
    },
    {
      prepared: fixture(t),
      client: mockClient({ serverVersionNum: 150010 }),
      code: "SOURCE_DATABASE_IDENTITY_MISMATCH",
    },
  ];
  for (const item of cases) {
    item.mutate?.(item.client);
    await assert.rejects(
      withAttestedPostgresMediaSource(input(item.prepared, async () => item.client)),
      expectCode(item.code),
    );
  }
});

test("connection/query/consumer failures are redacted, rollback/close the session, and clean only new attestations", async (t) => {
  for (const failAt of [
    "connect",
    "flowpack_media_source_system_identity_v1",
    "flowpack_media_source_contents_v1",
    "COMMIT",
  ]) {
    const prepared = fixture(t);
    const client = mockClient({ failAt });
    let consumerCalls = 0;
    const expectedCode = failAt === "connect"
      ? "SOURCE_CONNECTION_FAILED"
      : failAt === "flowpack_media_source_contents_v1"
        ? "SOURCE_MEDIA_SNAPSHOT_FAILED"
        : "SOURCE_ATTESTATION_QUERY_FAILED";
    await assert.rejects(
      withAttestedPostgresMediaSource(input(
        prepared,
        async () => client,
        async () => { consumerCalls += 1; },
      )),
      expectCode(expectedCode),
    );
    assert.equal(existsSync(prepared.mediaSourceAttestationPath), false);
    assert.equal(existsSync(prepared.databaseBindingAttestationPath), false);
    assert.equal(client.endCalls, 1);
    assert.equal(consumerCalls, 0);
    if (failAt !== "connect") assert.equal(client.calls.includes("ROLLBACK"), true);
  }

  const prepared = fixture(t);
  const client = mockClient();
  await assert.rejects(
    withAttestedPostgresMediaSource(input(
      prepared,
      async () => client,
      async () => { throw new Error(`private ${SECRET_URL}`); },
    )),
    expectCode("SOURCE_CONSUMER_FAILED"),
  );
  assert.equal(existsSync(prepared.mediaSourceAttestationPath), false);
  assert.equal(existsSync(prepared.databaseBindingAttestationPath), false);
  assert.equal(client.endCalls, 1);
});
