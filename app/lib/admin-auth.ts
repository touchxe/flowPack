import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Admin API 전용 인증 헬퍼
 * - 비로그인: 401 반환
 * - ADMIN이 아닌 유저: 403 반환
 * - ADMIN: session 반환
 */
export async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 }),
      session: null,
    };
  }

  if (session.user.role !== "ADMIN") {
    return {
      error: NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 }),
      session: null,
    };
  }

  return { error: null, session };
}
