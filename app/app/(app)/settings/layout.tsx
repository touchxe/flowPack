"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Bell, CreditCard, BookOpen } from "lucide-react";

const NAV_ITEMS = [
  { href: "/settings/profile",       label: "프로필",   icon: User,       desc: "계정 정보 및 테마" },
  { href: "/settings/instructions",  label: "작성 지침", icon: BookOpen,  desc: "AI 글쓰기 규칙" },
  { href: "/settings/notifications", label: "알림",     icon: Bell,       desc: "이메일 · 푸시" },
  { href: "/settings/billing",       label: "결제",     icon: CreditCard, desc: "구독 · 플랜" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start", padding: "8px 0" }}>
      {/* 사이드 네비게이션 */}
      <aside style={{
        width: 200,
        flexShrink: 0,
        position: "sticky",
        top: 80,
        background: "var(--fp-card-bg)",
        border: "1.5px solid var(--fp-border)",
        borderRadius: 16,
        padding: 8,
        boxShadow: "var(--fp-shadow-card)",
      }}>
        <p style={{
          fontSize: 10, fontWeight: 700, color: "var(--fp-muted)",
          textTransform: "uppercase", letterSpacing: "0.1em",
          padding: "6px 10px 10px", margin: 0,
        }}>
          설정
        </p>
        {NAV_ITEMS.map(({ href, label, icon: Icon, desc }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                marginBottom: 2,
                textDecoration: "none",
                background: isActive ? "var(--fp-primary-subtle)" : "transparent",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--fp-section-bg)";
              }}
              onMouseLeave={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: isActive ? "var(--fp-primary-subtle)" : "var(--fp-section-bg)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={15} color={isActive ? "var(--brand-500)" : "var(--fp-muted)"} />
              </div>
              <div>
                <p style={{
                  fontSize: 13, fontWeight: isActive ? 700 : 500,
                  color: isActive ? "var(--fp-heading)" : "var(--fp-secondary)",
                  margin: 0, lineHeight: 1.2,
                }}>
                  {label}
                </p>
                <p style={{ fontSize: 11, color: "var(--fp-muted)", margin: 0 }}>
                  {desc}
                </p>
              </div>
            </Link>
          );
        })}
      </aside>

      {/* 메인 컨텐츠 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
