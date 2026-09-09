import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildRemoteHelperVector,
  createSystemLiveCutoverOperations,
} from './nas-live-cutover-system.mjs';

const PROJECT_ID = 'flowpack-nas';
const MIGRATION_ID = '11111111-2222-4333-8444-555555555555';
const RELEASE_COMMIT = 'a'.repeat(40);
const TOKEN_DIGEST = 'b'.repeat(64);
const DUMP_DIGEST = 'c'.repeat(64);
const NAMES = {
  canonicalDatabase: 'flowpack',
  candidateDatabase: 'flowpack_candidate_123456789abc',
  previousDatabase: 'flowpack_precutover_123456789abc',
};

function evidence() {
  return {
    schemaVersion: 1,
    database: { encoding: 'UTF8', collate: 'C.UTF-8', ctype: 'C.UTF-8' },
    schemas: ['public'],
    extensions: ['plpgsql'],
    objectsSha256: '1'.repeat(64),
    tables: [{ name: 'public.Content', rowCount: 2, dataSha256: '2'.repeat(64) }],
    sequences: [],
    largeObjects: [],
  };
}

function context(overrides = {}) {
  return {
    control: {
      projectId: PROJECT_ID,
      migrationId: MIGRATION_ID,
      releaseCommit: RELEASE_COMMIT,
    },
    tokenDigest: TOKEN_DIGEST,
    confirmation: `${PROJECT_ID}:${MIGRATION_ID}:restore-destination`,
    databaseNames: NAMES,
    finalReport: {
      dumpDigest: DUMP_DIGEST,
      sourceEvidence: evidence(),
    },
    restoreCommand: {
      executable: 'pg_restore',
      args: [
        '--dbname',
        NAMES.candidateDatabase,
        '--single-transaction',
        '--exit-on-error',
        '--no-owner',
        '--no-acl',
        `/backups/${MIGRATION_ID}-final.dump`,
      ],
    },
    ...overrides,
  };
}

test('standard live operations fail closed without a restricted-gateway adapter', () => {
  assert.throws(
    () => createSystemLiveCutoverOperations({ projectId: PROJECT_ID }),
    /RESTRICTED_GATEWAY_STANDARD_PATH_REQUIRED/,
  );
});

test('remote helper vector contains one identity tuple and rejects shell/scp-unsafe roots', () => {
  const helperArguments = [
    MIGRATION_ID,
    RELEASE_COMMIT,
    TOKEN_DIGEST,
    'LOCKED',
    'TARGET_PREPARED',
    'd'.repeat(64),
    `${PROJECT_ID}:${MIGRATION_ID}:prepare-target`,
  ];
  const vector = buildRemoteHelperVector({
    uid: '1026',
    gid: '100',
    projectRoot: '/volume1/private/flowpack',
    image: 'node:20-bookworm-slim',
    command: 'advance',
    helperArguments,
  });
  assert.deepEqual(vector.slice(4), ['advance', PROJECT_ID, '/project', ...helperArguments]);
  for (const value of [MIGRATION_ID, RELEASE_COMMIT, TOKEN_DIGEST]) {
    assert.equal(vector.filter((entry) => entry === value).length, 1);
  }
  assert.throws(
    () => buildRemoteHelperVector({
      uid: '1',
      gid: '1',
      projectRoot: '/volume1/private/flow pack',
      image: 'node:20-bookworm-slim',
      command: 'advance',
      helperArguments,
    }),
    /REMOTE_ROOT_UNSAFE/,
  );
});

test('advance adapter sends the identity vector exactly once', () => {
  const helperCalls = [];
  const transport = {
    helper: (command, args) => {
      helperCalls.push({ command, args });
      return { ok: true, phase: 'TARGET_PREPARED' };
    },
  };
  const operations = createSystemLiveCutoverOperations(
    { projectId: PROJECT_ID },
    {
      transport,
      collectEvidence: async () => evidence(),
      compareEvidence: () => ({ ok: true, differenceCount: 0 }),
      fetchImpl: async () => ({ status: 200 }),
    },
  );
  operations.advanceRemotePhase(context({
    expectedPhase: 'LOCKED',
    targetPhase: 'TARGET_PREPARED',
    evidenceDigest: 'd'.repeat(64),
    confirmation: `${PROJECT_ID}:${MIGRATION_ID}:prepare-target`,
  }));
  assert.deepEqual(helperCalls, [{
    command: 'advance',
    args: [
      MIGRATION_ID,
      RELEASE_COMMIT,
      TOKEN_DIGEST,
      'LOCKED',
      'TARGET_PREPARED',
      'd'.repeat(64),
      `${PROJECT_ID}:${MIGRATION_ID}:prepare-target`,
    ],
  }]);
});

test('runtime env preflight occurs before lock and snapshot failure aborts the lock', () => {
  const calls = [];
  let remoteCount = 0;
  const transport = {
    projectRoot: '/volume1/private/flowpack',
    remote: () => {
      remoteCount += 1;
      calls.push(`remote:${remoteCount}`);
      if (remoteCount === 2) throw new Error('snapshot finalize failed');
      return '';
    },
    helper: (command, args) => {
      calls.push(`helper:${command}`);
      if (command === 'prepare') return { ok: true, phase: 'LOCKED' };
      assert.equal(command, 'finish-rollback');
      assert.equal(args.at(-1), `${PROJECT_ID}:${MIGRATION_ID}:pre-write-rollback`);
      return { ok: true, phase: 'ROLLED_BACK', lockReleased: true };
    },
  };
  const operations = createSystemLiveCutoverOperations(
    { projectId: PROJECT_ID },
    {
      transport,
      collectEvidence: async () => evidence(),
      compareEvidence: () => ({ ok: true, differenceCount: 0 }),
      fetchImpl: async () => ({ status: 200 }),
    },
  );
  assert.throws(
    () => operations.acquireRemoteLock(context({
      confirmation: `${PROJECT_ID}:${MIGRATION_ID}:prepare-target`,
    })),
    /snapshot finalize failed/,
  );
  assert.deepEqual(calls.slice(0, 4), [
    'remote:1',
    'helper:prepare',
    'remote:2',
    'helper:finish-rollback',
  ]);
});

function topologyTransport() {
  const candidateMarker = `${PROJECT_ID}:${MIGRATION_ID}:candidate:${DUMP_DIGEST}`;
  const previousMarker = `${PROJECT_ID}:${MIGRATION_ID}:precutover`;
  const state = {
    canonical: { exists: true, comment: null },
    candidate: { exists: false, comment: null },
    previous: { exists: false, comment: null },
  };
  const calls = [];
  const transport = {
    projectRoot: '/volume1/private/flowpack',
    httpsUrl: new URL('https://flowpack.example.ts.net/'),
    dbPsql: (_database, sql) => {
      if (sql.includes("'canonical', json_build_object")) return `${JSON.stringify(state)}\n`;
      if (sql.includes("'baselineAbsent'")) {
        return `${JSON.stringify({ schemas: ['public'], baselineAbsent: true })}\n`;
      }
      if (sql.includes('COMMENT ON DATABASE') && sql.includes('RENAME TO')) {
        calls.push('rename-previous');
        state.canonical = { exists: false, comment: null };
        state.previous = { exists: true, comment: previousMarker };
        return '';
      }
      if (sql.includes(`ALTER DATABASE "${NAMES.candidateDatabase}" RENAME`)) {
        calls.push('promote-candidate');
        state.canonical = { ...state.candidate, exists: true };
        state.candidate = { exists: false, comment: null };
        return '';
      }
      if (sql.includes(`DROP DATABASE "${NAMES.candidateDatabase}"`)) {
        calls.push('drop-candidate');
        state.candidate = { exists: false, comment: null };
        return '';
      }
      return '';
    },
    dbShell: (script, args = []) => {
      if (script.includes('createdb')) {
        calls.push('restore-candidate');
        state.candidate = { exists: true, comment: args[6] };
        return 'RESTORED\n';
      }
      if (script.includes('sha256sum')) {
        calls.push('verify-staged-dump');
        return '';
      }
      return '';
    },
    compose: () => '',
    remote: () => '',
    helper: () => ({ ok: true }),
  };
  return { calls, candidateMarker, previousMarker, state, transport };
}

test('candidate restore and both rename mutations resume idempotently after crashes', async () => {
  const f = topologyTransport();
  const operations = createSystemLiveCutoverOperations(
    { projectId: PROJECT_ID },
    {
      transport: f.transport,
      collectEvidence: async () => evidence(),
      compareEvidence: () => ({ ok: true, differenceCount: 0 }),
      fetchImpl: async () => ({ status: 200 }),
    },
  );
  const ctx = context();
  await operations.restoreCandidate(ctx);
  await operations.restoreCandidate(ctx);
  assert.equal(f.calls.filter((call) => call === 'restore-candidate').length, 1);
  assert.equal(f.calls.filter((call) => call === 'verify-staged-dump').length, 2);
  assert.equal(f.state.candidate.comment, f.candidateMarker);

  operations.renameCanonicalToPrevious(ctx);
  operations.renameCanonicalToPrevious(ctx);
  assert.equal(f.calls.filter((call) => call === 'rename-previous').length, 1);
  assert.equal(f.state.previous.comment, f.previousMarker);

  operations.renameCandidateToCanonical(ctx);
  operations.renameCandidateToCanonical(ctx);
  assert.equal(f.calls.filter((call) => call === 'promote-candidate').length, 1);
  assert.equal(f.state.canonical.comment, f.candidateMarker);
});

test('read-only HTTPS smoke requires the exact operator-only social-token continuity probe', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'flowpack-social-smoke-'));
  chmodSync(root, 0o700);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const authSmokeInputPath = join(root, 'auth-smoke.json');
  const token = 'credential-operator-token-value-1234567890';
  const socialToken = 'social-operator-token-value-1234567890123';
  writeFileSync(authSmokeInputPath, `${JSON.stringify({
    email: 'operator@example.test',
    password: 'private-password',
    schemaVersion: 1,
    socialToken,
    token,
  })}\n`, { mode: 0o600 });
  chmodSync(authSmokeInputPath, 0o600);

  const requests = [];
  let socialStatus = 204;
  const fetchImpl = async (url, init) => {
    requests.push({ init, pathname: url.pathname });
    const status = {
      '/api/health': 200,
      '/api/media': 503,
      '/api/auth/credential-smoke': 204,
      '/api/auth/social-token-smoke': socialStatus,
    }[url.pathname];
    return { status };
  };
  const transport = {
    httpsUrl: new URL('https://flowpack.example.ts.net/'),
    dbPsql: () => '',
  };
  const operations = createSystemLiveCutoverOperations(
    { projectId: PROJECT_ID },
    {
      transport,
      collectEvidence: async () => evidence(),
      compareEvidence: () => ({ ok: true, differenceCount: 0 }),
      fetchImpl,
    },
  );
  const smokeContext = context({
    control: {
      authSmokeInputPath,
      migrationId: MIGRATION_ID,
      projectId: PROJECT_ID,
      releaseCommit: RELEASE_COMMIT,
    },
  });
  const result = await operations.smokeReadOnly(smokeContext);
  assert.equal(result.socialTokenDecryptSmokePassed, true);
  const socialRequest = requests.find(
    ({ pathname }) => pathname === '/api/auth/social-token-smoke',
  );
  assert.equal(
    socialRequest.init.headers['x-flowpack-social-token-smoke-token'],
    socialToken,
  );
  assert.equal(JSON.stringify(result).includes(socialToken), false);
  assert.equal(JSON.stringify(result).includes('private-password'), false);

  socialStatus = 409;
  await assert.rejects(
    () => operations.smokeReadOnly(smokeContext),
    /ZERO_WRITE_HTTP_GATE_FAILED/,
  );
});
