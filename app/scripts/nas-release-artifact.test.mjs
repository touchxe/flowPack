import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
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
  createReleaseArtifact,
  readFileManifest,
  validateReleasePath,
  verifyReleaseArtifact,
  verifyStagingFiles,
} from './nas-release-artifact.mjs';

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, COPYFILE_DISABLE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function git(cwd, ...args) {
  return run('git', args, cwd);
}

function makeRepository(t) {
  const root = mkdtempSync(join(tmpdir(), 'nas-release-artifact-'));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  git(root, 'init', '--quiet');
  git(root, 'config', 'user.name', 'Artifact Test');
  git(root, 'config', 'user.email', 'artifact-test@example.invalid');
  return root;
}

function commitAll(root, message = 'fixture') {
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--message', message);
  return git(root, 'rev-parse', '--verify', 'HEAD');
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function captureError(operation) {
  let captured;
  try {
    operation();
  } catch (error) {
    captured = error;
  }
  assert.ok(captured instanceof Error, 'expected operation to throw');
  return captured;
}

function refreshArchiveMetadata(artifactDirectory) {
  const archivePath = join(artifactDirectory, 'release.tar');
  const manifestPath = join(artifactDirectory, 'release-manifest.json');
  const archive = readFileSync(archivePath);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.archive.bytes = archive.byteLength;
  manifest.archive.sha256 = sha256(archive);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function appendTarArchive(targetPath, appendedPath) {
  const target = readFileSync(targetPath);
  let lastNonZero = target.byteLength - 1;
  while (lastNonZero >= 0 && target[lastNonZero] === 0) lastNonZero -= 1;
  const targetPayloadBytes = Math.ceil((lastNonZero + 1) / 512) * 512;
  writeFileSync(
    targetPath,
    Buffer.concat([target.subarray(0, targetPayloadBytes), readFileSync(appendedPath)]),
  );
}

test('creates a HEAD-bound artifact and verifies it in an empty staging directory', (t) => {
  const root = makeRepository(t);
  writeFileSync(join(root, 'app.txt'), 'committed\n');
  writeFileSync(join(root, 'run.sh'), '#!/bin/sh\nexit 0\n');
  chmodSync(join(root, 'run.sh'), 0o755);
  writeFileSync(join(root, '.env.example'), 'SAFE_TEMPLATE=1\n');
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'large.bin'), Buffer.alloc(2 * 1024 * 1024, 0x61));
  const commit = commitAll(root);

  writeFileSync(join(root, 'app.txt'), 'dirty working tree content\n');
  writeFileSync(join(root, 'untracked.txt'), 'must not ship\n');

  const artifactDirectory = join(root, 'artifact');
  const result = createReleaseArtifact({ artifactDirectory, repositoryRoot: root });
  const manifest = JSON.parse(
    readFileSync(join(artifactDirectory, 'release-manifest.json'), 'utf8'),
  );
  const archive = readFileSync(join(artifactDirectory, 'release.tar'));
  const records = readFileManifest(join(artifactDirectory, 'release-files.jsonl'));

  assert.equal(result.commit, commit);
  assert.equal(manifest.commit, commit);
  assert.match(manifest.commit, /^[0-9a-f]{40,64}$/);
  assert.equal(manifest.archive.bytes, archive.byteLength);
  assert.equal(manifest.archive.sha256, sha256(archive));
  assert.deepEqual(
    records.map((record) => record.path),
    ['.env.example', 'app.txt', 'run.sh', 'src/large.bin'],
  );
  assert.equal(records.find((record) => record.path === 'run.sh').mode, '100755');
  assert.equal(records.find((record) => record.path === 'app.txt').sha256, sha256(Buffer.from('committed\n')));

  const stagingDirectory = join(root, 'staging');
  const verification = verifyReleaseArtifact({ artifactDirectory, stagingDirectory });
  assert.equal(verification.commit, commit);
  assert.equal(readFileSync(join(stagingDirectory, 'app.txt'), 'utf8'), 'committed\n');
  assert.equal(lstatSync(join(stagingDirectory, 'run.sh')).mode & 0o777, 0o755);
  assert.equal(lstatSync(join(stagingDirectory, 'app.txt')).mode & 0o777, 0o644);
});

test('rejects a tracked symbolic link without disclosing its path', (t) => {
  const root = makeRepository(t);
  writeFileSync(join(root, 'safe.txt'), 'safe\n');
  symlinkSync('safe.txt', join(root, 'private-link'));
  commitAll(root);

  const error = captureError(() =>
    createReleaseArtifact({ artifactDirectory: join(root, 'artifact'), repositoryRoot: root }),
  );
  assert.match(error.message, /symbolic link/i);
  assert.doesNotMatch(error.message, /private-link/);
});

test('rejects a tracked submodule entry without disclosing its path', (t) => {
  const root = makeRepository(t);
  writeFileSync(join(root, 'safe.txt'), 'safe\n');
  const firstCommit = commitAll(root);
  git(root, 'update-index', '--add', '--cacheinfo', `160000,${firstCommit},vendor/private-module`);
  git(root, 'commit', '--quiet', '--message', 'gitlink fixture');

  const error = captureError(() =>
    createReleaseArtifact({ artifactDirectory: join(root, 'artifact'), repositoryRoot: root }),
  );
  assert.match(error.message, /submodule/i);
  assert.doesNotMatch(error.message, /private-module/);
});

test('rejects tracked secret material while allowing the explicit environment template', (t) => {
  const root = makeRepository(t);
  writeFileSync(join(root, '.env.example'), 'SAFE_TEMPLATE=1\n');
  writeFileSync(join(root, '.env.local'), 'not-a-real-secret\n');
  commitAll(root);

  const error = captureError(() =>
    createReleaseArtifact({ artifactDirectory: join(root, 'artifact'), repositoryRoot: root }),
  );
  assert.match(error.message, /forbidden secret/i);
  assert.doesNotMatch(error.message, /\.env\.local/);
});

test('rejects absolute, parent-traversal, non-canonical, and duplicate-prone path forms', () => {
  for (const releasePath of [
    '/absolute',
    '../escape',
    'nested/../../escape',
    'safe//file',
    'safe/./file',
    'safe\\file',
  ]) {
    assert.throws(() => validateReleasePath(releasePath), /unsafe release path/i);
  }
  assert.equal(validateReleasePath('safe/한글-file.txt'), 'safe/한글-file.txt');
});

test('rejects an archive member that is not present in the file manifest', (t) => {
  const root = makeRepository(t);
  writeFileSync(join(root, 'app.txt'), 'committed\n');
  commitAll(root);
  const artifactDirectory = join(root, 'artifact');
  createReleaseArtifact({ artifactDirectory, repositoryRoot: root });

  writeFileSync(join(root, 'extra.txt'), 'extra\n');
  git(root, 'add', 'extra.txt');
  git(root, 'commit', '--quiet', '--message', 'extra member fixture');
  const appendedArchive = join(root, 'extra-member.tar');
  git(root, 'archive', '--format=tar', `--output=${appendedArchive}`, 'HEAD', 'extra.txt');
  appendTarArchive(join(artifactDirectory, 'release.tar'), appendedArchive);
  refreshArchiveMetadata(artifactDirectory);

  assert.throws(
    () =>
      verifyReleaseArtifact({
        artifactDirectory,
        stagingDirectory: join(root, 'staging'),
      }),
    /archive member set/i,
  );
});

test('rejects duplicate archive members even if the outer archive checksum is refreshed', (t) => {
  const root = makeRepository(t);
  writeFileSync(join(root, 'app.txt'), 'committed\n');
  commitAll(root);
  const artifactDirectory = join(root, 'artifact');
  createReleaseArtifact({ artifactDirectory, repositoryRoot: root });

  const appendedArchive = join(root, 'duplicate-member.tar');
  git(root, 'archive', '--format=tar', `--output=${appendedArchive}`, 'HEAD', 'app.txt');
  appendTarArchive(join(artifactDirectory, 'release.tar'), appendedArchive);
  refreshArchiveMetadata(artifactDirectory);

  assert.throws(
    () =>
      verifyReleaseArtifact({
        artifactDirectory,
        stagingDirectory: join(root, 'staging'),
      }),
    /duplicate archive member/i,
  );
});

test('requires empty staging and detects a post-extraction file mutation', (t) => {
  const root = makeRepository(t);
  writeFileSync(join(root, 'app.txt'), 'committed\n');
  commitAll(root);
  const artifactDirectory = join(root, 'artifact');
  createReleaseArtifact({ artifactDirectory, repositoryRoot: root });

  const nonEmptyStaging = join(root, 'non-empty-staging');
  mkdirSync(nonEmptyStaging);
  writeFileSync(join(nonEmptyStaging, 'existing.txt'), 'existing\n');
  assert.throws(
    () => verifyReleaseArtifact({ artifactDirectory, stagingDirectory: nonEmptyStaging }),
    /staging directory must be empty/i,
  );

  const stagingDirectory = join(root, 'staging');
  verifyReleaseArtifact({ artifactDirectory, stagingDirectory });
  const records = readFileManifest(join(artifactDirectory, 'release-files.jsonl'));
  writeFileSync(join(stagingDirectory, 'app.txt'), 'mutated\n');
  assert.throws(
    () => verifyStagingFiles(stagingDirectory, records),
    /staging file metadata/i,
  );
});
