import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import KakaoProvider from "next-auth/providers/kakao";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { normalizeUsername } from "@/lib/username";

declare module "next-auth" {
  interface User {
    username?: string | null;
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

async function invalidateOtherSessions(currentSessionId: string, userId: string) {
  await prisma.session.updateMany({
    where: {
      userId,
      NOT: { id: currentSessionId },
    },
    data: { expires: new Date() },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
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
    CredentialsProvider({
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
            username: true,
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
          username: user.username,
          name: user.name,
          image: user.image,
          role: user.role ?? "USER",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        // 로그인 시 user 객체에서 role 직접 추출 (authorize 반환값)
        // @ts-ignore - custom field from authorize
        token.role = (user as any).role ?? "USER";
        // 로그인 시 항상 새 sessionId 생성 (signIn 콜백에서 설정된 값 우선)
        token.sessionId = (user as any).sessionId || generateSessionId();
      }

      // 세션 갱신 시 사용자 정보 업데이트
      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { email: true, username: true, name: true, image: true },
        });
        if (dbUser) {
          token.email = dbUser.email;
          token.username = dbUser.username;
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
    async signIn({ user, account, profile }) {
      // 새 로그인 시 이전 세션 무효화
      if (account?.provider === "google" || account?.provider === "kakao" || account?.provider === "apple") {
        if (user.id) {
          const newSessionId = generateSessionId();
          // 새 sessionId를 JWT에 전달
          // @ts-expect-error - custom field
          user.sessionId = newSessionId;

          // DB의 이전 세션 무효화
          const existingSessions = await prisma.session.findMany({
            where: { userId: user.id },
          });

          if (existingSessions.length > 0) {
            await invalidateOtherSessions(existingSessions[0].id, user.id);
          }
        }
        return true;
      }

      if (account?.provider === "credentials") {
        if (user.id) {
          // Credentials 로그인 시에도 새 sessionId 생성
          const newSessionId = generateSessionId();
          // @ts-expect-error - custom field
          user.sessionId = newSessionId;

          // DB의 이전 세션 무효화
          const existingSessions = await prisma.session.findMany({
            where: { userId: user.id },
          });

          if (existingSessions.length > 0) {
            await invalidateOtherSessions(existingSessions[0].id, user.id);
          }
        }
        return true;
      }

      return true;
    },
  },
});

async function findUserByLoginIdentifier(
  identifier: string,
  userSelect: { select: { id: true; email: true; username: true; name: true; image: true; passwordHash: true; role: true; isBlocked: true } }
) {
  const usernameUser = await prisma.user.findUnique({
    where: { username: identifier },
    ...userSelect,
  });
  if (usernameUser) {
    return usernameUser;
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
