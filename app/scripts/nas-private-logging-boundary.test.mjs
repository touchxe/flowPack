import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function source(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function assertNoLoggedExpression(path, expressions) {
  const contents = source(path);
  const logCalls = contents.match(/console\.(?:log|warn|error)\([^;]*\);/gs) ?? [];
  const joined = logCalls.join("\n");
  for (const expression of expressions) {
    assert.doesNotMatch(joined, expression, `${path} must not place private values in logs`);
  }
}

test("password reset tokens and contact PII are never written to logs", () => {
  assertNoLoggedExpression("app/api/auth/forgot-password/route.ts", [
    /\bemail\b/,
    /\btoken\b/,
    /reset\?token/,
  ]);
  assertNoLoggedExpression("app/api/contact/route.ts", [
    /\bemail\b/,
    /\bmessage\b(?!Bytes)/,
  ]);
});

test("OAuth logs exclude provider payloads, identities, URLs, tokens and caught errors", () => {
  assertNoLoggedExpression("lib/integrations/instagram.ts", [
    /\baccessToken\b/,
    /\bshortToken\b/,
    /\burl\b/,
    /\bdata\b/,
    /await\s+res\.text/,
  ]);
  assertNoLoggedExpression("app/api/social-accounts/callback/instagram/route.ts", [
    /session\.user\.id/,
    /profile\.(?:id|username)/,
    /shortTokenResult\.userId/,
    /existing\.id/,
    /\bexpiresAt\b/,
    /\berr\b/,
  ]);
});

test("publishing logs contain counts and outcomes, not remote addresses or object identities", () => {
  const privateExpressions = [
    /creds\.siteUrl/,
    /img\.(?:id|url)/,
    /imgResult\.(?:mediaId|mediaUrl|error)/,
    /wpResult\.(?:post|error)/,
    /\bwpTitle\b/,
  ];
  assertNoLoggedExpression("app/api/publish/route.ts", privateExpressions);
  assertNoLoggedExpression("app/api/publish/wordpress/route.ts", privateExpressions);
});
