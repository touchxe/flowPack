import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "date-fns";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  try {
    let startDate: Date;
    let endDate: Date;

    if (year && month) {
      startDate = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
      endDate = endOfMonth(new Date(parseInt(year), parseInt(month) - 1));
    } else {
      // Default to current month
      const now = new Date();
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
    }

    const contents = await prisma.content.findMany({
      where: {
        userId: session.user.id,
        OR: [
          {
            scheduledAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        scheduledAt: true,
        createdAt: true,
      },
      orderBy: {
        scheduledAt: "asc",
      },
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
