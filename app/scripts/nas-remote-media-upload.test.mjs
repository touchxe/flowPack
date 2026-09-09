import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RemoteMediaUploadError,
  auditInstalledMediaUploadRelease,
  receiveForcedMediaUpload,
  runCli,
} from './nas-remote-media-upload.mjs';

test('every release-owned forced upload entry point stays fail closed behind the root gateway', () => {
  for (const invoke of [
    auditInstalledMediaUploadRelease,
    receiveForcedMediaUpload,
    runCli,
  ]) {
    assert.throws(
      () => invoke({
        helperPath: '/caller/path',
        inputDescriptor: 0,
        originalCommand: '',
        projectRoot: '/caller/root',
      }),
      (error) => error instanceof RemoteMediaUploadError &&
        error.code === 'MEDIA_UPLOAD_ROOT_GATEWAY_REQUIRED',
    );
  }
});
