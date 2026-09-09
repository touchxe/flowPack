import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, link, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  MediaOperatorError,
  applyMediaCandidate,
  runMediaOperator,
  verifyMediaApplyPlan,
} from "./nas-media-operator.mjs";
import {
  nasOwnedMediaReplacement,
  prepareOwnedMediaMigration,
} from "./nas-media-migration.mjs";
import { mediaCandidateIdentitySha256 } from "./nas-media-contract.mjs";
import {
  createPostgresMediaCandidateAdapter,
  writePrivateMediaCandidateAttestation,
} from "./nas-media-postgres-adapter.mjs";

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const SOURCE = `data:image/png;base64,${PNG.toString("base64")}`;
const MIGRATION_ID = "0198d821-93d5-7af2-a15e-6d7437f10380";
const ROLLBACK_KEY = Buffer.alloc(32, 19);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function expectCode(code) {
  return (error) => {
    assert.ok(error instanceof MediaOperatorError);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    assert.equal(error.message.includes(SOURCE), false);
    return true;
  };
}

async function createFixture(t) {
  const root = await mkdtemp(join(tmpdir(), "flowpack-media-operator-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const records = {
    mediaFiles: [{
      id: "private-media-row",
      userId: "private-user",
      url: SOURCE,
      blobKey: "legacy/private-object",
      mimeType: "image/png",
      size: PNG.length,
    }],
    contentImages: [{
      id: "private-image-row",
      contentId: "private-content-row",
      url: SOURCE,
    }],
    contents: [{
      id: "private-content-row",
      userId: "private-user",
      thumbnailUrl: SOURCE,
      body: `<p>private-before ${SOURCE} private-after</p>`,
      slides: JSON.stringify([{ privateTitle: "private-slide", imageUrl: SOURCE }]),
    }],
  };
  const prepared = await prepareOwnedMediaMigration({
    records,
    policy: {
      policyId: "owned-media-test",
      rewritePolicyId: "nas-route-test",
      maxBytes: 1024,
      allowedMimeTypes: ["image/png"],
      approvedSources: [{
        classification: "data",
        owned: true,
        approvalId: "database-owned-test",
        hosts: [],
        pathPrefixes: [],
      }],
      replacementFor: nasOwnedMediaReplacement,
    },
    storageRoot: root,
    rollbackKey: ROLLBACK_KEY,
    reviewer: async (review) => ({
      approved: true,
      reviewDigest: review.reviewDigest,
      reviewerId: "reviewer-private-id",
      reviewedAt: "2026-08-24T00:00:00.000Z",
    }),
  });
  const migrationNames = await readdir(join(root, ".nas-media-migrations"));
  assert.equal(migrationNames.length, 1);
  const migrationRoot = join(root, ".nas-media-migrations", migrationNames[0]);
  const candidateDatabaseNameSha256 = sha256("flowpack_candidate_0123456789ab");
  const remoteLockIdentitySha256 = sha256("isolated-remote-lock-fixture");
  const candidateIdentitySha256 = mediaCandidateIdentitySha256({
    candidateDatabaseNameSha256,
    migrationId: MIGRATION_ID,
    projectId: "flowpack",
    remoteLockIdentitySha256,
  });
  const control = {
    schemaVersion: 2,
    projectId: "flowpack",
    migrationId: MIGRATION_ID,
    targetKind: "candidate",
    candidateAttestationSha256: sha256("private-candidate-attestation-fixture"),
    candidateDatabaseNameSha256,
    candidateIdentitySha256,
    remoteLockIdentitySha256,
    reviewDigest: prepared.review.digest,
    manifestSha256: prepared.evidence.manifestSha256,
    rewritePlanSha256: prepared.evidence.rewritePlanSha256,
    encryptedRollbackSha256: prepared.evidence.encryptedRollbackSha256,
  };
  const controlPath = join(root, "apply-control.json");
  await writeFile(controlPath, `${JSON.stringify(control)}\n`, { mode: 0o600 });
  await chmod(controlPath, 0o600);
  const paths = {
    controlPath,
    manifestPath: join(migrationRoot, "manifest.json"),
    rewritePlanPath: join(migrationRoot, "rewrite-plan.json"),
    encryptedMappingPath: join(migrationRoot, "rollback-map.enc"),
  };
  const objectReader = async (key) => ({ buffer: await readFile(join(root, key)) });
  return { root, records, prepared, control, paths, objectReader, candidateIdentitySha256 };
}

function candidateDatabase(fixture, options = {}) {
  let state = structuredClone({
    media_files: {
      "private-media-row": {
        id: "private-media-row",
        userId: "private-user",
        url: SOURCE,
        blobKey: "legacy/private-object",
      },
    },
    content_images: {
      "private-image-row": {
        id: "private-image-row",
        contentId: "private-content-row",
        contentUserId: "private-user",
        url: SOURCE,
      },
    },
    contents: {
      "private-content-row": {
        id: "private-content-row",
        userId: "private-user",
        thumbnailUrl: SOURCE,
        body: fixture.records.contents[0].body,
        slides: fixture.records.contents[0].slides,
      },
    },
  });
  const calls = { transactions: 0, reads: 0, updates: [] };
  const database = {
    calls,
    get state() {
      return state;
    },
    async describeTarget() {
      return options.identity ?? {
        attestationSha256: fixture.control.candidateAttestationSha256,
        databaseNameSha256: fixture.control.candidateDatabaseNameSha256,
        kind: "candidate",
        projectId: "flowpack",
        migrationId: MIGRATION_ID,
        identitySha256: fixture.candidateIdentitySha256,
        remoteLockIdentitySha256: fixture.control.remoteLockIdentitySha256,
      };
    },
    async transaction(transactionOptions, callback) {
      calls.transactions += 1;
      assert.deepEqual(transactionOptions, { isolationLevel: "SERIALIZABLE" });
      const snapshot = structuredClone(state);
      const updateCallCount = calls.updates.length;
      let updateNumber = 0;
      const tx = {
        async describeTarget() {
          return database.describeTarget();
        },
        async readRow({ table, recordId }) {
          calls.reads += 1;
          const row = state[table]?.[recordId];
          return row ? structuredClone(row) : null;
        },
        async updateExact({ table, recordId, expected, ownership, replacement, operationId }) {
          updateNumber += 1;
          if (options.failUpdateAt === updateNumber) return { matched: 0, updated: 0 };
          const row = state[table]?.[recordId];
          const ownershipMatches = table === "content_images"
            ? row?.contentId === ownership.contentId && row?.contentUserId === ownership.contentUserId
            : row?.userId === ownership.userId;
          if (
            !row ||
            !ownershipMatches ||
            Object.entries(expected).some(([field, value]) => row[field] !== value)
          ) {
            return { matched: 0, updated: 0 };
          }
          Object.assign(row, replacement);
          calls.updates.push(operationId);
          return { matched: 1, updated: 1 };
        },
      };
      try {
        return await callback(tx);
      } catch (error) {
        state = snapshot;
        calls.updates.length = updateCallCount;
        throw error;
      }
    },
  };
  return database;
}

function postgresCandidateClient(fixture) {
  let state = structuredClone(candidateDatabase(fixture).state);
  let transactionSnapshot = null;
  const calls = [];
  const contentFields = {
    flowpack_media_update_content_thumbnail_v1: "thumbnailUrl",
    flowpack_media_update_content_body_v1: "body",
    flowpack_media_update_content_slides_v1: "slides",
  };
  const client = {
    calls,
    processID: 5151,
    get state() {
      return state;
    },
    async query(query) {
      calls.push(structuredClone(query));
      if (typeof query === "string") {
        if (query.startsWith("BEGIN")) transactionSnapshot = structuredClone(state);
        if (query === "ROLLBACK" && transactionSnapshot) state = transactionSnapshot;
        if (query === "COMMIT" || query === "ROLLBACK") transactionSnapshot = null;
        return { rowCount: null, rows: [] };
      }
      const id = query.values[0];
      if (query.name === "flowpack_media_target_identity_v1") {
        return { rowCount: 1, rows: [{ databaseName: "flowpack_candidate_0123456789ab" }] };
      }
      if (query.name === "flowpack_media_read_media_file_v1") {
        const row = state.media_files[id];
        return row ? { rowCount: 1, rows: [{ ...row }] } : { rowCount: 0, rows: [] };
      }
      if (query.name === "flowpack_media_read_content_image_v1") {
        const row = state.content_images[id];
        if (!row) return { rowCount: 0, rows: [] };
        return { rowCount: 1, rows: [{ ...row }] };
      }
      if (query.name === "flowpack_media_read_content_v1") {
        const row = state.contents[id];
        return row ? { rowCount: 1, rows: [{ ...row }] } : { rowCount: 0, rows: [] };
      }
      if (query.name === "flowpack_media_update_media_file_url_v1") {
        const row = state.media_files[id];
        const [, url, blobKey, userId, expectedUrl, expectedBlobKey] = query.values;
        if (!row || row.userId !== userId || row.url !== expectedUrl || row.blobKey !== expectedBlobKey) {
          return { rowCount: 0, rows: [] };
        }
        Object.assign(row, { url, blobKey });
        return { rowCount: 1, rows: [{ id }] };
      }
      if (query.name === "flowpack_media_update_content_image_url_v1") {
        const row = state.content_images[id];
        const [, url, contentId, contentUserId, expectedUrl] = query.values;
        if (
          !row ||
          row.contentId !== contentId ||
          row.contentUserId !== contentUserId ||
          row.url !== expectedUrl
        ) {
          return { rowCount: 0, rows: [] };
        }
        row.url = url;
        return { rowCount: 1, rows: [{ id }] };
      }
      const field = contentFields[query.name];
      if (field) {
        const row = state.contents[id];
        const [, replacement, userId, expected] = query.values;
        if (!row || row.userId !== userId || row[field] !== expected) {
          return { rowCount: 0, rows: [] };
        }
        row[field] = replacement;
        return { rowCount: 1, rows: [{ id }] };
      }
      throw new Error("unexpected query");
    },
  };
  return client;
}

test("verify-plan authenticates the producer envelope, hashes and every staged object", async (t) => {
  const fixture = await createFixture(t);
  const result = await verifyMediaApplyPlan({
    ...fixture.paths,
    rollbackKey: ROLLBACK_KEY,
    objectReader: fixture.objectReader,
  });

  assert.deepEqual(Object.keys(result).sort(), [
    "encryptedRollbackSha256",
    "manifestSha256",
    "migrationIdSha256",
    "mode",
    "objectBytes",
    "objectsVerified",
    "ok",
    "operationsVerified",
    "reviewDigest",
    "rewritePlanSha256",
    "rollbackPlanSha256",
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.mode, "verify-plan");
  assert.equal(result.operationsVerified, 5);
  assert.equal(result.objectsVerified, 1);
  assert.equal(result.objectBytes, PNG.length);
  const serialized = JSON.stringify(result);
  for (const secret of [SOURCE, "private-media-row", "private-content-row", "private-user", "legacy/private-object"]) {
    assert.equal(serialized.includes(secret), false);
  }
});

test("verify-plan rejects unsafe control files, altered hashes and the wrong key without disclosure", async (t) => {
  const fixture = await createFixture(t);
  await chmod(fixture.paths.controlPath, 0o644);
  await assert.rejects(
    verifyMediaApplyPlan({ ...fixture.paths, rollbackKey: ROLLBACK_KEY, objectReader: fixture.objectReader }),
    expectCode("CONTROL_FILE_UNSAFE"),
  );
  await chmod(fixture.paths.controlPath, 0o600);

  await assert.rejects(
    verifyMediaApplyPlan({
      ...fixture.paths,
      rollbackKey: Buffer.alloc(32, 20),
      objectReader: fixture.objectReader,
    }),
    expectCode("MAPPING_DECRYPTION_FAILED"),
  );

  const changed = { ...fixture.control, manifestSha256: "0".repeat(64) };
  await writeFile(fixture.paths.controlPath, `${JSON.stringify(changed)}\n`, { mode: 0o600 });
  await chmod(fixture.paths.controlPath, 0o600);
  await assert.rejects(
    verifyMediaApplyPlan({ ...fixture.paths, rollbackKey: ROLLBACK_KEY, objectReader: fixture.objectReader }),
    expectCode("MANIFEST_HASH_MISMATCH"),
  );
});

test("verify-plan rejects a hardlinked private control artifact", async (t) => {
  const fixture = await createFixture(t);
  await link(fixture.paths.controlPath, join(fixture.root, "unexpected-control-link.json"));
  await assert.rejects(
    verifyMediaApplyPlan({
      ...fixture.paths,
      rollbackKey: ROLLBACK_KEY,
      objectReader: fixture.objectReader,
    }),
    expectCode("CONTROL_FILE_UNSAFE"),
  );
});

test("a rehashed control cannot detach source ownership inventory from human-reviewed operations", async (t) => {
  const fixture = await createFixture(t);
  const manifest = JSON.parse(await readFile(fixture.paths.manifestPath, "utf8"));
  manifest.inventory.ownership.identityScopeSha256 = "e".repeat(64);
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  await writeFile(fixture.paths.manifestPath, manifestBytes, { mode: 0o600 });
  await chmod(fixture.paths.manifestPath, 0o600);
  const changedControl = { ...fixture.control, manifestSha256: sha256(manifestBytes) };
  await writeFile(fixture.paths.controlPath, `${JSON.stringify(changedControl)}\n`, { mode: 0o600 });
  await chmod(fixture.paths.controlPath, 0o600);

  await assert.rejects(
    verifyMediaApplyPlan({
      ...fixture.paths,
      rollbackKey: ROLLBACK_KEY,
      objectReader: fixture.objectReader,
    }),
    expectCode("INVENTORY_EVIDENCE_INVALID"),
  );
});

test("apply-candidate performs every allowlisted update once in one SERIALIZABLE transaction", async (t) => {
  const fixture = await createFixture(t);
  const database = candidateDatabase(fixture);
  const confirmation = `apply-candidate:flowpack:${MIGRATION_ID}:${fixture.control.manifestSha256}`;
  const result = await applyMediaCandidate({
    ...fixture.paths,
    rollbackKey: ROLLBACK_KEY,
    objectReader: fixture.objectReader,
    database,
    confirmation,
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, "apply-candidate");
  assert.equal(result.operationsApplied, 5);
  assert.equal(result.postWriteRollbackAllowed, false);
  assert.equal(database.calls.transactions, 1);
  assert.equal(database.calls.updates.length, 5);
  assert.equal(new Set(database.calls.updates).size, 5);
  assert.equal(database.state.media_files["private-media-row"].blobKey.startsWith("objects/"), true);
  assert.equal(database.state.content_images["private-image-row"].url.startsWith("/api/nas-owned-media/"), true);
  assert.equal(database.state.contents["private-content-row"].body.includes(SOURCE), false);
  const serialized = JSON.stringify(result);
  for (const secret of [SOURCE, "private-media-row", "private-content-row", "private-user", "legacy/private-object"]) {
    assert.equal(serialized.includes(secret), false);
  }
});

test("apply-candidate integrates with the attested parameterized PostgreSQL adapter", async (t) => {
  const fixture = await createFixture(t);
  const attestationPath = join(fixture.root, "candidate-attestation.json");
  const evidence = await writePrivateMediaCandidateAttestation({
    attestationPath,
    candidateDatabaseName: "flowpack_candidate_0123456789ab",
    migrationId: MIGRATION_ID,
    remoteLockIdentitySha256: fixture.control.remoteLockIdentitySha256,
  });
  const control = {
    ...fixture.control,
    candidateAttestationSha256: evidence.attestationSha256,
    candidateDatabaseNameSha256: evidence.candidateDatabaseNameSha256,
    candidateIdentitySha256: evidence.candidateIdentitySha256,
  };
  await writeFile(fixture.paths.controlPath, `${JSON.stringify(control)}\n`, { mode: 0o600 });
  await chmod(fixture.paths.controlPath, 0o600);
  const client = postgresCandidateClient(fixture);
  const database = await createPostgresMediaCandidateAdapter({ attestationPath, client });
  const applyOptions = {
    ...fixture.paths,
    rollbackKey: ROLLBACK_KEY,
    objectReader: fixture.objectReader,
    database,
    confirmation: `apply-candidate:flowpack:${MIGRATION_ID}:${control.manifestSha256}`,
  };
  const result = await applyMediaCandidate(applyOptions);
  const updateQueriesAfterApply = client.calls.filter(
    (call) => typeof call === "object" && call.name?.startsWith("flowpack_media_update_"),
  ).length;
  const replay = await applyMediaCandidate(applyOptions);

  assert.equal(result.operationsApplied, 5);
  assert.equal(result.idempotentReplay, false);
  assert.equal(replay.operationsApplied, 0);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.executionDigest, result.executionDigest);
  assert.deepEqual(
    client.calls.filter((call) => typeof call === "string"),
    [
      "BEGIN ISOLATION LEVEL SERIALIZABLE",
      "COMMIT",
      "BEGIN ISOLATION LEVEL SERIALIZABLE",
      "COMMIT",
    ],
  );
  assert.equal(
    client.calls.filter(
      (call) => typeof call === "object" && call.name?.startsWith("flowpack_media_update_"),
    ).length,
    updateQueriesAfterApply,
  );
  assert.equal(client.state.media_files["private-media-row"].url.includes(SOURCE), false);
  assert.equal(client.state.content_images["private-image-row"].url.includes(SOURCE), false);
  assert.equal(client.state.contents["private-content-row"].body.includes(SOURCE), false);
});

test("a committed candidate apply replays deterministically with zero new updates", async (t) => {
  const fixture = await createFixture(t);
  const database = candidateDatabase(fixture);
  const options = {
    ...fixture.paths,
    rollbackKey: ROLLBACK_KEY,
    objectReader: fixture.objectReader,
    database,
    confirmation: `apply-candidate:flowpack:${MIGRATION_ID}:${fixture.control.manifestSha256}`,
  };
  const first = await applyMediaCandidate(options);
  const updatesAfterFirst = database.calls.updates.length;
  const replay = await applyMediaCandidate(options);

  assert.equal(first.operationsApplied, 5);
  assert.equal(first.idempotentReplay, false);
  assert.equal(replay.operationsApplied, 0);
  assert.equal(replay.operationsVerified, 5);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.executionDigest, first.executionDigest);
  assert.equal(replay.rollbackPlanSha256, first.rollbackPlanSha256);
  assert.equal(database.calls.updates.length, updatesAfterFirst);
  assert.equal(database.calls.transactions, 2);
});

test("mixed original/replacement or third-value candidate state fails before any new update", async (t) => {
  const fixture = await createFixture(t);
  const confirmation = `apply-candidate:flowpack:${MIGRATION_ID}:${fixture.control.manifestSha256}`;
  const options = {
    ...fixture.paths,
    rollbackKey: ROLLBACK_KEY,
    objectReader: fixture.objectReader,
    confirmation,
  };

  const mixed = candidateDatabase(fixture);
  await applyMediaCandidate({ ...options, database: mixed });
  const appliedUpdates = mixed.calls.updates.length;
  mixed.state.contents["private-content-row"].body = fixture.records.contents[0].body;
  const mixedBefore = structuredClone(mixed.state);
  await assert.rejects(
    applyMediaCandidate({ ...options, database: mixed }),
    expectCode("CANDIDATE_STATE_MIXED"),
  );
  assert.deepEqual(mixed.state, mixedBefore);
  assert.equal(mixed.calls.updates.length, appliedUpdates);

  const thirdValue = candidateDatabase(fixture);
  thirdValue.state.contents["private-content-row"].body = "valid but unrelated third value";
  const thirdBefore = structuredClone(thirdValue.state);
  await assert.rejects(
    applyMediaCandidate({ ...options, database: thirdValue }),
    expectCode("ROW_PRECONDITION_MISMATCH"),
  );
  assert.deepEqual(thirdValue.state, thirdBefore);
  assert.equal(thirdValue.calls.updates.length, 0);
});

test("a precondition failure rolls the candidate transaction back and canonical/source targets never start", async (t) => {
  const fixture = await createFixture(t);
  const confirmation = `apply-candidate:flowpack:${MIGRATION_ID}:${fixture.control.manifestSha256}`;
  const database = candidateDatabase(fixture, { failUpdateAt: 2 });
  const before = structuredClone(database.state);
  await assert.rejects(
    applyMediaCandidate({
      ...fixture.paths,
      rollbackKey: ROLLBACK_KEY,
      objectReader: fixture.objectReader,
      database,
      confirmation,
    }),
    expectCode("ROW_PRECONDITION_MISMATCH"),
  );
  assert.deepEqual(database.state, before);
  assert.equal(database.calls.updates.length, 0);

  for (const kind of ["canonical", "source"]) {
    const rejected = candidateDatabase(fixture, {
        identity: {
          attestationSha256: fixture.control.candidateAttestationSha256,
          databaseNameSha256: fixture.control.candidateDatabaseNameSha256,
          kind,
          projectId: "flowpack",
          migrationId: MIGRATION_ID,
          identitySha256: fixture.candidateIdentitySha256,
          remoteLockIdentitySha256: fixture.control.remoteLockIdentitySha256,
      },
    });
    await assert.rejects(
      applyMediaCandidate({
        ...fixture.paths,
        rollbackKey: ROLLBACK_KEY,
        objectReader: fixture.objectReader,
        database: rejected,
        confirmation,
      }),
      expectCode("CANDIDATE_TARGET_REQUIRED"),
    );
    assert.equal(rejected.calls.transactions, 0);
  }
});

test("every object is verified before the candidate transaction and ownership is fail-closed", async (t) => {
  const fixture = await createFixture(t);
  const confirmation = `apply-candidate:flowpack:${MIGRATION_ID}:${fixture.control.manifestSha256}`;
  const unreadable = candidateDatabase(fixture);
  await assert.rejects(
    applyMediaCandidate({
      ...fixture.paths,
      rollbackKey: ROLLBACK_KEY,
      objectReader: async () => ({ buffer: Buffer.from("tampered") }),
      database: unreadable,
      confirmation,
    }),
    expectCode("OBJECT_VERIFICATION_FAILED"),
  );
  assert.equal(unreadable.calls.transactions, 0);

  const orphaned = candidateDatabase(fixture);
  orphaned.state.content_images["private-image-row"].contentUserId = "different-valid-owner";
  const before = structuredClone(orphaned.state);
  await assert.rejects(
    applyMediaCandidate({
      ...fixture.paths,
      rollbackKey: ROLLBACK_KEY,
      objectReader: fixture.objectReader,
      database: orphaned,
      confirmation,
    }),
    expectCode("ROW_OWNERSHIP_MISMATCH"),
  );
  assert.deepEqual(orphaned.state, before);

  const reparented = candidateDatabase(fixture);
  reparented.state.content_images["private-image-row"].contentId = "different-valid-content";
  const beforeReparent = structuredClone(reparented.state);
  await assert.rejects(
    applyMediaCandidate({
      ...fixture.paths,
      rollbackKey: ROLLBACK_KEY,
      objectReader: fixture.objectReader,
      database: reparented,
      confirmation,
    }),
    expectCode("ROW_OWNERSHIP_MISMATCH"),
  );
  assert.deepEqual(reparented.state, beforeReparent);
});

test("confirmation is exact and no operator mode permits post-write rollback", async (t) => {
  const fixture = await createFixture(t);
  const database = candidateDatabase(fixture);
  await assert.rejects(
    applyMediaCandidate({
      ...fixture.paths,
      rollbackKey: ROLLBACK_KEY,
      objectReader: fixture.objectReader,
      database,
      confirmation: "apply-candidate:flowpack:wrong",
    }),
    expectCode("APPLY_CONFIRMATION_INVALID"),
  );
  assert.equal(database.calls.transactions, 0);

  await assert.rejects(
    runMediaOperator({ mode: "rollback-live" }),
    expectCode("POST_WRITE_ROLLBACK_DISABLED"),
  );
});
