import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "@auth/core/adapters";
import GoogleProvider from "next-auth/providers/google";
import KakaoProvider from "next-auth/providers/kakao";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { normalizeUsername } from "@/lib/username";
import { captureAuthAdapterMethod, captureAuthDiagnostic } from "@/lib/auth-diagnostics";
import {
  assertNasAuthProviderSecrets,
  resolveAuthProviderIds,
} from "@/lib/auth-provider-policy.mjs";

const enabledProviderIds = resolveAuthProviderIds(process.env);
assertNasAuthProviderSecrets(enabledProviderIds, process.env);

declare module "next-auth" {
  interface User {
    username?: string | null;
    role?: string;
    sessionId?: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      username?: string | null;
      name?: string | null;
      image?: string | null;
      role: string; // 'USER' | 'ADMIN'
    };
    sessionId: string;
  }
}

function generateSessionId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const authAdapter = {
  ...PrismaAdapter(prisma),
  // Auth.js의 OAuth 프로필 객체에는 Prisma User 입력에 없는 속성이 포함될 수
  // 있다. FlowPack User 모델이 허용하는 인증 필드만 명시적으로 저장한다.
  createUser: async (user) => prisma.user.create({
    data: {
      email: user.email.trim().toLowerCase(),
      emailVerified: user.emailVerified ?? null,
      name: user.name ?? null,
      image: user.image ?? null,
    },
  }),
} satisfies Adapter;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: authAdapter,
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  logger: {
    debug(message) {
      captureAuthAdapterMethod(message);
    },
    error(error) {
      const diagnosticCode = captureAuthDiagnostic(error);
      console.error(`[Auth][${diagnosticCode}]`, error);
    },
  },
  providers: [
    ...(enabledProviderIds.includes("google") ? [GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })] : []),
    ...(enabledProviderIds.includes("kakao") ? [KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
    })] : []),
    ...(enabledProviderIds.includes("apple") ? [AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID!,
      clientSecret: process.env.APPLE_CLIENT_SECRET!,
    })] : []),
    ...(enabledProviderIds.includes("credentials") ? [CredentialsProvider({
      name: "credentials",
      credentials: {
        identifier: { label: "아이디 또는 이메일", type: "text" },
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        const identifierValue = credentials?.identifier ?? credentials?.email;
        if (typeof identifierValue !== "string" || typeof credentials?.password !== "string") {
          return null;
        }

        const identifier = identifierValue.trim();
        const password = credentials.password;
        if (!identifier || !password) {
          return null;
        }

        const userSelect = {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            passwordHash: true,
            role: true,
            isBlocked: true,
          },
        } as const;
        const normalizedIdentifier = normalizeUsername(identifier);
        const user = identifier.includes("@")
          ? await prisma.user.findUnique({ where: { email: identifier }, ...userSelect })
          : await findUserByLoginIdentifier(normalizedIdentifier, userSelect);

        if (!user || !user.passwordHash) {
          return null;
        }

        // 차단된 계정 로그인 거부
        if (user.isBlocked) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          username: null,
          name: user.name,
          image: user.image,
          role: user.role ?? "USER",
        };
      },
    })] : []),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role ?? "USER";
        token.sessionId = user.sessionId || generateSessionId();
      }

      // 세션 갱신 시 사용자 정보 업데이트
      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { email: true, name: true, image: true },
        });
        if (dbUser) {
          token.email = dbUser.email;
          token.username = null;
          token.name = dbUser.name;
          token.picture = dbUser.image;
          // role은 재로그인 시 갱신됨 (토큰 만료 전까지 캐시)
        }
      }

      // 세션 업데이트 시 sessionId 갱신
      if (trigger === "update" && session?.newSessionId) {
        token.sessionId = session.newSessionId as string;
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.username = token.username as string | null | undefined;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
        session.user.role = (token.role as string) ?? "USER";
        session.sessionId = token.sessionId as string;
      }
      return session;
    },
    async signIn({ user, account }) {
      // JWT 세션은 Prisma Session 레코드를 만들지 않는다. 로그인 콜백에서
      // Session 테이블을 조회하면 OAuth 성공 후 DB 오류가 Configuration으로
      // 숨겨질 수 있으므로 토큰 식별자만 새로 발급한다.
      if (account && user.id) {
        user.sessionId = generateSessionId();
      }
      return true;
    },
  },
});

async function findUserByLoginIdentifier(
  identifier: string,
  userSelect: { select: { id: true; email: true; name: true; image: true; passwordHash: true; role: true; isBlocked: true } }
) {
  try {
    const usernameUser = await prisma.user.findUnique({
      where: { username: identifier },
      ...userSelect,
    });
    if (usernameUser) {
      return usernameUser;
    }
  } catch (error) {
    if (!isMissingUsernameColumnError(error)) {
      throw error;
    }
  }

  const emailLocalPartMatches = await prisma.user.findMany({
    where: {
      email: {
        startsWith: `${identifier}@`,
        mode: "insensitive",
      },
    },
    take: 2,
    ...userSelect,
  });

  return emailLocalPartMatches.length === 1 ? emailLocalPartMatches[0] : null;
}

function isMissingUsernameColumnError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2022";
}
