import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  copyEncryptedBackupOffsite,
  createBackupManifest,
  encryptDatabaseDump,
  initializeBackupKey,
  readSourceDatabaseConfig,
  verifyOffsiteReadback,
  writeLibpqServiceFile,
} from './nas-database-artifact.mjs';
import {
  collectPostgresIntegrityEvidence,
  createCustomFormatDump,
  createSourceQuery,
  runScratchRestoreDrill,
  verifyCustomFormatDump,
} from './nas-postgres-migration.mjs';

const PROJECT_ID = 'flowpack-nas';
const MIGRATION_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const IMAGE = 'postgres:17.11-bookworm';
const SYNTHETIC_PASSWORD = 'synthetic_restore_drill_only';
let lastDockerFailure = '';
let lastDockerOutput = '';

function docker(args, options = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    input: options.input,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const normalized = {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error,
  };
  if (normalized.error || normalized.status !== 0) {
    lastDockerFailure = normalized.stderr
      .replaceAll(SYNTHETIC_PASSWORD, '[redacted]')
      .replaceAll(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-dsn]')
      .slice(-500);
  }
  lastDockerOutput = normalized.stdout
    .replaceAll(SYNTHETIC_PASSWORD, '[redacted]')
    .replaceAll(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-dsn]')
    .slice(-1000);
  return normalized;
}

function runCommand(executable, args, options = {}) {
  if (executable !== 'docker') {
    return { status: 1, stdout: '', stderr: 'unsupported executable' };
  }
  return docker(args, options);
}

function requireSuccess(result, message) {
  if (result.error || result.status !== 0) throw new Error(message);
  return result.stdout;
}

async function availablePort() {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = createServer();
    server.unref();
    server.once('error', rejectPromise);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        rejectPromise(new Error('unable to allocate local drill port'));
        return;
      }
      server.close((error) => {
        if (error) rejectPromise(error);
        else resolvePromise(address.port);
      });
    });
  });
}

function writePrivate(path, value) {
  writeFileSync(path, value, { mode: 0o600 });
  chmodSync(path, 0o600);
}

function canonicalSha256(value) {
  return createHash('sha256').update(`${JSON.stringify(value)}\n`, 'utf8').digest('hex');
}

const seedSql = String.raw`
CREATE TYPE document_state AS ENUM ('draft', 'issued');
CREATE TABLE _prisma_migrations (
  id text PRIMARY KEY,
  checksum text NOT NULL
);
CREATE TABLE accounts (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE documents (
  id bigserial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id),
  state document_state NOT NULL DEFAULT 'draft',
  payload jsonb NOT NULL,
  binary_note bytea,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX documents_account_state_idx ON documents(account_id, state);
CREATE VIEW issued_documents AS SELECT id, account_id FROM documents WHERE state = 'issued';
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_account_policy ON documents USING (account_id IS NOT NULL);
CREATE FUNCTION reject_empty_payload() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.payload = '{}'::jsonb THEN RAISE EXCEPTION 'empty payload'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER documents_payload_guard BEFORE INSERT OR UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION reject_empty_payload();
INSERT INTO _prisma_migrations(id, checksum) VALUES
  ('synthetic-baseline', 'excluded-from-flowpack-logical-dump');
INSERT INTO accounts(id, email, created_at) VALUES
  ('00000000-0000-4000-8000-000000000001', 'synthetic-one@example.invalid', '2026-01-01T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000002', 'synthetic-two@example.invalid', '2026-01-02T00:00:00Z');
INSERT INTO documents(account_id, state, payload, binary_note, created_at) VALUES
  ('00000000-0000-4000-8000-000000000001', 'issued', '{"amount":100,"label":"synthetic"}', decode('00ff', 'hex'), '2026-02-01T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000001', 'draft', '{"amount":200,"label":"fixture"}', NULL, '2026-02-02T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000002', 'issued', '{"amount":300,"label":"drill"}', decode('abcd', 'hex'), '2026-02-03T00:00:00Z');
SELECT lo_from_bytea(0, decode('00112233', 'hex'));
`;

const root = mkdtempSync(join(tmpdir(), 'flowpack-postgres-integration-'));
chmodSync(root, 0o700);
const serviceDirectory = join(root, 'service');
const artifactDirectory = join(root, 'artifacts');
const offsiteRoot = join(root, 'offsite');
const readbackDirectory = join(root, 'readback');
for (const directory of [serviceDirectory, artifactDirectory, offsiteRoot, readbackDirectory]) {
  mkdirSync(directory, { mode: 0o700 });
}
const containerName = `flowpack-source-${randomBytes(6).toString('hex')}`;
let started = false;
let stage = 'allocate-port';

try {
  const port = await availablePort();
  stage = 'start-source';
  requireSuccess(
    docker([
      'run',
      '--detach',
      '--rm',
      '--name',
      containerName,
      '--publish',
      `127.0.0.1:${port}:5432`,
      '--env',
      `POSTGRES_PASSWORD=${SYNTHETIC_PASSWORD}`,
      '--env',
      'POSTGRES_DB=source',
      IMAGE,
    ]),
    'synthetic source PostgreSQL failed to start',
  );
  started = true;
  stage = 'wait-source';
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = docker([
      'exec',
      containerName,
      'pg_isready',
      '-U',
      'postgres',
      '-d',
      'source',
    ]);
    if (result.status === 0) {
      ready = true;
      break;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  if (!ready) throw new Error('synthetic source PostgreSQL did not become ready');
  stage = 'seed-source';
  requireSuccess(
    docker(
      [
        'exec',
        '-i',
        containerName,
        'psql',
        '-U',
        'postgres',
        '-d',
        'source',
        '-v',
        'ON_ERROR_STOP=1',
        '--file',
        '-',
      ],
      { input: seedSql },
    ),
    'synthetic source seed failed',
  );

  const sourceConfigPath = join(serviceDirectory, 'source.env');
  stage = 'write-source-config';
  writePrivate(
    sourceConfigPath,
    `SOURCE_DATABASE_URL=postgresql://postgres:${SYNTHETIC_PASSWORD}@host.docker.internal:${port}/source?sslmode=disable\n`,
  );
  const sourceConfig = readSourceDatabaseConfig(sourceConfigPath, {
    allowInsecureLoopback: true,
  });
  writeLibpqServiceFile(sourceConfig, join(serviceDirectory, 'pg_service.conf'));
  const query = createSourceQuery({
    clientImage: IMAGE,
    serviceDirectory,
    run: runCommand,
  });
  stage = 'collect-source-evidence';
  const sourceEvidence = await collectPostgresIntegrityEvidence({
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    query,
  });
  stage = 'create-dump';
  const dump = createCustomFormatDump({
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    clientImage: IMAGE,
    serviceDirectory,
    artifactDirectory,
    run: runCommand,
  });
  stage = 'verify-dump';
  verifyCustomFormatDump({ clientImage: IMAGE, artifactDirectory, run: runCommand });

  const keyPath = join(root, 'backup.key');
  const encryptedPath = join(artifactDirectory, 'source.dump.enc');
  const evidencePath = join(artifactDirectory, 'evidence.bundle.json');
  const encryptedEvidencePath = join(artifactDirectory, 'evidence.bundle.enc');
  const manifestPath = join(artifactDirectory, 'backup.manifest.json');
  const profilePath = join(root, 'offsite-profile.json');
  stage = 'initialize-backup-key';
  initializeBackupKey(keyPath);
  stage = 'encrypt-dump';
  const encryption = await encryptDatabaseDump({
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    dumpPath: join(artifactDirectory, 'source.dump'),
    keyPath,
    encryptedPath,
  });
  writePrivate(
    evidencePath,
    `${JSON.stringify({
      schemaVersion: 1,
      projectId: PROJECT_ID,
      migrationId: MIGRATION_ID,
      sourceInventory: sourceEvidence,
    })}\n`,
  );
  const evidenceEncryption = await encryptDatabaseDump({
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    dumpPath: evidencePath,
    keyPath,
    encryptedPath: encryptedEvidencePath,
  });
  stage = 'create-manifest';
  const manifest = createBackupManifest({
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    createdAt: '2026-08-24T00:00:00.000Z',
    sourceServerMajor: sourceEvidence.serverMajor,
    targetServerMajor: 17,
    inventorySha256: canonicalSha256(sourceEvidence),
    encryption,
    evidenceEncryption,
  });
  writePrivate(manifestPath, `${JSON.stringify(manifest)}\n`);
  writePrivate(
    profilePath,
    `${JSON.stringify({
      schemaVersion: 1,
      profileId: 'synthetic-offsite',
      type: 'filesystem',
      root: offsiteRoot,
    })}\n`,
  );
  stage = 'copy-offsite';
  copyEncryptedBackupOffsite({
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    encryptedPath,
    encryptedEvidencePath,
    manifestPath,
    profilePath,
  });
  stage = 'verify-offsite-readback';
  await verifyOffsiteReadback({
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    profilePath,
    keyPath,
    readbackDirectory,
  });
  stage = 'verify-readback-dump';
  verifyCustomFormatDump({
    clientImage: IMAGE,
    artifactDirectory: readbackDirectory,
    run: runCommand,
  });
  stage = 'scratch-restore';
  const drill = await runScratchRestoreDrill({
    projectId: PROJECT_ID,
    migrationId: MIGRATION_ID,
    targetImage: IMAGE,
    artifactDirectory: readbackDirectory,
    sourceServerMajor: sourceEvidence.serverMajor,
    sourceEvidence,
    run: runCommand,
  });
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      dumpBytes: dump.dumpBytes,
      tableCount: drill.tableCount,
      sequenceCount: drill.sequenceCount,
      largeObjectCount: drill.largeObjectCount,
      offsiteReadback: true,
    })}\n`,
  );
} catch {
  process.stdout.write(
    `${JSON.stringify({
      ok: false,
      stage,
      diagnostic: lastDockerFailure,
      output: lastDockerOutput,
    })}\n`,
  );
  process.exitCode = 1;
} finally {
  if (started) docker(['rm', '-f', containerName]);
  rmSync(root, { recursive: true, force: true });
}
