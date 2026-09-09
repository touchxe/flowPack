import assert from 'node:assert/strict';
import { chmodSync, lstatSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { initializeBackupKeyCli, parseBackupKeyArguments } from './nas-backup-key.mjs';

function privateDirectory(prefix) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  chmodSync(directory, 0o700);
  return directory;
}

test('initializes a new mode-0600 backup key without returning key material or its path', (t) => {
  const root = privateDirectory('flowpack-backup-key-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const keyPath = join(root, 'backup.key');
  const result = initializeBackupKeyCli(['init', '--output', keyPath]);
  assert.deepEqual(result, { ok: true });
  assert.equal(lstatSync(keyPath).mode & 0o777, 0o600);
  assert.match(readFileSync(keyPath, 'utf8'), /^[A-Za-z0-9+/]{43}=\n$/);
  assert.equal(JSON.stringify(result).includes(keyPath), false);
  assert.throws(() => initializeBackupKeyCli(['init', '--output', keyPath]));
});

test('rejects relative, non-canonical, unsafe, and malformed arguments', () => {
  for (const argv of [
    [],
    ['init', '--output', 'backup.key'],
    ['init', '--output', '/private/tmp/../tmp/backup.key'],
    ['init', '--output', '/private/tmp/key with space'],
    ['create', '--output', '/private/tmp/backup.key'],
  ]) {
    assert.throws(() => parseBackupKeyArguments(argv), /USAGE/);
  }
});

test('fails closed when the injected key writer returns an unexpected shape', () => {
  assert.throws(
    () =>
      initializeBackupKeyCli(
        ['init', '--output', '/private/tmp/backup.key'],
        () => ({ ok: true, key: 'not-allowed' }),
      ),
    /KEY_INITIALIZATION_FAILED/,
  );
});
