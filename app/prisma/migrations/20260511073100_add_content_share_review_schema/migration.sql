-- Add the fields used by shared review links and public annotations.
-- The IF NOT EXISTS clauses keep this migration safe for databases that were
-- partially patched while debugging production.

ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "aiProvider" TEXT;
ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "aiModel" TEXT;
ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "aiLog" TEXT;
ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "keywords" TEXT;
ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "industry" TEXT;
ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "shareEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "shareToken" TEXT;
ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "shareCreatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "contents_shareToken_key" ON "contents"("shareToken");

CREATE TABLE IF NOT EXISTS "content_annotations" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "slideIndex" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_annotations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "content_annotations_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "content_annotations_contentId_number_key" ON "content_annotations"("contentId", "number");
CREATE INDEX IF NOT EXISTS "content_annotations_contentId_idx" ON "content_annotations"("contentId");
