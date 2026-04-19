import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "true";

  try {
    if (all) {
      const contents = await prisma.content.findMany({
        where: { userId: session.user.id },
        select: {
          id: true, title: true, type: true, status: true,
          scheduledAt: true, createdAt: true, thumbnailUrl: true,
          images: { select: { url: true }, orderBy: { order: "asc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ contents });
    }

    // year/month 기반 월별 필터
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const y = year ? parseInt(year) : new Date().getFullYear();
    const m = month ? parseInt(month) : new Date().getMonth() + 1;
    const startDate = new Date(`${y}-${String(m).padStart(2, "0")}-01T00:00:00.000Z`);
    const mn = m === 12 ? 1 : m + 1;
    const yn = m === 12 ? y + 1 : y;
    const endDate = new Date(`${yn}-${String(mn).padStart(2, "0")}-01T00:00:00.000Z`);

    const contents = await prisma.content.findMany({
      where: {
        userId: session.user.id,
        OR: [
          { scheduledAt: { gte: startDate, lt: endDate } },
          { scheduledAt: null, createdAt: { gte: startDate, lt: endDate } },
        ],
      },
      select: {
        id: true, title: true, type: true, status: true,
        scheduledAt: true, createdAt: true, thumbnailUrl: true,
        images: { select: { url: true }, orderBy: { order: "asc" }, take: 1 },
      },
      orderBy: { scheduledAt: "asc" },
    });

    return NextResponse.json({ contents });
  } catch (error) {
    console.error("Fetch contents error:", error);
    return NextResponse.json({ error: "콘텐츠를 불러오는데 오류가 발생했습니다" }, { status: 500 });
  }
}

// DELETE /api/contents — 일괄 삭제
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as { ids: string[] };
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: "삭제할 id 목록이 필요합니다" }, { status: 400 });
    }

    // 본인 소유 확인 후 삭제
    await prisma.content.deleteMany({
      where: { id: { in: body.ids }, userId: session.user.id },
    });

    return NextResponse.json({ success: true, deleted: body.ids.length });
  } catch (error) {
    console.error("Bulk delete error:", error);
    return NextResponse.json({ error: "삭제 중 오류가 발생했습니다" }, { status: 500 });
  }
}
