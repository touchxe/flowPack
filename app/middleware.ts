import NextAuth, { type NextAuthRequest } from "next-auth";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { shouldBlockRouteRequest } from "@/lib/deployment-boundary.mjs";

// authConfig의 authorized 콜백으로 라우팅 보호 처리. Prisma/bcrypt를
// 포함하지 않으며, route handler 실행 전에 쓰기 경계를 적용한다.
const { auth: authMiddleware } = NextAuth(authConfig);
const authenticatedMiddleware = authMiddleware(
  (_request: NextAuthRequest, _event: NextFetchEvent) => NextResponse.next(),
);

export function middleware(request: NextRequest, event: NextFetchEvent) {
  if (shouldBlockRouteRequest(
    { method: request.method, pathname: request.nextUrl.pathname },
    process.env,
  )) {
    return NextResponse.json(
      {
        success: false,
        error: "Service is temporarily read-only",
        code: "MAINTENANCE_READ_ONLY",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "Retry-After": "60",
        },
      },
    );
  }

  return authenticatedMiddleware(request, event);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
