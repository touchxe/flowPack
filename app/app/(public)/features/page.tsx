"use client";

import Link from "next/link";
import { Layers, FileText, Share2, BarChart3, Calendar, Sparkles, Check, ArrowRight, Zap, Image, MessageCircle, Clock } from "lucide-react";
import { useState } from "react";

const features = [
  {
    icon: <Layers size={28} />, title: "카드뉴스 생성",
    desc: "레퍼런스 디자인 학습으로 프로 수준의 카드뉴스를 5분 만에 생성합니다. 슬라이드 구성부터 디자인까지 AI가 자동으로 처리합니다.",
    tag: "5분 제작", iconColor: "var(--brand-500)", iconBg: "#EEF2FF",
    details: ["50+ 레이아웃 템플릿", "자동 폰트·색상 매칭", "브랜드 가이드 학습", "PNG/PDF 내보내기"],
  },
  {
    icon: <FileText size={28} />, title: "블로그 / 장문",
    desc: "SEO 최적화된 2000자+ 블로그 포스트를 자동 생성합니다. 키워드, 목차, 소제목까지 완벽하게 구성됩니다.",
    tag: "2000자+ 장문", iconColor: "#059669", iconBg: "#ECFDF5",
    details: ["SEO 메타태그 자동 설정", "목차 + 소제목 구조", "내부 링크 추천", "네이버·WordPress 직배포"],
  },
  {
    icon: <MessageCircle size={28} />, title: "SNS 캡션",
    desc: "Threads, Instagram, X, LinkedIn에 최적화된 캡션과 해시태그를 채널별로 자동 생성합니다.",
    tag: "채널별 최적화", iconColor: "#D97706", iconBg: "#FFFBEB",
    details: ["플랫폼별 길이 최적화", "해시태그 자동 생성", "이모지·CTA 포함", "A/B 변형 제공"],
  },
  {
    icon: <Share2 size={28} />, title: "멀티채널 배포",
    desc: "Instagram, Facebook, Twitter, LinkedIn, 네이버 블로그 등 6개 채널에 원클릭으로 동시 배포합니다.",
    tag: "원클릭 배포", iconColor: "var(--fp-cyan)", iconBg: "#F5F3FF",
    details: ["6개 채널 동시 발행", "채널별 포맷 자동 변환", "예약 발행 지원", "발행 이력 추적"],
  },
  {
    icon: <Sparkles size={28} />, title: "AI 페르소나",
    desc: "당신의 브랜드 스타일을 학습하여 95% 이상의 일치도로 콘텐츠를 생성합니다. 수정 없이 바로 사용 가능한 수준입니다.",
    tag: "95% 일치도", iconColor: "var(--brand-500)", iconBg: "#EEF2FF",
    details: ["브랜드 톤·보이스 학습", "이전 콘텐츠 분석", "작성자 스타일 모사", "지속 학습 개선"],
  },
  {
    icon: <Calendar size={28} />, title: "예약 발행",
    desc: "AI가 추천하는 최적 발행 시간에 자동으로 콘텐츠를 배포합니다. 일주일치를 한 번에 예약할 수 있습니다.",
    tag: "AI 시간 추천", iconColor: "#059669", iconBg: "#ECFDF5",
    details: ["AI 최적 시간 분석", "반복 발행 설정", "캘린더 뷰 제공", "알림 기능"],
  },
  {
    icon: <BarChart3 size={28} />, title: "성과 분석",
    desc: "채널별 조회수, 좋아요, 공유 수를 한 대시보드에서 확인하세요. AI가 성과 패턴을 분석해 다음 콘텐츠를 추천합니다.",
    tag: "실시간 분석", iconColor: "#D97706", iconBg: "#FFFBEB",
    details: ["통합 성과 대시보드", "채널별 비교 분석", "최고 성과 콘텐츠 식별", "다음 콘텐츠 AI 추천"],
  },
  {
    icon: <Image size={28} />, title: "AI 이미지 생성",
    desc: "텍스트 설명만으로 콘텐츠에 어울리는 이미지를 자동 생성합니다. 저작권 걱정 없이 사용할 수 있습니다.",
    tag: "저작권 FREE", iconColor: "var(--fp-cyan)", iconBg: "#F5F3FF",
    details: ["자연어로 이미지 생성", "브랜드 스타일 적용", "다양한 해상도 지원", "상업적 사용 가능"],
  },
  {
    icon: <Clock size={28} />, title: "대량 생성",
    desc: "URL이나 문서를 입력하면 여러 채널용 콘텐츠를 한꺼번에 생성합니다. 한 번의 작업으로 일주일치를 준비하세요.",
    tag: "일주일치 한번에", iconColor: "var(--brand-500)", iconBg: "#EEF2FF",
    details: ["URL→콘텐츠 변환", "문서 기반 생성", "배치 처리 지원", "템플릿 자동 선택"],
  },
];

const comparisons = [
  { label: "카드뉴스 제작 시간", before: "2~3시간", after: "5분" },
  { label: "블로그 작성 시간", before: "4~6시간", after: "10분" },
  { label: "SNS 채널 관리", before: "채널별 개별 작업", after: "원클릭 동시 배포" },
  { label: "브랜드 일관성", before: "매번 가이드 확인", after: "AI가 자동 유지" },
  { label: "월 콘텐츠 제작 비용", before: "50만원 이상", after: "29,000원" },
];

export default function FeaturesPage() {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div style={{ minHeight: "100vh", background: "var(--fp-page-bg)" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family: 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
        .fp-grad-text { background: var(--brand-gradient); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .fp-btn-primary { background: var(--brand-gradient); color:#000; border-radius:10px; font-weight:600; transition:all 0.25s; box-shadow:var(--fp-shadow-glow); }
        .fp-btn-primary:hover { transform:translateY(-1px); opacity:0.9; }
        .fp-btn-outline { background:var(--fp-card-bg); color:var(--fp-body); border:1.5px solid var(--fp-border); border-radius:10px; font-weight:500; transition:all 0.25s; }
        .fp-btn-outline:hover { border-color:var(--brand-500); color:var(--brand-500); background:var(--fp-primary-subtle); }
        .feat-card { background:var(--fp-card-bg); border:1px solid var(--fp-border); border-radius:20px; padding:28px; transition:all 0.25s; cursor:default; }
        .feat-card:hover { transform:translateY(-4px); box-shadow:var(--fp-shadow-hover); border-color:var(--fp-border-strong); }
        .comp-row { display:grid; grid-template-columns:2fr 1fr 1fr; gap:16px; padding:14px 24px; border-bottom:1px solid var(--fp-border-soft); }
        .comp-row:nth-child(odd) { background:var(--fp-section-bg); }
        .comp-row:nth-child(even) { background:var(--fp-card-bg); }
        .step-connector { position:absolute; top:32px; left:65%; width:70%; height:2px; background:linear-gradient(90deg,var(--fp-border),var(--fp-border-strong)); }
      `}</style>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section style={{ padding: "80px 24px 96px", background: "#fff", position: "relative", overflow: "hidden", textAlign: "center" }}>
        <div style={{ position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)", width: 800, height: 600, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(99,102,241,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div className="mx-auto max-w-4xl" style={{ position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 9999, background: "#EEF2FF", border: "1px solid #C7D2FE", fontSize: 13, fontWeight: 600, color: "var(--brand-500)", marginBottom: 24 }}>
            <Sparkles size={14} /> 모든 기능 한눈에 보기
          </div>
          <h1 style={{ fontSize: "clamp(32px,5vw,52px)", fontWeight: 800, lineHeight: 1.12, letterSpacing: "-0.02em", color: "var(--heading)", marginBottom: 20 }}>
            어떤 콘텐츠든,
            <br /><span className="fp-grad-text">AI가 만들어드립니다</span>
          </h1>
          <p style={{ fontSize: 18, color: "var(--fp-secondary)", lineHeight: 1.6, maxWidth: 560, margin: "0 auto 40px" }}>
            텍스트·카드뉴스·블로그·이미지까지, 하나의 주제로 모든 포맷을 한 번에 생성하고 배포하세요.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/register" className="fp-btn-primary inline-flex items-center gap-2" style={{ height: 52, padding: "0 32px", fontSize: 16 }}>
              무료로 시작하기 <ArrowRight size={16} />
            </Link>
            <Link href="/pricing" className="fp-btn-outline inline-flex items-center gap-2" style={{ height: 52, padding: "0 32px", fontSize: 16 }}>
              요금제 보기
            </Link>
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: "var(--fp-muted)" }}>신용카드 없이 · 매월 10크레딧 무료 제공</p>
        </div>
      </section>

      {/* ── 기능 그리드 ──────────────────────────────────── */}
      <section style={{ padding: "80px 24px", background: "#F7F8FA" }}>
        <div className="mx-auto max-w-6xl">
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-500)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>FEATURES</div>
            <h2 style={{ fontSize: "clamp(24px,4vw,36px)", fontWeight: 700, color: "var(--heading)", marginBottom: 14 }}>9가지 핵심 기능</h2>
            <p style={{ fontSize: 16, color: "var(--fp-secondary)", maxWidth: 480, margin: "0 auto" }}>
              FlowPack 하나로 콘텐츠 제작, 배포, 분석 전 과정을 자동화하세요.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }} className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <div key={f.title} className="feat-card"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: f.iconBg, color: f.iconColor, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--heading)", marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6, marginBottom: 16 }}>{f.desc}</p>
                {hoveredIdx === i ? (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    {f.details.map(d => (
                      <li key={d} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--fp-body)" }}>
                        <Check size={13} color={f.iconColor} style={{ flexShrink: 0 }} /> {d}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 9999, background: f.iconBg, color: f.iconColor, fontSize: 12, fontWeight: 700 }}>
                    <Check size={12} /> {f.tag}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Before/After 비교표 ──────────────────────────── */}
      <section style={{ padding: "80px 24px", background: "#fff" }}>
        <div className="mx-auto max-w-3xl">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-500)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>COMPARISON</div>
            <h2 style={{ fontSize: "clamp(24px,3.5vw,32px)", fontWeight: 700, color: "var(--heading)", marginBottom: 12 }}>FlowPack 도입 전 vs 후</h2>
            <p style={{ fontSize: 16, color: "#6B7280" }}>직접 만들 때와 비교해보세요.</p>
          </div>
          <div style={{ background: "var(--fp-card-bg)", borderRadius: 20, border: "1px solid var(--fp-border)", overflow: "hidden", boxShadow: "var(--fp-shadow-card)" }}>
            <div className="comp-row" style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fp-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>항목</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fp-muted)", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>이전 방식</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-500)", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>FlowPack</span>
            </div>
            {comparisons.map((c, i) => (
              <div key={i} className="comp-row">
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--heading)" }}>{c.label}</span>
                <span style={{ fontSize: 13, color: "var(--fp-muted)", textAlign: "center" }}>{c.before}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--brand-500)", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <Check size={13} /> {c.after}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 도구 통합 비교 ──────────────────────────────── */}
      <section style={{ padding: "80px 24px", background: "#F7F8FA" }}>
        <div className="mx-auto max-w-3xl">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-500)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>TOOL CONSOLIDATION</div>
            <h2 style={{ fontSize: "clamp(24px,3.5vw,32px)", fontWeight: 700, color: "var(--heading)", marginBottom: 12 }}>
              아직도 3개 도구 따로 쓰고 계세요?
            </h2>
            <p style={{ fontSize: 16, color: "var(--fp-secondary)" }}>ChatGPT + Canva + 스케줄러 → FlowPack 하나면 전부 됩니다.</p>
          </div>

          {/* 도구 3개 → 1개 시각화 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 48, flexWrap: "wrap" }}>
            {[
              { name: "ChatGPT", desc: "글 작성", color: "#10A37F", bg: "#F0FDF9" },
              { name: "Canva", desc: "카드뉴스 디자인", color: "var(--fp-cyan)", bg: "#F5F3FF" },
              { name: "스케줄러", desc: "SNS 예약", color: "#F59E0B", bg: "#FFFBEB" },
            ].map((tool, i) => (
              <div key={tool.name} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ textAlign: "center", padding: "16px 20px", borderRadius: 14, background: tool.bg, border: `1.5px solid ${tool.color}33`, minWidth: 100 }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{i === 0 ? "💬" : i === 1 ? "🎨" : "📅"}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: tool.color }}>{tool.name}</div>
                  <div style={{ fontSize: 11, color: "var(--fp-muted)", marginTop: 2 }}>{tool.desc}</div>
                </div>
                {i < 2 && <div style={{ fontSize: 18, color: "var(--fp-border-strong)", fontWeight: 300 }}>+</div>}
              </div>
            ))}
            <div style={{ fontSize: 20, color: "var(--brand-500)", fontWeight: 700, margin: "0 8px" }}>→</div>
            <div style={{ textAlign: "center", padding: "16px 28px", borderRadius: 14, background: "var(--fp-primary-subtle)", border: "2px solid var(--brand-500)", minWidth: 120, boxShadow: "var(--fp-shadow-glow)" }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>⚡</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--brand-500)" }}>FlowPack</div>
              <div style={{ fontSize: 11, color: "var(--fp-cyan)", marginTop: 2, fontWeight: 600 }}>ALL IN ONE</div>
            </div>
          </div>

          {/* 상세 비교표 */}
          <div style={{ background: "#fff", borderRadius: 20, overflow: "hidden", border: "1px solid #E5E7EB", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16, padding: "14px 24px", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fp-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>기능</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fp-muted)", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>기존 3개 도구</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-500)", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>FlowPack</span>
            </div>
            {[
              { label: "글·기획 작성", before: "ChatGPT 별도 접속", after: "내장 AI 생성" },
              { label: "카드뉴스 디자인", before: "Canva 별도 작업", after: "자동 디자인" },
              { label: "SNS 예약 발행", before: "스케줄러 앱 연동", after: "원클릭 예약" },
              { label: "브랜드 학습", before: "매번 프롬프트 입력", after: "AI 자동 학습·유지" },
              { label: "채널별 최적화", before: "수동 변환 필요", after: "자동 포맷 변환" },
              { label: "월 사용 비용", before: "3개 구독 합산", after: "FlowPack 1개" },
            ].map((item, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16, padding: "14px 24px", borderBottom: "1px solid #F3F4F6", background: i % 2 === 0 ? "#F9FAFB" : "#fff" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--heading)" }}>{item.label}</span>
                <span style={{ fontSize: 13, color: "var(--fp-muted)", textAlign: "center" }}>{item.before}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--brand-500)", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <Check size={13} /> {item.after}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3단계 워크플로 ────────────────────────────────── */}
      <section style={{ padding: "80px 24px", background: "#F7F8FA" }}>
        <div className="mx-auto max-w-6xl">
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-500)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>HOW IT WORKS</div>
            <h2 style={{ fontSize: "clamp(24px,4vw,36px)", fontWeight: 700, color: "var(--heading)" }}>3단계로 끝납니다</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 32, position: "relative" }}>
            {[
              { n: "01", title: "주제 입력", desc: "만들고 싶은 콘텐츠의 주제와 톤을 선택합니다. 키워드 하나면 충분해요.", color: "var(--brand-500)", shadow: "rgba(99,102,241,0.3)" },
              { n: "02", title: "AI 생성", desc: "AI가 콘텐츠를 자동 생성합니다. 마음에 들지 않으면 재생성.", color: "var(--fp-cyan)", shadow: "rgba(139,92,246,0.3)" },
              { n: "03", title: "배포 완료", desc: "원하는 채널 선택 후 원클릭 배포 또는 예약 발행.", color: "#059669", shadow: "rgba(5,150,105,0.3)" },
            ].map((s, i) => (
              <div key={s.n} style={{ textAlign: "center", position: "relative" }}>
                {i < 2 && <div className="step-connector hidden md:block" />}
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: s.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, margin: "0 auto 20px", boxShadow: `0 8px 20px ${s.shadow}` }}>{s.n}</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--heading)", marginBottom: 8 }}>{s.title}</h3>
                  <p style={{ fontSize: 14, color: "var(--fp-secondary)", lineHeight: 1.5 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section style={{ padding: "80px 24px" }}>
        <div className="mx-auto max-w-4xl">
          <div style={{ borderRadius: 24, padding: "clamp(40px,5vw,72px)", textAlign: "center", background: "var(--brand-gradient)", position: "relative", overflow: "hidden", boxShadow: "var(--fp-shadow-hover)" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(255,255,255,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "relative" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 16px", borderRadius: 9999, background: "rgba(255,255,255,0.2)", fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 24 }}>
                <Zap size={14} /> 오늘 바로 무료 체험
              </div>
              <h2 style={{ fontSize: "clamp(24px,4vw,36px)", fontWeight: 800, color: "#fff", marginBottom: 16 }}>
                지금 바로 시작하세요
              </h2>
              <p style={{ fontSize: 16, color: "rgba(255,255,255,0.75)", maxWidth: 480, margin: "0 auto 32px" }}>
                매월 10크레딧 무료 제공. 신용카드 없이 1분 만에 시작할 수 있어요.
              </p>
              <Link href="/register" style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 52, padding: "0 36px", borderRadius: 12, background: "#fff", color: "var(--brand-500)", fontSize: 16, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 14px rgba(0,0,0,0.1)" }}>
                무료 시작하기 <ArrowRight size={16} />
              </Link>
              <p style={{ marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.45)" }}>신용카드 없이 · 언제든 취소 가능</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
