import assert from 'node:assert/strict';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildSourcePsqlDockerInvocation,
  collectPostgresIntegrityEvidence,
  createCustomFormatDump,
  extractPinnedTargetPostgres,
  runScratchRestoreDrill,
  verifyCustomFormatDump,
} from './nas-postgres-migration.mjs';

const PROJECT_ID = 'flowpack-nas';
const MIGRATION_ID = '11111111-2222-4333-8444-555555555555';

function privateDirectory(prefix) {
  const path = mkdtempSync(join(tmpdir(), prefix));
  chmodSync(path, 0o700);
  return path;
}

function baseMetadata() {
  return {
    serverVersionNum: 160010,
    databaseEncoding: 'UTF8',
    databaseCollation: 'C.UTF-8',
    databaseCtype: 'C.UTF-8',
    schemas: ['public'],
    extensions: ['plpgsql'],
    tables: ['public.accounts', 'public.documents'],
    sequences: ['public.documents_id_seq'],
    largeObjects: [],
    objects: [
      'column|public.accounts|1|id|uuid|NO|',
      'column|public.documents|1|id|bigint|NO|',
      'constraint|public.documents|documents_pkey|PRIMARY KEY (id)',
      'index|public.documents|documents_pkey|CREATE UNIQUE INDEX documents_pkey',
    ],
  };
}

function tableEvidence() {
  return [
    {
      kind: 'table',
      name: 'public.accounts',
      rowCount: 2,
      dataSha256: 'a'.repeat(64),
    },
    {
      kind: 'table',
      name: 'public.documents',
      rowCount: 3,
      dataSha256: 'b'.repeat(64),
    },
    {
      kind: 'sequence',
      name: 'public.documents_id_seq',
      lastValue: '3',
      isCalled: true,
    },
  ];
}

test('target PostgreSQL image is pinned and source docker invocation contains no credentials', () => {
  const compose = [
    'version: "2.4"',
    'services:',
    '  db:',
    '    image: postgres:17.11-bookworm',
  ].join('\n');
  assert.deepEqual(extractPinnedTargetPostgres(compose), {
    image: 'postgres:17.11-bookworm',
    major: 17,
  });
  assert.throws(
    () => extractPinnedTargetPostgres(compose.replace('17.11-bookworm', 'latest')),
    /target PostgreSQL image is invalid/i,
  );

  const invocation = buildSourcePsqlDockerInvocation({
    clientImage: 'postgres:17.6-bookworm',
    serviceDirectory: '/private/tmp/operator-secrets',
  });
  assert.equal(invocation.executable, 'docker');
  assert.ok(invocation.args.includes('PGSERVICEFILE=/run/nas-secrets/pg_service.conf'));
  assert.ok(invocation.args.includes('PGPASSFILE=/run/nas-secrets/pgpass'));
  assert.ok(invocation.args.includes('service=source'));
  assert.ok(invocation.args.includes('bridge'));
  assert.ok(invocation.args.includes('-i'));
  const serialized = JSON.stringify(invocation);
  assert.equal(serialized.includes('password'), false);
  assert.equal(serialized.includes('postgresql://'), false);
  assert.equal(serialized.includes('db.example'), false);
});

test('integrity collector hashes schema objects and returns only row counts and data hashes', async () => {
  const metadata = baseMetadata();
  let call = 0;
  const evidence = await collectPostgresIntegrityEvidence({
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    query: async (sql) => {
      call += 1;
      if (call === 1) {
        assert.match(sql, /server_version_num/);
        assert.match(sql, /pg_largeobject_metadata/);
        assert.match(sql, /pg_policy/);
        assert.match(sql, /pg_get_viewdef/);
        assert.match(sql, /pg_proc/);
        assert.match(sql, /nspname !~ '\^pg_'/);
        assert.match(sql, /NOT \(table_schema = 'public' AND table_name = '_prisma_migrations'\)/);
        assert.match(sql, /NOT \(ns\.nspname = 'public' AND rel\.relname = '_prisma_migrations'\)/);
        assert.match(sql, /NOT \(schemaname = 'public' AND tablename = '_prisma_migrations'\)/);
        assert.match(sql, /typ\.typname = '_prisma_migrations'/);
        assert.match(sql, /baseline_rel\.oid = typ\.typrelid/);
        return `${JSON.stringify(metadata)}\n`;
      }
      assert.match(sql, /row_to_json/);
      assert.match(sql, /documents_id_seq/);
      return `${tableEvidence().map((record) => JSON.stringify(record)).join('\n')}\n`;
    },
  });
  assert.equal(call, 2);
  assert.equal(evidence.schemaVersion, 1);
  assert.deepEqual(evidence.schemas, ['public']);
  assert.deepEqual(evidence.database, {
    encoding: 'UTF8',
    collate: 'C.UTF-8',
    ctype: 'C.UTF-8',
  });
  assert.equal(evidence.tables.length, 2);
  assert.equal(evidence.sequences.length, 1);
  assert.deepEqual(evidence.largeObjects, []);
  assert.match(evidence.objectsSha256, /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(evidence).includes('column|'), false);
});

test('integrity collector rejects every unexpected non-system schema before reading table data', async () => {
  const metadata = {
    ...baseMetadata(),
    schemas: ['private', 'public'],
    tables: ['private.hidden_records', ...baseMetadata().tables],
  };
  let calls = 0;
  await assert.rejects(
    () => collectPostgresIntegrityEvidence({
      projectId: PROJECT_ID,
      migrationId: MIGRATION_ID,
      query: async () => {
        calls += 1;
        return `${JSON.stringify(metadata)}\n`;
      },
    }),
    /schema allowlist/i,
  );
  assert.equal(calls, 1);
});

test('integrity collector hashes large objects while excluding only the Prisma baseline table', async () => {
  const metadata = { ...baseMetadata(), largeObjects: ['16384'] };
  const records = [
    ...tableEvidence(),
    { kind: 'large-object', oid: '16384', bytes: 4, dataSha256: 'c'.repeat(64) },
  ];
  let call = 0;
  const evidence = await collectPostgresIntegrityEvidence({
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    query: async (sql) => {
      call += 1;
      if (call === 1) return `${JSON.stringify(metadata)}\n`;
      assert.match(sql, /lo_get\(16384::oid\)/);
      assert.doesNotMatch(sql, /_prisma_migrations/);
      return `${records.map((record) => JSON.stringify(record)).join('\n')}\n`;
    },
  });
  assert.deepEqual(evidence.largeObjects, [
    { oid: '16384', bytes: 4, dataSha256: 'c'.repeat(64) },
  ]);
  assert.equal(evidence.tables.some((record) => record.name.endsWith('._prisma_migrations')), false);
});

test('custom dump uses a private artifact directory and verifies a pg_restore list', (t) => {
  const root = privateDirectory('flowpack-pg-dump-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const artifactDirectory = join(root, 'artifacts');
  const serviceDirectory = join(root, 'service');
  mkdirSync(artifactDirectory, { mode: 0o700 });
  mkdirSync(serviceDirectory, { mode: 0o700 });
  writeFileSync(join(serviceDirectory, 'pg_service.conf'), '[source]\n', { mode: 0o600 });
  chmodSync(join(serviceDirectory, 'pg_service.conf'), 0o600);
  writeFileSync(join(serviceDirectory, 'pgpass'), '*:*:*:*:fixture\n', { mode: 0o600 });
  chmodSync(join(serviceDirectory, 'pgpass'), 0o600);
  const invocations = [];
  const run = (executable, args) => {
    invocations.push({ executable, args });
    const dumpArgument = args.find((argument) => argument === '--file=/artifacts/source.dump');
    if (dumpArgument) {
      writeFileSync(join(artifactDirectory, 'source.dump'), 'PGDMP fixture\n', { mode: 0o600 });
      chmodSync(join(artifactDirectory, 'source.dump'), 0o600);
      return { status: 0, stdout: '', stderr: '' };
    }
    if (args.includes('pg_restore')) {
      return {
        status: 0,
        stdout: '; Archive created at 2026-08-24\n1; 0 0 TABLE public documents owner\n',
        stderr: '',
      };
    }
    return { status: 1, stdout: '', stderr: 'unexpected' };
  };

  const created = createCustomFormatDump({
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    clientImage: 'postgres:17.6-bookworm',
    serviceDirectory,
    artifactDirectory,
    run,
  });
  assert.equal(created.ok, true);
  assert.equal(statSync(join(artifactDirectory, 'source.dump')).mode & 0o777, 0o600);
  assert.equal(JSON.stringify(invocations).includes('postgresql://'), false);
  const dumpInvocation = invocations.find(({ args }) => args.includes('pg_dump'));
  assert.ok(dumpInvocation);
  assert.ok(dumpInvocation.args.includes('--exclude-table=public._prisma_migrations'));
  assert.ok(dumpInvocation.args.includes('--schema=public'));
  assert.ok(dumpInvocation.args.includes('--blobs'));

  const verified = verifyCustomFormatDump({
    clientImage: 'postgres:17.6-bookworm',
    artifactDirectory,
    run,
  });
  assert.equal(verified.ok, true);
  assert.match(verified.listSha256, /^[0-9a-f]{64}$/);
  assert.equal(existsSync(join(artifactDirectory, 'source.dump.list')), true);
  assert.equal(statSync(join(artifactDirectory, 'source.dump.list')).mode & 0o777, 0o600);
  assert.doesNotMatch(readFileSync(join(artifactDirectory, 'source.dump.list'), 'utf8'), /postgresql:\/\//);
});

test('scratch restore is network-isolated, exact, and always removes its generated container', async () => {
  const sourceEvidence = {
    schemaVersion: 1,
    database: { encoding: 'UTF8', collate: 'C.UTF-8', ctype: 'C.UTF-8' },
    schemas: ['public'],
    extensions: ['plpgsql'],
    objectsSha256: '1'.repeat(64),
    tables: [{ name: 'public.documents', rowCount: 3, dataSha256: '2'.repeat(64) }],
    sequences: [{ name: 'public.documents_id_seq', lastValue: '3', isCalled: true }],
    largeObjects: [{ oid: '16384', bytes: 4, dataSha256: '3'.repeat(64) }],
  };
  const invocations = [];
  const run = (executable, args, options = {}) => {
    invocations.push({ executable, args, hasInput: typeof options.input === 'string' });
    if (args[0] === 'run') return { status: 0, stdout: 'container-id\n', stderr: '' };
    if (args[0] === 'exec' && args.includes('pg_isready')) {
      return { status: 0, stdout: 'ready\n', stderr: '' };
    }
    if (args[0] === 'exec' && args.includes('pg_restore')) {
      return { status: 0, stdout: '', stderr: '' };
    }
    if (args[0] === 'exec' && args.includes('psql')) {
      return { status: 0, stdout: 'unused\n', stderr: '' };
    }
    if (args[0] === 'rm') return { status: 0, stdout: '', stderr: '' };
    return { status: 1, stdout: '', stderr: '' };
  };
  const result = await runScratchRestoreDrill({
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    targetImage: 'postgres:17.11-bookworm',
    artifactDirectory: '/private/tmp/flowpack-artifacts',
    sourceServerMajor: 17,
    sourceEvidence,
    run,
    collectDestinationEvidence: async () => structuredClone(sourceEvidence),
    wait: async () => {},
  });
  assert.deepEqual(result, {
    ok: true,
    differenceCount: 0,
    tableCount: 1,
    sequenceCount: 1,
    largeObjectCount: 1,
  });
  const runInvocation = invocations.find((entry) => entry.args[0] === 'run');
  assert.ok(runInvocation.args.includes('none'));
  assert.equal(runInvocation.args.some((value) => /^-p|^--publish/.test(value)), false);
  const restoreInvocation = invocations.find((entry) => entry.args.includes('pg_restore'));
  assert.ok(restoreInvocation.args.includes('--clean'));
  assert.ok(restoreInvocation.args.includes('--if-exists'));
  assert.ok(invocations.some((entry) => entry.args[0] === 'rm' && entry.args.includes('-f')));
  assert.equal(JSON.stringify(invocations).includes('postgresql://'), false);
});

test('scratch restore refuses a source newer than the pinned target before running Docker', async () => {
  let called = false;
  await assert.rejects(
    () =>
      runScratchRestoreDrill({
        projectId: PROJECT_ID,
        migrationId: MIGRATION_ID,
        targetImage: 'postgres:17.11-bookworm',
        artifactDirectory: '/private/tmp/flowpack-artifacts',
        sourceServerMajor: 18,
        sourceEvidence: {},
        run: () => {
          called = true;
          return { status: 0, stdout: '', stderr: '' };
        },
      }),
    /source PostgreSQL is newer than target/i,
  );
  assert.equal(called, false);
});
