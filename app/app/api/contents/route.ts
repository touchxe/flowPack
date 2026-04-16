import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  const all = searchParams.get("all") === "true";

  try {
    // all=true: 날짜 필터 없이 전체 반환
    if (all) {
      const contents = await prisma.content.findMany({
        where: { userId: session.user.id },
        select: { id: true, title: true, type: true, status: true, scheduledAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ contents });
    }

    // year/month 기반 월별 필터
    const y = year ? parseInt(year) : new Date().getFullYear();
    const m = month ? parseInt(month) : new Date().getMonth() + 1;

    // 월 시작·끝을 UTC Date로 계산
    const startDate = new Date(`${y}-${String(m).padStart(2, "0")}-01T00:00:00.000Z`);
    const mn = m === 12 ? 1 : m + 1;
    const yn = m === 12 ? y + 1 : y;
    const endDate = new Date(`${yn}-${String(mn).padStart(2, "0")}-01T00:00:00.000Z`);

    const contents = await prisma.content.findMany({
      where: {
        userId: session.user.id,
        OR: [
          // scheduledAt이 해당 월인 콘텐츠
          { scheduledAt: { gte: startDate, lt: endDate } },
          // scheduledAt 없고 createdAt이 해당 월인 콘텐츠
          { scheduledAt: null, createdAt: { gte: startDate, lt: endDate } },
        ],
      },
      select: { id: true, title: true, type: true, status: true, scheduledAt: true, createdAt: true },
      orderBy: { scheduledAt: "asc" },
    });

    return NextResponse.json({ contents });
  } catch (error) {
    console.error("Fetch contents error:", error);
    return NextResponse.json(
      { error: "콘텐츠를 불러오는데 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
