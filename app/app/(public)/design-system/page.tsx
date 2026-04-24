"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Zap, Sparkles, FileText, PenLine, Share2, Rocket,
  Clock, BarChart2, Smartphone, Globe, Check, ChevronDown,
  Info, CheckCircle2, AlertTriangle, XCircle,
  User, Search, Bell, Settings, Home, LayoutDashboard,
  CreditCard, Star, Shield, Zap as ZapIcon,
  ArrowRight, Mail, Plus, Trash2, Edit3, Eye,
  Image, Video, Hash, Newspaper,
  TrendingUp, Users, Activity, Target,
  ChevronRight, Layers, BookOpen
} from "lucide-react";

/* ─── Category Filter Tab 데모 컴포넌트 ───────────────── */
function CategoryFilterDemo() {
  const [active, setActive] = useState("전체");
  const tabs = ["전체", "카드뉴스", "블로그", "SNS", "이메일"];
  const items: Record<string, string[]> = {
    "전체": ["카카오뱅크 신규 서비스 안내", "스타트업 A 월간 뉴스레터", "브랜드B 인스타그램 캡션", "FlowPack 제품 소개서"],
    "카드뉴스": ["카카오뱅크 신규 서비스 안내", "FlowPack 제품 소개서"],
    "블로그": ["스타트업 A 월간 뉴스레터"],
    "SNS": ["브랜드B 인스타그램 캡션"],
    "이메일": ["스타트업 A 월간 뉴스레터"],
  };
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 24 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActive(tab)}
            style={{ padding: "8px 16px", borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
              background: active === tab ? "var(--brand-500)" : "#F3F4F6",
              color: active === tab ? "#fff" : "#6B7280",
              transition: "all 0.2s" }}>
            {tab}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(items[active] || []).map(item => (
          <div key={item} style={{ padding: "12px 16px", borderRadius: 10, background: "#F8F7FF", border: "1px solid #EEF2FF", fontSize: 14, color: "#374151", display: "flex", alignItems: "center", gap: 10 }}>
            <FileText size={14} color="var(--brand-500)" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── 섹션 목록 ─────────────────────────────────────────── */
const sections = [
  "Foundation",
  "Buttons",
  "Badges",
  "Cards",
  "Forms",
  "Feedback",
  "Icons",
  "Navigation",
  "Pricing",
  "Landing UI",
  "Hero Patterns",
  "Marketing",
  "Data Display",
  "Media Cards",
];

const colors = [
  /* ── Brand Primary (--brand-* 변경 시 함께 변경) ── */
  { name: "Brand 500 (Primary)", hex: "var(--brand-500)", token: "--brand-500", textWhite: false },
  { name: "Brand 600 (Hover)", hex: "var(--brand-600)", token: "--brand-600", textWhite: false },
  { name: "Brand Subtle", hex: "var(--fp-primary-subtle)", token: "--fp-primary-subtle", textWhite: false },
  { name: "Brand Border", hex: "var(--fp-primary-border)", token: "--fp-primary-border", textWhite: false },
  /* ── Accent / Secondary ── */
  { name: "Lime Green (UV)", hex: "#80b918", token: "--uv", textWhite: false },
  { name: "Forest Green", hex: "#2b9348", token: "--brand-secondary", textWhite: true },
  /* ── Gray System ── */
  { name: "Gray 900 (Heading)", hex: "#111827", token: "--fp-heading", textWhite: true },
  { name: "Gray 700 (Body)", hex: "#374151", token: "--fp-body", textWhite: true },
  { name: "Gray 500 (Secondary)", hex: "#6B7280", token: "--fp-secondary", textWhite: true },
  { name: "Gray 400 (Muted)", hex: "#9CA3AF", token: "--fp-muted", textWhite: false },
  { name: "Gray 200 (Border)", hex: "#E5E7EB", token: "--fp-border", textWhite: false },
  { name: "Gray 100 (Border Soft)", hex: "#F3F4F6", token: "--fp-border-soft", textWhite: false },
  { name: "White", hex: "#FFFFFF", token: "--fp-white", textWhite: false },
  { name: "Section BG", hex: "#FEFCE8", token: "--fp-section-bg", textWhite: false },
  /* ── Status ── */
  { name: "Success", hex: "#2b9348", token: "--fp-success", textWhite: true },
  { name: "Warning", hex: "#f97316", token: "--fp-warning", textWhite: true },
  { name: "Error", hex: "#ef4444", token: "--fp-error", textWhite: true },
  { name: "Info", hex: "#0284c7", token: "--fp-info", textWhite: true },
];

const typeScale = [
  { name: "Display Hero", size: "48px", weight: "800", lh: "1.15", ls: "-0.02em", sample: "AI가 만들어드립니다" },
  { name: "Display", size: "36px", weight: "700", lh: "1.2", ls: "-0.015em", sample: "홍보 콘텐츠 자동화" },
  { name: "Heading 1", size: "30px", weight: "700", lh: "1.3", ls: "-0.01em", sample: "카드뉴스 생성" },
  { name: "Heading 2", size: "24px", weight: "600", lh: "1.3", ls: "-0.01em", sample: "멀티채널 배포" },
  { name: "Heading 3", size: "20px", weight: "600", lh: "1.4", ls: "normal", sample: "브랜드 스타일 학습" },
  { name: "Body Large", size: "18px", weight: "400", lh: "1.6", ls: "normal", sample: "주제만 입력하면 AI가 콘텐츠를 만들어드립니다." },
  { name: "Body", size: "16px", weight: "400", lh: "1.6", ls: "normal", sample: "카드뉴스, 블로그, 텍스트 콘텐츠를 지원합니다." },
  { name: "Body Small", size: "14px", weight: "400", lh: "1.5", ls: "normal", sample: "매월 10개 크레딧 무료 제공" },
  { name: "Caption", size: "13px", weight: "500", lh: "1.4", ls: "normal", sample: "PAIN POINTS · FEATURES" },
  { name: "Micro", size: "12px", weight: "400", lh: "1.4", ls: "normal", sample: "© 2026 FlowPack. All rights reserved." },
];

const spacing = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96];

export default function DesignSystemPage() {
  const [active, setActive] = useState("Foundation");

  return (
    <div style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", minHeight: "100vh", background: "#F7F8FA" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family: 'Pretendard Variable', 'Pretendard', sans-serif; box-sizing: border-box; }
        .ds-nav-item { cursor: pointer; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; color: var(--fp-secondary); transition: all 0.2s; }
        .ds-nav-item:hover { background: var(--fp-primary-subtle); color: var(--brand-500); }
        .ds-nav-item.active { background: var(--brand-500); color: #000; }
        .ds-section { margin-bottom: 64px; }
        .ds-section-title { font-size: 22px; font-weight: 700; color: var(--fp-heading); margin-bottom: 8px; }
        .ds-section-desc { font-size: 14px; color: var(--fp-secondary); margin-bottom: 24px; }
        .ds-subsection { font-size: 13px; font-weight: 700; color: var(--fp-muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 16px; margin-top: 32px; }
        code { background: var(--fp-border-soft); border: 1px solid var(--fp-border); border-radius: 4px; padding: 1px 6px; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: var(--fp-body); }
      `}</style>

      {/* 헤더 */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--fp-card-bg)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--fp-border-soft)", height: 56 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--brand-gradient)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Zap size={14} color="#000" />
              </div>
              <span style={{ fontSize: 14, color: "var(--fp-secondary)" }}>FlowPack</span>
            </Link>
            <span style={{ color: "var(--fp-border)" }}>/</span>
            {/* 라이브러리 탭 스위처 */}
            <div style={{ display: "flex", alignItems: "center", gap: 2, background: "var(--fp-border-soft)", borderRadius: 8, padding: 3 }}>
              <div style={{ padding: "4px 12px", borderRadius: 6, fontSize: 13, fontWeight: 700, color: "var(--fp-heading)", background: "var(--fp-card-bg)", boxShadow: "var(--fp-shadow-card)", display: "flex", alignItems: "center", gap: 6 }}>
                <Layers size={13} color="var(--brand-500)" />
                컴포넌트 라이브러리
              </div>
              <Link href="/design-library" style={{ padding: "4px 12px", borderRadius: 6, fontSize: 13, fontWeight: 500, color: "var(--fp-secondary)", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s" }}>
                <BookOpen size={13} />
                디자인 라이브러리
                <span style={{ fontSize: 10, fontWeight: 700, background: "var(--fp-primary-subtle)", color: "var(--brand-500)", padding: "1px 6px", borderRadius: 9999, border: "1px solid var(--fp-border)" }}>NEW</span>
              </Link>
            </div>
          </div>
          <span style={{ fontSize: 12, color: "var(--fp-muted)", background: "var(--fp-border-soft)", padding: "3px 8px", borderRadius: 6 }}>v1.0 · DESIGN.md 기반</span>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px", display: "flex", gap: 32 }}>
        {/* 사이드 네비 */}
        <aside style={{ width: 180, flexShrink: 0 }}>
          <div style={{ position: "sticky", top: 72, background: "var(--fp-card-bg)", borderRadius: 12, border: "1px solid var(--fp-border-soft)", padding: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--fp-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, padding: "0 4px" }}>Components</p>
            {sections.map(s => (
              <div key={s} className={`ds-nav-item${active === s ? " active" : ""}`} onClick={() => setActive(s)}>{s}</div>
            ))}
          </div>
        </aside>

        {/* 메인 컨텐츠 */}
        <main style={{ flex: 1, minWidth: 0 }}>

          {/* ── Foundation ────────────────────────── */}
          {active === "Foundation" && (
            <div>
              <div className="ds-section">
                <h2 className="ds-section-title">Foundation</h2>
                <p className="ds-section-desc">DESIGN.md 기반 FlowPack 디자인 시스템의 기초 토큰입니다.</p>

                <div className="ds-subsection">Color Palette</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
                  {colors.map(c => (
                    <div key={c.hex} style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--fp-border)", background: "var(--fp-card-bg)" }}>
                      <div style={{ height: 64, background: c.hex }} />
                      <div style={{ padding: "10px 12px" }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--fp-heading)", marginBottom: 2 }}>{c.name}</p>
                        <code>{c.hex}</code>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="ds-subsection">Gradient</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {[
                    { name: "Primary CTA", g: "var(--brand-gradient)", token: "--brand-gradient" },
                    { name: "CTA Banner", g: "linear-gradient(135deg,var(--brand-600),var(--uv))", token: "--brand-gradient" },
                    { name: "Persona BG", g: "var(--fp-gradient-persona)", token: "--fp-gradient-persona" },
                    { name: "Stat BG", g: "var(--fp-gradient-stat-bg,#FAF9FF)", token: "--fp-gradient-stat-bg" },
                  ].map(g => (
                    <div key={g.name} style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--fp-border)", width: 180 }}>
                      <div style={{ height: 64, background: g.g }} />
                      <div style={{ padding: "10px 12px", background: "var(--fp-card-bg)" }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--fp-heading)", marginBottom: 2 }}>{g.name}</p>
                        <code>{g.token}</code>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="ds-subsection">Typography Scale</div>
                <div style={{ background: "var(--fp-card-bg)", borderRadius: 12, border: "1px solid var(--fp-border-soft)", overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "160px 60px 60px 1fr", padding: "10px 20px", background: "var(--fp-section-bg)", borderBottom: "1px solid var(--fp-border-soft)", fontSize: 11, fontWeight: 700, color: "var(--fp-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    <span>Role</span><span>Size</span><span>Weight</span><span>Sample</span>
                  </div>
                  {typeScale.map((t, i) => (
                    <div key={t.name} style={{ display: "grid", gridTemplateColumns: "160px 60px 60px 1fr", padding: "14px 20px", borderBottom: i < typeScale.length - 1 ? "1px solid var(--fp-border-soft)" : "none", alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--fp-secondary)" }}>{t.name}</span>
                      <span style={{ fontSize: 12, color: "var(--fp-muted)" }}>{t.size}</span>
                      <span style={{ fontSize: 12, color: "var(--fp-muted)" }}>{t.weight}</span>
                      <span style={{ fontSize: t.size, fontWeight: Number(t.weight), lineHeight: t.lh, letterSpacing: t.ls, color: "var(--fp-heading)" }}>{t.sample}</span>
                    </div>
                  ))}
                </div>

                <div className="ds-subsection">Spacing Scale</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {spacing.map(s => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <span style={{ fontSize: 12, color: "var(--fp-muted)", width: 32, textAlign: "right" }}>{s}px</span>
                      <div style={{ height: 8, width: s * 1.5, background: "var(--brand-gradient)", borderRadius: 4 }} />
                      <code>space-{s / 4}</code>
                    </div>
                  ))}
                </div>

                <div className="ds-subsection">Border Radius</div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
                  {[{ n: "4px", r: 4 }, { n: "8px", r: 8 }, { n: "10px (Button)", r: 10 }, { n: "12px", r: 12 }, { n: "16px (Card)", r: 16 }, { n: "20px (Feature)", r: 20 }, { n: "24px (Banner)", r: 24 }, { n: "9999px (Pill)", r: 9999 }].map(({ n, r }) => (
                    <div key={n} style={{ textAlign: "center" }}>
                      <div style={{ width: 64, height: 64, background: "var(--fp-primary-subtle)", border: "2px solid var(--brand-500)", borderRadius: r, marginBottom: 6 }} />
                      <p style={{ fontSize: 11, color: "var(--fp-secondary)" }}>{n}</p>
                    </div>
                  ))}
                </div>

                <div className="ds-subsection">Shadow System</div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {[
                    { n: "Level 1 · Subtle",   s: "var(--fp-shadow-sm)" },
                    { n: "Level 2 · Standard", s: "var(--fp-shadow-md)" },
                    { n: "Level 3 · Elevated", s: "var(--fp-shadow-hover)" },
                    { n: "Level 4 · Floating", s: "var(--fp-shadow-lg)" },
                    { n: "CTA Glow",           s: "var(--fp-shadow-glow)" },
                  ].map(({ n, s }) => (
                    <div key={n} style={{ width: 140, height: 80, background: "var(--fp-card-bg)", borderRadius: 12, boxShadow: s, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--fp-body)", textAlign: "center", padding: 8 }}>{n}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Buttons ─────────────────────────────── */}
          {active === "Buttons" && (
            <div>
              <h2 className="ds-section-title">Buttons</h2>
              <p className="ds-section-desc">DESIGN.md §4 기반 버튼 변형과 상태입니다. radius 10px, Pretendard weight 600.</p>

              <div className="ds-subsection">Variants</div>
              <div style={{ background: "var(--fp-card-bg)", borderRadius: 12, border: "1px solid var(--fp-border-soft)", padding: 24, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                <button style={{ height: 44, padding: "0 20px", borderRadius: 10, border: "none", background: "var(--brand-gradient)", color: "#000", fontSize: 15, fontWeight: 600, cursor: "pointer", boxShadow: "var(--fp-shadow-glow)" }}>Primary Gradient</button>
                <button style={{ height: 44, padding: "0 20px", borderRadius: 10, border: "none", background: "var(--brand-500)", color: "#000", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Primary Solid</button>
                <button style={{ height: 44, padding: "0 20px", borderRadius: 10, border: "1.5px solid var(--fp-border)", background: "var(--fp-card-bg)", color: "var(--fp-body)", fontSize: 15, fontWeight: 500, cursor: "pointer" }}>Secondary</button>
                <button style={{ height: 44, padding: "0 20px", borderRadius: 8, border: "none", background: "transparent", color: "var(--fp-secondary)", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Ghost</button>
                <button style={{ height: 44, padding: "0 20px", borderRadius: 10, border: "none", background: "var(--fp-error)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Destructive</button>
                <button style={{ height: 44, padding: "0 20px", borderRadius: 10, border: "none", background: "var(--brand-gradient)", color: "#000", fontSize: 15, fontWeight: 600, cursor: "pointer", opacity: 0.5 }} disabled>Disabled</button>
              </div>

              <div className="ds-subsection">Sizes</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 24, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                <button style={{ height: 36, padding: "0 14px", borderRadius: 8, border: "none", background: "#2563EB", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Small (36px)</button>
                <button style={{ height: 44, padding: "0 20px", borderRadius: 10, border: "none", background: "#2563EB", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Default (44px)</button>
                <button style={{ height: 52, padding: "0 32px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#2563EB,var(--brand-600))", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 14px rgba(37,99,235,0.35)" }}>Large (52px)</button>
              </div>

              <div className="ds-subsection">With Icon</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 24, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                <button style={{ height: 44, padding: "0 20px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#2563EB,var(--brand-600))", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 14px rgba(37,99,235,0.35)" }}><Sparkles size={16} />카드뉴스 생성</button>
                <button style={{ height: 44, padding: "0 20px", borderRadius: 10, border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151", fontSize: 15, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}><BarChart2 size={16} />요금제 보기</button>
                <button style={{ height: 44, padding: "0 20px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#2563EB,var(--brand-600))", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>1분 만에 시작하기 <ArrowRight size={16} /></button>
                <button style={{ height: 44, width: 44, borderRadius: 10, border: "1.5px solid #E5E7EB", background: "#fff", color: "#6B7280", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={18} /></button>
                <button style={{ height: 44, width: 44, borderRadius: 10, border: "none", background: "#FEF2F2", color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={18} /></button>
                <button style={{ height: 44, width: 44, borderRadius: 10, border: "none", background: "#EFF6FF", color: "#2563EB", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Edit3 size={18} /></button>
              </div>

              <div className="ds-subsection">Spec Table</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", overflow: "hidden" }}>
                {[{v:"Primary Gradient",bg:"linear-gradient(135deg,#2563EB,var(--brand-600))",col:"#fff",r:"10px",note:"랜딩 CTA, 주요 액션"},{v:"Primary Solid",bg:"#2563EB",col:"#fff",r:"10px",note:"확인, 저장"},{v:"Secondary",bg:"#fff",col:"#374151",r:"10px",note:"취소, 요금제 보기"},{v:"Ghost",bg:"transparent",col:"#6B7280",r:"8px",note:"건너뛰기, 나중에"},{v:"Destructive",bg:"#DC2626",col:"#fff",r:"10px",note:"삭제, 위험 액션"}].map((b,i,arr) => (
                  <div key={b.v} style={{ display: "grid", gridTemplateColumns: "140px 180px 80px 1fr", padding: "12px 20px", borderBottom: i<arr.length-1?"1px solid #F3F4F6":"none", fontSize: 13, alignItems: "center", background: i%2===0?"#fff":"#F9FAFB" }}>
                    <span style={{ fontWeight: 600, color: "#111827" }}>{b.v}</span>
                    <code style={{ fontSize: 11 }}>{b.bg}</code>
                    <code style={{ fontSize: 11 }}>{b.r}</code>
                    <span style={{ color: "#6B7280" }}>{b.note}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Badges ──────────────────────────────── */}
          {active === "Badges" && (
            <div>
              <h2 className="ds-section-title">Badges</h2>
              <p className="ds-section-desc">pill(9999px) 기반 상태 배지. 파스텔 배경 + 진한 텍스트 조합.</p>

              <div className="ds-subsection">Brand</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 24, display: "flex", flexWrap: "wrap", gap: 10 }}>
                {[
                  { label: "Yellow (Primary)", bg: "#fefce8", color: "#a16207", border: "#fef08a" },
                  { label: "Lime (Accent)", bg: "#f7fee7", color: "#3f6212", border: "#d9f99d" },
                  { label: "Forest Green · Secondary", bg: "#f0faf3", color: "#1a5c2d", border: "#a3d9b0" },
                ].map(b => (
                  <span key={b.label} style={{ display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 9999, background: b.bg, color: b.color, border: `1px solid ${b.border}`, fontSize: 13, fontWeight: 600 }}>{b.label}</span>
                ))}
              </div>

              <div className="ds-subsection">Status</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 24, display: "flex", flexWrap: "wrap", gap: 10 }}>
                {[
                  { label: "완료", bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
                  { label: "예약", bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" },
                  { label: "임시저장", bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
                  { label: "보관", bg: "#F3F4F6", color: "#6B7280", border: "#E5E7EB" },
                  { label: "오류", bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
                ].map(b => (
                  <span key={b.label} style={{ display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 9999, background: b.bg, color: b.color, border: `1px solid ${b.border}`, fontSize: 13, fontWeight: 600 }}>{b.label}</span>
                ))}
              </div>

              <div className="ds-subsection">Content Type</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 24, display: "flex", flexWrap: "wrap", gap: 10 }}>
                {[
                  { label: "카드뉴스", bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" },
                  { label: "블로그", bg: "#EDE9FE", color: "#7C3AED", border: "#DDD6FE" },
                  { label: "동영상", bg: "#FFF1F2", color: "#E11D48", border: "#FECDD3" },
                  { label: "텍스트", bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0" },
                ].map(b => (
                  <span key={b.label} style={{ display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 9999, background: b.bg, color: b.color, border: `1px solid ${b.border}`, fontSize: 13, fontWeight: 600 }}>{b.label}</span>
                ))}
              </div>

              <div className="ds-subsection">Section Label (11px uppercase)</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 24, display: "flex", flexWrap: "wrap", gap: 16 }}>
                {["FEATURES", "HOW IT WORKS", "PAIN POINTS", "REVIEWS", "FAQ", "COMPARISON"].map(l => (
                  <span key={l} style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#2563EB" }}>{l}</span>
                ))}
              </div>
            </div>
          )}

          {/* ── Cards ───────────────────────────────── */}
          {active === "Cards" && (
            <div>
              <h2 className="ds-section-title">Cards</h2>
              <p className="ds-section-desc">radius 16–20px, 1px solid #F3F4F6. hover 시 translateY(-4px) + shadow 강화.</p>

              <div className="ds-subsection">Default Card</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                {[
                  { icon: <Clock size={20} color="#2563EB" />, title: "기획의 고통", bg: "#EFF6FF" },
                  { icon: <FileText size={20} color="#D97706" />, title: "제작 시간 부족", bg: "#FFFBEB" },
                  { icon: <TrendingUp size={20} color="#059669" />, title: "일관성 실패", bg: "#ECFDF5" },
                ].map((item) => (
                  <div key={item.title} style={{ background: "#fff", border: "1px solid #F3F4F6", borderRadius: 16, padding: 24, transition: "all 0.25s ease", cursor: "default" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 20px 40px rgba(0,0,0,0.08)"; (e.currentTarget as HTMLDivElement).style.borderColor = "#DBEAFE"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = ""; (e.currentTarget as HTMLDivElement).style.borderColor = "#F3F4F6"; }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>{item.icon}</div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 8 }}>{item.title}</p>
                    <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.5 }}>AI가 자동으로 해결해드립니다.</p>
                  </div>
                ))}
              </div>

              <div className="ds-subsection">Stat Card</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
                {[{ v: "90%", l: "콘텐츠 제작 시간 절감" }, { v: "5분", l: "카드뉴스 평균 제작" }, { v: "6+", l: "연동 SNS 채널" }, { v: "95%", l: "브랜드 스타일 일치도" }].map(s => (
                  <div key={s.l} style={{ background: "linear-gradient(135deg,#F8FAFF,#F0F4FF)", border: "1px solid #DBEAFE", borderRadius: 16, padding: 24, textAlign: "center" }}>
                    <div style={{ fontSize: 36, fontWeight: 800, background: "linear-gradient(135deg,#2563EB,var(--brand-600))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 4 }}>{s.v}</div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#6B7280" }}>{s.l}</p>
                  </div>
                ))}
              </div>

              <div className="ds-subsection">Testimonial Card</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                <div style={{ background: "#fff", border: "1px solid #F3F4F6", borderRadius: 16, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#2563EB,var(--brand-600))", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>김</div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>김민준</p>
                      <p style={{ fontSize: 12, color: "#9CA3AF" }}>@devoutsource_kim · 외주개발 대표</p>
                    </div>
                    <div style={{ marginLeft: "auto", color: "#FBBF24", fontSize: 13 }}>★★★★★</div>
                  </div>
                  <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>"FlowPack으로 3개월 만에 팔로워 3천명, 개발 외주 리드 10건."</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Forms ───────────────────────────────── */}
          {active === "Forms" && (
            <div>
              <h2 className="ds-section-title">Forms</h2>
              <p className="ds-section-desc">radius 10px, 1.5px solid #E5E7EB. focus 시 border #2563EB + ring rgba(37,99,235,0.1).</p>

              <div className="ds-subsection">Input</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 480 }}>
                <div>
                  <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 6 }}>이메일</label>
                  <input placeholder="hello@flowpack.dev" style={{ width: "100%", height: 44, padding: "0 14px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 15, color: "#111827", outline: "none", boxSizing: "border-box" }}
                    onFocus={e => { e.target.style.borderColor = "#2563EB"; e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.1)"; }}
                    onBlur={e => { e.target.style.borderColor = "#E5E7EB"; e.target.style.boxShadow = ""; }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 6 }}>비밀번호</label>
                  <input type="password" placeholder="8자 이상 입력하세요" style={{ width: "100%", height: 44, padding: "0 14px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 15, color: "#111827", outline: "none", boxSizing: "border-box" }}
                    onFocus={e => { e.target.style.borderColor = "#2563EB"; e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.1)"; }}
                    onBlur={e => { e.target.style.borderColor = "#E5E7EB"; e.target.style.boxShadow = ""; }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 6 }}>오류 상태</label>
                  <input defaultValue="잘못된 이메일" style={{ width: "100%", height: 44, padding: "0 14px", borderRadius: 10, border: "1.5px solid #DC2626", boxShadow: "0 0 0 3px rgba(220,38,38,0.1)", fontSize: 15, color: "#111827", outline: "none", boxSizing: "border-box" }} />
                  <p style={{ fontSize: 12, color: "#DC2626", marginTop: 4 }}>올바른 이메일 주소를 입력해주세요.</p>
                </div>
              </div>

              <div className="ds-subsection">Textarea</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 24, maxWidth: 480 }}>
                <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 6 }}>콘텐츠 주제</label>
                <textarea rows={4} placeholder="예: 5가지 마케팅 전략을 소개하는 카드뉴스 만들어줘" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 15, color: "#111827", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }}
                  onFocus={e => { e.target.style.borderColor = "#2563EB"; e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.1)"; }}
                  onBlur={e => { e.target.style.borderColor = "#E5E7EB"; e.target.style.boxShadow = ""; }} />
              </div>

              <div className="ds-subsection">Select & Switch</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 24, display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", maxWidth: 480 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 6 }}>콘텐츠 타입</label>
                  <select style={{ width: "100%", height: 44, padding: "0 14px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 15, color: "#374151", outline: "none", background: "#fff", boxSizing: "border-box" }}>
                    <option>카드뉴스</option><option>블로그</option><option>텍스트</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 10 }}>자동 배포</label>
                  <div style={{ width: 48, height: 28, borderRadius: 14, background: "#2563EB", position: "relative", cursor: "pointer" }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, right: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Feedback ────────────────────────────── */}
          {active === "Feedback" && (
            <div>
              <h2 className="ds-section-title">Feedback</h2>
              <p className="ds-section-desc">Alert, Progress, Skeleton 등 사용자 피드백 컴포넌트.</p>

              <div className="ds-subsection">Alert</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { type: "info", icon: "ℹ️", title: "안내", msg: "카드뉴스 생성에는 1개 크레딧이 사용됩니다.", bg: "#EFF6FF", border: "#BFDBFE", title_c: "#1D4ED8", msg_c: "#3B82F6" },
                  { type: "success", icon: "✅", title: "성공", msg: "카드뉴스가 성공적으로 생성되었습니다.", bg: "#ECFDF5", border: "#A7F3D0", title_c: "#065F46", msg_c: "#059669" },
                  { type: "warning", icon: "⚠️", title: "주의", msg: "크레딧이 2개 남았습니다. 플랜을 업그레이드하세요.", bg: "#FFFBEB", border: "#FDE68A", title_c: "#92400E", msg_c: "#D97706" },
                  { type: "error", icon: "❌", title: "오류", msg: "콘텐츠 생성에 실패했습니다. 다시 시도해주세요.", bg: "#FEF2F2", border: "#FECACA", title_c: "#991B1B", msg_c: "#DC2626" },
                ].map(a => (
                  <div key={a.type} style={{ background: a.bg, border: `1px solid ${a.border}`, borderRadius: 12, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 16 }}>{a.icon}</span>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: a.title_c, marginBottom: 2 }}>{a.title}</p>
                      <p style={{ fontSize: 14, color: a.msg_c }}>{a.msg}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="ds-subsection">Progress</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                {[{ label: "카드뉴스 사용", pct: 70, color: "#2563EB" }, { label: "블로그 사용", pct: 40, color: "#7C3AED" }, { label: "크레딧 소모", pct: 85, color: "#DC2626" }].map(p => (
                  <div key={p.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{p.label}</span>
                      <span style={{ fontSize: 13, color: "#6B7280" }}>{p.pct}%</span>
                    </div>
                    <div style={{ height: 8, background: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${p.pct}%`, background: p.color, borderRadius: 4, transition: "width 0.3s ease" }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="ds-subsection">Skeleton</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                <style>{`@keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} } .skeleton { background: linear-gradient(90deg,#F3F4F6 25%,#E5E7EB 50%,#F3F4F6 75%); background-size: 400px 100%; animation: shimmer 1.5s infinite; border-radius: 6px; }`}</style>
                <div className="skeleton" style={{ height: 20, width: "60%" }} />
                <div className="skeleton" style={{ height: 16, width: "90%" }} />
                <div className="skeleton" style={{ height: 16, width: "75%" }} />
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 8 }} />
                  <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 8 }} />
                </div>
              </div>

              {/* Toast Notification */}
              <div className="ds-subsection" style={{ marginTop: 32 }}>Toast Notification</div>
              <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 24 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}>
                  {[
                    { icon: <CheckCircle2 size={18} color="#059669" />, title: "저장 완료", msg: "콘텐츠가 성공적으로 저장되었습니다.", border: "#A7F3D0", bg: "#fff" },
                    { icon: <AlertTriangle size={18} color="#D97706" />, title: "크레딧 부족", msg: "이번 달 크레딧이 부족합니다.", border: "#FDE68A", bg: "#FFFBEB" },
                    { icon: <Info size={18} color="var(--brand-500)" />, title: "AI 생성 중", msg: "카드뉴스를 생성하고 있어요...", border: "#C7D2FE", bg: "#EEF2FF" },
                  ].map(t => (
                    <div key={t.title} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", borderRadius: 12, background: t.bg, border: `1px solid ${t.border}`, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
                      <div style={{ flexShrink: 0, marginTop: 1 }}>{t.icon}</div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 2 }}>{t.title}</p>
                        <p style={{ fontSize: 13, color: "#6B7280" }}>{t.msg}</p>
                      </div>
                      <span style={{ fontSize: 18, color: "#9CA3AF", cursor: "pointer", flexShrink: 0 }}>✕</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 404 Error Page */}
              <div className="ds-subsection" style={{ marginTop: 32 }}>404 Error Page</div>
              <div style={{ background: "linear-gradient(135deg,#F8F7FF,#EEF2FF)", border: "1px solid #C7D2FE", borderRadius: 16, padding: 64, textAlign: "center" }}>
                <div style={{ fontSize: 80, fontWeight: 900, background: "linear-gradient(135deg,var(--brand-500),var(--brand-500))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1, marginBottom: 16 }}>404</div>
                <h3 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 8 }}>페이지를 찾을 수 없어요</h3>
                <p style={{ fontSize: 15, color: "#6B7280", marginBottom: 32 }}>요청하신 페이지가 삭제되었거나 주소가 변경되었어요.</p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                  <button style={{ padding: "12px 28px", borderRadius: 10, background: "linear-gradient(135deg,var(--brand-500),var(--brand-500))", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>홈으로 이동</button>
                  <button style={{ padding: "12px 28px", borderRadius: 10, background: "#fff", color: "#374151", border: "1.5px solid #E5E7EB", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>이전 페이지</button>
                </div>
              </div>

            </div>
          )}

          {/* ── Landing UI ──────────────────────────── */}
          {active === "Landing UI" && (
            <div>
              <h2 className="ds-section-title">Landing UI</h2>
              <p className="ds-section-desc">랜딩 페이지 전용 컴포넌트. DESIGN.md §9 기반.</p>

              <div className="ds-subsection">Hero Badge</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 24, display: "flex", flexWrap: "wrap", gap: 12 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: 9999, background: "var(--fp-primary-subtle)", color: "#a16207", border: "1px solid var(--fp-primary-border)", fontSize: 13, fontWeight: 600 }}>✨ AI 기반 홍보 콘텐츠 플랫폼</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 9999, background: "#f0faf3", color: "#1a5c2d", border: "1px solid #a3d9b0", fontSize: 13, fontWeight: 700 }}>✨ AI 페르소나 · NEW</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 16px", borderRadius: 9999, background: "var(--brand-secondary)", color: "#fff", fontSize: 13, fontWeight: 700 }}>🎉 지금 가입하면 1주일 완전 무료</span>
              </div>

              <div className="ds-subsection">Feature Card</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
                {[
                  { icon: <FileText size={22} color="#2563EB" />, title: "카드뉴스", desc: "레퍼런스 디자인 학습으로 무한 생성", tag: "5분 제작", bg: "#EFF6FF", c: "#2563EB" },
                  { icon: <PenLine size={22} color="#059669" />, title: "블로그", desc: "SEO 최적화된 전문가 수준의 글", tag: "2000자+ 장문", bg: "#ECFDF5", c: "#059669" },
                  { icon: <Hash size={22} color="#D97706" />, title: "텍스트 SNS", desc: "Threads, X, LinkedIn 최적화 글", tag: "채널별 최적화", bg: "#FFFBEB", c: "#D97706" },
                  { icon: <Share2 size={22} color="#7C3AED" />, title: "멀티배포", desc: "SNS와 블로그 동시 배포", tag: "원클릭", bg: "#F5F3FF", c: "#7C3AED" },
                ].map(f => (
                  <div key={f.title} style={{ background: "#fff", border: "1px solid #F3F4F6", borderRadius: 20, padding: 28 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: f.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>{f.icon}</div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 6 }}>{f.title}</p>
                    <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5, marginBottom: 12 }}>{f.desc}</p>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 9999, background: f.bg, color: f.c, border: `1px solid ${f.c}30`, fontSize: 12, fontWeight: 600 }}><Check size={10} /> {f.tag}</span>
                  </div>
                ))}
              </div>

              <div className="ds-subsection">Channel Pills</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 24, display: "flex", flexWrap: "wrap", gap: 10 }}>
                {["Instagram", "Facebook", "Twitter / X", "LinkedIn", "Naver", "WordPress"].map(c => (
                  <span key={c} style={{ padding: "8px 20px", borderRadius: 9999, background: "#F9FAFB", border: "1px solid #E5E7EB", fontSize: 14, fontWeight: 500, color: "#6B7280" }}>{c}</span>
                ))}
              </div>

              <div className="ds-subsection">Step Indicator</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 32, display: "flex", justifyContent: "center", gap: 48, alignItems: "flex-start" }}>
                {[
                  { n: "01", t: "주제 입력", c: "#2563EB", sh: "rgba(37,99,235,0.3)" },
                  { n: "02", t: "AI 생성", c: "var(--brand-600)", sh: "rgba(79,70,229,0.3)" },
                  { n: "03", t: "배포", c: "#059669", sh: "rgba(5,150,105,0.3)" },
                ].map((s, i) => (
                  <div key={s.n} style={{ textAlign: "center", position: "relative" }}>
                    {i < 2 && <div style={{ position: "absolute", top: 28, left: "100%", width: "100%", height: 2, background: "linear-gradient(90deg,#BFDBFE,#DDD6FE)", marginLeft: 8 }} />}
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: s.c, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, margin: "0 auto 12px", boxShadow: `0 8px 20px ${s.sh}` }}>{s.n}</div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{s.t}</p>
                  </div>
                ))}
              </div>

              <div className="ds-subsection">CTA Banner</div>
              <div style={{ borderRadius: 20, padding: 40, background: "linear-gradient(135deg,#1D4ED8,var(--brand-600))", textAlign: "center", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 60% at 50% 0%,rgba(255,255,255,0.1),transparent)", pointerEvents: "none" }} />
                <p style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 8 }}>마케팅, 더 이상 직접 하지 마세요</p>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", marginBottom: 24 }}>FlowPack과 함께 홍보 시간을 90% 줄이세요.</p>
                <button style={{ height: 48, padding: "0 28px", borderRadius: 12, border: "none", background: "#fff", color: "#2563EB", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>무료 체험 시작하기 →</button>
              </div>
            </div>
          )}

          {/* ── Icons ─────────────────────────────── */}
          {active === "Icons" && (
            <div>
              <h2 className="ds-section-title">Icons</h2>
              <p className="ds-section-desc">FlowPack 에서 사용하는 Lucide React 아이콘 레퍼런스. <code>lucide-react</code>만 사용하며 SVG 이모지 사용 안 함.</p>

              <div className="ds-subsection">Navigation & Layout</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px,1fr))", gap: 8 }}>
                {[
                  { ic: <Home size={20} />, n: "Home" },
                  { ic: <LayoutDashboard size={20} />, n: "Dashboard" },
                  { ic: <Settings size={20} />, n: "Settings" },
                  { ic: <Search size={20} />, n: "Search" },
                  { ic: <Bell size={20} />, n: "Bell" },
                  { ic: <User size={20} />, n: "User" },
                  { ic: <Users size={20} />, n: "Users" },
                  { ic: <ChevronRight size={20} />, n: "ChevronRight" },
                  { ic: <ChevronDown size={20} />, n: "ChevronDown" },
                  { ic: <ArrowRight size={20} />, n: "ArrowRight" },
                  { ic: <Layers size={20} />, n: "Layers" },
                  { ic: <Eye size={20} />, n: "Eye" },
                ].map(({ ic, n }) => (
                  <div key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 8px", borderRadius: 8, cursor: "default" }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "#EFF6FF"}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = ""}
                  >
                    <span style={{ color: "#374151" }}>{ic}</span>
                    <span style={{ fontSize: 10, color: "#9CA3AF", textAlign: "center" }}>{n}</span>
                  </div>
                ))}
              </div>

              <div className="ds-subsection">Content & Actions</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px,1fr))", gap: 8 }}>
                {[
                  { ic: <FileText size={20} />, n: "FileText" },
                  { ic: <PenLine size={20} />, n: "PenLine" },
                  { ic: <Edit3 size={20} />, n: "Edit3" },
                  { ic: <Trash2 size={20} />, n: "Trash2" },
                  { ic: <Plus size={20} />, n: "Plus" },
                  { ic: <Share2 size={20} />, n: "Share2" },
                  { ic: <Rocket size={20} />, n: "Rocket" },
                  { ic: <Sparkles size={20} />, n: "Sparkles" },
                  { ic: <Image size={20} />, n: "Image" },
                  { ic: <Video size={20} />, n: "Video" },
                  { ic: <Hash size={20} />, n: "Hash" },
                  { ic: <Newspaper size={20} />, n: "Newspaper" },
                  { ic: <Globe size={20} />, n: "Globe" },
                  { ic: <Smartphone size={20} />, n: "Smartphone" },
                ].map(({ ic, n }) => (
                  <div key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 8px", borderRadius: 8, cursor: "default" }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "#EFF6FF"}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = ""}
                  >
                    <span style={{ color: "#374151" }}>{ic}</span>
                    <span style={{ fontSize: 10, color: "#9CA3AF", textAlign: "center" }}>{n}</span>
                  </div>
                ))}
              </div>

              <div className="ds-subsection">Status & Feedback</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px,1fr))", gap: 8 }}>
                {[
                  { ic: <Check size={20} />, n: "Check", c: "#059669" },
                  { ic: <CheckCircle2 size={20} />, n: "CheckCircle2", c: "#059669" },
                  { ic: <Info size={20} />, n: "Info", c: "#2563EB" },
                  { ic: <AlertTriangle size={20} />, n: "AlertTriangle", c: "#D97706" },
                  { ic: <XCircle size={20} />, n: "XCircle", c: "#DC2626" },
                  { ic: <Star size={20} />, n: "Star", c: "#FBBF24" },
                  { ic: <Shield size={20} />, n: "Shield", c: "var(--brand-600)" },
                  { ic: <Activity size={20} />, n: "Activity", c: "#2563EB" },
                  { ic: <TrendingUp size={20} />, n: "TrendingUp", c: "#059669" },
                  { ic: <Target size={20} />, n: "Target", c: "#7C3AED" },
                  { ic: <CreditCard size={20} />, n: "CreditCard", c: "#374151" },
                  { ic: <Mail size={20} />, n: "Mail", c: "#374151" },
                  { ic: <Zap size={20} />, n: "Zap", c: "#F59E0B" },
                ].map(({ ic, n, c }) => (
                  <div key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 8px", borderRadius: 8, cursor: "default" }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "#EFF6FF"}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = ""}
                  >
                    <span style={{ color: c }}>{ic}</span>
                    <span style={{ fontSize: 10, color: "#9CA3AF", textAlign: "center" }}>{n}</span>
                  </div>
                ))}
              </div>

              <div className="ds-subsection">Icon Sizes</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 24, display: "flex", gap: 32, alignItems: "flex-end" }}>
                {[12, 16, 20, 24, 32, 40, 48].map(s => (
                  <div key={s} style={{ textAlign: "center" }}>
                    <Sparkles size={s} color="#2563EB" />
                    <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>{s}px</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Navigation ─────────────────────────── */}
          {active === "Navigation" && (
            <div>
              <h2 className="ds-section-title">Navigation</h2>
              <p className="ds-section-desc">앱 내부 네비게이션 패턴. 사이드바, 탭, 브레드크럼브.</p>

              <div className="ds-subsection">App Sidebar Item</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 16, maxWidth: 220 }}>
                {[
                  { icon: <Home size={18} />, label: "홈", active: false },
                  { icon: <LayoutDashboard size={18} />, label: "대시보드", active: true },
                  { icon: <FileText size={18} />, label: "콘텐츠", active: false },
                  { icon: <Sparkles size={18} />, label: "AI 생성", active: false },
                  { icon: <BarChart2 size={18} />, label: "분석", active: false },
                  { icon: <Settings size={18} />, label: "설정", active: false },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, marginBottom: 2, background: item.active ? "#EFF6FF" : "transparent", color: item.active ? "#2563EB" : "#6B7280", fontWeight: item.active ? 600 : 400, fontSize: 14, cursor: "pointer" }}>
                    {item.icon}
                    <span>{item.label}</span>
                    {item.active && <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#2563EB" }} />}
                  </div>
                ))}
              </div>

              <div className="ds-subsection">Tabs</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 24 }}>
                <div style={{ display: "inline-flex", background: "#F3F4F6", borderRadius: 10, padding: 4, gap: 2 }}>
                  {["전체", "콘텐츠", "난초고", "컴플리트"].map((tab, i) => (
                    <div key={tab} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 14, fontWeight: i === 0 ? 600 : 400, color: i === 0 ? "#111827" : "#6B7280", background: i === 0 ? "#fff" : "transparent", cursor: "pointer", boxShadow: i === 0 ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>{tab}</div>
                  ))}
                </div>
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #F3F4F6" }}>
                    {["콘텐츠", "다임둑비드", "소셜계정"].map((tab, i) => (
                      <div key={tab} style={{ padding: "10px 20px", fontSize: 14, fontWeight: i === 0 ? 600 : 400, color: i === 0 ? "#2563EB" : "#6B7280", borderBottom: i === 0 ? "2px solid #2563EB" : "none", marginBottom: -2, cursor: "pointer" }}>{tab}</div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="ds-subsection">Breadcrumb</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                  {["홈", "콘텐츠", "카드뉴스"].map((crumb, i, arr) => (
                    <>
                      <span key={crumb} style={{ color: i === arr.length - 1 ? "#111827" : "#9CA3AF", fontWeight: i === arr.length - 1 ? 600 : 400, cursor: i < arr.length - 1 ? "pointer" : "default" }}>{crumb}</span>
                      {i < arr.length - 1 && <ChevronRight size={14} color="#D1D5DB" />}
                    </>
                  ))}
                </div>
              </div>

              <div className="ds-subsection">Top Navigation Bar</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", height: 56, borderBottom: "1px solid #F3F4F6" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#2563EB,var(--brand-600))", display: "flex", alignItems: "center", justifyContent: "center" }}><Zap size={14} color="#fff" /></div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>FlowPack</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Bell size={16} color="#6B7280" /></div>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Settings size={16} color="#6B7280" /></div>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,var(--brand-500),var(--brand-500))", display: "flex", alignItems: "center", justifyContent: "center" }}><User size={16} color="#fff" /></div>
                  </div>
                </div>
              </div>

              {/* Mega Dropdown Menu */}
              <div className="ds-subsection" style={{ marginTop: 32 }}>Mega Dropdown Menu</div>
              <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden", marginBottom: 24 }}>
                <div style={{ padding: "12px 24px", background: "#F8F7FF", borderBottom: "1px solid #EEF2FF", display: "flex", gap: 32, alignItems: "center" }}>
                  {["소개", "서비스", "ESG", "미디어", "투자정보"].map((m, i) => (
                    <div key={m} style={{ fontSize: 14, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? "var(--brand-500)" : "#374151", cursor: "pointer", borderBottom: i === 0 ? "2px solid var(--brand-500)" : "none", paddingBottom: 4 }}>{m}</div>
                  ))}
                </div>
                <div style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                  {[
                    { label: "회사소개", desc: "FlowPack 비전과 팀" },
                    { label: "윤리경영", desc: "신뢰와 투명성" },
                    { label: "브랜드 리소스", desc: "로고 및 에셋" },
                    { label: "오시는 길", desc: "위치 및 연락처" },
                  ].map(item => (
                    <div key={item.label} style={{ padding: "12px 16px", borderRadius: 10, cursor: "pointer", background: "#FAFAFA", border: "1px solid #F3F4F6" }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 2 }}>{item.label}</p>
                      <p style={{ fontSize: 12, color: "#9CA3AF" }}>{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile Menu Drawer */}
              <div className="ds-subsection">Mobile Menu Drawer</div>
              <div style={{ background: "#F3F4F6", borderRadius: 16, padding: 16, display: "flex", gap: 0, alignItems: "stretch", minHeight: 240, overflow: "hidden" }}>
                <div style={{ width: 260, background: "#fff", borderRadius: "12px 0 0 12px", boxShadow: "4px 0 20px rgba(0,0,0,0.08)" }}>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>FlowPack</span>
                    <span style={{ fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</span>
                  </div>
                  {["홈", "기능", "요금제", "문의하기"].map((m, i) => (
                    <div key={m} style={{ padding: "14px 20px", borderBottom: "1px solid #F9FAFB", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer",
                      background: i === 1 ? "#EEF2FF" : "#fff", color: i === 1 ? "var(--brand-500)" : "#374151", fontWeight: i === 1 ? 600 : 400, fontSize: 15 }}>
                      {m} <ChevronRight size={16} />
                    </div>
                  ))}
                  <div style={{ padding: 16 }}>
                    <button style={{ width: "100%", height: 44, borderRadius: 10, background: "linear-gradient(135deg,var(--brand-500),var(--brand-500))", color: "#fff", border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>무료로 시작하기</button>
                  </div>
                </div>
                <div style={{ flex: 1, opacity: 0.3, background: "#111827", borderRadius: "0 12px 12px 0" }} />
              </div>

            </div>
          )}



          {/* ── Pricing ───────────────────────────── */}
          {active === "Pricing" && (
            <div>
              <h2 className="ds-section-title">Pricing</h2>
              <p className="ds-section-desc">요금제 페이지 전용 컴포넌트. 플랜 카드, Billing Toggle, 기능 체크리스트.</p>

              <div className="ds-subsection">Billing Toggle</div>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 24, display: "flex", justifyContent: "center" }}>
                <div style={{ display: "inline-flex", background: "#F3F4F6", borderRadius: 10, padding: 4, gap: 2 }}>
                  <div style={{ padding: "7px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600, color: "#111827", background: "#fff", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>월간결제</div>
                  <div style={{ padding: "7px 20px", borderRadius: 8, fontSize: 14, fontWeight: 400, color: "#6B7280", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>연간결제 <span style={{ padding: "2px 8px", borderRadius: 9999, background: "#ECFDF5", color: "#059669", fontSize: 11, fontWeight: 700 }}>20% 할인</span></div>
                </div>
              </div>

              <div className="ds-subsection">Pricing Cards</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                {[
                  {
                    name: "Free", price: "0", period: "/월", desc: "개인 크리에이터 시작용",
                    features: ["10 크레딧/월", "카드뉴스 3장", "1개 콘텐츠 타입", "SNS 1개 연동"],
                    cta: "시작하기", highlight: false, badge: null
                  },
                  {
                    name: "Pro", price: "29,000", period: "/월", desc: "마케터 & 스타트업",
                    features: ["100 크레딧/월", "모든 콘텐츠 타입", "SNS 6개 연동", "AI 페르소나", "예약 발행"],
                    cta: "14일 무료 체험", highlight: true, badge: "가장 인기"
                  },
                  {
                    name: "Business", price: "79,000", period: "/월", desc: "팀 & 에이전시",
                    features: ["500 크레딧/월", "무제한 콘텐츠 타입", "SNS 전체 연동", "원클릭 예약발행", "팀원 5명"],
                    cta: "영업팀 문의", highlight: false, badge: null
                  },
                ].map(plan => (
                  <div key={plan.name} style={{ background: plan.highlight ? "linear-gradient(135deg,var(--brand-500),var(--brand-500))" : "#fff", border: plan.highlight ? "none" : "1px solid #E5E7EB", borderRadius: 20, padding: 28, position: "relative" }}>
                    {plan.badge && <span style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", padding: "3px 12px", borderRadius: 9999, background: "#059669", color: "#fff", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{plan.badge}</span>}
                    <p style={{ fontSize: 13, fontWeight: 700, color: plan.highlight ? "rgba(255,255,255,0.7)" : "#6B7280", marginBottom: 4 }}>{plan.name}</p>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 6 }}>
                      <span style={{ fontSize: 32, fontWeight: 800, color: plan.highlight ? "#fff" : "#111827" }}>&#8361;{plan.price}</span>
                      <span style={{ fontSize: 13, color: plan.highlight ? "rgba(255,255,255,0.6)" : "#9CA3AF" }}>{plan.period}</span>
                    </div>
                    <p style={{ fontSize: 13, color: plan.highlight ? "rgba(255,255,255,0.7)" : "#6B7280", marginBottom: 20 }}>{plan.desc}</p>
                    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                      {plan.features.map(f => (
                        <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: plan.highlight ? "rgba(255,255,255,0.9)" : "#374151" }}>
                          <CheckCircle2 size={14} color={plan.highlight ? "rgba(255,255,255,0.8)" : "#059669"} />{f}
                        </li>
                      ))}
                    </ul>
                    <button style={{ width: "100%", height: 44, borderRadius: 10, border: plan.highlight ? "none" : "1.5px solid #E5E7EB", background: plan.highlight ? "#fff" : "transparent", color: plan.highlight ? "var(--brand-500)" : "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{plan.cta}</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Hero Patterns ──────────────────────── */}
          {active === "Hero Patterns" && (
            <div>
              <div className="ds-section">
                <h2 className="ds-section-title">Hero Patterns</h2>
                <p className="ds-section-desc">카카오뱅크 벤치마킹 기반 랜딩 히어로 패턴. KPI Stats, Feature Cards, CTA Banner.</p>

                {/* KPI Stats Bar */}
                <div className="ds-subsection">KPI Stats Bar</div>
                <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 32, marginBottom: 24 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, borderRadius: 12, overflow: "hidden", border: "1px solid #E5E7EB" }}>
                    {[
                      { icon: <FileText size={24} color="var(--brand-500)" />, num: "2,400+", label: "생성된 콘텐츠", sub: "이번 달" },
                      { icon: <Clock size={24} color="var(--brand-500)" />, num: "68%", label: "시간 절약", sub: "평균 대비" },
                      { icon: <TrendingUp size={24} color="var(--brand-500)" />, num: "4.9/5", label: "사용자 만족도", sub: "리뷰 1,200개" },
                    ].map((s, i) => (
                      <div key={s.label} style={{ padding: "28px 32px", borderRight: i < 2 ? "1px solid #E5E7EB" : "none", textAlign: "center", background: "#FAFAFA" }}>
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--fp-primary-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>{s.icon}</div>
                        </div>
                        <div style={{ fontSize: 36, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", lineHeight: 1 }}>{s.num}</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginTop: 6 }}>{s.label}</div>
                        <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 2 }}>{s.sub}</div>
                      </div>
                    ))}
                  </div>
                  <p style={{ marginTop: 12, fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>토큰: <code>--brand-500</code> 아이콘 색상, <code>--fp-heading</code> 숫자, 3열 border 구분</p>
                </div>

                {/* Feature Card Large */}
                <div className="ds-subsection">Feature Card Large (좌이미지+우텍스트)</div>
                <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden", marginBottom: 24, display: "flex", minHeight: 280 }}>
                  <div style={{ flex: 1, background: "linear-gradient(135deg,#EEF2FF,#F5F3FF)", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
                    <div style={{ width: "100%", maxWidth: 280, background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 20px 40px var(--fp-primary-subtle)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,var(--brand-500),var(--brand-500))" }} />
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-500)" }}>AI 콘텐츠 생성</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>카드뉴스 초안</div>
                        </div>
                      </div>
                      {[90, 75, 60].map((w, i) => (
                        <div key={i} style={{ height: 8, borderRadius: 4, background: i === 0 ? "var(--brand-500)" : "#E5E7EB", width: `${w}%`, marginBottom: 8 }} />
                      ))}
                      <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--fp-primary-subtle)", borderRadius: 8, fontSize: 12, color: "#a16207", fontWeight: 600, textAlign: "center" }}>✓ 생성 완료</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, padding: "40px 48px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <span style={{ display: "inline-flex", padding: "4px 10px", background: "var(--fp-primary-subtle)", borderRadius: 9999, fontSize: 12, fontWeight: 700, color: "#a16207", marginBottom: 16, width: "fit-content" }}>AI 생성</span>
                    <h3 style={{ fontSize: 28, fontWeight: 800, color: "#111827", lineHeight: 1.2, marginBottom: 12 }}>주제만 입력하면<br/>AI가 완성합니다</h3>
                    <p style={{ fontSize: 16, color: "#6B7280", lineHeight: 1.6, marginBottom: 24 }}>카드뉴스, 블로그, SNS 캡션까지. 브랜드 톤을 학습한 AI가 일관된 콘텐츠를 자동 생성합니다.</p>
                    <button style={{ width: "fit-content", padding: "12px 24px", borderRadius: 10, background: "var(--brand-500)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                      무료로 시작하기 <ArrowRight size={16} />
                    </button>
                  </div>
                </div>

                {/* CTA Banner */}
                <div className="ds-subsection">CTA Banner (풀폭 그라디언트)</div>
                <div style={{ borderRadius: 20, background: "linear-gradient(135deg,var(--brand-500),var(--brand-500))", padding: "48px 64px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 24 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>지금 시작하세요</p>
                    <h3 style={{ fontSize: 32, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>첫 10개 콘텐츠, <br />무료로 만들어보세요.</h3>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button style={{ padding: "14px 28px", borderRadius: 10, background: "#fff", color: "var(--brand-500)", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>무료로 시작하기</button>
                    <button style={{ padding: "14px 28px", borderRadius: 10, background: "transparent", color: "#fff", border: "2px solid rgba(255,255,255,0.4)", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>데모 보기</button>
                  </div>
                </div>

                {/* Alert Banner */}
                <div className="ds-subsection" style={{ marginTop: 32 }}>Alert Banner (4종)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { type: "info", icon: <Info size={16} color="var(--fp-info)" />, bg: "var(--fp-info-bg)", border: "var(--fp-info-border)", text: "FlowPack v2.1이 출시되었습니다. 새로운 기능을 확인해보세요.", actionColor: "var(--fp-info)", action: "자세히 보기" },
                    { type: "success", icon: <CheckCircle2 size={16} color="var(--fp-success)" />, bg: "var(--fp-success-bg)", border: "var(--fp-success-border)", text: "콘텐츠가 성공적으로 발행되었습니다. 3개 채널에 업로드 완료.", actionColor: "var(--fp-success)", action: "확인" },
                    { type: "warning", icon: <AlertTriangle size={16} color="var(--fp-warning)" />, bg: "var(--fp-warning-bg)", border: "var(--fp-warning-border)", text: "이번 달 크레딧이 80% 소진되었습니다. 플랜 업그레이드를 고려해보세요.", actionColor: "var(--fp-warning)", action: "업그레이드" },
                    { type: "error", icon: <XCircle size={16} color="var(--fp-error)" />, bg: "var(--fp-error-bg)", border: "var(--fp-error-border)", text: "Instagram 연동이 끊어졌습니다. 재연결이 필요합니다.", actionColor: "var(--fp-error)", action: "재연결" },
                  ].map(a => (
                    <div key={a.type} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: a.bg, border: `1px solid ${a.border}` }}>
                      {a.icon}
                      <span style={{ flex: 1, fontSize: 14, color: "#374151" }}>{a.text}</span>
                      <button style={{ fontSize: 13, fontWeight: 600, color: a.actionColor, background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>{a.action} →</button>
                    </div>
                  ))}
                </div>

                {/* Sticky CTA */}
                <div className="ds-subsection" style={{ marginTop: 32 }}>Sticky CTA Bar (모바일 하단 고정)</div>
                <div style={{ position: "relative", background: "#F3F4F6", borderRadius: 16, padding: 24, overflow: "hidden", minHeight: 120 }}>
                  <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}>모바일 화면 하단 고정 바 — 실제 구현 시 <code>position: fixed; bottom: 0</code></p>
                  <div style={{ background: "#fff", borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 -4px 20px rgba(0,0,0,0.1)", border: "1px solid #F3F4F6" }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>지금 무료로 시작하세요</p>
                      <p style={{ fontSize: 12, color: "#9CA3AF" }}>첫 10개 콘텐츠 무료</p>
                    </div>
                    <button style={{ padding: "10px 20px", borderRadius: 10, background: "linear-gradient(135deg,var(--brand-500),var(--brand-500))", color: "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>시작하기</button>
                  </div>
                </div>

                {/* Partner Logo Grid */}
                <div className="ds-subsection" style={{ marginTop: 32 }}>Partner Logo Grid (통합 채널)</div>
                <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 32 }}>
                  <p style={{ textAlign: "center", fontSize: 14, color: "#9CA3AF", marginBottom: 24, fontWeight: 500 }}>지원 채널 & 통합 플랫폼</p>
                  <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
                    {[
                      { name: "Instagram", color: "#E1306C", bg: "#FFF0F5" },
                      { name: "YouTube", color: "#FF0000", bg: "#FFF5F5" },
                      { name: "Blog", color: "#03C75A", bg: "#F0FFF6" },
                      { name: "Facebook", color: "#1877F2", bg: "#F0F6FF" },
                      { name: "Twitter/X", color: "#111827", bg: "#F9FAFB" },
                      { name: "LinkedIn", color: "#0A66C2", bg: "#F0F6FF" },
                      { name: "TikTok", color: "#69C9D0", bg: "#F0FDFC" },
                      { name: "Threads", color: "#111827", bg: "#F9FAFB" },
                    ].map(p => (
                      <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: p.bg, border: `1px solid ${p.color}22` }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: p.color }}>{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Category Filter Tab */}
                <div className="ds-subsection" style={{ marginTop: 32 }}>Category Filter Tab (인터랙티브)</div>
                <CategoryFilterDemo />

              </div>
            </div>
          )}



          {/* ── Marketing ──────────────────────────── */}
          {active === "Marketing" && (
            <div>
              <div className="ds-section">
                <h2 className="ds-section-title">Marketing</h2>
                <p className="ds-section-desc">전환율을 높이는 마케팅 컴포넌트. Testimonial, Comparison Table, Email Capture.</p>

                {/* Testimonial */}
                <div className="ds-subsection">Testimonial Cards</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 32 }}>
                  {[
                    { name: "김지연", role: "마케팅 디렉터, 스타트업A", text: "콘텐츠 제작 시간이 70% 줄었어요. 이제 아이디어에만 집중할 수 있습니다.", rating: 5 },
                    { name: "박성민", role: "대표이사, 브랜드B", text: "SNS 6개 채널에 동시 발행이 가능해서 정말 편합니다. 팀 모두가 만족해요.", rating: 5 },
                    { name: "이수아", role: "콘텐츠 크리에이터", text: "AI가 브랜드 톤을 정확히 이해해서 수정이 거의 없어요. 강력 추천합니다.", rating: 5 },
                  ].map(t => (
                    <div key={t.name} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 24 }}>
                      <div style={{ display: "flex", gap: 2, marginBottom: 12 }}>
                        {[...Array(t.rating)].map((_, i) => <Star key={i} size={14} color="#F59E0B" fill="#F59E0B" />)}
                      </div>
                      <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, marginBottom: 16 }}>"{t.text}"</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,var(--brand-500),var(--brand-500))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{t.name[0]}</span>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{t.name}</div>
                          <div style={{ fontSize: 12, color: "#9CA3AF" }}>{t.role}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Comparison Table */}
                <div className="ds-subsection">Comparison Table</div>
                <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden", marginBottom: 32 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", background: "var(--fp-primary-subtle)" }}>
                    <div style={{ padding: "16px 24px", fontSize: 13, fontWeight: 700, color: "#9CA3AF" }}>기능</div>
                    <div style={{ padding: "16px 24px", fontSize: 13, fontWeight: 700, color: "#a16207", textAlign: "center" }}>FlowPack</div>
                    <div style={{ padding: "16px 24px", fontSize: 13, fontWeight: 700, color: "#9CA3AF", textAlign: "center" }}>수동 작업</div>
                  </div>
                  {[
                    ["콘텐츠 초안 생성", true, false],
                    ["멀티채널 동시 배포", true, false],
                    ["브랜드 톤 학습", true, false],
                    ["예약 발행", true, false],
                    ["분석 리포트", true, false],
                  ].map(([label, fp, manual], i) => (
                    <div key={String(label)} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", borderTop: "1px solid #F3F4F6", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                      <div style={{ padding: "14px 24px", fontSize: 14, color: "#374151" }}>{String(label)}</div>
                      <div style={{ padding: "14px 24px", textAlign: "center" }}>
                        {fp ? <CheckCircle2 size={18} color="#059669" /> : <XCircle size={18} color="#E5E7EB" />}
                      </div>
                      <div style={{ padding: "14px 24px", textAlign: "center" }}>
                        {manual ? <CheckCircle2 size={18} color="#059669" /> : <XCircle size={18} color="#DC2626" />}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Email Lead Capture */}
                <div className="ds-subsection">Email Lead Capture</div>
                <div style={{ background: "linear-gradient(135deg,#fefce8,#f7fee7)", borderRadius: 16, padding: 40, textAlign: "center", border: "1px solid var(--fp-primary-border)" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#a16207", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>얼리 액세스</p>
                  <h3 style={{ fontSize: 24, fontWeight: 800, color: "#111827", marginBottom: 8 }}>출시 알림 신청하기</h3>
                  <p style={{ fontSize: 15, color: "#6B7280", marginBottom: 24 }}>베타 사용자에게는 50% 할인 혜택을 드립니다.</p>
                  <div style={{ display: "flex", gap: 8, maxWidth: 480, margin: "0 auto" }}>
                    <input placeholder="이메일 주소 입력" style={{ flex: 1, height: 48, padding: "0 16px", borderRadius: 10, border: "1.5px solid var(--fp-primary-border)", fontSize: 14, outline: "none", background: "#fff" }} />
                    <button style={{ height: 48, padding: "0 24px", borderRadius: 10, background: "var(--brand-500)", color: "#000", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>신청하기</button>
                  </div>
                  <p style={{ marginTop: 12, fontSize: 12, color: "#9CA3AF" }}>스팸 없음. 언제든 수신 취소 가능.</p>
                </div>

                {/* Before / After Comparison */}
                <div className="ds-subsection" style={{ marginTop: 32 }}>Before / After Comparison</div>
                <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden", marginBottom: 32 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    <div style={{ padding: 32, borderRight: "1px solid #E5E7EB", background: "var(--fp-error-bg)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fp-error-text)" }}>✗ 수동 작업 (Before)</span>
                      </div>
                      {["디자이너 의뢰 후 3~5일 대기", "채널마다 따로 편집·재업로드", "톤앤매너 불일치로 수정 반복", "월 평균 콘텐츠 제작비 80만원+"].map(t => (
                        <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                          <XCircle size={14} color="var(--fp-error)" />
                          <span style={{ fontSize: 14, color: "#374151" }}>{t}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: 32, background: "var(--fp-success-bg)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fp-success-text)" }}>✓ FlowPack (After)</span>
                      </div>
                      {["주제 입력 → 3분 내 초안 완성", "6개 채널 포맷 자동 변환", "브랜드 톤 학습으로 즉시 사용", "월 29,000원으로 무제한 생성"].map(t => (
                        <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                          <CheckCircle2 size={14} color="var(--fp-success)" />
                          <span style={{ fontSize: 14, color: "#374151" }}>{t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ── Data Display ───────────────────────── */}
          {active === "Data Display" && (
            <div>
              <div className="ds-section">
                <h2 className="ds-section-title">Data Display</h2>
                <p className="ds-section-desc">수치·진행율·타임라인 시각화 컴포넌트.</p>

                {/* Progress Bar */}
                <div className="ds-subsection">Progress Bar</div>
                <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 24, marginBottom: 24 }}>
                  {[
                    { label: "카드뉴스 생성", value: 80, color: "var(--brand-500)" },
                    { label: "블로그 포스팅", value: 55, color: "var(--brand-500)" },
                    { label: "SNS 캡션", value: 92, color: "#059669" },
                    { label: "이메일 뉴스레터", value: 30, color: "#D97706" },
                  ].map(p => (
                    <div key={p.label} style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{p.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: p.color }}>{p.value}%</span>
                      </div>
                      <div style={{ height: 8, background: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${p.value}%`, background: p.color, borderRadius: 4, transition: "width 0.6s ease" }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Timeline */}
                <div className="ds-subsection">Timeline</div>
                <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 24 }}>
                  {[
                    { date: "2026.04", title: "AI 카드뉴스 v2 출시", desc: "멀티레이아웃 템플릿 50종 추가", current: true },
                    { date: "2026.02", title: "YouTube 썸네일 지원", desc: "영상 콘텐츠 썸네일 자동 생성 기능 추가", current: false },
                    { date: "2026.01", title: "플랫폼 베타 런칭", desc: "초기 200명 베타 사용자와 함께 시작", current: false },
                  ].map((item, i) => (
                    <div key={item.date} style={{ display: "flex", gap: 16, paddingBottom: i < 2 ? 24 : 0 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: item.current ? "var(--brand-500)" : "#C7D2FE", border: `3px solid ${item.current ? "#EEF2FF" : "#F3F4F6"}`, flexShrink: 0, marginTop: 2 }} />
                        {i < 2 && <div style={{ width: 2, flex: 1, background: "#E5E7EB", marginTop: 4 }} />}
                      </div>
                      <div style={{ paddingBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "#9CA3AF", display: "block", marginBottom: 2 }}>{item.date}</span>
                        <p style={{ fontSize: 14, fontWeight: 700, color: item.current ? "#111827" : "#374151", marginBottom: 2 }}>{item.title}</p>
                        <p style={{ fontSize: 13, color: "#6B7280" }}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Animated Counter */}
                <div className="ds-subsection" style={{ marginTop: 32 }}>Animated Counter</div>
                <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 32 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24, textAlign: "center" }}>
                    {[
                      { num: "12,400+", label: "생성 콘텐츠", color: "var(--brand-500)" },
                      { num: "98%", label: "고객 만족도", color: "var(--brand-500)" },
                      { num: "3,200+", label: "활성 사용자", color: "#059669" },
                      { num: "68%", label: "시간 절약", color: "#D97706" },
                    ].map(c => (
                      <div key={c.label}>
                        <div style={{ fontSize: 40, fontWeight: 800, color: c.color, lineHeight: 1, letterSpacing: "-0.02em" }}>{c.num}</div>
                        <div style={{ fontSize: 14, color: "#6B7280", marginTop: 6, fontWeight: 500 }}>{c.label}</div>
                      </div>
                    ))}
                  </div>
                  <p style={{ marginTop: 20, fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>실제 구현: <code>useEffect + requestAnimationFrame</code>으로 스크롤 진입 시 카운트업</p>
                </div>

                {/* Donut Chart */}
                <div className="ds-subsection" style={{ marginTop: 32 }}>Donut Chart (채널별 사용 비율)</div>
                <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 32, display: "flex", alignItems: "center", gap: 48, flexWrap: "wrap" }}>
                  {/* SVG Donut */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <svg width={160} height={160} viewBox="0 0 160 160">
                      {/* 배경 원 */}
                      <circle cx={80} cy={80} r={60} fill="none" stroke="#F3F4F6" strokeWidth={24} />
                      {/* 카드뉴스 38% */}
                      <circle cx={80} cy={80} r={60} fill="none" stroke="var(--brand-500)" strokeWidth={24}
                        strokeDasharray={`${2 * Math.PI * 60 * 0.38} ${2 * Math.PI * 60 * 0.62}`}
                        strokeDashoffset={2 * Math.PI * 60 * 0.25}
                        strokeLinecap="round" />
                      {/* 블로그 25% */}
                      <circle cx={80} cy={80} r={60} fill="none" stroke="var(--brand-500)" strokeWidth={24}
                        strokeDasharray={`${2 * Math.PI * 60 * 0.25} ${2 * Math.PI * 60 * 0.75}`}
                        strokeDashoffset={2 * Math.PI * 60 * (0.25 - 0.38)}
                        strokeLinecap="round" />
                      {/* SNS 22% */}
                      <circle cx={80} cy={80} r={60} fill="none" stroke="#059669" strokeWidth={24}
                        strokeDasharray={`${2 * Math.PI * 60 * 0.22} ${2 * Math.PI * 60 * 0.78}`}
                        strokeDashoffset={2 * Math.PI * 60 * (0.25 - 0.38 - 0.25)}
                        strokeLinecap="round" />
                      {/* 이메일 15% */}
                      <circle cx={80} cy={80} r={60} fill="none" stroke="#D97706" strokeWidth={24}
                        strokeDasharray={`${2 * Math.PI * 60 * 0.15} ${2 * Math.PI * 60 * 0.85}`}
                        strokeDashoffset={2 * Math.PI * 60 * (0.25 - 0.38 - 0.25 - 0.22)}
                        strokeLinecap="round" />
                      <text x={80} y={75} textAnchor="middle" fontSize={20} fontWeight={800} fill="#111827">85%</text>
                      <text x={80} y={93} textAnchor="middle" fontSize={11} fill="#9CA3AF">달성률</text>
                    </svg>
                  </div>
                  {/* Legend */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {[
                      { label: "카드뉴스", pct: 38, color: "var(--brand-500)" },
                      { label: "블로그", pct: 25, color: "var(--brand-500)" },
                      { label: "SNS 캡션", pct: 22, color: "#059669" },
                      { label: "이메일", pct: 15, color: "#D97706" },
                    ].map(d => (
                      <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 14, color: "#374151", minWidth: 72 }}>{d.label}</span>
                        <div style={{ flex: 1, height: 6, background: "#F3F4F6", borderRadius: 3, overflow: "hidden", minWidth: 120 }}>
                          <div style={{ height: "100%", width: `${d.pct / 40 * 100}%`, background: d.color, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: d.color, minWidth: 36, textAlign: "right" }}>{d.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}


          {/* ── Media Cards ────────────────────────── */}
          {active === "Media Cards" && (
            <div>
              <div className="ds-section">
                <h2 className="ds-section-title">Media Cards</h2>
                <p className="ds-section-desc">뉴스·미디어·Empty State·Skeleton 카드 패턴.</p>

                {/* News Card Grid */}
                <div className="ds-subsection">News / Media Card</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 32 }}>
                  {[
                    { tag: "업데이트", date: "2026.04.08", title: "FlowPack v2, AI 영상 캡션 생성 지원", desc: "이제 유튜브 영상 링크만 넣으면 자동으로 SNS 캡션이 생성됩니다.", color: "var(--brand-500)" },
                    { tag: "가이드", date: "2026.04.01", title: "카드뉴스 10배 빠르게 만드는 법", desc: "FlowPack AI를 활용한 콘텐츠 제작 워크플로우를 소개합니다.", color: "#059669" },
                    { tag: "케이스", date: "2026.03.20", title: "스타트업 A사, 콘텐츠 비용 60% 절감", desc: "FlowPack 도입 후 마케팅 팀 생산성이 어떻게 달라졌는지 살펴봅니다.", color: "#D97706" },
                  ].map(n => (
                    <div key={n.title} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden", cursor: "pointer", transition: "box-shadow 0.2s" }}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)")}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
                      <div style={{ height: 140, background: `linear-gradient(135deg,${n.color}20,${n.color}40)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Newspaper size={40} color={n.color} />
                      </div>
                      <div style={{ padding: 20 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: n.color, background: `${n.color}15`, padding: "2px 8px", borderRadius: 9999 }}>{n.tag}</span>
                          <span style={{ fontSize: 12, color: "#9CA3AF" }}>{n.date}</span>
                        </div>
                        <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 6, lineHeight: 1.4 }}>{n.title}</p>
                        <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>{n.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Empty State */}
                <div className="ds-subsection">Empty State</div>
                <div style={{ background: "#fff", border: "2px dashed #E5E7EB", borderRadius: 16, padding: "60px 40px", textAlign: "center", marginBottom: 24 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--fp-primary-subtle)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <FileText size={28} color="var(--brand-500)" />
                  </div>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 8 }}>아직 콘텐츠가 없어요</p>
                  <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 24 }}>첫 번째 콘텐츠를 만들어보세요. 주제만 입력하면 AI가 완성합니다.</p>
                  <button style={{ padding: "12px 24px", borderRadius: 10, background: "var(--brand-500)", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Plus size={16} /> 첫 콘텐츠 만들기
                  </button>
                </div>

                {/* Skeleton Loading */}
                <div className="ds-subsection">Skeleton Loading</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden" }}>
                      <div style={{ height: 140, background: "linear-gradient(90deg,#F3F4F6 25%,#E5E7EB 50%,#F3F4F6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
                      <div style={{ padding: 20 }}>
                        <div style={{ height: 12, borderRadius: 6, background: "#F3F4F6", width: "40%", marginBottom: 10 }} />
                        <div style={{ height: 16, borderRadius: 6, background: "#F3F4F6", width: "90%", marginBottom: 8 }} />
                        <div style={{ height: 16, borderRadius: 6, background: "#F3F4F6", width: "70%", marginBottom: 12 }} />
                        <div style={{ height: 12, borderRadius: 6, background: "#F3F4F6", width: "55%" }} />
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
