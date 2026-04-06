import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isLoggedIn = !!token;
  const { pathname } = req.nextUrl;

  // 공개 경로 체크 (비회원도 접근 가능)
  const publicPaths = [
    "/",                    // 랜딩 페이지
    "/features",            // 기능 소개
    "/login",               // 로그인
    "/register",            // 회원가입
    "/find-password",       // 비밀번호 찾기
    "/pricing",             // 요금제
    "/terms",               // 이용약관
    "/privacy",             // 개인정보처리방침
    "/cookie",              // 쿠키 정책
    "/contact",             // 문의하기
  ];
  const isPublicPath = publicPaths.includes(pathname);

  // 공개 경로면 바로 통과
  if (isPublicPath) {
    return NextResponse.next();
  }

  // /home 경로는 인증 필요
  if (pathname.startsWith("/home") && !isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // /carousel-lab 경로도 인증 필요
  if (pathname.startsWith("/carousel-lab") && !isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // /ai/* 경로도 인증 필요
  if (pathname.startsWith("/ai") && !isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // /calendar, /analytics, /social-accounts 경로도 인증 필요
  if (
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/social-accounts") ||
    pathname.startsWith("/settings")
  ) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 로그인/회원가입은 로그인 상태면 /home으로 리다이렉트
  if ((pathname === "/login" || pathname === "/register") && isLoggedIn) {
    return NextResponse.redirect(new URL("/home", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 아래 경로 제외:
     * - /api/* (API 라우트)
     * - /_next/* (Next.js internals)
     * - 정적 파일
     */
    "/((?!api|_next/static|_next/image|favicon.ico|$).*)",
  ],
};
