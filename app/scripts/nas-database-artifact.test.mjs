import assert from 'node:assert/strict';
import {
  chmodSync,
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
import test from 'node:test';

import {
  compareIntegrityEvidence,
  copyEncryptedBackupOffsite,
  createBackupManifest,
  decryptDatabaseDump,
  encryptDatabaseDump,
  initializeBackupKey,
  readSourceDatabaseConfig,
  validateRestoreConfirmation,
  verifyOffsiteFilesystemBoundary,
  verifyOffsiteReadback,
  writeLibpqServiceFile,
} from './nas-database-artifact.mjs';

const PROJECT_ID = 'flowpack-nas';
const MIGRATION_ID = '11111111-2222-4333-8444-555555555555';

function privateDirectory(prefix) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  chmodSync(directory, 0o700);
  return directory;
}

function writePrivate(path, value) {
  writeFileSync(path, value, { mode: 0o600 });
  chmodSync(path, 0o600);
}

test('source database config requires a mode-0600 regular file and never serializes the URL', (t) => {
  const root = privateDirectory('flowpack-db-config-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const sourcePath = join(root, 'source.env');
  writePrivate(
    sourcePath,
    'SOURCE_DATABASE_URL=postgresql://migration_user:p%40ss@db.example.invalid:5432/app?sslmode=require&channel_binding=require\n',
  );

  const config = readSourceDatabaseConfig(sourcePath);
  assert.equal(config.protocol, 'postgresql:');
  assert.equal(config.hasPassword, true);
  assert.deepEqual(JSON.parse(JSON.stringify(config.publicSummary)), {
    ok: true,
    sslMode: 'require',
    portExplicit: true,
  });
  assert.equal(JSON.stringify(config.publicSummary).includes('db.example.invalid'), false);
  assert.equal(JSON.stringify(config.publicSummary).includes('p%40ss'), false);

  chmodSync(sourcePath, 0o644);
  assert.throws(() => readSourceDatabaseConfig(sourcePath), /private source database file is invalid/i);
  chmodSync(sourcePath, 0o600);
  const linked = join(root, 'linked.env');
  symlinkSync(sourcePath, linked);
  assert.throws(() => readSourceDatabaseConfig(linked), /private source database file is invalid/i);
});

test('libpq service and password files are private and the result returns no secret', (t) => {
  const root = privateDirectory('flowpack-pg-service-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const sourcePath = join(root, 'source.env');
  const servicePath = join(root, 'pg_service.conf');
  writePrivate(
    sourcePath,
    'SOURCE_DATABASE_URL=postgresql://migration_user:p%40ss@db.example.invalid:5432/app?sslmode=require&channel_binding=require\n',
  );
  const config = readSourceDatabaseConfig(sourcePath);

  const result = writeLibpqServiceFile(config, servicePath);
  assert.deepEqual(result, { ok: true, serviceName: 'source' });
  assert.equal(lstatSync(servicePath).mode & 0o777, 0o600);
  assert.equal(lstatSync(join(root, 'pgpass')).mode & 0o777, 0o600);
  const serviceContents = readFileSync(servicePath, 'utf8');
  const passwordContents = readFileSync(join(root, 'pgpass'), 'utf8');
  assert.match(serviceContents, /^\[source\]$/m);
  assert.match(serviceContents, /^channel_binding=require$/m);
  assert.doesNotMatch(serviceContents, /^password=/m);
  assert.equal(passwordContents, 'db.example.invalid:5432:app:migration_user:p@ss\n');
  assert.equal(JSON.stringify(result).includes('p@ss'), false);
  assert.equal(JSON.stringify(result).includes('db.example.invalid'), false);
});

test('source database config rejects unreviewed connection parameters', (t) => {
  const root = privateDirectory('flowpack-db-query-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const sourcePath = join(root, 'source.env');
  writePrivate(
    sourcePath,
    'SOURCE_DATABASE_URL=postgresql://migration_user:p%40ss@db.example.invalid/app?sslmode=require&options=-cstatement_timeout%3D0\n',
  );
  assert.throws(
    () => readSourceDatabaseConfig(sourcePath),
    /private source database file is invalid/i,
  );
});

test('source database config rejects insecure TLS modes except an explicit synthetic loopback fixture', (t) => {
  const root = privateDirectory('flowpack-db-tls-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const remotePath = join(root, 'remote.env');
  const loopbackPath = join(root, 'loopback.env');
  for (const sslMode of ['disable', 'allow', 'prefer']) {
    writePrivate(
      remotePath,
      `SOURCE_DATABASE_URL=postgresql://migration_user:p%40ss@db.example.invalid/app?sslmode=${sslMode}\n`,
    );
    assert.throws(() => readSourceDatabaseConfig(remotePath), /private source database file is invalid/i);
    assert.throws(
      () => readSourceDatabaseConfig(remotePath, { allowInsecureLoopback: true }),
      /private source database file is invalid/i,
    );
  }
  writePrivate(
    loopbackPath,
    'SOURCE_DATABASE_URL=postgresql://migration_user:p%40ss@host.docker.internal/app?sslmode=disable\n',
  );
  assert.throws(() => readSourceDatabaseConfig(loopbackPath), /private source database file is invalid/i);
  assert.equal(
    readSourceDatabaseConfig(loopbackPath, { allowInsecureLoopback: true }).publicSummary.sslMode,
    'disable',
  );
});

test('AES-256-GCM database backup round-trips and rejects tampering or the wrong key', async (t) => {
  const root = privateDirectory('flowpack-db-encryption-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dumpPath = join(root, 'source.dump');
  const keyPath = join(root, 'backup.key');
  const encryptedPath = join(root, 'source.dump.enc');
  const restoredPath = join(root, 'restored.dump');
  writePrivate(dumpPath, 'fixture dump with private row material\n'.repeat(4096));
  initializeBackupKey(keyPath);

  const encrypted = await encryptDatabaseDump({
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    dumpPath,
    keyPath,
    encryptedPath,
  });
  assert.equal(encrypted.algorithm, 'aes-256-gcm');
  assert.match(encrypted.plaintextSha256, /^[0-9a-f]{64}$/);
  assert.match(encrypted.encryptedSha256, /^[0-9a-f]{64}$/);
  assert.equal(readFileSync(encryptedPath).includes(Buffer.from('private row material')), false);
  assert.equal(lstatSync(encryptedPath).mode & 0o777, 0o600);

  const restored = await decryptDatabaseDump({
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    encryptedPath,
    keyPath,
    outputPath: restoredPath,
    expectedPlaintextSha256: encrypted.plaintextSha256,
    expectedEncryptedSha256: encrypted.encryptedSha256,
  });
  assert.equal(restored.ok, true);
  assert.deepEqual(readFileSync(restoredPath), readFileSync(dumpPath));

  const tampered = readFileSync(encryptedPath);
  tampered[Math.floor(tampered.length / 2)] ^= 0xff;
  writePrivate(join(root, 'tampered.enc'), tampered);
  await assert.rejects(
    () =>
      decryptDatabaseDump({
        projectId: PROJECT_ID,
        migrationId: MIGRATION_ID,
        encryptedPath: join(root, 'tampered.enc'),
        keyPath,
        outputPath: join(root, 'tampered.dump'),
        expectedPlaintextSha256: encrypted.plaintextSha256,
        expectedEncryptedSha256: encrypted.encryptedSha256,
      }),
    /encrypted database backup is invalid/i,
  );

  const wrongKey = join(root, 'wrong.key');
  initializeBackupKey(wrongKey);
  await assert.rejects(
    () =>
      decryptDatabaseDump({
        projectId: PROJECT_ID,
        migrationId: MIGRATION_ID,
        encryptedPath,
        keyPath: wrongKey,
        outputPath: join(root, 'wrong.dump'),
        expectedPlaintextSha256: encrypted.plaintextSha256,
        expectedEncryptedSha256: encrypted.encryptedSha256,
      }),
    /encrypted database backup is invalid/i,
  );
});

test('manifest and filesystem offsite readback prove ciphertext and plaintext integrity', async (t) => {
  const root = privateDirectory('flowpack-offsite-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const working = join(root, 'working');
  const offsite = join(root, 'offsite');
  const readback = join(root, 'readback');
  mkdirSync(working, { mode: 0o700 });
  mkdirSync(offsite, { mode: 0o700 });
  mkdirSync(readback, { mode: 0o700 });
  const dumpPath = join(working, 'source.dump');
  const keyPath = join(working, 'backup.key');
  const encryptedPath = join(working, 'source.dump.enc');
  const evidencePath = join(working, 'evidence.bundle.json');
  const encryptedEvidencePath = join(working, 'evidence.bundle.enc');
  const manifestPath = join(working, 'backup.manifest.json');
  const profilePath = join(working, 'offsite-profile.json');
  writePrivate(dumpPath, 'private database fixture\n'.repeat(64));
  initializeBackupKey(keyPath);
  const encrypted = await encryptDatabaseDump({
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    dumpPath,
    keyPath,
    encryptedPath,
  });
  writePrivate(
    evidencePath,
    `${JSON.stringify({ schemaVersion: 1, sourceInventorySha256: 'b'.repeat(64) })}\n`,
  );
  const evidenceEncryption = await encryptDatabaseDump({
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    dumpPath: evidencePath,
    keyPath,
    encryptedPath: encryptedEvidencePath,
  });
  const manifest = createBackupManifest({
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    createdAt: '2026-08-24T00:00:00.000Z',
    sourceServerMajor: 17,
    targetServerMajor: 17,
    inventorySha256: 'a'.repeat(64),
    encryption: encrypted,
    evidenceEncryption,
  });
  writePrivate(manifestPath, `${JSON.stringify(manifest)}\n`);
  writePrivate(
    profilePath,
    `${JSON.stringify({
      schemaVersion: 1,
      profileId: 'external-drive-a',
      type: 'filesystem',
      root: offsite,
    })}\n`,
  );

  const copied = copyEncryptedBackupOffsite({
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    encryptedPath,
    encryptedEvidencePath,
    manifestPath,
    profilePath,
  });
  assert.deepEqual(copied, { ok: true, copiedFileCount: 3 });
  assert.throws(
    () =>
      copyEncryptedBackupOffsite({
        projectId: PROJECT_ID,
        migrationId: MIGRATION_ID,
        encryptedPath,
        encryptedEvidencePath,
        manifestPath,
        profilePath,
      }),
    /offsite destination is not empty/i,
  );

  const verified = await verifyOffsiteReadback({
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    profilePath,
    keyPath,
    readbackDirectory: readback,
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.dumpSha256, encrypted.plaintextSha256);
  assert.equal(verified.evidenceSha256, evidenceEncryption.plaintextSha256);
  assert.equal(JSON.stringify(verified).includes(offsite), false);
  assert.equal(existsSync(join(readback, 'source.dump')), true);
  assert.equal(existsSync(join(readback, 'evidence.bundle.json')), true);
});

test('offsite filesystem boundary rejects a different folder on the same device', (t) => {
  const root = privateDirectory('flowpack-offsite-boundary-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const localPath = join(root, 'local');
  const offsite = join(root, 'offsite');
  const profilePath = join(root, 'offsite-profile.json');
  mkdirSync(localPath, { mode: 0o700 });
  mkdirSync(offsite, { mode: 0o700 });
  writePrivate(
    profilePath,
    `${JSON.stringify({
      schemaVersion: 1,
      profileId: 'external-drive-boundary',
      type: 'filesystem',
      root: offsite,
    })}\n`,
  );

  assert.throws(
    () => verifyOffsiteFilesystemBoundary({ localPath, profilePath }),
    /separate filesystem/i,
  );
});

test('integrity comparison is exact but public output reveals only counts', () => {
  const source = {
    schemaVersion: 1,
    database: { encoding: 'UTF8', collate: 'C.UTF-8', ctype: 'C.UTF-8' },
    schemas: ['public'],
    extensions: ['plpgsql'],
    objectsSha256: '1'.repeat(64),
    tables: [
      { name: 'public.private_records', rowCount: 2, dataSha256: '2'.repeat(64) },
    ],
    sequences: [{ name: 'public.private_records_id_seq', lastValue: '2', isCalled: true }],
    largeObjects: [{ oid: '16384', bytes: 4, dataSha256: '3'.repeat(64) }],
  };
  const same = structuredClone(source);
  const match = compareIntegrityEvidence(source, same);
  assert.deepEqual(match, {
    ok: true,
    differenceCount: 0,
    tableCount: 1,
    sequenceCount: 1,
    largeObjectCount: 1,
  });

  same.tables[0].rowCount = 3;
  const mismatch = compareIntegrityEvidence(source, same);
  assert.deepEqual(mismatch, {
    ok: false,
    differenceCount: 1,
    tableCount: 1,
    sequenceCount: 1,
    largeObjectCount: 1,
  });
  assert.equal(JSON.stringify(mismatch).includes('private_records'), false);
});

test('live restore requires the exact non-secret project and migration confirmation', () => {
  assert.equal(
    validateRestoreConfirmation(
      PROJECT_ID,
      MIGRATION_ID,
      `RESTORE:${PROJECT_ID}:${MIGRATION_ID}`,
    ),
    true,
  );
  for (const invalid of [
    '',
    `RESTORE:${PROJECT_ID}:different`,
    `RESTORE:documate-nas:${MIGRATION_ID}`,
    `restore:${PROJECT_ID}:${MIGRATION_ID}`,
  ]) {
    assert.throws(
      () => validateRestoreConfirmation(PROJECT_ID, MIGRATION_ID, invalid),
      /restore confirmation is invalid/i,
    );
  }
});
