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
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "rgba(255,255,255,0.92)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid #F3F4F6",
      boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
    }}>
      <div style={{ maxWidth: 1152, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* 로고 */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,var(--fp-primary-subtle0),var(--fp-primary-subtle0))", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(99,102,241,0.30)" }}>
            <Zap size={17} color="#fff" />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#111827", letterSpacing: "-0.01em" }}>FlowPack</span>
        </Link>

        {/* 데스크탑 네비 */}
        <nav style={{ display: "flex", alignItems: "center", gap: 32 }} className="hidden md:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link key={link.href} href={link.href} style={{
                fontSize: 14, fontWeight: active ? 700 : 500,
                color: active ? "var(--fp-primary-subtle0)" : "#6B7280",
                textDecoration: "none",
                transition: "color 0.15s",
              }}>
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* 데스크탑 CTA */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }} className="hidden md:flex">
          {status === "loading" ? null : session ? (
            /* 로그인 상태: 대시보드 바로가기 버튼만 표시 */
            <Link href="/home" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 38, padding: "0 18px", borderRadius: 9,
              background: "linear-gradient(135deg,var(--fp-primary-subtle0),var(--fp-primary-subtle0))",
              color: "#fff", fontSize: 14, fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 2px 10px rgba(99,102,241,0.3)",
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
                background: "linear-gradient(135deg,var(--fp-primary-subtle0),var(--fp-primary-subtle0))",
                color: "#fff", fontSize: 14, fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 2px 10px rgba(99,102,241,0.3)",
                transition: "all 0.2s",
              }}>
                무료로 시작 →
              </Link>
            </>
          )}
        </div>

        {/* 모바일 메뉴 버튼 */}
        <button onClick={() => setOpen(!open)} className="md:hidden"
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
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textAlign: "center", fontSize: 14, fontWeight: 700, color: "#fff", padding: "11px", background: "linear-gradient(135deg,var(--fp-primary-subtle0),var(--fp-primary-subtle0))", borderRadius: 10, textDecoration: "none" }}>
                <LayoutDashboard size={15} />
                내 대시보드
              </Link>
            ) : (
              /* 비로그인 상태 */
              <>
                <Link href="/login" onClick={() => setOpen(false)}
                  style={{ textAlign: "center", fontSize: 14, fontWeight: 600, color: "var(--fp-primary-subtle0)", padding: "10px", border: "1.5px solid #C7D2FE", borderRadius: 10, textDecoration: "none" }}>
                  로그인
                </Link>
                <Link href="/register" onClick={() => setOpen(false)}
                  style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: "#fff", padding: "11px", background: "linear-gradient(135deg,var(--fp-primary-subtle0),var(--fp-primary-subtle0))", borderRadius: 10, textDecoration: "none" }}>
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
