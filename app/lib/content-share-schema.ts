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

  const annotationColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'content_annotations'
  `;

  return annotationColumns.some((column) => column.column_name === "selectedText");
}

async function assertContentShareSchema(): Promise<void> {
  if (await hasContentShareSchema()) return;
  throw new Error("CONTENT_SHARE_SCHEMA_NOT_READY");
}

export async function ensureContentShareSchema(): Promise<void> {
  // Runtime requests are never allowed to repair schema. The reviewed
  // PostgreSQL baseline/migration operator owns DDL; this is a read-only guard.
  ensureContentShareSchemaPromise ??= assertContentShareSchema().catch((error) => {
    ensureContentShareSchemaPromise = null;
    throw error;
  });

  return ensureContentShareSchemaPromise;
}
