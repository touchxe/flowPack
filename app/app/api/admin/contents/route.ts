import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/contents?q=&type=&status=&page=
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") ?? "";
  const type = searchParams.get("type") ?? "";
  const status = searchParams.get("status") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const PAGE_SIZE = 20;

  const where = {
    ...(q && {
      OR: [
        { title: { contains: q } },
        { user: { email: { contains: q } } },
      ],
    }),
    ...(type && type !== "ALL" && { type: type as any }),
    ...(status && status !== "ALL" && { status: status as any }),
  };

  const [contents, total] = await Promise.all([
    prisma.content.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    }),
    prisma.content.count({ where }),
  ]);

  return NextResponse.json({
    contents,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  });
}
