-- Repair production drift for longform generation and saved user instructions.
-- This migration is additive and idempotent because production was historically
-- synchronized with a mix of prisma db push and hand-applied PostgreSQL patches.

BEGIN;

ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "aiProvider" TEXT;
ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "aiModel" TEXT;
ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "aiLog" TEXT;

CREATE TABLE IF NOT EXISTS "user_instructions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_instructions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_instructions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "user_instructions_userId_idx"
  ON "user_instructions"("userId");

COMMIT;
