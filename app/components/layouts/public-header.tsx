"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, Menu, X, LayoutDashboard } from "lucide-react";
import { useState } from "react";
import { useSession } from "next-auth/react";

const NAV_LINKS = [
  { href: "/features", label: "기능" },
  { href: "/gallery", label: "갤러리" },
  { href: "/cases", label: "도입 사례" },
  { href: "/pricing", label: "요금제" },
  { href: "/contact", label: "문의하기" },
];

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();

  return (
    <header
      className="sticky top-0 z-50 border-b border-[#F3F4F6] bg-white/95 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* 로고 */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,var(--brand-500),var(--brand-500))", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px var(--fp-primary-subtle)" }}>
            <Zap size={17} color="#fff" />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#111827", letterSpacing: "-0.01em" }}>FlowPack</span>
        </Link>

        {/* 데스크탑 네비 */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link key={link.href} href={link.href} style={{
                fontSize: 14, fontWeight: active ? 700 : 500,
                color: active ? "var(--brand-500)" : "#6B7280",
                textDecoration: "none",
                transition: "color 0.15s",
              }}>
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* 데스크탑 CTA */}
        <div className="hidden items-center gap-3 md:flex">
          {status === "loading" ? null : session ? (
            /* 로그인 상태: 대시보드 바로가기 버튼만 표시 */
            <Link href="/home" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 38, padding: "0 18px", borderRadius: 9,
              background: "linear-gradient(135deg,var(--brand-500),var(--brand-500))",
              color: "#fff", fontSize: 14, fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 2px 10px var(--fp-primary-subtle)",
              transition: "all 0.2s",
            }}>
              <LayoutDashboard size={15} />
              내 대시보드
            </Link>
          ) : (
            /* 비로그인 상태: 로그인 + 무료로 시작 */
            <>
              <Link href="/login" style={{ fontSize: 14, fontWeight: 500, color: "#6B7280", textDecoration: "none" }}>
                로그인
              </Link>
              <Link href="/register" style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 38, padding: "0 18px", borderRadius: 9,
                background: "linear-gradient(135deg,var(--brand-500),var(--brand-500))",
                color: "#fff", fontSize: 14, fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 2px 10px var(--fp-primary-subtle)",
                transition: "all 0.2s",
              }}>
                무료로 시작 →
              </Link>
            </>
          )}
        </div>

        {/* 모바일 메뉴 버튼 */}
        <button
          type="button"
          aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg md:hidden"
          style={{ padding: 8, background: "none", border: "none", cursor: "pointer", color: "#6B7280" }}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* 모바일 드롭다운 */}
      {open && (
        <div style={{ background: "#fff", borderTop: "1px solid #F3F4F6", padding: "16px 24px 20px" }} className="md:hidden">
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)}
                style={{ fontSize: 15, fontWeight: 500, color: "#374151", padding: "10px 0", textDecoration: "none", borderBottom: "1px solid #F9FAFB" }}>
                {link.label}
              </Link>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {session ? (
              /* 로그인 상태: 대시보드 버튼만 */
              <Link href="/home" onClick={() => setOpen(false)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textAlign: "center", fontSize: 14, fontWeight: 700, color: "#fff", padding: "11px", background: "linear-gradient(135deg,var(--brand-500),var(--brand-500))", borderRadius: 10, textDecoration: "none" }}>
                <LayoutDashboard size={15} />
                내 대시보드
              </Link>
            ) : (
              /* 비로그인 상태 */
              <>
                <Link href="/login" onClick={() => setOpen(false)}
                  style={{ textAlign: "center", fontSize: 14, fontWeight: 600, color: "var(--brand-500)", padding: "10px", border: "1.5px solid #C7D2FE", borderRadius: 10, textDecoration: "none" }}>
                  로그인
                </Link>
                <Link href="/register" onClick={() => setOpen(false)}
                  style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: "#fff", padding: "11px", background: "linear-gradient(135deg,var(--brand-500),var(--brand-500))", borderRadius: 10, textDecoration: "none" }}>
                  무료로 시작
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
