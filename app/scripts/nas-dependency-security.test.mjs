import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const lockfile = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));

function locked(name) {
  return lockfile.packages[`node_modules/${name}`]?.version;
}

test('NAS build pins the reviewed patched production dependency floor', () => {
  assert.equal(packageJson.engines.node, '>=20 <25');
  assert.equal(packageJson.dependencies.next, '^15.5.23');
  assert.equal(packageJson.dependencies['next-auth'], '^5.0.0-beta.32');
  assert.equal(packageJson.dependencies['@auth/prisma-adapter'], '^2.11.3');
  assert.equal(packageJson.dependencies.dompurify, '^3.4.14');
  assert.equal(packageJson.dependencies.marked, '^18.0.10');
  assert.equal(packageJson.dependencies.resend, '^6.22.0');
  assert.equal(packageJson.dependencies['@prisma/client'], '^6.19.3');
  assert.equal(packageJson.devDependencies.prisma, '^6.19.3');

  assert.equal(locked('next'), '15.5.23');
  assert.equal(locked('next-auth'), '5.0.0-beta.32');
  assert.equal(locked('@auth/core'), '0.41.3');
  assert.equal(locked('@auth/prisma-adapter'), '2.11.3');
  assert.equal(locked('dompurify'), '3.4.14');
  assert.equal(locked('marked'), '18.0.10');
  assert.equal(locked('resend'), '6.22.0');
});

test('reviewed transitive overrides remain present in every locked installation', () => {
  assert.deepEqual(packageJson.overrides, {
    'deepmerge-ts': '8.0.2',
    'js-yaml': '4.3.1',
    'minimatch@3.1.5': { 'brace-expansion': '1.1.18' },
    'minimatch@10.2.5': { 'brace-expansion': '5.0.9' },
    postcss: '$postcss',
    sharp: '0.35.3',
  });

  const expectedVersions = new Map([
    ['deepmerge-ts', new Set(['8.0.2'])],
    ['js-yaml', new Set(['4.3.1'])],
    ['postcss', new Set(['8.5.26'])],
    ['sharp', new Set(['0.35.3'])],
    ['brace-expansion', new Set(['1.1.18', '5.0.9'])],
  ]);
  const observed = new Map([...expectedVersions.keys()].map((name) => [name, new Set()]));
  for (const [path, metadata] of Object.entries(lockfile.packages)) {
    for (const name of expectedVersions.keys()) {
      if (path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`)) {
        observed.get(name).add(metadata.version);
      }
    }
  }
  for (const [name, expected] of expectedVersions) {
    assert.deepEqual(observed.get(name), expected, `${name} lock versions changed`);
  }
});
