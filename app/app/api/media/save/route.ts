/** Retired: accepting browser-supplied storage URLs crosses the trust boundary. */
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "이 업로드 방식은 더 이상 지원되지 않습니다." },
    { status: 410 },
  );
}
