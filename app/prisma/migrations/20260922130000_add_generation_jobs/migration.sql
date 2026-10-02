-- Additive PostgreSQL migration for durable asynchronous content generation jobs.
BEGIN;

CREATE TABLE IF NOT EXISTS "generation_jobs" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "apiKeyId" TEXT NOT NULL,
  "externalRequestId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "input" TEXT NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "leaseOwner" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "contentId" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "creditReserved" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "generation_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "generation_jobs_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "generation_jobs_externalRequestId_fkey" FOREIGN KEY ("externalRequestId") REFERENCES "external_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "generation_jobs_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "generation_jobs_status_check" CHECK ("status" IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "generation_jobs_externalRequestId_key"
  ON "generation_jobs"("externalRequestId");
CREATE INDEX IF NOT EXISTS "generation_jobs_status_leaseExpiresAt_createdAt_idx"
  ON "generation_jobs"("status", "leaseExpiresAt", "createdAt");
CREATE INDEX IF NOT EXISTS "generation_jobs_userId_createdAt_idx"
  ON "generation_jobs"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "generation_jobs_expiresAt_idx"
  ON "generation_jobs"("expiresAt");

COMMIT;
