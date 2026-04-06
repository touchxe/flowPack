import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import KakaoProvider from "next-auth/providers/kakao";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import type { User as PrismaUser } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
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
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        // 새 로그인 시 새 sessionId 생성
        if (!token.sessionId) {
          token.sessionId = generateSessionId();
        }
      }

      // 세션 갱신 시 사용자 정보 업데이트
      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { email: true, name: true, image: true },
        });
        if (dbUser) {
          token.email = dbUser.email;
          token.name = dbUser.name;
          token.picture = dbUser.image;
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
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
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
