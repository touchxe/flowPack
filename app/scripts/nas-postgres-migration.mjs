import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  constants,
  existsSync,
  lstatSync,
  openSync,
  closeSync,
  readSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

import { compareIntegrityEvidence } from './nas-database-artifact.mjs';

const FILE_MODE = 0o600;
const DIRECTORY_MODE = 0o700;
const MAX_OUTPUT = 64 * 1024 * 1024;
const IMAGE_PATTERN = /^postgres:([1-9][0-9]*)\.([0-9]+)-bookworm$/;
const PROJECT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*-nas$/;
const MIGRATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const QUALIFIED_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]*\.[A-Za-z_][A-Za-z0-9_$]*$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
export const DEFAULT_SCHEMA_ALLOWLIST = Object.freeze(['public']);

class PostgresMigrationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PostgresMigrationError';
  }
}

function fail(message) {
  throw new PostgresMigrationError(message);
}

function validateIdentity(projectId, migrationId) {
  if (!PROJECT_ID_PATTERN.test(projectId) || !MIGRATION_ID_PATTERN.test(migrationId)) {
    fail('PostgreSQL migration identity is invalid');
  }
}

function validateImage(image, message) {
  const match = IMAGE_PATTERN.exec(image);
  if (!match) fail(message);
  const major = Number(match[1]);
  if (!Number.isSafeInteger(major) || major < 12 || major > 99) fail(message);
  return { image, major };
}

function assertPrivateDirectory(path, message) {
  try {
    const metadata = lstatSync(path);
    if (
      metadata.isSymbolicLink() ||
      !metadata.isDirectory() ||
      (metadata.mode & 0o777) !== DIRECTORY_MODE
    ) {
      fail(message);
    }
  } catch (error) {
    if (error instanceof PostgresMigrationError) throw error;
    fail(message);
  }
}

function assertPrivateFile(path, message) {
  try {
    const metadata = lstatSync(path);
    if (
      metadata.isSymbolicLink() ||
      !metadata.isFile() ||
      (metadata.mode & 0o777) !== FILE_MODE
    ) {
      fail(message);
    }
  } catch (error) {
    if (error instanceof PostgresMigrationError) throw error;
    fail(message);
  }
}

function validateMountPath(path, message) {
  if (
    typeof path !== 'string' ||
    !isAbsolute(path) ||
    resolve(path) !== path ||
    !/^[A-Za-z0-9_./-]+$/.test(path) ||
    path.includes('..') ||
    path.includes('//')
  ) {
    fail(message);
  }
  return path;
}

function defaultRun(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    encoding: 'utf8',
    input: options.input,
    maxBuffer: MAX_OUTPUT,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error,
  };
}

function successful(result, message) {
  if (
    !result ||
    result.error ||
    result.status !== 0 ||
    typeof result.stdout !== 'string' ||
    typeof result.stderr !== 'string'
  ) {
    fail(message);
  }
  return result.stdout;
}

function hashString(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function hashFile(path) {
  const hash = createHash('sha256');
  const descriptor = openSync(path, constants.O_RDONLY);
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    while (true) {
      const bytesRead = readSync(descriptor, buffer, 0, buffer.byteLength, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    closeSync(descriptor);
  }
  return hash.digest('hex');
}

function quoteIdentifier(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(value)) {
    fail('PostgreSQL inventory metadata is invalid');
  }
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteLiteral(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f\r\n]/u.test(value)) {
    fail('PostgreSQL inventory metadata is invalid');
  }
  return `'${value.replaceAll("'", "''")}'`;
}

function splitQualifiedName(value) {
  if (typeof value !== 'string' || !QUALIFIED_NAME_PATTERN.test(value)) {
    fail('PostgreSQL inventory metadata is invalid');
  }
  return value.split('.');
}

const METADATA_SQL = String.raw`
WITH user_schemas AS (
  SELECT oid, nspname FROM pg_namespace
  WHERE nspname !~ '^pg_' AND nspname <> 'information_schema'
), object_inventory AS (
  SELECT concat_ws('|', 'column', table_schema, table_name, ordinal_position::text,
    column_name, data_type, is_nullable, coalesce(column_default, '')) AS definition
  FROM information_schema.columns
  WHERE table_schema IN (SELECT nspname FROM user_schemas)
    AND NOT (table_schema = 'public' AND table_name = '_prisma_migrations')
  UNION ALL
  SELECT concat_ws('|', 'constraint', ns.nspname, rel.relname, con.conname,
    pg_get_constraintdef(con.oid, true))
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  WHERE ns.oid IN (SELECT oid FROM user_schemas)
    AND NOT (ns.nspname = 'public' AND rel.relname = '_prisma_migrations')
  UNION ALL
  SELECT concat_ws('|', 'index', schemaname, tablename, indexname, indexdef)
  FROM pg_indexes
  WHERE schemaname IN (SELECT nspname FROM user_schemas)
    AND NOT (schemaname = 'public' AND tablename = '_prisma_migrations')
  UNION ALL
  SELECT concat_ws('|', 'trigger', ns.nspname, rel.relname, trg.tgname,
    pg_get_triggerdef(trg.oid, true))
  FROM pg_trigger trg
  JOIN pg_class rel ON rel.oid = trg.tgrelid
  JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  WHERE ns.oid IN (SELECT oid FROM user_schemas)
    AND NOT (ns.nspname = 'public' AND rel.relname = '_prisma_migrations')
    AND NOT trg.tgisinternal
  UNION ALL
  SELECT concat_ws('|', 'enum', ns.nspname, typ.typname, enum.enumsortorder::text,
    enum.enumlabel)
  FROM pg_enum enum
  JOIN pg_type typ ON typ.oid = enum.enumtypid
  JOIN pg_namespace ns ON ns.oid = typ.typnamespace
  WHERE ns.oid IN (SELECT oid FROM user_schemas)
  UNION ALL
  SELECT concat_ws('|', 'relation', ns.nspname, rel.relname, rel.relkind,
    rel.relpersistence, rel.relrowsecurity::text, rel.relforcerowsecurity::text,
    coalesce(pg_get_partkeydef(rel.oid), ''))
  FROM pg_class rel
  JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  WHERE ns.oid IN (SELECT oid FROM user_schemas) AND rel.relkind IN ('r', 'p', 'f')
    AND NOT (ns.nspname = 'public' AND rel.relname = '_prisma_migrations')
  UNION ALL
  SELECT concat_ws('|', 'view', ns.nspname, rel.relname, rel.relkind,
    pg_get_viewdef(rel.oid, true))
  FROM pg_class rel
  JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  WHERE ns.oid IN (SELECT oid FROM user_schemas) AND rel.relkind IN ('v', 'm')
    AND NOT (ns.nspname = 'public' AND rel.relname = '_prisma_migrations')
  UNION ALL
  SELECT concat_ws('|', 'routine', ns.nspname, proc.proname,
    pg_get_function_identity_arguments(proc.oid), proc.prokind, lang.lanname,
    proc.provolatile, proc.prosecdef::text, proc.proleakproof::text,
    proc.proparallel, coalesce(array_to_string(proc.proconfig, ','), ''),
    CASE WHEN proc.prokind IN ('f', 'p') THEN pg_get_functiondef(proc.oid)
      ELSE proc.prosrc END)
  FROM pg_proc proc
  JOIN pg_namespace ns ON ns.oid = proc.pronamespace
  JOIN pg_language lang ON lang.oid = proc.prolang
  WHERE ns.oid IN (SELECT oid FROM user_schemas)
  UNION ALL
  SELECT concat_ws('|', 'policy', ns.nspname, rel.relname, policy.polname,
    policy.polpermissive::text, policy.polcmd, policy.polroles::text,
    coalesce(pg_get_expr(policy.polqual, policy.polrelid, true), ''),
    coalesce(pg_get_expr(policy.polwithcheck, policy.polrelid, true), ''))
  FROM pg_policy policy
  JOIN pg_class rel ON rel.oid = policy.polrelid
  JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  WHERE ns.oid IN (SELECT oid FROM user_schemas)
    AND NOT (ns.nspname = 'public' AND rel.relname = '_prisma_migrations')
  UNION ALL
  SELECT concat_ws('|', 'rule', ns.nspname, rel.relname, rule.rulename,
    pg_get_ruledef(rule.oid, true))
  FROM pg_rewrite rule
  JOIN pg_class rel ON rel.oid = rule.ev_class
  JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  WHERE ns.oid IN (SELECT oid FROM user_schemas) AND rule.rulename <> '_RETURN'
    AND NOT (ns.nspname = 'public' AND rel.relname = '_prisma_migrations')
  UNION ALL
  SELECT concat_ws('|', 'type', ns.nspname, typ.typname, typ.typtype,
    typ.typcategory, typ.typnotnull::text, coalesce(typ.typdefault, ''),
    coalesce(format_type(typ.typbasetype, typ.typtypmod), ''))
  FROM pg_type typ
  JOIN pg_namespace ns ON ns.oid = typ.typnamespace
  WHERE ns.oid IN (SELECT oid FROM user_schemas)
    AND typ.typtype IN ('d', 'c', 'r', 'm', 'e') AND typ.typisdefined
    AND NOT (
      ns.nspname = 'public' AND typ.typname = '_prisma_migrations'
      AND EXISTS (
        SELECT 1 FROM pg_class baseline_rel
        WHERE baseline_rel.oid = typ.typrelid AND baseline_rel.relkind IN ('r', 'p')
      )
    )
  UNION ALL
  SELECT concat_ws('|', 'collation', ns.nspname, coll.collname,
    coll.collprovider, coll.collisdeterministic::text,
    coalesce(coll.collcollate, ''), coalesce(coll.collctype, ''))
  FROM pg_collation coll
  JOIN pg_namespace ns ON ns.oid = coll.collnamespace
  WHERE ns.oid IN (SELECT oid FROM user_schemas)
  UNION ALL
  SELECT concat_ws('|', 'extension', ext.extname, ext.extversion, ns.nspname)
  FROM pg_extension ext
  JOIN pg_namespace ns ON ns.oid = ext.extnamespace
)
SELECT json_build_object(
  'serverVersionNum', current_setting('server_version_num')::integer,
  'databaseEncoding', (
    SELECT pg_encoding_to_char(encoding) FROM pg_database WHERE datname = current_database()
  ),
  'databaseCollation', (
    SELECT datcollate FROM pg_database WHERE datname = current_database()
  ),
  'databaseCtype', (
    SELECT datctype FROM pg_database WHERE datname = current_database()
  ),
  'schemas', COALESCE((
    SELECT json_agg(nspname ORDER BY nspname)
    FROM user_schemas
  ), '[]'::json),
  'extensions', COALESCE((
    SELECT json_agg(extname ORDER BY extname) FROM pg_extension
  ), '[]'::json),
  'tables', COALESCE((
    SELECT json_agg(format('%s.%s', ns.nspname, rel.relname) ORDER BY ns.nspname, rel.relname)
    FROM pg_class rel
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.oid IN (SELECT oid FROM user_schemas) AND rel.relkind IN ('r', 'p', 'f')
      AND NOT (ns.nspname = 'public' AND rel.relname = '_prisma_migrations')
  ), '[]'::json),
  'sequences', COALESCE((
    SELECT json_agg(format('%s.%s', ns.nspname, rel.relname) ORDER BY ns.nspname, rel.relname)
    FROM pg_class rel
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.oid IN (SELECT oid FROM user_schemas) AND rel.relkind = 'S'
  ), '[]'::json),
  'largeObjects', COALESCE((
    SELECT json_agg(oid::text ORDER BY oid) FROM pg_largeobject_metadata
  ), '[]'::json),
  'objects', COALESCE((
    SELECT json_agg(definition ORDER BY definition) FROM object_inventory
  ), '[]'::json)
)::text;
`;

function validateSchemaAllowlist(value) {
  if (
    !Array.isArray(value) || value.length === 0 ||
    value.some((schema) => typeof schema !== 'string' || !/^[A-Za-z_][A-Za-z0-9_$]*$/.test(schema)) ||
    new Set(value).size !== value.length
  ) fail('PostgreSQL schema allowlist is invalid');
  return [...value].sort();
}

function parseSingleJsonLine(output, message) {
  const lines = output.split('\n').filter((line) => line !== '');
  if (lines.length !== 1) fail(message);
  try {
    return JSON.parse(lines[0]);
  } catch {
    fail(message);
  }
}

function validateMetadata(metadata, schemaAllowlist = DEFAULT_SCHEMA_ALLOWLIST) {
  const allowedSchemas = validateSchemaAllowlist(schemaAllowlist);
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    Array.isArray(metadata) ||
    Object.keys(metadata).sort().join('\n') !==
      ['databaseCollation', 'databaseCtype', 'databaseEncoding', 'extensions', 'largeObjects', 'objects', 'schemas', 'sequences', 'serverVersionNum', 'tables']
        .sort()
        .join('\n') ||
    !Number.isSafeInteger(metadata.serverVersionNum) ||
    metadata.serverVersionNum < 120000 ||
    !Array.isArray(metadata.schemas) ||
    typeof metadata.databaseEncoding !== 'string' ||
    typeof metadata.databaseCollation !== 'string' ||
    typeof metadata.databaseCtype !== 'string' ||
    /[\u0000\r\n]/u.test(metadata.databaseEncoding) ||
    /[\u0000\r\n]/u.test(metadata.databaseCollation) ||
    /[\u0000\r\n]/u.test(metadata.databaseCtype) ||
    !Array.isArray(metadata.extensions) ||
    !Array.isArray(metadata.tables) ||
    !Array.isArray(metadata.sequences) ||
    !Array.isArray(metadata.largeObjects) ||
    !Array.isArray(metadata.objects) ||
    metadata.extensions.some((value) => typeof value !== 'string') ||
    metadata.tables.some((value) => !QUALIFIED_NAME_PATTERN.test(value)) ||
    metadata.sequences.some((value) => !QUALIFIED_NAME_PATTERN.test(value)) ||
    metadata.largeObjects.some((value) => typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) ||
    metadata.objects.some(
      (value) => typeof value !== 'string' || /\u0000/u.test(value),
    )
  ) {
    fail('PostgreSQL inventory metadata is invalid');
  }
  if (JSON.stringify(metadata.schemas) !== JSON.stringify(allowedSchemas)) {
    fail('PostgreSQL schema allowlist mismatch');
  }
  for (const list of [metadata.extensions, metadata.tables, metadata.sequences, metadata.largeObjects, metadata.objects]) {
    if (new Set(list).size !== list.length) fail('PostgreSQL inventory metadata is invalid');
  }
  for (const qualifiedName of [...metadata.tables, ...metadata.sequences]) {
    if (!allowedSchemas.includes(qualifiedName.split('.')[0])) fail('PostgreSQL schema allowlist mismatch');
  }
  return metadata;
}

function buildDataEvidenceSql(metadata) {
  const statements = [];
  for (const qualifiedName of metadata.tables) {
    const [schema, table] = splitQualifiedName(qualifiedName);
    const relation = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
    statements.push(`
SELECT json_build_object(
  'kind', 'table',
  'name', ${quoteLiteral(qualifiedName)},
  'rowCount', count(*)::bigint,
  'dataSha256', encode(sha256(convert_to(COALESCE(string_agg(row_hash, '' ORDER BY row_hash), ''), 'UTF8')), 'hex')
)::text
FROM (
  SELECT encode(sha256(convert_to(row_to_json(source_row)::text, 'UTF8')), 'hex') AS row_hash
  FROM ${relation} AS source_row
) AS hashed_rows;`);
  }
  for (const qualifiedName of metadata.sequences) {
    const [schema, sequence] = splitQualifiedName(qualifiedName);
    const relation = `${quoteIdentifier(schema)}.${quoteIdentifier(sequence)}`;
    statements.push(`
SELECT json_build_object(
  'kind', 'sequence',
  'name', ${quoteLiteral(qualifiedName)},
  'lastValue', last_value::text,
  'isCalled', is_called
)::text FROM ${relation};`);
  }
  for (const oid of metadata.largeObjects) {
    statements.push(`
SELECT json_build_object(
  'kind', 'large-object',
  'oid', ${quoteLiteral(oid)},
  'bytes', octet_length(lo_get(${oid}::oid))::bigint,
  'dataSha256', encode(sha256(lo_get(${oid}::oid)), 'hex')
)::text;`);
  }
  return `${statements.join('\n')}\n`;
}

function parseEvidenceLines(output, metadata) {
  const records = [];
  try {
    for (const line of output.split('\n')) {
      if (line === '') continue;
      records.push(JSON.parse(line));
    }
  } catch {
    fail('PostgreSQL data integrity evidence is invalid');
  }
  if (records.length !== metadata.tables.length + metadata.sequences.length + metadata.largeObjects.length) {
    fail('PostgreSQL data integrity evidence is invalid');
  }
  const tables = [];
  const sequences = [];
  const largeObjects = [];
  const names = new Set();
  const largeObjectOids = new Set();
  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      fail('PostgreSQL data integrity evidence is invalid');
    }
    if (
      record.kind === 'table' &&
      Object.keys(record).sort().join('\n') ===
        ['kind', 'name', 'rowCount', 'dataSha256'].sort().join('\n') &&
      metadata.tables.includes(record.name) &&
      !names.has(record.name) &&
      Number.isSafeInteger(record.rowCount) &&
      record.rowCount >= 0 &&
      SHA256_PATTERN.test(record.dataSha256)
    ) {
      names.add(record.name);
      tables.push({
        name: record.name,
        rowCount: record.rowCount,
        dataSha256: record.dataSha256,
      });
      continue;
    }
    if (
      record.kind === 'sequence' &&
      Object.keys(record).sort().join('\n') ===
        ['kind', 'name', 'lastValue', 'isCalled'].sort().join('\n') &&
      metadata.sequences.includes(record.name) &&
      !names.has(record.name) &&
      typeof record.lastValue === 'string' &&
      /^-?[0-9]+$/.test(record.lastValue) &&
      typeof record.isCalled === 'boolean'
    ) {
      names.add(record.name);
      sequences.push({
        name: record.name,
        lastValue: record.lastValue,
        isCalled: record.isCalled,
      });
      continue;
    }
    if (
      record.kind === 'large-object' &&
      Object.keys(record).sort().join('\n') === ['kind', 'oid', 'bytes', 'dataSha256'].sort().join('\n') &&
      metadata.largeObjects.includes(record.oid) && !largeObjectOids.has(record.oid) &&
      Number.isSafeInteger(record.bytes) && record.bytes >= 0 && SHA256_PATTERN.test(record.dataSha256)
    ) {
      largeObjectOids.add(record.oid);
      largeObjects.push({ oid: record.oid, bytes: record.bytes, dataSha256: record.dataSha256 });
      continue;
    }
    fail('PostgreSQL data integrity evidence is invalid');
  }
  tables.sort((left, right) => left.name.localeCompare(right.name));
  sequences.sort((left, right) => left.name.localeCompare(right.name));
  largeObjects.sort((left, right) => BigInt(left.oid) < BigInt(right.oid) ? -1 : 1);
  return { tables, sequences, largeObjects };
}

export function extractPinnedTargetPostgres(composeText) {
  if (typeof composeText !== 'string' || /\r|\u0000/u.test(composeText)) {
    fail('target PostgreSQL image is invalid');
  }
  const matches = [...composeText.matchAll(/^    image: (postgres:[^\s]+)$/gm)];
  if (matches.length !== 1) fail('target PostgreSQL image is invalid');
  return validateImage(matches[0][1], 'target PostgreSQL image is invalid');
}

export function buildSourcePsqlDockerInvocation({ clientImage, serviceDirectory }) {
  validateImage(clientImage, 'PostgreSQL client image is invalid');
  validateMountPath(serviceDirectory, 'private libpq service directory is invalid');
  return {
    executable: 'docker',
    args: [
      'run',
      '--rm',
      '-i',
      '--network',
      'bridge',
      '--mount',
      `type=bind,src=${serviceDirectory},dst=/run/nas-secrets,readonly`,
      '--env',
      'PGSERVICEFILE=/run/nas-secrets/pg_service.conf',
      '--env',
      'PGPASSFILE=/run/nas-secrets/pgpass',
      clientImage,
      'psql',
      '-X',
      '-q',
      '-A',
      '-t',
      '-v',
      'ON_ERROR_STOP=1',
      '--dbname',
      'service=source',
      '--file',
      '-',
    ],
  };
}

export function createSourceQuery({ clientImage, serviceDirectory, run = defaultRun }) {
  assertPrivateDirectory(serviceDirectory, 'private libpq service directory is invalid');
  assertPrivateFile(
    join(serviceDirectory, 'pg_service.conf'),
    'private libpq service file is invalid',
  );
  assertPrivateFile(
    join(serviceDirectory, 'pgpass'),
    'private libpq password file is invalid',
  );
  const invocation = buildSourcePsqlDockerInvocation({ clientImage, serviceDirectory });
  return async (sql) =>
    successful(
      run(invocation.executable, invocation.args, { input: sql }),
      'source PostgreSQL query failed',
    );
}

export async function collectPostgresIntegrityEvidence({ projectId, migrationId, query, schemaAllowlist = DEFAULT_SCHEMA_ALLOWLIST }) {
  validateIdentity(projectId, migrationId);
  if (typeof query !== 'function') fail('PostgreSQL inventory query is invalid');
  const metadata = validateMetadata(
    parseSingleJsonLine(await query(METADATA_SQL), 'PostgreSQL inventory metadata is invalid'),
    schemaAllowlist,
  );
  const { tables, sequences, largeObjects } = parseEvidenceLines(
    await query(buildDataEvidenceSql(metadata)),
    metadata,
  );
  const result = {
    schemaVersion: 1,
    database: Object.freeze({ encoding: metadata.databaseEncoding, collate: metadata.databaseCollation, ctype: metadata.databaseCtype }),
    schemas: [...metadata.schemas],
    extensions: [...metadata.extensions].sort(),
    objectsSha256: hashString(`${metadata.objects.join('\n')}\n`),
    tables,
    sequences,
    largeObjects,
  };
  Object.defineProperty(result, 'serverMajor', {
    value: Math.floor(metadata.serverVersionNum / 10000),
  });
  return Object.freeze(result);
}

function userArgument() {
  if (typeof process.getuid !== 'function' || typeof process.getgid !== 'function') return [];
  return ['--user', `${process.getuid()}:${process.getgid()}`];
}

export function createCustomFormatDump({
  projectId,
  migrationId,
  clientImage,
  serviceDirectory,
  artifactDirectory,
  schemaAllowlist = DEFAULT_SCHEMA_ALLOWLIST,
  run = defaultRun,
}) {
  validateIdentity(projectId, migrationId);
  validateImage(clientImage, 'PostgreSQL client image is invalid');
  validateMountPath(serviceDirectory, 'private libpq service directory is invalid');
  validateMountPath(artifactDirectory, 'database artifact directory is invalid');
  assertPrivateDirectory(serviceDirectory, 'private libpq service directory is invalid');
  assertPrivateFile(
    join(serviceDirectory, 'pg_service.conf'),
    'private libpq service file is invalid',
  );
  assertPrivateFile(
    join(serviceDirectory, 'pgpass'),
    'private libpq password file is invalid',
  );
  assertPrivateDirectory(artifactDirectory, 'database artifact directory is invalid');
  const allowedSchemas = validateSchemaAllowlist(schemaAllowlist);
  const dumpPath = join(artifactDirectory, 'source.dump');
  if (existsSync(dumpPath)) fail('database dump destination is not empty');
  const args = [
    'run',
    '--rm',
    '--network',
    'bridge',
    ...userArgument(),
    '--mount',
    `type=bind,src=${serviceDirectory},dst=/run/nas-secrets,readonly`,
    '--mount',
    `type=bind,src=${artifactDirectory},dst=/artifacts`,
    '--env',
    'PGSERVICEFILE=/run/nas-secrets/pg_service.conf',
    '--env',
    'PGPASSFILE=/run/nas-secrets/pgpass',
    clientImage,
    'pg_dump',
    '--dbname=service=source',
    '--format=custom',
    '--compress=9',
    '--no-owner',
    '--no-acl',
    ...allowedSchemas.map((schema) => `--schema=${schema}`),
    '--exclude-table=public._prisma_migrations',
    '--blobs',
    '--file=/artifacts/source.dump',
  ];
  successful(run('docker', args), 'source PostgreSQL dump failed');
  if (!existsSync(dumpPath) || statSync(dumpPath).size <= 0) {
    fail('source PostgreSQL dump failed');
  }
  chmodSync(dumpPath, FILE_MODE);
  assertPrivateFile(dumpPath, 'source PostgreSQL dump failed');
  return { ok: true, dumpBytes: statSync(dumpPath).size, dumpSha256: hashFile(dumpPath) };
}

export function verifyCustomFormatDump({
  clientImage,
  artifactDirectory,
  run = defaultRun,
}) {
  validateImage(clientImage, 'PostgreSQL client image is invalid');
  validateMountPath(artifactDirectory, 'database artifact directory is invalid');
  assertPrivateDirectory(artifactDirectory, 'database artifact directory is invalid');
  const dumpPath = join(artifactDirectory, 'source.dump');
  const listPath = join(artifactDirectory, 'source.dump.list');
  assertPrivateFile(dumpPath, 'database dump is invalid');
  if (existsSync(listPath)) fail('database dump list destination is not empty');
  const stdout = successful(
    run('docker', [
      'run',
      '--rm',
      '--network',
      'none',
      '--mount',
      `type=bind,src=${artifactDirectory},dst=/artifacts,readonly`,
      clientImage,
      'pg_restore',
      '--list',
      '/artifacts/source.dump',
    ]),
    'database dump verification failed',
  );
  if (stdout.length === 0 || /postgres(?:ql)?:\/\//i.test(stdout) || /\u0000/u.test(stdout)) {
    fail('database dump verification failed');
  }
  try {
    writeFileSync(listPath, stdout.endsWith('\n') ? stdout : `${stdout}\n`, {
      flag: 'wx',
      mode: FILE_MODE,
    });
    chmodSync(listPath, FILE_MODE);
  } catch {
    fail('database dump verification failed');
  }
  return { ok: true, listSha256: hashFile(listPath) };
}

function destinationQuery(containerName, run) {
  return async (sql) =>
    successful(
      run(
        'docker',
        [
          'exec',
          '-i',
          containerName,
          'psql',
          '-U',
          'postgres',
          '-d',
          'scratch',
          '-X',
          '-q',
          '-A',
          '-t',
          '-v',
          'ON_ERROR_STOP=1',
          '--file',
          '-',
        ],
        { input: sql },
      ),
      'scratch PostgreSQL query failed',
    );
}

export async function runScratchRestoreDrill({
  projectId,
  migrationId,
  targetImage,
  artifactDirectory,
  sourceServerMajor,
  sourceEvidence,
  run = defaultRun,
  collectDestinationEvidence,
  wait = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds)),
}) {
  validateIdentity(projectId, migrationId);
  const target = validateImage(targetImage, 'target PostgreSQL image is invalid');
  if (
    !Number.isSafeInteger(sourceServerMajor) ||
    sourceServerMajor < 12 ||
    sourceServerMajor > 99
  ) {
    fail('source PostgreSQL version is invalid');
  }
  if (sourceServerMajor > target.major) {
    fail('source PostgreSQL is newer than target');
  }
  validateMountPath(artifactDirectory, 'database artifact directory is invalid');
  const containerName = `${projectId.replace(/-nas$/, '')}-restore-${migrationId
    .replaceAll('-', '')
    .slice(0, 12)}`;
  let started = false;
  try {
    successful(
      run('docker', [
        'run',
        '--detach',
        '--rm',
        '--network',
        'none',
        '--name',
        containerName,
        '--env',
        'POSTGRES_HOST_AUTH_METHOD=trust',
        '--env',
        'POSTGRES_DB=scratch',
        '--mount',
        `type=bind,src=${artifactDirectory},dst=/artifacts,readonly`,
        target.image,
      ]),
      'scratch PostgreSQL start failed',
    );
    started = true;
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const result = run('docker', [
        'exec',
        containerName,
        'pg_isready',
        '-U',
        'postgres',
        '-d',
        'scratch',
      ]);
      if (result && result.status === 0) {
        ready = true;
        break;
      }
      await wait(1000);
    }
    if (!ready) fail('scratch PostgreSQL readiness failed');
    successful(
      run('docker', [
        'exec',
        containerName,
        'pg_restore',
        '-U',
        'postgres',
        '-d',
        'scratch',
        '--single-transaction',
        '--exit-on-error',
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-acl',
        '/artifacts/source.dump',
      ]),
      'scratch PostgreSQL restore failed',
    );
    const destinationEvidence = collectDestinationEvidence
      ? await collectDestinationEvidence({ containerName })
      : await collectPostgresIntegrityEvidence({
          projectId,
          migrationId,
          query: destinationQuery(containerName, run),
        });
    const comparison = compareIntegrityEvidence(sourceEvidence, destinationEvidence);
    if (!comparison.ok) fail('scratch PostgreSQL integrity comparison failed');
    return comparison;
  } finally {
    if (started) run('docker', ['rm', '-f', containerName]);
  }
}
