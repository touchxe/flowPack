import assert from 'node:assert/strict';
import test from 'node:test';

import {
  inspectSocialTokenContinuity,
  MAX_ACTIVE_SOCIAL_TOKEN_SMOKE_ROWS,
} from './social-token-continuity.mjs';

test('checks every encrypted token while returning classification and counts only', () => {
  const seen = [];
  const result = inspectSocialTokenContinuity([
    'enc:v1:first-secret-envelope',
    'legacy-plaintext-secret',
    'enc:v1:second-secret-envelope',
  ], {
    decrypt(value) {
      seen.push(value);
      return `decrypted-${value}`;
    },
  });
  assert.equal(seen.length, 2);
  assert.deepEqual(result, {
    classification: 'mixed',
    encryptedCount: 2,
    encryptedDecryptFailures: 0,
    legacyPlaintextCount: 1,
    ok: true,
    totalCount: 3,
  });
  const output = JSON.stringify(result);
  assert.doesNotMatch(output, /secret|envelope|decrypted/);
});

test('one encrypted-token failure fails closed without echoing the token', () => {
  const secret = 'enc:v1:do-not-print-this-envelope';
  assert.throws(
    () => inspectSocialTokenContinuity([secret], { decrypt: () => { throw new Error(secret); } }),
    (error) => {
      assert.equal(error.code, 'SOCIAL_TOKEN_DECRYPT_CONTINUITY_FAILED');
      assert.equal(error.message.includes(secret), false);
      return true;
    },
  );
});

test('the bounded full scan rejects overflow before decryption', () => {
  let decryptCalls = 0;
  assert.throws(
    () => inspectSocialTokenContinuity(
      Array.from({ length: 4 }, () => 'enc:v1:value'),
      { maximumRows: 3, decrypt: () => { decryptCalls += 1; return 'value'; } },
    ),
    /SOCIAL_TOKEN_SMOKE_OVERFLOW/,
  );
  assert.equal(decryptCalls, 0);
  assert.throws(
    () => inspectSocialTokenContinuity([], {
      maximumRows: MAX_ACTIVE_SOCIAL_TOKEN_SMOKE_ROWS + 1,
      decrypt: () => 'value',
    }),
    /SOCIAL_TOKEN_SMOKE_INPUT_INVALID/,
  );
});
