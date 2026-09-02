-- Repair production drift without deleting or rewriting existing data.
-- This migration is intentionally idempotent because FlowPack's production
-- database was historically synchronized with `prisma db push`.

BEGIN;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key"
  ON "users"("username");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_username_format_check'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_username_format_check"
      CHECK ("username" IS NULL OR "username" ~ '^[a-z][a-z0-9_]{3,19}$');
  END IF;
END
$$;

DO $$
BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'CONTENT_CREATED',
    'CONTENT_FAILED',
    'DRAFT_REMINDER',
    'PUBLISH_SUCCESS',
    'PUBLISH_FAILED',
    'SCHEDULE_REMINDER',
    'DAILY_SCHEDULE_SUMMARY',
    'VIEW_MILESTONE',
    'WEEKLY_REPORT',
    'CLICK_SPIKE',
    'CREDIT_LOW',
    'CREDIT_EXHAUSTED',
    'CREDIT_RESET',
    'PAYMENT_SUCCESS',
    'SUBSCRIPTION_EXPIRING',
    'TOKEN_EXPIRING',
    'SOCIAL_CONNECTED',
    'SYSTEM_NOTICE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "actionUrl" TEXT,
  "metadata" TEXT,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "notifications_userId_isRead_idx"
  ON "notifications"("userId", "isRead");

CREATE INDEX IF NOT EXISTS "notifications_userId_createdAt_idx"
  ON "notifications"("userId", "createdAt");

COMMIT;
