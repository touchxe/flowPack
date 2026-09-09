import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  parseRehearsalArguments,
  rehearseDatabaseMigration,
  runCli,
} from './nas-database-operator.mjs';

const PROJECT_ID = 'flowpack-nas';
const MIGRATION_ID = '11111111-2222-4333-8444-555555555555';
const SCRIPT_PATH = fileURLToPath(new URL('./nas-database-operator.mjs', import.meta.url));
const FIXED_NOW = '2026-08-24T03:04:05.000Z';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function privateDirectory(prefix) {
  const path = mkdtempSync(join(tmpdir(), prefix));
  chmodSync(path, 0o700);
  return path;
}

function writePrivate(path, value) {
  writeFileSync(path, value, { mode: 0o600 });
  chmodSync(path, 0o600);
}

function sourceEvidence() {
  const evidence = {
    schemaVersion: 1,
    database: { encoding: 'UTF8', collate: 'C.UTF-8', ctype: 'C.UTF-8' },
    schemas: ['public'],
    extensions: ['plpgsql'],
    objectsSha256: '1'.repeat(64),
    tables: [
      { name: 'public.accounts', rowCount: 2, dataSha256: '2'.repeat(64) },
      { name: 'public.documents', rowCount: 3, dataSha256: '3'.repeat(64) },
    ],
    sequences: [
      { name: 'public.documents_id_seq', lastValue: '3', isCalled: true },
    ],
    largeObjects: [],
  };
  Object.defineProperty(evidence, 'serverMajor', { value: 17 });
  return Object.freeze(evidence);
}

function createFixture(t) {
  const root = privateDirectory('flowpack-db-operator-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const offsiteRoot = join(root, 'external-backup');
  mkdirSync(offsiteRoot, { mode: 0o700 });
  const composePath = join(root, 'docker-compose.nas.yml');
  const sourceConfigPath = join(root, 'source.env');
  const backupKeyPath = join(root, 'backup.key');
  const offsiteProfilePath = join(root, 'offsite-profile.json');
  const journalPath = join(root, 'migration.jsonl');
  const workspacePath = join(root, 'rehearsal-workspace');
  writeFileSync(
    composePath,
    'version: "2.4"\nservices:\n  db:\n    image: postgres:17.11-bookworm\n',
    { mode: 0o644 },
  );
  writePrivate(
    sourceConfigPath,
    'SOURCE_DATABASE_URL=postgresql://private_user:private_password@private-db.invalid/app?sslmode=require\n',
  );
  writePrivate(backupKeyPath, `${Buffer.alloc(32, 7).toString('base64')}\n`);
  writePrivate(
    offsiteProfilePath,
    `${JSON.stringify({
      schemaVersion: 1,
      profileId: 'external-drive-primary',
      type: 'filesystem',
      root: offsiteRoot,
    })}\n`,
  );
  writePrivate(
    journalPath,
    `${JSON.stringify({
      migrationId: MIGRATION_ID,
      projectId: PROJECT_ID,
    })}\n`,
  );
  return {
    root,
    offsiteRoot,
    input: {
      migrationId: MIGRATION_ID,
      composePath,
      sourceConfigPath,
      backupKeyPath,
      offsiteProfilePath,
      journalPath,
      workspacePath,
    },
  };
}

function createDependencies(fixture, overrides = {}) {
  const calls = [];
  let ledgerState = 'STAGED';
  let ledgerEventCount = 2;
  const record = (name) => calls.push(name);
  const dependencies = {
    now: () => new Date(FIXED_NOW),
    extractPinnedTargetPostgres: (composeText) => {
      record('extractPinnedTargetPostgres');
      assert.match(composeText, /postgres:17\.11-bookworm/);
      return { image: 'postgres:17.11-bookworm', major: 17 };
    },
    readSourceDatabaseConfig: (path) => {
      record('readSourceDatabaseConfig');
      assert.equal(path, fixture.input.sourceConfigPath);
      return { publicSummary: { ok: true } };
    },
    writeLibpqServiceFile: (_config, path) => {
      record('writeLibpqServiceFile');
      writePrivate(path, '[source]\nhost=private-db.invalid\n');
      writePrivate(join(path.replace(/\/pg_service\.conf$/, ''), 'pgpass'), 'private\n');
      return { ok: true, serviceName: 'source' };
    },
    createSourceQuery: () => {
      record('createSourceQuery');
      return async () => 'unused\n';
    },
    collectPostgresIntegrityEvidence: async () => {
      record('collectPostgresIntegrityEvidence');
      return sourceEvidence();
    },
    createCustomFormatDump: ({ artifactDirectory }) => {
      record('createCustomFormatDump');
      const contents = Buffer.from('PGDMP private synthetic fixture\n');
      const path = join(artifactDirectory, 'source.dump');
      writePrivate(path, contents);
      return {
        ok: true,
        dumpBytes: contents.byteLength,
        dumpSha256: sha256(contents),
      };
    },
    verifyCustomFormatDump: ({ artifactDirectory }) => {
      record(
        artifactDirectory.endsWith('/readback')
          ? 'verifyCustomFormatDump:readback'
          : 'verifyCustomFormatDump:source',
      );
      const contents = Buffer.from('; PostgreSQL custom archive list\n');
      writePrivate(join(artifactDirectory, 'source.dump.list'), contents);
      return { ok: true, listSha256: sha256(contents) };
    },
    encryptDatabaseDump: async ({ dumpPath, encryptedPath }) => {
      record('encryptDatabaseDump');
      const plaintext = readFileSync(dumpPath);
      const ciphertext = Buffer.concat([Buffer.from('NASPG001'), Buffer.alloc(64, 9)]);
      writePrivate(encryptedPath, ciphertext);
      return {
        algorithm: 'aes-256-gcm',
        formatVersion: 1,
        plaintextBytes: plaintext.byteLength,
        plaintextSha256: sha256(plaintext),
        encryptedBytes: ciphertext.byteLength,
        encryptedSha256: sha256(ciphertext),
      };
    },
    createBackupManifest: (values) => {
      record('createBackupManifest');
      return {
        schemaVersion: 1,
        projectId: values.projectId,
        migrationId: values.migrationId,
        createdAt: values.createdAt,
        source: { serverMajor: values.sourceServerMajor },
        target: { serverMajor: values.targetServerMajor },
        inventory: { sha256: values.inventorySha256 },
        dump: {
          format: 'postgresql-custom',
          plaintextBytes: values.encryption.plaintextBytes,
          plaintextSha256: values.encryption.plaintextSha256,
          encryption: {
            algorithm: values.encryption.algorithm,
            formatVersion: values.encryption.formatVersion,
            encryptedBytes: values.encryption.encryptedBytes,
            encryptedSha256: values.encryption.encryptedSha256,
          },
        },
        evidence: {
          format: 'canonical-json',
          plaintextBytes: values.evidenceEncryption.plaintextBytes,
          plaintextSha256: values.evidenceEncryption.plaintextSha256,
          encryption: {
            algorithm: values.evidenceEncryption.algorithm,
            formatVersion: values.evidenceEncryption.formatVersion,
            encryptedBytes: values.evidenceEncryption.encryptedBytes,
            encryptedSha256: values.evidenceEncryption.encryptedSha256,
          },
        },
      };
    },
    copyEncryptedBackupOffsite: () => {
      record('copyEncryptedBackupOffsite');
      return { ok: true, copiedFileCount: 3 };
    },
    verifyOffsiteReadback: async ({ readbackDirectory }) => {
      record('verifyOffsiteReadback');
      const artifactDirectory = join(fixture.input.workspacePath, 'artifacts');
      for (const name of [
        'source.dump',
        'source.dump.enc',
        'evidence.bundle.json',
        'evidence.bundle.enc',
        'backup.manifest.json',
      ]) {
        copyFileSync(join(artifactDirectory, name), join(readbackDirectory, name));
        chmodSync(join(readbackDirectory, name), 0o600);
      }
      return {
        ok: true,
        dumpSha256: sha256(readFileSync(join(readbackDirectory, 'source.dump'))),
        evidenceSha256: sha256(
          readFileSync(join(readbackDirectory, 'evidence.bundle.json')),
        ),
      };
    },
    runScratchRestoreDrill: async ({ artifactDirectory, targetImage }) => {
      record('runScratchRestoreDrill');
      assert.ok(artifactDirectory.endsWith('/readback'));
      assert.equal(targetImage, 'postgres:17.11-bookworm');
      return {
        ok: true,
        differenceCount: 0,
        tableCount: 2,
        sequenceCount: 1,
        largeObjectCount: 0,
      };
    },
    verifyLedger: () => {
      record(`verifyLedger:${ledgerState}`);
      return {
        currentState: ledgerState,
        eventCount: ledgerEventCount,
        ok: true,
        rolledBack: false,
      };
    },
    verifyOffsiteFilesystemBoundary: ({ localPath, profilePath }) => {
      record('verifyOffsiteFilesystemBoundary');
      assert.equal(localPath, fixture.input.workspacePath);
      assert.equal(profilePath, fixture.input.offsiteProfilePath);
      return { ok: true, separateDevice: true };
    },
    advanceLedger: ({ targetState, evidence }) => {
      record('advanceLedger');
      if (targetState === 'ARTIFACTS_VERIFIED') {
        assert.deepEqual(Object.keys(evidence).sort(), [
          'databaseArtifactReportDigest',
          'databaseDumpDigest',
          'offNasBackupVerified',
          'storageManifestDigest',
        ]);
      } else {
        assert.equal(targetState, 'RESTORE_DRILL_PASSED');
        assert.deepEqual(Object.keys(evidence).sort(), [
          'integrityReportDigest',
          'offNasBackupVerified',
          'restoreDrillReportDigest',
        ]);
      }
      assert.equal(evidence.offNasBackupVerified, true);
      ledgerState = targetState;
      ledgerEventCount += 1;
      return {
        currentState: ledgerState,
        eventCount: ledgerEventCount,
        ok: true,
        rolledBack: false,
      };
    },
    ...overrides,
  };
  return { calls, dependencies };
}

test('rehearsal performs the encrypted offsite readback restore chain and publishes only safe evidence', async (t) => {
  const fixture = createFixture(t);
  const { calls, dependencies } = createDependencies(fixture);

  const result = await rehearseDatabaseMigration(fixture.input, dependencies);

  assert.deepEqual(calls, [
    'extractPinnedTargetPostgres',
    'verifyLedger:STAGED',
    'verifyOffsiteFilesystemBoundary',
    'readSourceDatabaseConfig',
    'writeLibpqServiceFile',
    'createSourceQuery',
    'collectPostgresIntegrityEvidence',
    'createCustomFormatDump',
    'verifyCustomFormatDump:source',
    'encryptDatabaseDump',
    'encryptDatabaseDump',
    'createBackupManifest',
    'copyEncryptedBackupOffsite',
    'verifyOffsiteReadback',
    'verifyCustomFormatDump:readback',
    'advanceLedger',
    'verifyLedger:ARTIFACTS_VERIFIED',
    'runScratchRestoreDrill',
    'advanceLedger',
    'verifyLedger:RESTORE_DRILL_PASSED',
  ]);
  assert.deepEqual(result, {
    ok: true,
    status: 'RESTORE_DRILL_PASSED',
    sourceServerMajor: 17,
    targetServerMajor: 17,
    tableCount: 2,
    sequenceCount: 1,
    largeObjectCount: 0,
    differenceCount: 0,
    dumpBytes: 32,
    encryptedBytes: 72,
    copiedFileCount: 3,
    ledgerEventCount: 4,
    offsiteReadback: true,
    scratchRestore: true,
    inventorySha256: result.inventorySha256,
    dumpSha256: result.dumpSha256,
    dumpListSha256: result.dumpListSha256,
    encryptedSha256: result.encryptedSha256,
    encryptedEvidenceSha256: result.encryptedEvidenceSha256,
    evidenceBundleSha256: result.evidenceBundleSha256,
    manifestSha256: result.manifestSha256,
    artifactVerificationReportSha256: result.artifactVerificationReportSha256,
    integrityReportSha256: result.integrityReportSha256,
    restoreDrillReportSha256: result.restoreDrillReportSha256,
  });
  for (const key of [
    'inventorySha256',
    'dumpSha256',
    'dumpListSha256',
    'encryptedSha256',
    'encryptedEvidenceSha256',
    'evidenceBundleSha256',
    'manifestSha256',
    'artifactVerificationReportSha256',
    'integrityReportSha256',
    'restoreDrillReportSha256',
  ]) {
    assert.match(result[key], /^[0-9a-f]{64}$/);
  }
  const serialized = JSON.stringify(result);
  for (const secret of [
    'private_password',
    'private-db.invalid',
    fixture.root,
    fixture.offsiteRoot,
    fixture.input.sourceConfigPath,
    'external-drive-primary',
    MIGRATION_ID,
  ]) {
    assert.equal(serialized.includes(secret), false);
  }
  for (const directory of [
    fixture.input.workspacePath,
    join(fixture.input.workspacePath, 'service'),
    join(fixture.input.workspacePath, 'artifacts'),
    join(fixture.input.workspacePath, 'readback'),
  ]) {
    assert.equal(lstatSync(directory).mode & 0o777, 0o700);
  }
  for (const name of [
    'source.dump.enc',
    'evidence.bundle.enc',
    'backup.manifest.json',
    'artifact-verification-report.json',
    'integrity-report.json',
    'restore-drill-report.json',
  ]) {
    assert.equal(lstatSync(join(fixture.input.workspacePath, 'artifacts', name)).mode & 0o777, 0o600);
  }
  for (const name of [
    'source.inventory.json',
    'source.dump',
    'source.dump.list',
    'evidence.bundle.json',
  ]) {
    assert.equal(existsSync(join(fixture.input.workspacePath, 'artifacts', name)), false);
  }
  for (const name of ['source.dump', 'source.dump.list', 'evidence.bundle.json']) {
    assert.equal(existsSync(join(fixture.input.workspacePath, 'readback', name)), false);
  }
  assert.equal(existsSync(join(fixture.input.workspacePath, 'service', 'pgpass')), false);
});

test('strict inputs reject extra keys, invalid UUIDs, placeholders, unsafe modes, links, and dirty workspaces', async (t) => {
  const fixture = createFixture(t);
  const { calls, dependencies } = createDependencies(fixture);
  await assert.rejects(
    () =>
      rehearseDatabaseMigration(
        { ...fixture.input, unexpected: true },
        dependencies,
      ),
    /INVALID_INPUT/,
  );
  await assert.rejects(
    () =>
      rehearseDatabaseMigration(
        { ...fixture.input, migrationId: 'not-a-uuid' },
        dependencies,
      ),
    /INVALID_MIGRATION_ID/,
  );

  writePrivate(
    fixture.input.offsiteProfilePath,
    `${JSON.stringify({
      schemaVersion: 1,
      profileId: 'replace-with-approved-profile',
      type: 'filesystem',
      root: fixture.offsiteRoot,
    })}\n`,
  );
  await assert.rejects(
    () => rehearseDatabaseMigration(fixture.input, dependencies),
    /INVALID_OFFSITE_PROFILE/,
  );

  writePrivate(
    fixture.input.offsiteProfilePath,
    `${JSON.stringify({
      schemaVersion: 1,
      profileId: 'external-drive-primary',
      type: 'filesystem',
      root: fixture.offsiteRoot,
    })}\n`,
  );
  chmodSync(fixture.input.sourceConfigPath, 0o644);
  await assert.rejects(
    () => rehearseDatabaseMigration(fixture.input, dependencies),
    /INVALID_PRIVATE_FILE/,
  );
  chmodSync(fixture.input.sourceConfigPath, 0o600);

  const linkedKey = join(fixture.root, 'linked.key');
  symlinkSync(fixture.input.backupKeyPath, linkedKey);
  await assert.rejects(
    () =>
      rehearseDatabaseMigration(
        { ...fixture.input, backupKeyPath: linkedKey },
        dependencies,
      ),
    /INVALID_PRIVATE_FILE/,
  );

  mkdirSync(fixture.input.workspacePath, { mode: 0o700 });
  await assert.rejects(
    () => rehearseDatabaseMigration(fixture.input, dependencies),
    /WORKSPACE_NOT_EMPTY/,
  );
  assert.deepEqual(calls, []);
});

test('a readback mismatch fails closed before the scratch restore or ledger advance', async (t) => {
  const fixture = createFixture(t);
  const { calls, dependencies } = createDependencies(fixture, {
    verifyOffsiteReadback: async ({ readbackDirectory }) => {
      calls.push('verifyOffsiteReadback');
      const artifactDirectory = join(fixture.input.workspacePath, 'artifacts');
      for (const name of [
        'source.dump',
        'source.dump.enc',
        'evidence.bundle.json',
        'evidence.bundle.enc',
        'backup.manifest.json',
      ]) {
        copyFileSync(join(artifactDirectory, name), join(readbackDirectory, name));
        chmodSync(join(readbackDirectory, name), 0o600);
      }
      return {
        ok: true,
        dumpSha256: 'f'.repeat(64),
        evidenceSha256: sha256(
          readFileSync(join(readbackDirectory, 'evidence.bundle.json')),
        ),
      };
    },
  });

  await assert.rejects(
    () => rehearseDatabaseMigration(fixture.input, dependencies),
    /OFFSITE_READBACK_FAILED/,
  );
  assert.equal(calls.includes('runScratchRestoreDrill'), false);
  assert.equal(calls.includes('advanceLedger'), false);
  for (const path of [
    join(fixture.input.workspacePath, 'artifacts', 'source.dump'),
    join(fixture.input.workspacePath, 'artifacts', 'evidence.bundle.json'),
    join(fixture.input.workspacePath, 'readback', 'source.dump'),
    join(fixture.input.workspacePath, 'readback', 'evidence.bundle.json'),
    join(fixture.input.workspacePath, 'service', 'pgpass'),
  ]) {
    assert.equal(existsSync(path), false);
  }
});

test('rehearsal rejects a same-device offsite target before reading the source database', async (t) => {
  const fixture = createFixture(t);
  const { calls, dependencies } = createDependencies(fixture, {
    verifyOffsiteFilesystemBoundary: () => ({ ok: true, separateDevice: false }),
  });

  await assert.rejects(
    () => rehearseDatabaseMigration(fixture.input, dependencies),
    /OFFSITE_STORAGE_BOUNDARY_FAILED/,
  );
  assert.equal(calls.includes('readSourceDatabaseConfig'), false);
});

test('the ledger must belong to the migration and already be at STAGED', async (t) => {
  const fixture = createFixture(t);
  const { calls, dependencies } = createDependencies(fixture, {
    verifyLedger: () => ({
      currentState: 'PLANNED',
      eventCount: 1,
      ok: true,
      rolledBack: false,
    }),
  });
  await assert.rejects(
    () => rehearseDatabaseMigration(fixture.input, dependencies),
    /INVALID_LEDGER_STATE/,
  );
  assert.equal(calls.includes('readSourceDatabaseConfig'), false);

  const differentMigration = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  writePrivate(
    fixture.input.journalPath,
    `${JSON.stringify({ migrationId: differentMigration, projectId: PROJECT_ID })}\n`,
  );
  await assert.rejects(
    () => rehearseDatabaseMigration(fixture.input, dependencies),
    /LEDGER_IDENTITY_MISMATCH/,
  );
});

test('CLI parsing is exact and CLI failures never echo supplied coordinates', async (t) => {
  const fixture = createFixture(t);
  const argv = [
    'rehearse',
    '--migration-id',
    MIGRATION_ID,
    '--compose',
    fixture.input.composePath,
    '--source-config',
    fixture.input.sourceConfigPath,
    '--backup-key',
    fixture.input.backupKeyPath,
    '--offsite-profile',
    fixture.input.offsiteProfilePath,
    '--journal',
    fixture.input.journalPath,
    '--workspace',
    fixture.input.workspacePath,
  ];
  assert.deepEqual(parseRehearsalArguments(argv), fixture.input);
  assert.throws(
    () => parseRehearsalArguments([...argv, '--workspace', fixture.input.workspacePath]),
    /USAGE/,
  );
  assert.throws(() => parseRehearsalArguments([...argv, '--unknown', 'value']), /USAGE/);

  const { dependencies } = createDependencies(fixture);
  const result = await runCli(argv, dependencies);
  assert.equal(result.ok, true);

  const secretCoordinate = '/private/tmp/private-db.invalid-private_password';
  const failure = spawnSync(
    process.execPath,
    [SCRIPT_PATH, 'rehearse', '--source-config', secretCoordinate],
    { encoding: 'utf8' },
  );
  assert.equal(failure.status, 1);
  assert.equal(failure.stdout, '');
  assert.equal(failure.stderr, '{"ok":false}\n');
  assert.equal(`${failure.stdout}${failure.stderr}`.includes(secretCoordinate), false);
});

test('live cutover remains explicitly unavailable until guarded NAS restore exists', async () => {
  await assert.rejects(() => runCli(['cutover']), /LIVE_CUTOVER_OPERATOR_UNAVAILABLE/);
});
