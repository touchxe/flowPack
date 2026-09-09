#!/usr/bin/env node

import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { initializeBackupKey } from './nas-database-artifact.mjs';

export class BackupKeyOperatorError extends Error {
  constructor(code) {
    super(code);
    this.name = 'BackupKeyOperatorError';
    this.code = code;
  }
}

function fail(code) {
  throw new BackupKeyOperatorError(code);
}

export function parseBackupKeyArguments(argv) {
  if (
    !Array.isArray(argv) ||
    argv.length !== 3 ||
    argv[0] !== 'init' ||
    argv[1] !== '--output' ||
    typeof argv[2] !== 'string' ||
    argv[2].length === 0 ||
    argv[2].length > 4096 ||
    !isAbsolute(argv[2]) ||
    resolve(argv[2]) !== argv[2] ||
    !/^[A-Za-z0-9_./-]+$/.test(argv[2]) ||
    argv[2].includes('//')
  ) {
    fail('USAGE');
  }
  return argv[2];
}

export function initializeBackupKeyCli(argv = process.argv.slice(2), initialize = initializeBackupKey) {
  if (typeof initialize !== 'function') fail('INVALID_DEPENDENCY');
  const outputPath = parseBackupKeyArguments(argv);
  const result = initialize(outputPath);
  if (result?.ok !== true || Object.keys(result).length !== 1) fail('KEY_INITIALIZATION_FAILED');
  return Object.freeze({ ok: true });
}

const invokedPath = process.argv[1] === undefined ? undefined : pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  try {
    process.stdout.write(`${JSON.stringify(initializeBackupKeyCli())}\n`);
  } catch {
    process.stderr.write('{"ok":false}\n');
    process.exitCode = 1;
  }
}
