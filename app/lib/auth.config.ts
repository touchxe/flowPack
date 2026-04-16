// Edge Runtime 호환 auth 설정 (Prisma/bcrypt 미포함)
// 미들웨어에서만 사용. 전체 auth는 lib/auth.ts에서 관리.
import type { NextAuthConfig } from "next-auth";

const PUBLIC_PATHS = [
  "/", "/features", "/login", "/register", "/find-password",
  "/pricing", "/terms", "/privacy", "/cookie", "/contact",
  "/design-system", "/design-library",
];

const PROTECTED_PREFIXES = [
  "/home", "/carousel-lab", "/ai", "/calendar",
  "/analytics", "/social-accounts", "/settings", "/contents", "/content",
];

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.role = (user as any).role ?? "USER";
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).role = (token.role as string) ?? "USER";
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      // 공개 경로
      if (PUBLIC_PATHS.includes(pathname)) return true;

      // Admin 경로
      if (pathname.startsWith("/admin")) {
        if (!isLoggedIn) {
          return Response.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, nextUrl));
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((auth?.user as any)?.role !== "ADMIN") {
          return Response.redirect(new URL("/home", nextUrl));
        }
        return true;
      }

      // 보호된 경로
      const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
      if (isProtected && !isLoggedIn) {
        return Response.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, nextUrl));
      }

      // 로그인 상태에서 /login, /register 접근 시 /home으로
      if ((pathname === "/login" || pathname === "/register") && isLoggedIn) {
        return Response.redirect(new URL("/home", nextUrl));
      }

      return true;
    },
  },
  providers: [], // auth.ts에서 실제 provider 추가
} satisfies NextAuthConfig;
