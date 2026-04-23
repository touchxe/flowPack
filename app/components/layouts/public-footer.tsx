import Link from "next/link";
import { Zap, Instagram, Twitter, Youtube } from "lucide-react";

const FOOTER_COLS = [
  {
    title: "서비스",
    links: [
      { href: "/features", label: "기능 소개" },
      { href: "/gallery", label: "갤러리" },
      { href: "/cases", label: "도입 사례" },
      { href: "/pricing", label: "요금제" },
      { href: "/contact", label: "문의하기" },
    ],
  },
  {
    title: "회사",
    links: [
      { href: "/privacy", label: "개인정보처리방침" },
      { href: "/terms", label: "이용약관" },
      { href: "/cookie", label: "쿠키 정책" },
    ],
  },
  {
    title: "지원",
    links: [
      { href: "/contact", label: "고객센터" },
      { href: "mailto:support@flowpack.dev", label: "이메일 문의" },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer style={{ background: "#111827", color: "#fff", padding: "64px 24px 32px" }}>
      <div style={{ maxWidth: 1152, margin: "0 auto" }}>
        {/* 상단: 로고 + 컬럼 */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 48, marginBottom: 48 }}>
          {/* 브랜드 */}
          <div>
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", marginBottom: 16 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,var(--fp-primary-subtle0),var(--fp-primary-subtle0))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Zap size={17} color="#fff" />
              </div>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>FlowPack</span>
            </Link>
            <p style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.6, maxWidth: 240, marginBottom: 20 }}>
              AI 기반 홍보 콘텐츠 플랫폼. 카드뉴스, 블로그, SNS 포스팅을 한 번에.
            </p>
            {/* SNS 아이콘 */}
            <div style={{ display: "flex", gap: 12 }}>
              {[
                { href: "https://instagram.com", icon: <Instagram size={16} /> },
                { href: "https://twitter.com", icon: <Twitter size={16} /> },
                { href: "https://youtube.com", icon: <Youtube size={16} /> },
              ].map((s, i) => (
                <a key={i} href={s.href} target="_blank" rel="noopener noreferrer"
                  style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", textDecoration: "none", transition: "all 0.2s" }}>
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* 링크 컬럼 */}
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {col.title}
              </h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} style={{ fontSize: 13, color: "#9CA3AF", textDecoration: "none", transition: "color 0.15s" }}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* 구분선 */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 12, color: "#6B7280" }}>© 2026 FlowPack. All rights reserved.</p>
          <p style={{ fontSize: 12, color: "#6B7280" }}>Made with ❤️ in Korea</p>
        </div>
      </div>
    </footer>
  );
}
