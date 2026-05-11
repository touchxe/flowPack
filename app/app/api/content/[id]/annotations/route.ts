import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { ensureContentShareSchema } from "@/lib/content-share-schema";
import { prisma } from "@/lib/prisma";

const createAnnotationSchema = z.object({
  slideIndex: z.number().int().min(0).default(0),
  selectedText: z.string().trim().max(1000).optional(),
  body: z.string().trim().min(1, "댓글을 입력해주세요").max(1000),
});

interface AnnotationRow {
  id: string;
  slideIndex: number;
  number: number;
  authorName: string | null;
  selectedText: string | null;
  body: string;
  createdAt: Date;
}

async function authorizeContent(contentId: string, userId: string): Promise<boolean> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    select: { id: true, userId: true },
  });

  return Boolean(content && content.userId === userId);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  await ensureContentShareSchema();

  if (!(await authorizeContent(id, session.user.id))) {
    return NextResponse.json({ success: false, error: "콘텐츠를 찾을 수 없습니다." }, { status: 404 });
  }

  const annotations = await prisma.$queryRaw<AnnotationRow[]>`
    SELECT id, "slideIndex", number, "authorName", "selectedText", body, "createdAt"
    FROM "content_annotations"
    WHERE "contentId" = ${id}
    ORDER BY number ASC
  `;

  return NextResponse.json({ success: true, data: annotations });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const payload = createAnnotationSchema.parse(await req.json());
    await ensureContentShareSchema();

    if (!(await authorizeContent(id, session.user.id))) {
      return NextResponse.json({ success: false, error: "콘텐츠를 찾을 수 없습니다." }, { status: 404 });
    }

    const nextRows = await prisma.$queryRaw<Array<{ nextNumber: number }>>`
      SELECT COALESCE(MAX(number), 0) + 1 AS "nextNumber"
      FROM "content_annotations"
      WHERE "contentId" = ${id}
    `;
    const nextNumber = Number(nextRows[0]?.nextNumber ?? 1);

    const rows = await prisma.$queryRaw<AnnotationRow[]>`
      INSERT INTO "content_annotations" (
        id, "contentId", "slideIndex", number, "authorName", "selectedText", body, "createdAt"
      )
      VALUES (
        ${randomUUID()}, ${id}, ${payload.slideIndex}, ${nextNumber}, ${session.user.name ?? null},
        ${payload.selectedText ?? null}, ${payload.body}, CURRENT_TIMESTAMP
      )
      RETURNING id, "slideIndex", number, "authorName", "selectedText", body, "createdAt"
    `;

    return NextResponse.json({ success: true, data: rows[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? "입력값을 확인해주세요." },
        { status: 422 }
      );
    }

    console.error("Create content annotation error:", error);
    return NextResponse.json({ success: false, error: "댓글을 저장하지 못했습니다." }, { status: 500 });
  }
}
