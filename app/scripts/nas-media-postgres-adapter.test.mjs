import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  PostgresMediaAdapterError,
  createPostgresMediaCandidateAdapter,
  writePrivateMediaCandidateAttestation,
} from "./nas-media-postgres-adapter.mjs";

const MIGRATION_ID = "0198d821-93d5-7af2-a15e-6d7437f10380";
const CANDIDATE_DATABASE = "flowpack_candidate_0123456789ab";
const REMOTE_LOCK_IDENTITY = "4".repeat(64);

function expectCode(code) {
  return (error) => {
    assert.ok(error instanceof PostgresMediaAdapterError);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    assert.equal(error.message.includes(CANDIDATE_DATABASE), false);
    return true;
  };
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "flowpack-media-pg-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  const attestationPath = join(root, "candidate-attestation.json");
  const evidence = await writePrivateMediaCandidateAttestation({
    attestationPath,
    candidateDatabaseName: CANDIDATE_DATABASE,
    migrationId: MIGRATION_ID,
    remoteLockIdentitySha256: REMOTE_LOCK_IDENTITY,
  });
  return { root, attestationPath, evidence };
}

function mockClient({ databaseName = CANDIDATE_DATABASE, failUpdate = false } = {}) {
  const calls = [];
  return {
    calls,
    processID: 4242,
    async query(query) {
      calls.push(structuredClone(query));
      const name = typeof query === "object" ? query.name : null;
      if (name === "flowpack_media_target_identity_v1") {
        return { rowCount: 1, rows: [{ databaseName }] };
      }
      if (name?.startsWith("flowpack_media_read_")) {
        if (name.endsWith("media_file_v1")) {
          return {
            rowCount: 1,
            rows: [{
              id: "private-media-row",
              userId: "private-user",
              url: "private-source-url",
              blobKey: "legacy/private-object",
            }],
          };
        }
        return { rowCount: 0, rows: [] };
      }
      if (name?.startsWith("flowpack_media_update_")) {
        if (failUpdate) throw new Error("private database error");
        return { rowCount: 1, rows: [{ id: "private-row" }] };
      }
      return { rowCount: null, rows: [] };
    },
  };
}

test("private attestation binds candidate database and remote lock without disclosure", async (t) => {
  const prepared = await fixture(t);
  assert.deepEqual(Object.keys(prepared.evidence).sort(), [
    "attestationSha256",
    "candidateDatabaseNameSha256",
    "candidateIdentitySha256",
    "migrationIdSha256",
    "ok",
    "remoteLockIdentitySha256",
  ]);
  const bytes = await readFile(prepared.attestationPath);
  assert.equal(bytes.includes(Buffer.from(CANDIDATE_DATABASE)), true);
  const client = mockClient();
  const adapter = await createPostgresMediaCandidateAdapter({
    attestationPath: prepared.attestationPath,
    client,
  });
  const identity = await adapter.describeTarget();
  assert.deepEqual(identity, {
    attestationSha256: prepared.evidence.attestationSha256,
    databaseNameSha256: prepared.evidence.candidateDatabaseNameSha256,
    identitySha256: prepared.evidence.candidateIdentitySha256,
    kind: "candidate",
    migrationId: MIGRATION_ID,
    projectId: "flowpack",
    remoteLockIdentitySha256: REMOTE_LOCK_IDENTITY,
  });
  assert.equal(JSON.stringify(identity).includes(CANDIDATE_DATABASE), false);
  const query = client.calls[0];
  assert.equal(query.name, "flowpack_media_target_identity_v1");
  assert.deepEqual(query.values, []);
  assert.equal(query.text.includes(CANDIDATE_DATABASE), false);
  assert.equal(query.text.includes(REMOTE_LOCK_IDENTITY), false);
});

test("adapter uses one SERIALIZABLE transaction and static parameterized CAS SQL", async (t) => {
  const prepared = await fixture(t);
  const client = mockClient();
  const adapter = await createPostgresMediaCandidateAdapter({
    attestationPath: prepared.attestationPath,
    client,
  });
  const operations = [
    ["media_files", "url", {
      recordId: "private-media-row",
      table: "media_files",
      userId: "private-user",
    }, { url: "private-source-url", blobKey: "legacy/private-object" }, {
      url: "/api/media/private-media-row/content",
      blobKey: "objects/aa/" + "a".repeat(64) + ".png",
    }],
    ["content_images", "url", {
      contentId: "private-content-row",
      contentUserId: "private-user",
      recordId: "private-image-row",
      table: "content_images",
    }, { url: "private-source-url" }, { url: "/api/nas-owned-media/objects/aa/file.png" }],
    ["contents", "thumbnailUrl", {
      recordId: "private-content-row",
      table: "contents",
      userId: "private-user",
    }, { thumbnailUrl: "private-source-url" }, { thumbnailUrl: "/api/nas-owned-media/object" }],
    ["contents", "body", {
      recordId: "private-content-row",
      table: "contents",
      userId: "private-user",
    }, { body: "private body" }, { body: "rewritten body" }],
    ["contents", "slides", {
      recordId: "private-content-row",
      table: "contents",
      userId: "private-user",
    }, { slides: "private slides" }, { slides: "rewritten slides" }],
  ];

  const applied = await adapter.transaction({ isolationLevel: "SERIALIZABLE" }, async (tx) => {
    const target = await tx.describeTarget();
    assert.equal(target.identitySha256, prepared.evidence.candidateIdentitySha256);
    const row = await tx.readRow({ table: "media_files", recordId: "private-media-row" });
    assert.equal(row.userId, "private-user");
    for (const [table, field, ownership, expected, replacement] of operations) {
      const result = await tx.updateExact({
        expected,
        field,
        operationId: "b".repeat(64),
        ownership,
        recordId: ownership.recordId,
        replacement,
        table,
      });
      assert.deepEqual(result, { matched: 1, updated: 1 });
    }
    return operations.length;
  });
  assert.equal(applied, 5);

  const transactionCommands = client.calls.filter((call) => typeof call === "string");
  assert.deepEqual(transactionCommands, ["BEGIN ISOLATION LEVEL SERIALIZABLE", "COMMIT"]);
  const dataQueries = client.calls.filter((call) => typeof call === "object");
  const updateQueries = dataQueries.filter((query) => query.name.startsWith("flowpack_media_update_"));
  assert.equal(updateQueries.length, 5);
  assert.equal(new Set(updateQueries.map((query) => query.name)).size, 5);
  for (const query of dataQueries) {
    assert.ok(Array.isArray(query.values));
    for (const privateValue of [
      "private-media-row",
      "private-content-row",
      "private-user",
      "private-source-url",
      "legacy/private-object",
    ]) {
      assert.equal(query.text.includes(privateValue), false);
    }
  }
});

test("canonical/source databases and unsafe attestations fail before mutation", async (t) => {
  const prepared = await fixture(t);
  const canonical = mockClient({ databaseName: "flowpack" });
  const adapter = await createPostgresMediaCandidateAdapter({
    attestationPath: prepared.attestationPath,
    client: canonical,
  });
  await assert.rejects(adapter.describeTarget(), expectCode("CANDIDATE_DATABASE_MISMATCH"));
  assert.equal(canonical.calls.some((call) => typeof call === "string" && call.startsWith("BEGIN")), false);

  await chmod(prepared.attestationPath, 0o644);
  await assert.rejects(
    createPostgresMediaCandidateAdapter({
      attestationPath: prepared.attestationPath,
      client: mockClient(),
    }),
    expectCode("CANDIDATE_ATTESTATION_UNSAFE"),
  );
  await chmod(prepared.attestationPath, 0o600);

  const linked = join(prepared.root, "linked-attestation.json");
  await symlink(prepared.attestationPath, linked);
  await assert.rejects(
    createPostgresMediaCandidateAdapter({ attestationPath: linked, client: mockClient() }),
    expectCode("CANDIDATE_ATTESTATION_UNSAFE"),
  );

  await assert.rejects(
    writePrivateMediaCandidateAttestation({
      attestationPath: join(prepared.root, "hostile.json"),
      candidateDatabaseName: "flowpack; DROP DATABASE postgres",
      migrationId: MIGRATION_ID,
      remoteLockIdentitySha256: REMOTE_LOCK_IDENTITY,
    }),
    expectCode("CANDIDATE_ATTESTATION_INVALID"),
  );

  await assert.rejects(
    createPostgresMediaCandidateAdapter({
      attestationPath: prepared.attestationPath,
      client: { query: async () => ({ rowCount: 0, rows: [] }) },
    }),
    expectCode("POSTGRES_DEDICATED_SESSION_REQUIRED"),
  );
});

test("adapter rolls the dedicated transaction back on a parameterized CAS failure", async (t) => {
  const prepared = await fixture(t);
  const client = mockClient({ failUpdate: true });
  const adapter = await createPostgresMediaCandidateAdapter({
    attestationPath: prepared.attestationPath,
    client,
  });
  await assert.rejects(
    adapter.transaction({ isolationLevel: "SERIALIZABLE" }, async (tx) => tx.updateExact({
      expected: { body: "private body" },
      field: "body",
      operationId: "b".repeat(64),
      ownership: {
        recordId: "private-content-row",
        table: "contents",
        userId: "private-user",
      },
      recordId: "private-content-row",
      replacement: { body: "rewritten body" },
      table: "contents",
    })),
    expectCode("MEDIA_MUTATION_FAILED"),
  );
  assert.deepEqual(
    client.calls.filter((call) => typeof call === "string"),
    ["BEGIN ISOLATION LEVEL SERIALIZABLE", "ROLLBACK"],
  );
});

test("adapter rejects every field outside the five-field static SQL allowlist", async (t) => {
  const prepared = await fixture(t);
  const client = mockClient();
  const adapter = await createPostgresMediaCandidateAdapter({
    attestationPath: prepared.attestationPath,
    client,
  });
  await assert.rejects(
    adapter.transaction({ isolationLevel: "SERIALIZABLE" }, async (tx) => tx.updateExact({
      expected: { aiPrompt: "private prompt" },
      field: "aiPrompt",
      operationId: "b".repeat(64),
      ownership: {
        recordId: "private-content-row",
        table: "contents",
        userId: "private-user",
      },
      recordId: "private-content-row",
      replacement: { aiPrompt: "mutated prompt" },
      table: "contents",
    })),
    expectCode("MEDIA_MUTATION_INVALID"),
  );
  assert.equal(
    client.calls.some((call) => typeof call === "object" && call.name?.startsWith("flowpack_media_update_")),
    false,
  );
});

test("adapter redacts unexpected transaction failures before they cross the boundary", async (t) => {
  const prepared = await fixture(t);
  const client = mockClient();
  const adapter = await createPostgresMediaCandidateAdapter({
    attestationPath: prepared.attestationPath,
    client,
  });
  await assert.rejects(
    adapter.transaction({ isolationLevel: "SERIALIZABLE" }, async () => {
      throw new Error("private-row private-user private database detail");
    }),
    expectCode("MEDIA_TRANSACTION_FAILED"),
  );
  assert.deepEqual(
    client.calls.filter((call) => typeof call === "string"),
    ["BEGIN ISOLATION LEVEL SERIALIZABLE", "ROLLBACK"],
  );
});
