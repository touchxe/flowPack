-- Additive PostgreSQL migration for authenticated external content and media API.
BEGIN;

ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "coverMediaId" TEXT;
ALTER TABLE "content_images" ADD COLUMN IF NOT EXISTS "mediaId" TEXT;

CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "scopes" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "external_requests" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "apiKeyId" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'PROCESSING',
  "resourceId" TEXT,
  "responseStatus" INTEGER,
  "responseData" TEXT,
  "errorCode" TEXT,
  "creditReserved" BOOLEAN NOT NULL DEFAULT false,
  "leaseExpiresAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "external_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "external_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "external_requests_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_keyHash_key" ON "api_keys"("keyHash");
CREATE INDEX IF NOT EXISTS "api_keys_userId_revokedAt_idx" ON "api_keys"("userId", "revokedAt");
CREATE INDEX IF NOT EXISTS "api_keys_prefix_idx" ON "api_keys"("prefix");
CREATE UNIQUE INDEX IF NOT EXISTS "external_requests_apiKeyId_method_path_idempotencyKey_key"
  ON "external_requests"("apiKeyId", "method", "path", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "external_requests_userId_createdAt_idx" ON "external_requests"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "external_requests_expiresAt_idx" ON "external_requests"("expiresAt");
CREATE INDEX IF NOT EXISTS "contents_coverMediaId_idx" ON "contents"("coverMediaId");
CREATE UNIQUE INDEX IF NOT EXISTS "content_images_contentId_mediaId_key"
  ON "content_images"("contentId", "mediaId");
CREATE INDEX IF NOT EXISTS "content_images_mediaId_idx" ON "content_images"("mediaId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contents_coverMediaId_fkey') THEN
    ALTER TABLE "contents" ADD CONSTRAINT "contents_coverMediaId_fkey"
      FOREIGN KEY ("coverMediaId") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_images_mediaId_fkey') THEN
    ALTER TABLE "content_images" ADD CONSTRAINT "content_images_mediaId_fkey"
      FOREIGN KEY ("mediaId") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

COMMIT;
