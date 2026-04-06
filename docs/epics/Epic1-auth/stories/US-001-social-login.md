# US-001: 소셜 계정으로 가입·로그인

> **Story ID**: US-001
> **Epic**: Epic 1: 인증
> **우선순위**: P0
> **작성일**: 2026-03-31
> **Phase**: Phase 5

---

## 개요

사용자가 Google, Kakao, Apple 소셜 계정을 사용하여 FlowPack에 가입하고 로그인할 수 있다.

---

## 사용자 스토리

> **As a** 잠재 사용자
> **I want to** Google/Kakao/Apple 소셜 계정으로 가입·로그인
> **So that** 이메일/비밀번호 없이 간편하게 서비스를 이용할 수 있다

---

##acceptance criteria

### Google 소셜 로그인

- [ ] `/login` 페이지에 "Google로 계속하기" 버튼이 표시된다
- [ ] 버튼 클릭 시 Google OAuth consent screen으로 리다이렉트된다
- [ ] Google 계정 승인 후 새 User 레코드가 생성된다
- [ ] Account 레코드에 provider="google"으로 저장된다
- [ ] JWT 세션이 생성되어 쿠키에 저장된다
- [ ] `/home` 페이지로 리다이렉트된다
- [ ] 이미 가입된 Google 계정의 경우 기존 계정으로 로그인된다

### Kakao 소셜 로그인

- [ ] `/login` 페이지에 "Kakao로 계속하기" 버튼이 표시된다
- [ ] 버튼 클릭 시 Kakao 로그인 페이지로 리다이렉트된다
- [ ] Kakao 계정 로그인/동의 후 새 User/Account 레코드 생성
- [ ] JWT 세션 생성 후 `/home`으로 리다이렉트

### Apple 소셜 로그인

- [ ] `/login` 페이지에 "Apple로 계속하기" 버튼이 표시된다
- [ ] 버튼 클릭 시 Apple Sign-In consent screen으로 리다이렉트된다
- [ ] Apple 계정 승인 후 새 User/Account 레코드 생성
- [ ] JWT 세션 생성 후 `/home`으로 리다이렉트

### 공통

- [ ] OAuth 취소 시 `/login` 페이지로 돌아온다
- [ ] OAuth 중 네트워크 오류 시 에러 메시지 표시

---

## 구현 참고사항

### 파일 구조

```
app/
├── app/
│   ├── (public)/
│   │   ├── login/
│   │   │   └── page.tsx          # 로그인 페이지
│   │   └── register/
│   │       └── page.tsx          # 회원가입 페이지
│   └── api/
│       └── auth/
│           └── [...nextauth]/
│               └── route.ts      # Auth.js 핸들러
├── lib/
│   ├── auth.ts                    # Auth.js 설정
│   └── prisma.ts                  # Prisma 클라이언트
└── middleware.ts                   # 라우트 보호
```

### Auth.js 설정 (lib/auth.ts)

```typescript
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import KakaoProvider from "next-auth/providers/kakao";
import AppleProvider from "next-auth/providers/apple";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
    }),
    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID!,
      clientSecret: process.env.APPLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
```

### 미들웨어 (middleware.ts)

```typescript
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { nextUrl } = req;

  // (app)/* 경로는 인증 필요
  if (nextUrl.pathname.startsWith("/home") && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // /login, /register는 로그인 상태면 /home으로
  if ((nextUrl.pathname === "/login" || nextUrl.pathname === "/register") && isLoggedIn) {
    return NextResponse.redirect(new URL("/home", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

---

## 테스트 시나리오 (BDD)

자세한 테스트 시나리오는 `docs/bdd/Epic1-auth.md` 참조:

- `Scenario: 사용자가 Google 계정으로 최초 가입한다`
- `Scenario: 사용자가 Google 계정으로 재로그인한다`
- `Scenario: 사용자가 Kakao 계정으로 최초 가입한다`
- `Scenario: 사용자가 Apple 계정으로 최초 가입한다`
- `Scenario: OAuth 과정에서 사용자가 취소 버튼을 클릭`
- `Scenario: 소셜 로그인 중 네트워크 오류 발생`

---

## 환경 변수

```bash
# .env.local
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
KAKAO_CLIENT_ID=your_kakao_client_id
KAKAO_CLIENT_SECRET=your_kakao_client_secret
APPLE_CLIENT_ID=your_apple_client_id
APPLE_CLIENT_SECRET=your_apple_client_secret
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
```

---

## 의존성

- `next-auth@^5.0.0` (Beta, Auth.js v5)
- `@auth/prisma-adapter`
- `prisma`
- `bcrypt` (credentials용)

---

## 추정 시간

**Story Point**: 5

**세부 추정**:
- Auth.js 설정 + Google OAuth: 2h
- Kakao + Apple OAuth: 2h
- 미들웨어 + 라우트 보호: 1h
- 테스트 + 디버깅: 2h
