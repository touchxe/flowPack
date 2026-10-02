import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  getExternalMediaReferences,
  toExternalBody,
  toStoredExternalMarkdown,
} from "./external-content-markdown.ts";
import {
  createExternalContentSchema,
  generateExternalLongformJobSchema,
  updateExternalContentSchema,
} from "./validations/external-content-schema.ts";
import { resolveAIProviderBaseUrl } from "./ai-provider-base-url.mjs";

test("external media references round-trip without changing unrelated links", () => {
  const input = "![대표](flowpack-media:media_1)\n\n[일반 링크](https://example.com/a)";
  const stored = toStoredExternalMarkdown(input);
  assert.equal(stored, "![대표](/api/media/media_1/content)\n\n[일반 링크](https://example.com/a)");
  assert.deepEqual(toExternalBody(stored), { body: input, bodyFormat: "markdown" });
  assert.deepEqual([...getExternalMediaReferences(input)], ["media_1"]);
});

test("HTML edited by the existing editor is reported as HTML", () => {
  assert.deepEqual(toExternalBody("<p>본문</p>"), { body: "<p>본문</p>", bodyFormat: "html" });
});

test("create schema rejects unsupported format and more than ten images", () => {
  assert.equal(createExternalContentSchema.safeParse({ title: "글", bodyFormat: "html", body: "본문" }).success, false);
  assert.equal(createExternalContentSchema.safeParse({
    title: "글", bodyFormat: "markdown", body: "본문",
    images: Array.from({ length: 11 }, (_, index) => ({ mediaId: `m${index}`, altText: "" })),
  }).success, false);
});

test("body update requires an explicit markdown format", () => {
  assert.equal(updateExternalContentSchema.safeParse({ expectedRevision: 1, body: "수정" }).success, false);
  assert.equal(updateExternalContentSchema.safeParse({ expectedRevision: 1, body: "수정", bodyFormat: "markdown" }).success, true);
});

test("generation jobs accept at most ten owned media references and a listed cover", () => {
  assert.equal(generateExternalLongformJobSchema.safeParse({
    topic: "사진 글",
    images: [{ mediaId: "m1", altText: "대표" }],
    coverMediaId: "m1",
  }).success, true);
  assert.equal(generateExternalLongformJobSchema.safeParse({
    topic: "사진 글",
    images: [{ mediaId: "m1", altText: "대표" }],
    coverMediaId: "m2",
  }).success, false);
});

test("markdown input rejects raw HTML and unsafe link schemes", () => {
  assert.equal(createExternalContentSchema.safeParse({
    title: "글", bodyFormat: "markdown", body: "<script>alert(1)</script>",
  }).success, false);
  assert.equal(createExternalContentSchema.safeParse({
    title: "글", bodyFormat: "markdown", body: "[실행](javascript:alert(1))",
  }).success, false);
  assert.equal(createExternalContentSchema.safeParse({
    title: "글", bodyFormat: "markdown", body: "[안전](https://example.com)",
  }).success, true);
  assert.equal(createExternalContentSchema.safeParse({
    title: "글", bodyFormat: "markdown", body: "![외부](https://example.com/image.jpg)",
  }).success, false);
});

test("external API migration is additive PostgreSQL SQL", async () => {
  const sql = await readFile(new URL("../prisma/migrations/20260922090000_add_external_content_api/migration.sql", import.meta.url), "utf8");
  assert.match(sql, /BEGIN;/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "api_keys"/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "external_requests"/);
  assert.match(sql, /ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "revision"/);
  assert.doesNotMatch(sql, /PRAGMA|DATETIME|DROP TABLE/i);
});

test("generation job migration is additive PostgreSQL SQL", async () => {
  const sql = await readFile(new URL("../prisma/migrations/20260922130000_add_generation_jobs/migration.sql", import.meta.url), "utf8");
  assert.match(sql, /BEGIN;/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "generation_jobs"/);
  assert.match(sql, /generation_jobs_status_check/);
  assert.match(sql, /ON DELETE SET NULL/);
  assert.doesNotMatch(sql, /PRAGMA|DATETIME|DROP TABLE/i);
});

test("worker reaps an expired final lease and refunds a reserved credit", async () => {
  const source = await readFile(
    new URL("../server/services/generation-jobs.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /async function reapExhaustedLeases/);
  assert.match(source, /attemptCount: \{ gte: 3 \}/);
  assert.match(source, /leaseExpiresAt: \{ lte: now \}/);
  assert.match(source, /GENERATION_RETRIES_EXHAUSTED/);
  assert.match(source, /GREATEST\("creditsUsed" - 1, 0\)/);
  assert.ok(source.indexOf("await reapExhaustedLeases();") < source.indexOf("const job = await claimNextJob(workerId);"));
});

test("local AI endpoint is loopback-only and impossible in production", () => {
  assert.equal(
    resolveAIProviderBaseUrl("openai", {
      NODE_ENV: "development",
      FLOWPACK_AI_TEST_BASE_URL: "http://127.0.0.1:3108/v1",
    }),
    "http://127.0.0.1:3108/v1",
  );
  assert.throws(
    () => resolveAIProviderBaseUrl("openai", {
      NODE_ENV: "development",
      FLOWPACK_AI_TEST_BASE_URL: "https://example.com/v1",
    }),
    /loopback/,
  );
  assert.throws(
    () => resolveAIProviderBaseUrl("openai", {
      NODE_ENV: "production",
      FLOWPACK_AI_TEST_BASE_URL: "http://127.0.0.1:3108/v1",
    }),
    /unavailable in production/,
  );
});
