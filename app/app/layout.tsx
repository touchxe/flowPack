import type { Metadata } from "next";
import { ThemeProvider } from "@/components/layouts/theme-provider";
import { Providers } from "@/components/providers/session-provider";
import { SessionCheck } from "@/components/providers/session-check";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "FlowPack — AI 홍보 콘텐츠 플랫폼",
    template: "%s | FlowPack",
  },
  description:
    "스타트업과 소호 사업자를 위한 AI 기반 홍보 콘텐츠 제작 및 배포 플랫폼",
  keywords: ["AI", "홍보", "콘텐츠", "카드뉴스", "블로그", "SNS", "마케팅"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SessionCheck />
            {children}
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
