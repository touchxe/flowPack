import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("NAS profile explicitly disables callbacks, public media and local scheduler", async () => {
  const [compose, env] = await Promise.all([
    read("docker-compose.nas.yml"),
    read("ops/nas/env.example"),
  ]);
  for (const name of [
    "FLOWPACK_PUBLIC_CALLBACKS_ENABLED",
    "FLOWPACK_PUBLIC_MEDIA_ENABLED",
    "FLOWPACK_SCHEDULER_ENABLED",
  ]) {
    assert.match(compose, new RegExp(`^      ${name}: "false"$`, "m"));
    assert.match(env, new RegExp(`^${name}=false$`, "m"));
  }
});

test("inbound Toss and Meta routes enforce the public callback gate", async () => {
  const routes = await Promise.all([
    read("app/api/webhooks/toss/route.ts"),
    read("app/api/payments/confirm/route.ts"),
    read("app/api/meta/data-deletion/route.ts"),
    read("app/api/meta/deauthorize/route.ts"),
  ]);
  for (const route of routes) {
    assert.match(route, /isPublicCallbackEnabled/);
    assert.match(route, /PUBLIC_INTEGRATION_DISABLED/);
  }
});

test("publishing refuses unsafe schedules and public-media-dependent paths", async () => {
  const [publish, instagram] = await Promise.all([
    read("app/api/publish/route.ts"),
    read("app/api/publish/instagram/route.ts"),
  ]);
  assert.match(publish, /isRemoteSchedulingSupported/);
  assert.match(publish, /isPublicMediaEnabled/);
  assert.match(instagram, /isPublicMediaEnabled/);
});

test("maintenance mode removes request-time DDL and suppresses implicit GET writes", async () => {
  const [schemaGuard, redirect, sharedContent] = await Promise.all([
    read("lib/content-share-schema.ts"),
    read("app/r/[id]/route.ts"),
    read("app/api/public/content/[shareToken]/route.ts"),
  ]);
  assert.doesNotMatch(schemaGuard, /\$executeRaw/);
  assert.match(schemaGuard, /CONTENT_SHARE_SCHEMA_NOT_READY/);
  assert.match(redirect, /isImplicitWriteEnabled/);
  assert.match(sharedContent, /isImplicitWriteEnabled/);
});

test("NAS authentication is allowlisted and its credential smoke never creates a session", async () => {
  const [auth, login, register, smoke, socialSmoke, compose, env] = await Promise.all([
    read("lib/auth.ts"),
    read("app/(public)/login/login-form.tsx"),
    read("app/(public)/register/page.tsx"),
    read("app/api/auth/credential-smoke/route.ts"),
    read("app/api/auth/social-token-smoke/route.ts"),
    read("docker-compose.nas.yml"),
    read("ops/nas/env.example"),
  ]);
  assert.match(auth, /resolveAuthProviderIds/);
  assert.match(auth, /enabledProviderIds\.includes/);
  assert.match(login, /useAuthProviders/);
  assert.match(register, /useAuthProviders/);
  assert.match(login, /authProviders\.has\("apple"\)/);
  assert.match(register, /authProviders\.has\("apple"\)/);
  assert.match(smoke, /prisma\.user\.findUnique/);
  assert.match(smoke, /bcrypt\.compare/);
  assert.doesNotMatch(smoke, /prisma\.(?:session|user)\.(?:create|update|delete|upsert)/);
  assert.match(socialSmoke, /prisma\.socialAccount\.findMany/);
  assert.match(socialSmoke, /where: \{ isActive: true \}/);
  assert.match(socialSmoke, /MAX_ACTIVE_SOCIAL_TOKEN_SMOKE_ROWS \+ 1/);
  assert.match(socialSmoke, /decryptSocialToken/);
  assert.doesNotMatch(socialSmoke, /console\.|JSON\.stringify\(rows\)/);
  assert.match(compose, /^      FLOWPACK_AUTH_PROVIDERS: \$\{FLOWPACK_AUTH_PROVIDERS:-credentials\}$/m);
  assert.match(compose, /^      FLOWPACK_AUTH_SMOKE_ENABLED: \$\{FLOWPACK_AUTH_SMOKE_ENABLED:-false\}$/m);
  assert.match(compose, /^      FLOWPACK_SOCIAL_TOKEN_SMOKE_ENABLED: \$\{FLOWPACK_SOCIAL_TOKEN_SMOKE_ENABLED:-false\}$/m);
  assert.match(env, /^FLOWPACK_AUTH_PROVIDERS=credentials$/m);
  assert.match(env, /^FLOWPACK_AUTH_SMOKE_ENABLED=false$/m);
  assert.match(env, /^FLOWPACK_SOCIAL_TOKEN_SMOKE_ENABLED=false$/m);
});

test("the NAS env template names supported retained providers without sample secrets", async () => {
  const env = await read("ops/nas/env.example");
  for (const name of [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "KAKAO_CLIENT_ID",
    "KAKAO_CLIENT_SECRET",
    "APPLE_CLIENT_ID",
    "APPLE_CLIENT_SECRET",
    "OPENAI_API_KEY",
    "RESEND_API_KEY",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "NEXT_PUBLIC_TOSS_CLIENT_KEY",
    "TOSS_SECRET_KEY",
    "META_APP_ID",
    "META_APP_SECRET",
    "FACEBOOK_APP_SECRET",
    "INSTAGRAM_APP_SECRET",
    "THREADS_APP_ID",
    "THREADS_APP_SECRET",
    "TWITTER_CLIENT_ID",
    "TWITTER_CLIENT_SECRET",
    "LINKEDIN_CLIENT_ID",
    "LINKEDIN_CLIENT_SECRET",
  ]) {
    assert.match(env, new RegExp(`^${name}=$`, "m"));
  }
});
