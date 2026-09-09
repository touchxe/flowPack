export const MAX_ACTIVE_SOCIAL_TOKEN_SMOKE_ROWS = 10_000;

const TOKEN_PREFIX = 'enc:v1:';
const MAX_TOKEN_BYTES = 1024 * 1024;

export class SocialTokenContinuityError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SocialTokenContinuityError';
    this.code = code;
  }
}

function fail(code) {
  throw new SocialTokenContinuityError(code);
}

/**
 * @param {string[]} accessTokens
 * @param {{decrypt: (value: string) => string, maximumRows?: number}} options
 */
export function inspectSocialTokenContinuity(
  accessTokens,
  { decrypt, maximumRows = MAX_ACTIVE_SOCIAL_TOKEN_SMOKE_ROWS },
) {
  if (
    !Array.isArray(accessTokens) ||
    typeof decrypt !== 'function' ||
    !Number.isSafeInteger(maximumRows) ||
    maximumRows <= 0 ||
    maximumRows > MAX_ACTIVE_SOCIAL_TOKEN_SMOKE_ROWS
  ) {
    fail('SOCIAL_TOKEN_SMOKE_INPUT_INVALID');
  }
  if (accessTokens.length > maximumRows) fail('SOCIAL_TOKEN_SMOKE_OVERFLOW');

  let encryptedCount = 0;
  let legacyPlaintextCount = 0;
  for (const accessToken of accessTokens) {
    if (
      typeof accessToken !== 'string' ||
      accessToken.length === 0 ||
      Buffer.byteLength(accessToken, 'utf8') > MAX_TOKEN_BYTES
    ) {
      fail('SOCIAL_TOKEN_SMOKE_TOKEN_INVALID');
    }
    if (!accessToken.startsWith(TOKEN_PREFIX)) {
      legacyPlaintextCount += 1;
      continue;
    }
    try {
      const plaintext = decrypt(accessToken);
      if (
        typeof plaintext !== 'string' ||
        plaintext.length === 0 ||
        Buffer.byteLength(plaintext, 'utf8') > MAX_TOKEN_BYTES
      ) {
        fail('SOCIAL_TOKEN_DECRYPT_CONTINUITY_FAILED');
      }
    } catch {
      fail('SOCIAL_TOKEN_DECRYPT_CONTINUITY_FAILED');
    }
    encryptedCount += 1;
  }

  const classification = accessTokens.length === 0
    ? 'none'
    : encryptedCount === accessTokens.length
      ? 'encrypted-only'
      : legacyPlaintextCount === accessTokens.length
        ? 'legacy-plaintext-only'
        : 'mixed';
  return Object.freeze({
    classification,
    encryptedCount,
    encryptedDecryptFailures: 0,
    legacyPlaintextCount,
    ok: true,
    totalCount: accessTokens.length,
  });
}
