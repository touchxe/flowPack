-- WordPress 복수 사이트 연동을 위해 사용자·플랫폼 단일 제약을 사이트별 복합 제약으로 교체한다.
DROP INDEX IF EXISTS "social_accounts_userId_platform_key";

CREATE UNIQUE INDEX IF NOT EXISTS "social_accounts_userId_platform_accountId_key"
ON "social_accounts"("userId", "platform", "accountId");
