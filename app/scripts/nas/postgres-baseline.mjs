#!/usr/bin/env node

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const EVIDENCE_KIND = "flowpack.postgresql-live-drift-evidence";
const EVIDENCE_VERSION = 1;
const DEFAULT_MAX_EVIDENCE_AGE_HOURS = 24;
const FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

const SQLITE_SIGNATURES = [
  { code: "SQLITE_PRAGMA", pattern: /^\s*PRAGMA\b/i },
  { code: "SQLITE_DATETIME_TYPE", pattern: /\bDATETIME\b/i },
  { code: "SQLITE_AUTOINCREMENT", pattern: /\bAUTOINCREMENT\b/i },
  { code: "SQLITE_WITHOUT_ROWID", pattern: /\bWITHOUT\s+ROWID\b/i },
  { code: "SQLITE_CATALOG", pattern: /\bsqlite_(?:master|schema|sequence)\b/i },
  { code: "SQLITE_REDEFINE_TABLE", pattern: /\bCREATE\s+TABLE\s+["'`]?(?:new_|_new_)/i },
];

const POSTGRES_URL_PATTERN = /\bpostgres(?:ql)?:\/\/[^\s"']+/i;
const SENSITIVE_ASSIGNMENT_PATTERN = /\b(?:password|secret|token|api[_-]?key)\s*[:=]\s*(?!null\b)(?!"?MIGRATION_DATABASE_URL\b)[^\s,}]+/i;

const scriptPath = fileURLToPath(import.meta.url);
const scriptDirectory = path.dirname(scriptPath);
const defaultAppRoot = path.resolve(scriptDirectory, "../..");

export class BaselineGateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BaselineGateError";
    this.code = code;
  }
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function inspectMigrationSql(sql, relativePath = "migration.sql") {
  const findings = [];
  const lines = sql.split(/\r?\n/);

  for (const [index, sourceLine] of lines.entries()) {
    const line = sourceLine.replace(/--.*$/, "");
    if (!line.trim()) continue;

    for (const signature of SQLITE_SIGNATURES) {
      if (signature.pattern.test(line)) {
        findings.push({
          code: signature.code,
          file: relativePath,
          line: index + 1,
        });
      }
    }
  }

  return findings;
}

async function listMigrationSqlFiles(directory, rootDirectory = directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new BaselineGateError(
        "MIGRATION_SYMLINK_REJECTED",
        `Migration 경로에서 symbolic link를 사용할 수 없습니다: ${path.relative(rootDirectory, entryPath)}`
      );
    }
    if (entry.isDirectory()) {
      files.push(...await listMigrationSqlFiles(entryPath, rootDirectory));
    } else if (entry.isFile() && entry.name === "migration.sql") {
      files.push(entryPath);
    }
  }

  return files;
}

export async function scanMigrationDirectory(migrationsDirectory) {
  let files;
  try {
    files = await listMigrationSqlFiles(migrationsDirectory);
  } catch (error) {
    if (error instanceof BaselineGateError) throw error;
    if (error instanceof Error && error.code === "ENOENT") {
      throw new BaselineGateError("MIGRATIONS_NOT_FOUND", "Prisma migrations 디렉터리를 찾을 수 없습니다.");
    }
    throw error;
  }

  const inventory = [];
  const findings = [];

  for (const file of files) {
    const sql = await fs.readFile(file, "utf8");
    const relativePath = path.relative(migrationsDirectory, file).split(path.sep).join("/");
    inventory.push({ path: relativePath, sha256: sha256(sql) });
    findings.push(...inspectMigrationSql(sql, relativePath));
  }

  const inventorySha256 = sha256(JSON.stringify(inventory));
  return { inventory, inventorySha256, findings };
}

function assertPostgresqlDatasource(schema) {
  if (!/datasource\s+\w+\s*\{[\s\S]*?provider\s*=\s*"postgresql"[\s\S]*?\}/m.test(schema)) {
    throw new BaselineGateError(
      "POSTGRESQL_SCHEMA_REQUIRED",
      "Canonical Prisma schema의 datasource provider가 postgresql이어야 합니다."
    );
  }
}

export async function createGateContext({
  appRoot = defaultAppRoot,
  schemaPath = path.join(appRoot, "prisma/schema.prisma"),
  migrationsDirectory = path.join(appRoot, "prisma/migrations"),
} = {}) {
  let schema;
  try {
    schema = await fs.readFile(schemaPath, "utf8");
  } catch (error) {
    if (error instanceof Error && error.code === "ENOENT") {
      throw new BaselineGateError("SCHEMA_NOT_FOUND", "Canonical Prisma schema를 찾을 수 없습니다.");
    }
    throw error;
  }

  assertPostgresqlDatasource(schema);
  const migrationScan = await scanMigrationDirectory(migrationsDirectory);

  return {
    appRoot: path.resolve(appRoot),
    schemaPath: path.resolve(schemaPath),
    migrationsDirectory: path.resolve(migrationsDirectory),
    canonicalSchemaSha256: sha256(schema),
    ...migrationScan,
  };
}

function containsPotentialSecret(value) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  return POSTGRES_URL_PATTERN.test(serialized) || SENSITIVE_ASSIGNMENT_PATTERN.test(serialized);
}

function assertSecretFree(value, label) {
  if (containsPotentialSecret(value)) {
    throw new BaselineGateError(
      "SECRET_MATERIAL_REJECTED",
      `${label}에 DB URL 또는 비밀값으로 보이는 내용이 포함되어 있습니다.`
    );
  }
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

export function validateDriftEvidence(
  evidence,
  context,
  {
    now = Date.now(),
    maxEvidenceAgeHours = DEFAULT_MAX_EVIDENCE_AGE_HOURS,
  } = {}
) {
  if (!evidence) {
    throw new BaselineGateError(
      "EVIDENCE_REQUIRED",
      "Live PostgreSQL drift 검증 evidence가 필요합니다. prepare와 evidence 모드를 먼저 실행하세요."
    );
  }

  assertSecretFree(evidence, "Drift evidence");

  if (evidence.kind !== EVIDENCE_KIND || evidence.version !== EVIDENCE_VERSION) {
    throw new BaselineGateError("EVIDENCE_FORMAT_INVALID", "지원하지 않는 drift evidence 형식입니다.");
  }
  if (evidence.provider !== "postgresql" || evidence.proof !== "prisma-migrate-diff") {
    throw new BaselineGateError("EVIDENCE_PROOF_INVALID", "PostgreSQL Prisma migrate diff evidence만 허용됩니다.");
  }
  if (evidence.driftExitCode !== 0 || evidence.driftDetected !== false) {
    throw new BaselineGateError("LIVE_DRIFT_DETECTED", "Live DB와 canonical schema의 drift가 0이라는 증거가 아닙니다.");
  }
  if (evidence.canonicalSchemaSha256 !== context.canonicalSchemaSha256) {
    throw new BaselineGateError("SCHEMA_CHANGED_AFTER_EVIDENCE", "Evidence 생성 후 canonical schema가 변경되었습니다.");
  }
  if (evidence.migrationInventorySha256 !== context.inventorySha256) {
    throw new BaselineGateError("MIGRATIONS_CHANGED_AFTER_EVIDENCE", "Evidence 생성 후 migration inventory가 변경되었습니다.");
  }
  if (!isSha256(evidence.driftOutputSha256)) {
    throw new BaselineGateError("DRIFT_OUTPUT_HASH_INVALID", "Drift 출력 SHA-256이 없거나 올바르지 않습니다.");
  }

  const checkedAt = Date.parse(evidence.checkedAt);
  if (!Number.isFinite(checkedAt)) {
    throw new BaselineGateError("EVIDENCE_TIME_INVALID", "Evidence 확인 시간이 올바르지 않습니다.");
  }
  if (checkedAt > now + FUTURE_CLOCK_SKEW_MS) {
    throw new BaselineGateError("EVIDENCE_FROM_FUTURE", "Evidence 확인 시간이 현재보다 미래입니다.");
  }

  const maxAgeMs = maxEvidenceAgeHours * 60 * 60 * 1000;
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0 || now - checkedAt > maxAgeMs) {
    throw new BaselineGateError("EVIDENCE_EXPIRED", "Drift evidence가 만료되었습니다. Live DB를 다시 검증하세요.");
  }

  return evidence;
}

function toCommandPath(file, appRoot) {
  const relativePath = path.relative(appRoot, file).split(path.sep).join("/");
  return relativePath.startsWith("../") ? path.resolve(file) : relativePath;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function assertIsolatedOutputPath(outputDirectory, context) {
  const resolvedOutput = path.resolve(outputDirectory);
  const artifactRoot = path.join(context.appRoot, "migration-artifacts");
  const relativeToArtifactRoot = path.relative(artifactRoot, resolvedOutput);
  if (
    relativeToArtifactRoot === "" ||
    relativeToArtifactRoot.startsWith("..") ||
    path.isAbsolute(relativeToArtifactRoot)
  ) {
    throw new BaselineGateError(
      "ARTIFACT_OUTPUT_PATH_REJECTED",
      "준비 산출물은 app/migration-artifacts 아래의 전용 하위 디렉터리에 있어야 합니다."
    );
  }

  const relativeToMigrations = path.relative(context.migrationsDirectory, resolvedOutput);
  if (relativeToMigrations === "" || (!relativeToMigrations.startsWith("..") && !path.isAbsolute(relativeToMigrations))) {
    throw new BaselineGateError(
      "ACTIVE_MIGRATIONS_OUTPUT_REJECTED",
      "준비 산출물은 활성 prisma/migrations 디렉터리 밖에 있어야 합니다."
    );
  }
  return resolvedOutput;
}

async function writeNewFile(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    await fs.writeFile(file, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error instanceof Error && error.code === "EEXIST") {
      throw new BaselineGateError("ARTIFACT_ALREADY_EXISTS", `기존 산출물을 덮어쓰지 않습니다: ${file}`);
    }
    throw error;
  }
}

function buildEvidenceTemplate(context) {
  return {
    kind: EVIDENCE_KIND,
    version: EVIDENCE_VERSION,
    provider: "postgresql",
    proof: "prisma-migrate-diff",
    driftExitCode: null,
    driftDetected: null,
    checkedAt: null,
    canonicalSchemaSha256: context.canonicalSchemaSha256,
    migrationInventorySha256: context.inventorySha256,
    driftOutputSha256: null,
  };
}

export async function prepareArtifacts(context, outputDirectory) {
  const resolvedOutput = assertIsolatedOutputPath(outputDirectory, context);
  const datasourcePath = path.join(resolvedOutput, "migration-datasource.prisma");
  const introspectionPath = path.join(resolvedOutput, "live-introspection.prisma");
  const driftOutputPath = path.join(resolvedOutput, "live-drift.txt");
  const evidencePath = path.join(resolvedOutput, "live-drift-evidence.json");
  const evidenceTemplatePath = path.join(resolvedOutput, "live-drift-evidence.template.json");
  const baselineOutputPath = path.join(resolvedOutput, "postgresql-baseline.sql");
  const planPath = path.join(resolvedOutput, "baseline-plan.json");
  const commandsPath = path.join(resolvedOutput, "commands.txt");

  const datasourceCommandPath = toCommandPath(datasourcePath, context.appRoot);
  const schemaCommandPath = toCommandPath(context.schemaPath, context.appRoot);
  const introspectionCommandPath = toCommandPath(introspectionPath, context.appRoot);
  const driftCommandPath = toCommandPath(driftOutputPath, context.appRoot);
  const evidenceCommandPath = toCommandPath(evidencePath, context.appRoot);

  const commands = [
    "# MIGRATION_DATABASE_URL must be supplied by the operator environment.",
    `npx prisma db pull --schema ${shellQuote(datasourceCommandPath)} --print > ${shellQuote(introspectionCommandPath)}`,
    `npx prisma migrate diff --from-schema-datasource ${shellQuote(datasourceCommandPath)} --to-schema-datamodel ${shellQuote(schemaCommandPath)} --exit-code > ${shellQuote(driftCommandPath)}`,
    `node scripts/nas/postgres-baseline.mjs evidence --drift-report ${shellQuote(driftCommandPath)} --drift-exit-code 0 --output ${shellQuote(evidenceCommandPath)}`,
  ];

  const plan = {
    kind: "flowpack.postgresql-baseline-preparation",
    version: 1,
    status: "prepared-not-authorized",
    databaseEnvironmentVariable: "MIGRATION_DATABASE_URL",
    canonicalSchemaSha256: context.canonicalSchemaSha256,
    migrationInventorySha256: context.inventorySha256,
    legacySqliteFindings: context.findings,
    artifacts: {
      datasource: toCommandPath(datasourcePath, context.appRoot),
      introspection: introspectionCommandPath,
      driftOutput: driftCommandPath,
      evidence: evidenceCommandPath,
      baselineOutput: toCommandPath(baselineOutputPath, context.appRoot),
    },
    restrictions: [
      "No command in this plan applies a migration or mutates a database.",
      "Baseline generation is not authorized until drift evidence is validated.",
      "Existing prisma/migrations files must not be executed against PostgreSQL while SQLite signatures remain.",
    ],
  };

  const datasource = [
    "// Generated by postgres-baseline.mjs prepare. Contains no credentials.",
    "datasource db {",
    "  provider = \"postgresql\"",
    "  url      = env(\"MIGRATION_DATABASE_URL\")",
    "}",
    "",
  ].join("\n");

  assertSecretFree({ commands, plan, datasource }, "Prepared baseline artifacts");

  await writeNewFile(datasourcePath, datasource);
  await writeNewFile(evidenceTemplatePath, `${JSON.stringify(buildEvidenceTemplate(context), null, 2)}\n`);
  await writeNewFile(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  await writeNewFile(commandsPath, `${commands.join("\n")}\n`);

  return { plan, planPath, commandsPath, evidenceTemplatePath };
}

export async function recordDriftEvidence(
  context,
  { driftReportPath, driftExitCode, outputPath, now = Date.now() }
) {
  if (driftExitCode !== 0) {
    throw new BaselineGateError("LIVE_DRIFT_DETECTED", "Prisma migrate diff 종료 코드가 0이 아닙니다.");
  }

  const report = await fs.readFile(driftReportPath, "utf8");
  assertSecretFree(report, "Drift report");
  const normalizedReport = report.trim();
  if (!/^No difference detected\.?$/i.test(normalizedReport)) {
    throw new BaselineGateError(
      "DRIFT_REPORT_NOT_CLEAN",
      "Drift report가 Prisma의 'No difference detected' 결과가 아닙니다."
    );
  }

  const evidence = {
    kind: EVIDENCE_KIND,
    version: EVIDENCE_VERSION,
    provider: "postgresql",
    proof: "prisma-migrate-diff",
    driftExitCode: 0,
    driftDetected: false,
    checkedAt: new Date(now).toISOString(),
    canonicalSchemaSha256: context.canonicalSchemaSha256,
    migrationInventorySha256: context.inventorySha256,
    driftOutputSha256: sha256(report),
  };

  validateDriftEvidence(evidence, context, { now });
  assertIsolatedOutputPath(path.dirname(outputPath), context);
  await writeNewFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  return evidence;
}

export async function authorizeBaselineGeneration(
  context,
  {
    evidence,
    outputDirectory,
    now = Date.now(),
    maxEvidenceAgeHours = DEFAULT_MAX_EVIDENCE_AGE_HOURS,
  }
) {
  validateDriftEvidence(evidence, context, { now, maxEvidenceAgeHours });
  const resolvedOutput = assertIsolatedOutputPath(outputDirectory, context);
  const baselineOutputPath = path.join(resolvedOutput, "postgresql-baseline.sql");
  const commandPath = path.join(resolvedOutput, "baseline-generate-command.txt");
  const schemaCommandPath = toCommandPath(context.schemaPath, context.appRoot);
  const baselineCommandPath = toCommandPath(baselineOutputPath, context.appRoot);
  const command = `npx prisma migrate diff --from-empty --to-schema-datamodel ${shellQuote(schemaCommandPath)} --script --output ${shellQuote(baselineCommandPath)}`;

  assertSecretFree(command, "Baseline generation command");
  await writeNewFile(commandPath, `${command}\n`);

  return {
    commandPath,
    baselineOutputPath,
    legacySqliteFindings: context.findings,
    databaseMutationPerformed: false,
  };
}

export function refuseDirectDatabaseMutation(evidence, context, options = {}) {
  validateDriftEvidence(evidence, context, options);
  throw new BaselineGateError(
    "DIRECT_DATABASE_MUTATION_DISABLED",
    "이 안전 게이트는 baseline SQL을 생성하거나 DB에 적용하지 않습니다. 승인된 command artifact를 별도 검토하세요."
  );
}

async function readEvidence(evidencePath) {
  if (!evidencePath) return null;
  const content = await fs.readFile(evidencePath, "utf8");
  assertSecretFree(content, "Drift evidence file");
  try {
    return JSON.parse(content);
  } catch {
    throw new BaselineGateError("EVIDENCE_FORMAT_INVALID", "Drift evidence JSON을 읽을 수 없습니다.");
  }
}

function parseArguments(argv) {
  const mode = argv[0] ?? "check";
  const options = {};
  const allowed = new Set([
    "--evidence",
    "--output",
    "--schema",
    "--migrations",
    "--drift-report",
    "--drift-exit-code",
    "--max-evidence-age-hours",
  ]);

  for (let index = 1; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(name) || value === undefined) {
      throw new BaselineGateError("ARGUMENT_INVALID", `지원하지 않거나 값이 없는 인수입니다: ${name ?? ""}`);
    }
    options[name.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }

  return { mode, options };
}

function printJson(value) {
  const output = `${JSON.stringify(value, null, 2)}\n`;
  assertSecretFree(output, "CLI output");
  process.stdout.write(output);
}

export async function runCli(argv = process.argv.slice(2)) {
  const { mode, options } = parseArguments(argv);
  const appRoot = defaultAppRoot;
  const context = await createGateContext({
    appRoot,
    schemaPath: options.schema ? path.resolve(options.schema) : undefined,
    migrationsDirectory: options.migrations ? path.resolve(options.migrations) : undefined,
  });
  const defaultOutput = path.join(appRoot, "migration-artifacts/postgres-baseline");

  if (mode === "prepare") {
    const result = await prepareArtifacts(context, options.output ? path.resolve(options.output) : defaultOutput);
    printJson({
      success: true,
      status: "prepared-not-authorized",
      sqliteFindings: context.findings,
      plan: toCommandPath(result.planPath, appRoot),
      commands: toCommandPath(result.commandsPath, appRoot),
    });
    return 0;
  }

  if (mode === "evidence") {
    if (!options.driftReport || options.driftExitCode === undefined) {
      throw new BaselineGateError("ARGUMENT_INVALID", "evidence 모드에는 drift report와 exit code가 필요합니다.");
    }
    const outputPath = options.output ? path.resolve(options.output) : path.join(defaultOutput, "live-drift-evidence.json");
    const evidence = await recordDriftEvidence(context, {
      driftReportPath: path.resolve(options.driftReport),
      driftExitCode: Number(options.driftExitCode),
      outputPath,
    });
    printJson({ success: true, evidence });
    return 0;
  }

  const evidence = await readEvidence(options.evidence);
  const maxEvidenceAgeHours = options.maxEvidenceAgeHours
    ? Number(options.maxEvidenceAgeHours)
    : DEFAULT_MAX_EVIDENCE_AGE_HOURS;

  if (mode === "authorize") {
    const result = await authorizeBaselineGeneration(context, {
      evidence,
      outputDirectory: options.output ? path.resolve(options.output) : defaultOutput,
      now: Date.now(),
      maxEvidenceAgeHours,
    });
    printJson({
      success: true,
      status: "generation-command-authorized",
      databaseMutationPerformed: false,
      sqliteFindings: result.legacySqliteFindings,
      command: toCommandPath(result.commandPath, appRoot),
    });
    return 0;
  }

  if (mode === "generate" || mode === "apply") {
    refuseDirectDatabaseMutation(evidence, context, { maxEvidenceAgeHours });
  }

  if (mode !== "check") {
    throw new BaselineGateError("MODE_INVALID", `지원하지 않는 모드입니다: ${mode}`);
  }

  try {
    validateDriftEvidence(evidence, context, { maxEvidenceAgeHours });
  } catch (error) {
    if (!(error instanceof BaselineGateError)) throw error;
    printJson({
      success: false,
      status: "blocked",
      blockers: [error.code],
      readyForBaselineGeneration: false,
      readyForMigrationApply: false,
      sqliteFindings: context.findings,
    });
    return 2;
  }
  const readyForMigrationApply = context.findings.length === 0;
  printJson({
    success: readyForMigrationApply,
    status: readyForMigrationApply ? "ready" : "blocked-legacy-sqlite-migrations",
    readyForBaselineGeneration: true,
    readyForMigrationApply,
    sqliteFindings: context.findings,
  });
  return readyForMigrationApply ? 0 : 2;
}

async function main() {
  try {
    process.exitCode = await runCli();
  } catch (error) {
    const code = error instanceof BaselineGateError ? error.code : "BASELINE_GATE_FAILED";
    const message = error instanceof Error ? error.message : "Baseline gate failed.";
    printJson({ success: false, code, error: message });
    process.exitCode = 1;
  }
}

const isDirectExecution = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  : false;

if (isDirectExecution) {
  await main();
}
