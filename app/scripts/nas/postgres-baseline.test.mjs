import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  BaselineGateError,
  authorizeBaselineGeneration,
  createGateContext,
  inspectMigrationSql,
  prepareArtifacts,
  recordDriftEvidence,
  refuseDirectDatabaseMutation,
  scanMigrationDirectory,
  sha256,
  validateDriftEvidence,
} from "./postgres-baseline.mjs";

const POSTGRES_SCHEMA = `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id String @id
}
`;

async function createFixture(migrationSql = "CREATE TABLE users (id TEXT PRIMARY KEY);\n") {
  const appRoot = await fs.mkdtemp(path.join(os.tmpdir(), "flowpack-baseline-"));
  const schemaPath = path.join(appRoot, "prisma/schema.prisma");
  const migrationsDirectory = path.join(appRoot, "prisma/migrations");
  await fs.mkdir(path.join(migrationsDirectory, "20260101000000_init"), { recursive: true });
  await fs.writeFile(schemaPath, POSTGRES_SCHEMA);
  await fs.writeFile(path.join(migrationsDirectory, "20260101000000_init/migration.sql"), migrationSql);

  const context = await createGateContext({ appRoot, schemaPath, migrationsDirectory });
  return { appRoot, context, migrationsDirectory };
}

function validEvidence(context, now = Date.now()) {
  return {
    kind: "flowpack.postgresql-live-drift-evidence",
    version: 1,
    provider: "postgresql",
    proof: "prisma-migrate-diff",
    driftExitCode: 0,
    driftDetected: false,
    checkedAt: new Date(now).toISOString(),
    canonicalSchemaSha256: context.canonicalSchemaSha256,
    migrationInventorySha256: context.inventorySha256,
    driftOutputSha256: sha256("No difference detected.\n"),
  };
}

function assertGateCode(callback, expectedCode) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof BaselineGateError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

test("SQLite 전용 migration SQL signature를 파일과 줄 단위로 감지한다", () => {
  const findings = inspectMigrationSql(
    [
      "PRAGMA foreign_keys=OFF;",
      "CREATE TABLE new_users (expires DATETIME);",
      "CREATE TABLE audit (id INTEGER PRIMARY KEY AUTOINCREMENT);",
    ].join("\n"),
    "legacy/migration.sql"
  );

  assert.deepEqual(
    findings.map(({ code, line }) => ({ code, line })),
    [
      { code: "SQLITE_PRAGMA", line: 1 },
      { code: "SQLITE_DATETIME_TYPE", line: 2 },
      { code: "SQLITE_REDEFINE_TABLE", line: 2 },
      { code: "SQLITE_AUTOINCREMENT", line: 3 },
    ]
  );
});

test("migration inventory hash와 SQLite findings를 결정적으로 만든다", async (t) => {
  const { appRoot, migrationsDirectory } = await createFixture("PRAGMA foreign_keys=ON;\n");
  t.after(() => fs.rm(appRoot, { recursive: true, force: true }));

  const first = await scanMigrationDirectory(migrationsDirectory);
  const second = await scanMigrationDirectory(migrationsDirectory);

  assert.equal(first.inventorySha256, second.inventorySha256);
  assert.equal(first.findings[0]?.code, "SQLITE_PRAGMA");
});

test("evidence가 없거나 drift가 있거나 schema가 바뀌면 거부한다", async (t) => {
  const { appRoot, context } = await createFixture();
  t.after(() => fs.rm(appRoot, { recursive: true, force: true }));
  const now = Date.now();
  const evidence = validEvidence(context, now);

  assertGateCode(() => validateDriftEvidence(null, context, { now }), "EVIDENCE_REQUIRED");
  assertGateCode(
    () => validateDriftEvidence({ ...evidence, driftExitCode: 2, driftDetected: true }, context, { now }),
    "LIVE_DRIFT_DETECTED"
  );
  assertGateCode(
    () => validateDriftEvidence({ ...evidence, canonicalSchemaSha256: "0".repeat(64) }, context, { now }),
    "SCHEMA_CHANGED_AFTER_EVIDENCE"
  );
  assertGateCode(
    () => validateDriftEvidence({ ...evidence, checkedAt: new Date(now - 25 * 60 * 60 * 1000).toISOString() }, context, { now }),
    "EVIDENCE_EXPIRED"
  );
});

test("evidence와 준비 산출물에 DB URL 또는 비밀값을 허용하지 않는다", async (t) => {
  const { appRoot, context } = await createFixture("PRAGMA foreign_keys=ON;\n");
  t.after(() => fs.rm(appRoot, { recursive: true, force: true }));
  const now = Date.now();

  assertGateCode(
    () => validateDriftEvidence({ ...validEvidence(context, now), note: "postgresql://user:password@db/live" }, context, { now }),
    "SECRET_MATERIAL_REJECTED"
  );

  const outputDirectory = path.join(appRoot, "migration-artifacts/postgres-baseline");
  const previousValue = process.env.MIGRATION_DATABASE_URL;
  process.env.MIGRATION_DATABASE_URL = "postgresql://should-not-appear:secret@private/live";
  try {
    await prepareArtifacts(context, outputDirectory);
  } finally {
    if (previousValue === undefined) delete process.env.MIGRATION_DATABASE_URL;
    else process.env.MIGRATION_DATABASE_URL = previousValue;
  }

  const contents = await Promise.all(
    (await fs.readdir(outputDirectory)).map((file) => fs.readFile(path.join(outputDirectory, file), "utf8"))
  );
  const serialized = contents.join("\n");
  assert.doesNotMatch(serialized, /should-not-appear|postgresql:\/\//i);
  assert.match(serialized, /MIGRATION_DATABASE_URL/);
  assert.match(serialized, /SQLITE_PRAGMA/);
});

test("drift report가 깨끗할 때만 evidence를 새 파일로 기록한다", async (t) => {
  const { appRoot, context } = await createFixture();
  t.after(() => fs.rm(appRoot, { recursive: true, force: true }));
  const outputDirectory = path.join(appRoot, "migration-artifacts/postgres-baseline");
  const cleanReport = path.join(appRoot, "clean-drift.txt");
  const changedReport = path.join(appRoot, "changed-drift.txt");
  const emptyReport = path.join(appRoot, "empty-drift.txt");
  await fs.writeFile(cleanReport, "No difference detected.\n");
  await fs.writeFile(changedReport, "[*] Changed the users table\n");
  await fs.writeFile(emptyReport, "");

  const evidence = await recordDriftEvidence(context, {
    driftReportPath: cleanReport,
    driftExitCode: 0,
    outputPath: path.join(outputDirectory, "evidence.json"),
  });
  assert.equal(evidence.driftDetected, false);

  await assert.rejects(
    recordDriftEvidence(context, {
      driftReportPath: changedReport,
      driftExitCode: 0,
      outputPath: path.join(outputDirectory, "invalid-evidence.json"),
    }),
    (error) => error instanceof BaselineGateError && error.code === "DRIFT_REPORT_NOT_CLEAN"
  );
  await assert.rejects(
    recordDriftEvidence(context, {
      driftReportPath: emptyReport,
      driftExitCode: 0,
      outputPath: path.join(outputDirectory, "empty-evidence.json"),
    }),
    (error) => error instanceof BaselineGateError && error.code === "DRIFT_REPORT_NOT_CLEAN"
  );
});

test("준비 산출물을 활성 migration 또는 추적 소스 경로에 쓰지 않는다", async (t) => {
  const { appRoot, context, migrationsDirectory } = await createFixture();
  t.after(() => fs.rm(appRoot, { recursive: true, force: true }));

  await assert.rejects(
    prepareArtifacts(context, path.join(migrationsDirectory, "prepared")),
    (error) => error instanceof BaselineGateError && error.code === "ARTIFACT_OUTPUT_PATH_REJECTED"
  );
  await assert.rejects(
    prepareArtifacts(context, path.join(appRoot, "scripts/prepared")),
    (error) => error instanceof BaselineGateError && error.code === "ARTIFACT_OUTPUT_PATH_REJECTED"
  );
});

test("검증된 evidence가 있어야 격리된 baseline generation command를 승인한다", async (t) => {
  const { appRoot, context } = await createFixture("PRAGMA foreign_keys=ON;\n");
  t.after(() => fs.rm(appRoot, { recursive: true, force: true }));
  const outputDirectory = path.join(appRoot, "migration-artifacts/postgres-baseline");
  const now = Date.now();

  await assert.rejects(
    authorizeBaselineGeneration(context, { evidence: null, outputDirectory, now }),
    (error) => error instanceof BaselineGateError && error.code === "EVIDENCE_REQUIRED"
  );

  const result = await authorizeBaselineGeneration(context, {
    evidence: validEvidence(context, now),
    outputDirectory,
    now,
  });
  const command = await fs.readFile(result.commandPath, "utf8");
  assert.match(command, /migrate diff --from-empty/);
  assert.match(command, /migration-artifacts\/postgres-baseline\/postgresql-baseline\.sql/);
  assert.doesNotMatch(command, /postgresql:\/\//i);
  assert.equal(result.databaseMutationPerformed, false);
});

test("직접 generate/apply 경로는 evidence가 있어도 DB mutation을 거부한다", async (t) => {
  const { appRoot, context } = await createFixture();
  t.after(() => fs.rm(appRoot, { recursive: true, force: true }));
  const now = Date.now();

  assertGateCode(
    () => refuseDirectDatabaseMutation(null, context, { now }),
    "EVIDENCE_REQUIRED"
  );
  assertGateCode(
    () => refuseDirectDatabaseMutation(validEvidence(context, now), context, { now }),
    "DIRECT_DATABASE_MUTATION_DISABLED"
  );
});
