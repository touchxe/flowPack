import { prisma } from "@/lib/prisma";

let ensureContentShareSchemaPromise: Promise<void> | null = null;

const REQUIRED_CONTENT_COLUMNS = [
  "aiProvider",
  "aiModel",
  "aiLog",
  "keywords",
  "industry",
  "shareEnabled",
  "shareToken",
  "shareCreatedAt",
];

async function hasContentShareSchema(): Promise<boolean> {
  const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'contents'
      AND column_name IN (
        'aiProvider',
        'aiModel',
        'aiLog',
        'keywords',
        'industry',
        'shareEnabled',
        'shareToken',
        'shareCreatedAt'
      )
  `;
  const existingColumns = new Set(columns.map((column) => column.column_name));
  if (!REQUIRED_CONTENT_COLUMNS.every((column) => existingColumns.has(column))) {
    return false;
  }

  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'content_annotations'
  `;

  return tables.length > 0;
}

async function applyContentShareSchema(): Promise<void> {
  if (await hasContentShareSchema()) return;

  await prisma.$executeRawUnsafe('ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "aiProvider" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "aiModel" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "aiLog" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "keywords" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "industry" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "shareEnabled" BOOLEAN NOT NULL DEFAULT false');
  await prisma.$executeRawUnsafe('ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "shareToken" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "contents" ADD COLUMN IF NOT EXISTS "shareCreatedAt" TIMESTAMP(3)');
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "contents_shareToken_key" ON "contents"("shareToken")');
  await prisma.$executeRawUnsafe(`
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
    )
  `);
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "content_annotations_contentId_number_key" ON "content_annotations"("contentId", "number")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "content_annotations_contentId_idx" ON "content_annotations"("contentId")');
}

export async function ensureContentShareSchema(): Promise<void> {
  ensureContentShareSchemaPromise ??= applyContentShareSchema().catch((error) => {
    ensureContentShareSchemaPromise = null;
    throw error;
  });

  return ensureContentShareSchemaPromise;
}
