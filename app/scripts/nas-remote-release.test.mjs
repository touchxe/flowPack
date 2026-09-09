import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createReleaseArtifact } from './nas-release-artifact.mjs';
import {
  finishRelease,
  prepareRelease,
  promoteRelease,
  rollbackRelease,
  validateFunnelStatus,
  validateServeConfig,
  verifyCurrentRelease,
  verifyNetworkFiles,
} from './nas-remote-release.mjs';

const PROJECT_ID = 'flowpack-nas';
const SERVICE_ID = 'svc:flowpack';
const PORT_KEY = 'FLOWPACK_NAS_HTTP_PORT';
const TOKEN = 'a'.repeat(32);

function git(cwd, ...args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function privateFile(filePath, contents) {
  writeFileSync(filePath, contents, { mode: 0o600 });
  chmodSync(filePath, 0o600);
}

function makeFixture(t) {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'nas-remote-release-'));
  t.after(() => rmSync(temporaryRoot, { force: true, recursive: true }));
  const projectRoot = join(temporaryRoot, 'project');
  mkdirSync(join(projectRoot, 'scripts'), { recursive: true });
  mkdirSync(join(projectRoot, 'releases'));
  mkdirSync(join(projectRoot, 'state', 'incoming'), { recursive: true });
  privateFile(join(projectRoot, '.nas-project-id'), `${PROJECT_ID}\n`);
  privateFile(
    join(projectRoot, '.env.nas.local'),
    `${PORT_KEY}=13001\nUNRELATED_SECRET=not-printed\n`,
  );
  privateFile(join(projectRoot, '.env.nas.db.local'), 'POSTGRES_PASSWORD=not-printed\n');
  writeFileSync(join(projectRoot, 'app.txt'), 'release-one\n');
  copyFileSync(
    new URL('./nas-remote-release.mjs', import.meta.url),
    join(projectRoot, 'scripts', 'nas-remote-release.mjs'),
  );

  git(projectRoot, 'init', '--quiet');
  git(projectRoot, 'config', 'user.name', 'Remote Release Test');
  git(projectRoot, 'config', 'user.email', 'remote-release@example.invalid');
  git(projectRoot, 'add', 'app.txt', 'scripts/nas-remote-release.mjs');
  git(projectRoot, 'commit', '--quiet', '--message', 'release one');
  const commit = git(projectRoot, 'rev-parse', 'HEAD');
  const artifact = join(temporaryRoot, 'artifact');
  createReleaseArtifact({ artifactDirectory: artifact, repositoryRoot: projectRoot });
  const stage = join(projectRoot, 'state', 'incoming', `${commit}-${TOKEN}`);
  mkdirSync(stage, { mode: 0o700 });
  for (const file of [
    'release.tar',
    'release-files.jsonl',
    'release-manifest.json',
  ]) {
    copyFileSync(join(artifact, file), join(stage, file));
    chmodSync(join(stage, file), 0o600);
  }
  copyFileSync(
    join(projectRoot, 'scripts', 'nas-remote-release.mjs'),
    join(stage, 'nas-remote-release.mjs'),
  );
  chmodSync(join(stage, 'nas-remote-release.mjs'), 0o600);
  return { commit, projectRoot, stage, temporaryRoot };
}

test('prepares a commit-bound immutable release and promotes current atomically', (t) => {
  const fixture = makeFixture(t);
  const prepared = prepareRelease({
    projectId: PROJECT_ID,
    projectRoot: fixture.projectRoot,
    commit: fixture.commit,
    token: TOKEN,
  });
  assert.deepEqual(prepared, { ok: true, hadPrevious: false, previousCommit: null });
  assert.equal(readFileSync(join(fixture.projectRoot, 'releases', fixture.commit, 'app.txt'), 'utf8'), 'release-one\n');

  promoteRelease({ projectId: PROJECT_ID, projectRoot: fixture.projectRoot, token: TOKEN });
  assert.equal(readlinkSync(join(fixture.projectRoot, 'current')), `releases/${fixture.commit}`);
  finishRelease({ projectId: PROJECT_ID, projectRoot: fixture.projectRoot, token: TOKEN });
  assert.deepEqual(
    verifyCurrentRelease({ projectId: PROJECT_ID, projectRoot: fixture.projectRoot }),
    { ok: true, currentCommit: fixture.commit },
  );
});

test('rollback restores the exact previous source release and never removes either release', (t) => {
  const first = makeFixture(t);
  prepareRelease({
    projectId: PROJECT_ID,
    projectRoot: first.projectRoot,
    commit: first.commit,
    token: TOKEN,
  });
  promoteRelease({ projectId: PROJECT_ID, projectRoot: first.projectRoot, token: TOKEN });
  finishRelease({ projectId: PROJECT_ID, projectRoot: first.projectRoot, token: TOKEN });

  writeFileSync(join(first.projectRoot, 'app.txt'), 'release-two\n');
  git(first.projectRoot, 'add', 'app.txt');
  git(first.projectRoot, 'commit', '--quiet', '--message', 'release two');
  const nextCommit = git(first.projectRoot, 'rev-parse', 'HEAD');
  const nextArtifact = join(first.temporaryRoot, 'artifact-two');
  createReleaseArtifact({ artifactDirectory: nextArtifact, repositoryRoot: first.projectRoot });
  const nextToken = 'b'.repeat(32);
  const nextStage = join(first.projectRoot, 'state', 'incoming', `${nextCommit}-${nextToken}`);
  mkdirSync(nextStage, { mode: 0o700 });
  for (const file of ['release.tar', 'release-files.jsonl', 'release-manifest.json']) {
    copyFileSync(join(nextArtifact, file), join(nextStage, file));
    chmodSync(join(nextStage, file), 0o600);
  }
  copyFileSync(
    join(first.projectRoot, 'scripts', 'nas-remote-release.mjs'),
    join(nextStage, 'nas-remote-release.mjs'),
  );
  chmodSync(join(nextStage, 'nas-remote-release.mjs'), 0o600);

  assert.deepEqual(
    prepareRelease({
      projectId: PROJECT_ID,
      projectRoot: first.projectRoot,
      commit: nextCommit,
      token: nextToken,
    }),
    { ok: true, hadPrevious: true, previousCommit: first.commit },
  );
  promoteRelease({ projectId: PROJECT_ID, projectRoot: first.projectRoot, token: nextToken });
  assert.equal(readlinkSync(join(first.projectRoot, 'current')), `releases/${nextCommit}`);
  assert.deepEqual(
    rollbackRelease({ projectId: PROJECT_ID, projectRoot: first.projectRoot, token: nextToken }),
    { ok: true, hadPrevious: true, previousCommit: first.commit },
  );
  assert.equal(readlinkSync(join(first.projectRoot, 'current')), `releases/${first.commit}`);
  assert.equal(readFileSync(join(first.projectRoot, 'releases', first.commit, 'app.txt'), 'utf8'), 'release-one\n');
  assert.equal(readFileSync(join(first.projectRoot, 'releases', nextCommit, 'app.txt'), 'utf8'), 'release-two\n');
});

test('rejects tampered transfer inputs before extraction and releases the exclusive lock', (t) => {
  const fixture = makeFixture(t);
  writeFileSync(join(fixture.stage, 'release.tar'), 'tampered\n');
  chmodSync(join(fixture.stage, 'release.tar'), 0o600);
  assert.throws(
    () =>
      prepareRelease({
        projectId: PROJECT_ID,
        projectRoot: fixture.projectRoot,
        commit: fixture.commit,
        token: TOKEN,
      }),
    /checksum/i,
  );
  assert.equal(
    (() => {
      try {
        readFileSync(join(fixture.projectRoot, 'state', 'source-deploy.lock', 'token'));
        return true;
      } catch {
        return false;
      }
    })(),
    false,
  );
});

test('requires mode-600 non-symlink runtime and database environments', (t) => {
  const fixture = makeFixture(t);
  chmodSync(join(fixture.projectRoot, '.env.nas.local'), 0o644);
  assert.throws(
    () =>
      prepareRelease({
        projectId: PROJECT_ID,
        projectRoot: fixture.projectRoot,
        commit: fixture.commit,
        token: TOKEN,
      }),
    /environment file/i,
  );

  chmodSync(join(fixture.projectRoot, '.env.nas.local'), 0o600);
  rmSync(join(fixture.projectRoot, '.env.nas.db.local'));
  symlinkSync('.env.nas.local', join(fixture.projectRoot, '.env.nas.db.local'));
  assert.throws(
    () =>
      prepareRelease({
        projectId: PROJECT_ID,
        projectRoot: fixture.projectRoot,
        commit: fixture.commit,
        token: TOKEN,
      }),
    /environment file/i,
  );
});

test('structured Serve config requires the fixed service, HTTPS endpoint, loopback backend, and advertised state', () => {
  const valid = {
    version: '0.0.1',
    services: {
      [SERVICE_ID]: {
        endpoints: { 'tcp:443': 'http://127.0.0.1:13001' },
      },
    },
  };
  assert.equal(validateServeConfig({ config: valid, projectId: PROJECT_ID, backendPort: 13001 }), true);
  assert.throws(
    () =>
      validateServeConfig({
        config: {
          ...valid,
          services: { [SERVICE_ID]: { ...valid.services[SERVICE_ID], advertised: false } },
        },
        projectId: PROJECT_ID,
        backendPort: 13001,
      }),
    /backend/i,
  );
  assert.throws(
    () =>
      validateServeConfig({
        config: {
          ...valid,
          services: {
            [SERVICE_ID]: { endpoints: { 'tcp:443': 'http://0.0.0.0:13001' } },
          },
        },
        projectId: PROJECT_ID,
        backendPort: 13001,
      }),
    /backend/i,
  );
  assert.throws(
    () =>
      validateServeConfig({
        config: {
          ...valid,
          services: {
            [SERVICE_ID]: {
              endpoints: {
                'tcp:80': 'http://127.0.0.1:13001',
                'tcp:443': 'http://127.0.0.1:13001',
              },
            },
          },
        },
        projectId: PROJECT_ID,
        backendPort: 13001,
      }),
    /backend/i,
  );
});

test('Funnel is fail-closed and integrated network verification reads only the runtime port', (t) => {
  const fixture = makeFixture(t);
  const servePath = join(fixture.temporaryRoot, 'serve.json');
  const funnelPath = join(fixture.temporaryRoot, 'funnel.json');
  privateFile(
    servePath,
    `${JSON.stringify({
      version: '0.0.1',
      services: {
        [SERVICE_ID]: { endpoints: { 'tcp:443': 'http://127.0.0.1:13001' } },
      },
    })}\n`,
  );
  privateFile(funnelPath, '{}\n');
  assert.deepEqual(
    verifyNetworkFiles({
      projectId: PROJECT_ID,
      projectRoot: fixture.projectRoot,
      serveConfigPath: servePath,
      funnelStatusPath: funnelPath,
    }),
    { ok: true, networkVerified: true },
  );
  assert.equal(validateFunnelStatus({}), true);
  assert.throws(
    () => validateFunnelStatus({ AllowFunnel: { 'example.ts.net:443': true } }),
    /Funnel/i,
  );
});

