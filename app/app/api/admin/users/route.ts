import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/users?q=&plan=&page=&sort=
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") ?? "";
  const plan = searchParams.get("plan") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const sort = searchParams.get("sort") ?? "createdAt_desc";
  const PAGE_SIZE = 20;

  // 정렬 파싱
  const [sortField, sortDir] = sort.split("_");
  const orderBy: Record<string, string> =
    sortField === "credits"
      ? { creditsUsed: sortDir === "asc" ? "asc" : "desc" }
      : { createdAt: sortDir === "asc" ? "asc" : "desc" };

  const where = {
    ...(q && {
      OR: [
        { email: { contains: q } },
        { name: { contains: q } },
      ],
    }),
    ...(plan && plan !== "ALL" && { plan: plan as any }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        role: true,
        isBlocked: true,
        creditsUsed: true,
        creditsTotal: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    users,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  });
}
