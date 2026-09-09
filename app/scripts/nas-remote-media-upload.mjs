#!/usr/bin/env node

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export class RemoteMediaUploadError extends Error {
  constructor(code) {
    super(code);
    this.name = 'RemoteMediaUploadError';
    this.code = code;
  }
}

function blocked() {
  throw new RemoteMediaUploadError('MEDIA_UPLOAD_ROOT_GATEWAY_REQUIRED');
}

// Kept as fail-closed compatibility exports so an old release cannot silently
// regain the former release-owned SSH authorization path. The root-owned
// restricted gateway now owns framing, fixed incoming storage, receipt and
// project mapping before it invokes any reviewed media library primitive.
export function auditInstalledMediaUploadRelease() {
  return blocked();
}

export function receiveForcedMediaUpload() {
  return blocked();
}

export function runCli() {
  return blocked();
}

const invokedPath = process.argv[1] === undefined
  ? undefined
  : pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  try {
    runCli();
  } catch {
    process.stderr.write('{"ok":false}\n');
    process.exitCode = 1;
  }
}
