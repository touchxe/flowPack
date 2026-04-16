import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const session = await auth();
  const isLoggedIn = !!session?.user;
  const { pathname } = req.nextUrl;

  // 공개 경로 체크 (비회원도 접근 가능)
  const publicPaths = [
    "/",
    "/features",
    "/login",
    "/register",
    "/find-password",
    "/pricing",
    "/terms",
    "/privacy",
    "/cookie",
    "/contact",
    "/design-system",
    "/design-library",
  ];
  const isPublicPath = publicPaths.includes(pathname);

  if (isPublicPath) {
    return NextResponse.next();
  }

  // ── Admin 경로 보호 ─────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    // ADMIN 역할 체크
    const role = session?.user?.role as string | undefined;
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/home", req.url));
    }
    return NextResponse.next();
  }

  // ── 일반 인증 필요 경로 ──────────────────────────────────
  const protectedPrefixes = [
    "/home",
    "/carousel-lab",
    "/ai",
    "/calendar",
    "/analytics",
    "/social-accounts",
    "/settings",
    "/contents",
    "/content",
  ];

  const isProtected = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 로그인/회원가입은 로그인 상태면 /home으로 리다이렉트
  if ((pathname === "/login" || pathname === "/register") && isLoggedIn) {
    return NextResponse.redirect(new URL("/home", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|$).*)",
  ],
};
