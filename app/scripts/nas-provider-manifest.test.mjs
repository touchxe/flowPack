import assert from 'node:assert/strict';
import {
  chmodSync,
  linkSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { canonicalMediaJson, mediaSha256 } from './nas-media-contract.mjs';
import {
  RETAINED_PROVIDER_ENV_NAMES,
  readRetainedProviderManifest,
} from './nas-provider-manifest.mjs';

const MIGRATION_ID = '11111111-2222-4333-8444-555555555555';
const RELEASE_COMMIT = 'a'.repeat(40);

function fixture(t, mutate = (value) => value) {
  const root = mkdtempSync(join(tmpdir(), 'flowpack-provider-manifest-'));
  chmodSync(root, 0o700);
  t.after(() => rmSync(root, { force: true, recursive: true }));
  const activeNames = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'OPENAI_API_KEY'];
  const value = mutate({
    activeNames,
    disabledNames: RETAINED_PROVIDER_ENV_NAMES.filter((name) => !activeNames.includes(name)),
    migrationId: MIGRATION_ID,
    projectId: 'flowpack-v2',
    releaseCommit: RELEASE_COMMIT,
    schemaVersion: 1,
  });
  const path = join(root, 'retained-provider-manifest.json');
  writeFileSync(path, `${canonicalMediaJson(value)}\n`, { mode: 0o600 });
  return { path, root, value };
}

test('accepts only a complete sorted name-only inventory and returns its digest', () => {
  const t = { after: () => undefined };
  const prepared = fixture(t);
  try {
    const result = readRetainedProviderManifest(prepared.path, {
      migrationId: MIGRATION_ID,
      releaseCommit: RELEASE_COMMIT,
    });
    assert.equal(result.activeCount, 3);
    assert.equal(result.disabledCount, RETAINED_PROVIDER_ENV_NAMES.length - 3);
    assert.equal(result.sha256, mediaSha256(`${canonicalMediaJson(prepared.value)}\n`));
    assert.equal(JSON.stringify(result).includes('GOOGLE'), false);
  } finally {
    rmSync(prepared.root, { force: true, recursive: true });
  }
});

test('rejects values, unknown names, incomplete inventory, loose mode, and hardlinks', (t) => {
  for (const mutate of [
    (value) => ({ ...value, values: { OPENAI_API_KEY: 'secret' } }),
    (value) => ({ ...value, activeNames: [...value.activeNames, 'UNKNOWN_SECRET'] }),
    (value) => ({ ...value, disabledNames: value.disabledNames.slice(1) }),
    (value) => ({ ...value, activeNames: [...value.activeNames].reverse() }),
  ]) {
    const prepared = fixture(t, mutate);
    assert.throws(
      () => readRetainedProviderManifest(prepared.path, {
        migrationId: MIGRATION_ID,
        releaseCommit: RELEASE_COMMIT,
      }),
      /RETAINED_PROVIDER_MANIFEST_INVALID/,
    );
  }

  const loose = fixture(t);
  chmodSync(loose.path, 0o644);
  assert.throws(() => readRetainedProviderManifest(loose.path, {
    migrationId: MIGRATION_ID,
    releaseCommit: RELEASE_COMMIT,
  }), /RETAINED_PROVIDER_MANIFEST_INVALID/);

  const hardlinked = fixture(t);
  linkSync(hardlinked.path, join(hardlinked.root, 'alias.json'));
  assert.throws(() => readRetainedProviderManifest(hardlinked.path, {
    migrationId: MIGRATION_ID,
    releaseCommit: RELEASE_COMMIT,
  }), /RETAINED_PROVIDER_MANIFEST_INVALID/);
});
