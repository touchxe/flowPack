import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// authConfig의 authorized 콜백으로 라우팅 보호 처리
// Prisma/bcrypt를 포함하지 않아 Edge Function 1 MB 제한 준수
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|$).*)",
  ],
};
