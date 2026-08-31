ALTER TABLE "users" ADD COLUMN "username" TEXT;

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

ALTER TABLE "users"
  ADD CONSTRAINT "users_username_format_check"
  CHECK ("username" IS NULL OR "username" ~ '^[a-z][a-z0-9_]{3,19}$');
