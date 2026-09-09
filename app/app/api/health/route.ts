import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

export async function GET(): Promise<NextResponse> {
  try {
    const rows = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;

    if (rows[0]?.ok !== 1) {
      throw new Error("Database readiness probe returned an unexpected result.");
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          status: "ok",
          database: "ok",
        },
      },
      { status: 200, headers: RESPONSE_HEADERS }
    );
  } catch {
    console.error("[health] database readiness probe failed");

    return NextResponse.json(
      {
        success: false,
        error: "Service unavailable",
        code: "DEPENDENCY_UNAVAILABLE",
      },
      { status: 503, headers: RESPONSE_HEADERS }
    );
  }
}
