"use client";

import Link from "next/link";
import {
  Zap, ArrowRight, Layers, FileText, Share2, Sparkles,
  Check, Clock, TrendingUp, MessageCircle, Star, Mail,
  CheckCircle2, BarChart2, Image
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

/* ─── 데이터 ─────────────────────────────────────────────── */
const problems = [
  { icon: <Clock className="h-6 w-6" />, title: "기획의 고통", desc: "좋은 정보는 머릿속에 있는데,\n이걸 어떻게 콘텐츠로 풀지?" },
  { icon: <Layers className="h-6 w-6" />, title: "제작 시간 부족", desc: "카드뉴스, 블로그, 영상...\n하나만 만들어도 반나절이 간다." },
  { icon: <TrendingUp className="h-6 w-6" />, title: "일관성 실패", desc: "바빠서 며칠 쉬었더니 알고리즘\n끊기고, 다시 시작하기 두렵다." },
  { icon: <MessageCircle className="h-6 w-6" />, title: "반응 없는 콘텐츠", desc: "열심히 만들었는데,\n댓글도 없고 매출도 없다." },
];

const features = [
  { icon: <Layers className="h-7 w-7" />, title: "카드뉴스", desc: "레퍼런스 디자인을 학습해 브랜드 톤에 맞는 카드뉴스를 5분 만에 자동 생성합니다. 반복 작업 없이 무한 제작하세요.", tag: "5분 제작", iconBg: "#EEF2FF", iconColor: "var(--brand-500)" },
  { icon: <FileText className="h-7 w-7" />, title: "텍스트 콘텐츠", desc: "Threads, X, LinkedIn 각 채널의 특성에 최적화된 글을 한 번에 생성합니다. 채널별 길이·해시태그까지 자동 조정됩니다.", tag: "채널별 최적화", iconBg: "#FFFBEB", iconColor: "#D97706" },
  { icon: <FileText className="h-7 w-7" />, title: "블로그", desc: "키워드 분석부터 2,000자 이상의 SEO 최적화 장문 글까지. 전문가 수준의 블로그 포스트를 자동으로 완성합니다.", tag: "2000자+ 장문", iconBg: "#ECFDF5", iconColor: "#059669" },
  { icon: <Share2 className="h-7 w-7" />, title: "멀티채널 배포", desc: "Instagram, Facebook, Twitter 등 6개 채널에 단 한 번의 클릭으로 동시 발행합니다. 예약 배포도 지원합니다.", tag: "한 번의 클릭", iconBg: "#F5F3FF", iconColor: "var(--fp-cyan)" },
];

const stats = [
  { value: "90%", label: "콘텐츠 제작 시간 절감" },
  { value: "5분", label: "카드뉴스 평균 제작" },
  { value: "6+", label: "연동 SNS 채널" },
  { value: "95%", label: "브랜드 스타일 일치도" },
];

const comparisonItems = [
  { label: "매일 2시간 → 5분으로", old: "복붙 반복", fp: "기획부터 관리까지 (5분)" },
  { label: "카드뉴스, 블로그, 숏폼까지", old: "텍스트만", fp: "카드뉴스/블로그/숏폼/텍스트" },
  { label: "브랜드 스타일 학습", old: "매번 프롬프트", fp: "브랜드 언어 완벽 학습" },
  { label: "SNS 멀티채널 배포", old: "따로 복붙", fp: "원클릭 동시 배포" },
];

const testimonials = [
  { name: "김민준", handle: "devoutsource_kim", role: "외주개발 회사 대표", avatar: "김", content: "개발자라 글 쓰는 게 제일 싫었어요. 근데 FlowPack이 제 기술 블로그 톤으로 쓰레드 글을 뽑아주니까, 3개월 만에 팔로워 3천명. 거기서 개발 외주 리드만 10건 넘게 들어왔어요.", likes: 312 },
  { name: "리바이브", handle: "revive_official", role: "여성건기식 브랜드", avatar: "R", content: "솔직히 500명이면 아무것도 못 한다고 생각했거든요. 근데 FlowPack로 타겟에 맞는 콘텐츠를 매일 올리니까 DM 문의가 쏟아졌어요. 팔로워 수는 중요하지 않더라고요.", likes: 189 },
  { name: "박서연", handle: "stylist_seyeon", role: "퍼스널 스타일리스트", avatar: "박", content: "인스타 운영이 너무 힘들었는데 FlowPack으로 캡션이랑 카드뉴스를 동시에 뽑으니까 일주일치 콘텐츠가 1시간 만에 끝나요. 진짜 신세계예요.", likes: 241 },
];

const faqs = [
  { q: "어떤 종류의 콘텐츠를 만들 수 있나요?", a: "카드뉴스, 블로그 아티클, 텍스트 SNS 콘텐츠(Threads, X, LinkedIn 최적화) 등을 지원합니다. 하나의 주제로 여러 포맷의 콘텐츠를 한번에 생성할 수도 있습니다." },
  { q: "어떤 채널을 지원하나요?", a: "현재 Instagram, Facebook, Twitter/X, LinkedIn, 네이버 블로그, WordPress 등을 지원합니다. 더 많은 채널의 지원이 곧 추가될 예정입니다." },
  { q: "크레딧은 어떻게 사용되나요?", a: "카드뉴스, 블로그, 이미지 생성 등 AI 기능을 사용할 때마다 1개 크레딧이 차감됩니다. 월 10개 크레딧은 무료로 제공되며, 더 많은 크레딧이 필요하시면 유료 플랜을 이용해주세요." },
  { q: "구독을 취소할 수 있나요?", a: "네, 언제든지 취소할 수 있습니다. 현재 구독 기간이 끝날 때까지는 기존 플랜을 계속 이용하실 수 있습니다." },
  { q: "생성된 콘텐츠의 소유권은 누구에게 있나요?", a: "생성된 콘텐츠의 소유권은 이용자에게 있습니다. FlowPack은 서비스 제공을 위해서만 콘텐츠를 이용하며, 동의 없이 제3자에게 공유하거나 판매하지 않습니다." },
];

const channels = [
  { name: "Instagram", color: "#E1306C", bg: "#FFF0F5" },
  { name: "YouTube", color: "#FF0000", bg: "#FFF5F5" },
  { name: "Blog", color: "#03C75A", bg: "#F0FFF6" },
  { name: "Facebook", color: "#1877F2", bg: "#EFF6FF" },
  { name: "Twitter/X", color: "#111827", bg: "#F9FAFB" },
  { name: "LinkedIn", color: "#0A66C2", bg: "#EFF6FF" },
];

/* ── SEO·플랫폼 연동 섹션 ───────────────────────────────── */
function IntegrationSection() {
  const groups: { label: string; cols?: number; items: { name: string; desc: string; detail: string; color: string; bg: string }[] }[] = [
    {
      label: "검색 · 발행 연동",
      cols: 2,
      items: [
        { name: "네이버 검색 최적화", desc: "블로그 자동 발행 + 키워드 분석", detail: "네이버 SEO에 최적화된 제목·본문 자동 생성", color: "#03C75A", bg: "#F0FFF6" },
        { name: "Google Search Console", desc: "Sitemap 자동 제출 + 색인 요청", detail: "발행 즉시 Google에 색인 등록", color: "#4285F4", bg: "#EFF6FF" },
        { name: "WordPress", desc: "REST API /wp-json/wp/v2/posts", detail: "Application Password (Basic Auth)로 즉시 발행", color: "#21759B", bg: "#EFF8FF" },
        { name: "네이버 블로그", desc: "클립보드 복사 방식", detail: "HTML 변환 후 붙여넣기 가이드", color: "#03C75A", bg: "#F0FFF6" },
      ],
    },
    {
      label: "SNS 배포",
      items: [
        { name: "Instagram", desc: "Graph API Content Publishing", detail: "비즈니스 계정 필수, 일 25건", color: "#E1306C", bg: "#FFF0F5" },
        { name: "Facebook", desc: "Graph API Pages", detail: "페이지 관리자 권한 필요", color: "#1877F2", bg: "#EFF6FF" },
        { name: "X (Twitter)", desc: "v2 API manage tweets", detail: "월 1,500 트윗 (Free)", color: "#111827", bg: "#F9FAFB" },
        { name: "LinkedIn", desc: "Share on LinkedIn API", detail: "멤버 공유 API", color: "#0A66C2", bg: "#EFF6FF" },
        { name: "Threads", desc: "Instagram 연동", detail: "텍스트 컨텐츠 자동 변환", color: "#111827", bg: "#F9FAFB" },
      ],
    },
  ];

  return (
    <section style={{ padding: "80px 0", background: "#fff", borderBottom: "1px solid var(--fp-border-soft)" }}>
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center" style={{ marginBottom: 56 }}>
          <div className="fp-section-label" style={{ marginBottom: 12 }}>Integrations</div>
          <h2 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 700, color: "var(--fp-heading)", marginBottom: 12 }}>
            만들고, 배포하고, 최적화까지. 원클릭.
          </h2>
          <p style={{ fontSize: 16, color: "var(--fp-secondary)" }}>한번의 글로 멀티채널 동시 배포, SEO 자동 최적화까지.</p>
        </div>

        {/* ── 검색 · 발행 연동 — 대형 일러스트 카드 2×2 ── */}
        <div style={{ marginBottom: 48 }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* 카드 1: 네이버 검색 최적화 */}
            <div style={{ background: "#E8F8EF", borderRadius: 24, padding: "36px 32px", minHeight: 280, display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden", position: "relative" }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#0A3D2B", lineHeight: 1.4, maxWidth: 260, marginBottom: 32 }}>
                네이버 SEO에 최적화된<br />제목·본문 자동 생성
              </p>
              {/* 검색결과 rows 모킹 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {["월간 SEO 리포트 자동 분석", "키워드 순위 실시간 추적", "블로그 색인 자동 제출"].map((t, i) => (
                  <div key={i} style={{ background: "#fff", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#03C75A", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0A3D2B" }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 카드 2: Google Search Console */}
            <div style={{ background: "#E8F0FE", borderRadius: 24, padding: "36px 32px", minHeight: 280, display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden" }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#0D2B6B", lineHeight: 1.4, maxWidth: 260, marginBottom: 32 }}>
                Sitemap 자동 제출 +<br />발행 즉시 Google 색인 등록
              </p>
              {/* 색인 상태 모킹 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "sitemap.xml 제출", status: "완료", color: "#4285F4" },
                  { label: "새 포스트 색인 요청", status: "처리중", color: "#F9AB00" },
                  { label: "크롤링 오류", status: "0건", color: "#34A853" },
                ].map((r, i) => (
                  <div key={i} style={{ background: "#fff", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0D2B6B" }}>{r.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{r.status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 카드 3: WordPress */}
            <div style={{ background: "#E8F3FB", borderRadius: 24, padding: "36px 32px", minHeight: 280, display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden" }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#0B3046", lineHeight: 1.4, maxWidth: 260, marginBottom: 32 }}>
                REST API로<br />WordPress 즉시 발행
              </p>
              {/* 포스트 발행 UI 모킹 */}
              <div style={{ background: "#fff", borderRadius: 14, padding: "16px 20px" }}>
                <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>POST /wp-json/wp/v2/posts</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[{ k: "title", v: "AI 마케팅 트렌드 2026" }, { k: "status", v: "publish" }, { k: "auth", v: "Basic Auth ✓" }].map((row, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, fontSize: 12 }}>
                      <span style={{ color: "#21759B", fontWeight: 700, minWidth: 52 }}>{row.k}</span>
                      <span style={{ color: "#374151" }}>{row.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 카드 4: 네이버 블로그 */}
            <div style={{ background: "#F5F5F7", borderRadius: 24, padding: "36px 32px", minHeight: 280, display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden" }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#1C1C1E", lineHeight: 1.4, maxWidth: 260, marginBottom: 32 }}>
                클립보드 복사로<br />네이버 블로그 바로 붙여넣기
              </p>
              {/* 복사 단계 모킹 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { step: "01", text: "AI가 HTML 형식으로 변환" },
                  { step: "02", text: "클립보드에 자동 복사" },
                  { step: "03", text: "네이버 블로그에 붙여넣기" },
                ].map((s, i) => (
                  <div key={i} style={{ background: "#fff", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "var(--brand-500)", minWidth: 20 }}>{s.step}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{s.text}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}

/* ── SNS 멀티채널 배포 캐러셀 섹션 ────────────────────────── */
function SnsDeploySection() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const platforms = [
    {
      name: "Instagram",
      handle: "@yourbrand",
      color: "#E1306C",
      gradient: "linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)",
      bg: "#FFF0F5",
      textColor: "#5C0A28",
      feature: "비즈니스 계정 · 일 25건 자동 발행",
      details: ["이미지+캡션 자동 세트 생성", "해시태그 자동 추천", "최적 발행 시간 분석"],
      icon: (
        <svg viewBox="0 0 24 24" fill="white" width="24" height="24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      ),
      mockLines: ["주제 하나로 카드뉴스 + 캡션 세트 완성", "#마케팅 #AI #콘텐츠 자동 태그", "❤ 1.2k  💬 48  ↗ 230"],
    },
    {
      name: "Facebook",
      handle: "FlowPack Official",
      color: "#1877F2",
      gradient: "linear-gradient(135deg, #1877F2, #0C5FD6)",
      bg: "#EFF6FF",
      textColor: "#0B2B5C",
      feature: "페이지 관리자 권한 · Graph API",
      details: ["페이지 게시물 자동 발행", "링크 미리보기 자동 생성", "예약 발행 지원"],
      icon: (
        <svg viewBox="0 0 24 24" fill="white" width="24" height="24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
      mockLines: ["블로그 글을 Facebook 포맷으로 자동 변환", "요약 + 링크 미리보기 자동 구성", "👍 342  🔗 공유 87  💬 29"],
    },
    {
      name: "X (Twitter)",
      handle: "@yourbrand_x",
      color: "#111827",
      gradient: "linear-gradient(135deg, #111827, #374151)",
      bg: "#F9FAFB",
      textColor: "#111827",
      feature: "v2 API · 월 1,500 트윗 (Free)",
      details: ["280자 최적화 자동 분할", "스레드 연결 포스팅", "트렌딩 해시태그 연동"],
      icon: (
        <svg viewBox="0 0 24 24" fill="white" width="22" height="22">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
      mockLines: ["긴 글을 280자 트윗으로 자동 요약", "#AI #마케팅 트렌딩 태그 자동 추가", "♻ 리트윗 156  ♡ 1.4k  👁 24.3k"],
    },
    {
      name: "LinkedIn",
      handle: "FlowPack · AI 마케팅",
      color: "#0A66C2",
      gradient: "linear-gradient(135deg, #0A66C2, #0850A0)",
      bg: "#EFF6FF",
      textColor: "#052D57",
      feature: "Share on LinkedIn API · 멤버 공유",
      details: ["전문가 톤 자동 조정", "퍼스널 브랜딩 최적화", "B2B 타겟 콘텐츠 생성"],
      icon: (
        <svg viewBox="0 0 24 24" fill="white" width="24" height="24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      ),
      mockLines: ["인사이트 아티클을 전문가 포스트로 변환", "업계 리더십 콘텐츠 자동 생성", "👍 728  💬 91  ↗ 재공유 145"],
    },
    {
      name: "Threads",
      handle: "@yourbrand",
      color: "#111827",
      gradient: "linear-gradient(135deg, #111827, #1F2937)",
      bg: "#F3F4F6",
      textColor: "#111827",
      feature: "Instagram 계정 연동 · 텍스트 최적화",
      details: ["SNS 텍스트를 Threads 포맷으로 변환", "멀티 스레드 자동 구성", "팔로워 참여 유도 CTA 삽입"],
      icon: (
        <svg viewBox="0 0 24 24" fill="white" width="24" height="24">
          <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.028-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.74-1.774-.438-.527-1.094-.792-2.0-.799h-.027c-.75 0-1.917.257-2.65 1.22l-1.677-1.21c.985-1.37 2.584-2.12 4.326-2.12h.045c2.942.019 4.724 1.818 4.9 4.92.11-.005.219-.013.329-.013.614 0 1.493.116 2.26.587 1.194.732 1.961 1.925 2.381 3.645.602 2.47.231 5.082-1.63 6.908-1.722 1.694-4.003 2.522-6.93 2.544z"/>
        </svg>
      ),
      mockLines: ["짧고 임팩트 있는 텍스트 자동 생성", "대화형 스레드로 팔로워 참여 유도", "♻ 112  ♡ 2.1k  · 팔로워 +38"],
    },
  ];

  const total = platforms.length;

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActiveIdx(i => (i + 1) % total), 4000);
    return () => clearInterval(t);
  }, [paused, total]);

  const prev = () => { setPaused(true); setActiveIdx(i => (i - 1 + total) % total); };
  const next = () => { setPaused(true); setActiveIdx(i => (i + 1) % total); };
  const p = platforms[activeIdx];

  return (
    <section
      style={{ padding: "96px 0", background: "var(--fp-section-bg)", overflow: "hidden", position: "relative" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* 배경 장식 */}
      <div style={{ position: "absolute", top: -200, right: -200, width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(ellipse, ${p.color}18 0%, transparent 70%)`, transition: "background 0.6s", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -200, left: -200, width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(ellipse, ${p.color}10 0%, transparent 70%)`, transition: "background 0.6s", pointerEvents: "none" }} />

      <div className="mx-auto max-w-6xl px-6" style={{ position: "relative" }}>
        {/* 헤더 */}
        <div className="text-center" style={{ marginBottom: 64 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: p.color, marginBottom: 12, transition: "color 0.4s" }}>SNS Distribution</div>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, color: "var(--fp-heading)", marginBottom: 16, lineHeight: 1.15 }}>
            한 번의 클릭으로<br /><span style={{ color: p.color, transition: "color 0.4s" }}>모든 채널</span>에 동시 배포
          </h2>
          <p style={{ fontSize: 16, color: "var(--fp-secondary)" }}>5개 플랫폼 API 연동 · 최적화된 포맷으로 자동 변환 · 예약 발행 지원</p>
        </div>

        {/* 캐러셀 카드 랩퍼 (Coverflow Style) */}
        <div style={{ position: "relative", height: 500, overflow: "visible" }}>
          {platforms.map((pl, i) => {
            // 무한 루프처럼 보이기 위해 offset 조정
            let offset = i - activeIdx;
            if (offset < -2) offset += total;
            if (offset > 2) offset -= total;
            
            const isActive = offset === 0;
            const isVisible = Math.abs(offset) <= 1;

            return (
              <div
                key={pl.name}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: "100%",
                  maxWidth: 820,
                  transform: `translate(-50%, -50%) translateX(${offset * 85}%) scale(${isActive ? 1 : 0.85})`,
                  opacity: isVisible ? (isActive ? 1 : 0.4) : 0,
                  zIndex: isActive ? 10 : (isVisible ? 5 : 0),
                  pointerEvents: isActive ? "auto" : "none",
                  transition: "all 0.6s cubic-bezier(0.25, 0.8, 0.25, 1)",
                  background: "#fff",
                  borderRadius: 28,
                  padding: "clamp(32px, 5vw, 56px)",
                  boxShadow: isActive ? `0 20px 60px ${pl.color}15` : "0 4px 20px rgba(0,0,0,0.05)",
                  border: "none",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }} className="block md:grid">
                  {/* 왼쪽: 플랫폼 정보 */}
                  <div>
                    {/* 아이콘 + 플랫폼명 */}
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
                      <div style={{ width: 56, height: 56, borderRadius: 16, background: pl.gradient, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 8px 24px ${pl.color}40` }}>
                        {pl.icon}
                      </div>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--fp-heading)" }}>{pl.name}</div>
                        <div style={{ fontSize: 13, color: "var(--fp-secondary)" }}>{pl.handle}</div>
                      </div>
                    </div>

                    {/* 기능 뱃지 */}
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${pl.color}18`, borderRadius: 9999, padding: "5px 14px", marginBottom: 24 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: pl.color }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: pl.color }}>{pl.feature}</span>
                    </div>

                    {/* 디테일 리스트 */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
                      {pl.details.map((d, idx) => (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 20, height: 20, borderRadius: 6, background: `${pl.color}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke={pl.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                          <span style={{ fontSize: 14, color: "var(--fp-secondary)" }}>{d}</span>
                        </div>
                      ))}
                    </div>

                    {/* 슬라이드 번호 */}
                    <div style={{ fontSize: 12, color: "var(--fp-secondary)" }}>
                      <span style={{ color: pl.color, fontWeight: 700 }}>{String(i + 1).padStart(2, "0")}</span>
                      <span> / {String(total).padStart(2, "0")}</span>
                    </div>
                  </div>

                  {/* 오른쪽: 폰 목업 */}
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <div style={{
                      width: 260, background: "#fff",
                      borderRadius: 28, padding: "16px",
                      border: "6px solid #F1F5F9",
                      boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
                      position: "relative",
                    }}>
                      {/* 상단바 */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 4px" }}>
                        <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>9:41</span>
                        <div style={{ display: "flex", gap: 4 }}>
                          {[3,3,3].map((_, j) => <div key={j} style={{ width: 3, height: 8 - j * 2, background: "#94A3B8", borderRadius: 1 }} />)}
                        </div>
                      </div>
                      {/* 앱 헤더 */}
                      <div style={{ background: pl.gradient, borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <div style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>{pl.icon}</div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{pl.name}</span>
                      </div>
                      {/* 포스트 카드 */}
                      <div style={{ background: "#F8FAFC", borderRadius: 12, padding: 12, border: "1px solid var(--fp-border-soft)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: pl.gradient, flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--fp-heading)" }}>FlowPack</div>
                            <div style={{ fontSize: 9, color: "var(--fp-secondary)" }}>방금</div>
                          </div>
                          <div style={{ marginLeft: "auto", background: pl.color, borderRadius: 6, padding: "3px 8px" }}>
                            <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>발행됨</span>
                          </div>
                        </div>
                        {pl.mockLines.map((line, j) => (
                          <div key={j} style={{ fontSize: j === 2 ? 9 : 10, color: j === 2 ? "var(--fp-secondary)" : "var(--fp-heading)", marginBottom: 4, lineHeight: 1.4 }}>{line}</div>
                        ))}
                        {/* 이미지 플레이스홀더 */}
                        <div style={{ background: `${pl.color}20`, borderRadius: 8, height: 60, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="4" stroke={pl.color} strokeWidth="1.5"/><circle cx="8.5" cy="8.5" r="2.5" fill={pl.color} opacity="0.6"/><path d="M3 15l5-4 4 3 3-2 6 5" stroke={pl.color} strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Prev / Next 화살표 */}
          <button onClick={prev} style={{ position: "absolute", left: 0, top: "50%", transform: "translate(-50%, -50%)", width: 44, height: 44, borderRadius: "50%", background: "#fff", border: `1px solid var(--fp-border-soft)`, color: "var(--fp-heading)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s", zIndex: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
          <button onClick={next} style={{ position: "absolute", right: 0, top: "50%", transform: "translate(50%, -50%)", width: 44, height: 44, borderRadius: "50%", background: "#fff", border: `1px solid var(--fp-border-soft)`, color: "var(--fp-heading)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s", zIndex: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* 점 인디케이터 (Dot Navigation) */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 32 }}>
          {platforms.map((pl, i) => (
            <button
              key={i}
              onClick={() => { setPaused(true); setActiveIdx(i); }}
              style={{ width: i === activeIdx ? 28 : 8, height: 8, borderRadius: 9999, background: i === activeIdx ? p.color : "#E2E8F0", border: "none", cursor: "pointer", transition: "all 0.3s", padding: 0 }}
            />
          ))}
        </div>
      </div>

      {/* ── 로고 마퀴 + 카운터 ─────────────────────────── */}
      <SnsLogoMarquee />
    </section>
  );
}

/* ── 로고 마퀴 + 카운터 서브컴포넌트 ─────────────────────── */
function AnimatedCounter({ target, suffix, prefix = "" }: { target: number; suffix: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      let start = 0;
      const duration = 1800;
      const step = target / (duration / 16);
      const timer = setInterval(() => {
        start += step;
        if (start >= target) { setCount(target); clearInterval(timer); }
        else setCount(Math.floor(start));
      }, 16);
    }, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);
  return <div ref={ref}>{prefix}{count.toLocaleString()}{suffix}</div>;
}

function SnsLogoMarquee() {
  const row1 = [
    { name: "BREW & CO.", sub: "COFFEE ROASTERS", color: "#5D3A1A", mark: "circle" },
    { name: "맛나", sub: "한 식 당", color: "#C0392B", mark: "square" },
    { name: "GLAM", sub: "STUDIO", color: "#7D3C98", mark: "diamond" },
    { name: "BON PAIN", sub: "Boulangerie", color: "#9A7D0A", mark: "circle" },
    { name: "FitPro", sub: "GYM & WELLNESS", color: "#1A5276", mark: "square" },
    { name: "MODA", sub: "", color: "#922B21", mark: "dot" },
    { name: "FLORÉ", sub: "Flower Studio", color: "#1D6A39", mark: "circle" },
    { name: "PetCare", sub: "ANIMAL HOSPITAL", color: "#B7770D", mark: "plus" },
  ];
  const row2 = [
    { name: "PIZZA NOVA", sub: "", color: "#CA6F1E", mark: "square" },
    { name: "건강약국", sub: "HEALTH RX", color: "#117A65", mark: "cross" },
    { name: "24시마트", sub: "MART", color: "#1A5276", mark: "circle" },
    { name: "NAILORY", sub: "Nail & Beauty", color: "#943126", mark: "diamond" },
    { name: "토끼분식", sub: "", color: "#D35400", mark: "dot" },
    { name: "WINGS", sub: "CHICKEN", color: "#9A6800", mark: "circle" },
    { name: "CleanPro", sub: "LAUNDRY", color: "#4D5D6E", mark: "square" },
    { name: "마이홈", sub: "INTERIOR", color: "#6E2F1A", mark: "diamond" },
  ];

  // 로고마크 SVG 컴포넌트
  const Mark = ({ type, color }: { type: string; color: string }) => {
    const s = 10;
    if (type === "circle") return <svg width={s} height={s}><circle cx={s/2} cy={s/2} r={s/2} fill={color}/></svg>;
    if (type === "square") return <svg width={s} height={s}><rect width={s} height={s} rx={2} fill={color}/></svg>;
    if (type === "diamond") return <svg width={s} height={s}><polygon points={`${s/2},0 ${s},${s/2} ${s/2},${s} 0,${s/2}`} fill={color}/></svg>;
    if (type === "dot") return <svg width={6} height={6}><circle cx={3} cy={3} r={3} fill={color}/></svg>;
    if (type === "cross") return <svg width={s} height={s}><rect x={4} y={0} width={2} height={s} rx={1} fill={color}/><rect x={0} y={4} width={s} height={2} rx={1} fill={color}/></svg>;
    if (type === "plus") return <svg width={s} height={s}><rect x={4} y={0} width={2} height={s} fill={color}/><rect x={0} y={4} width={s} height={2} fill={color}/></svg>;
    return null;
  };

  const LogoItem = ({ name, sub, color, mark }: { name: string; sub: string; color: string; mark: string }) => (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      padding: "0 40px", flexShrink: 0,
      borderRight: "1px solid #E5E7EB",
    }}>
      <Mark type={mark} color={color} />
      <div>
        <div style={{
          fontSize: 15, fontWeight: 800, color,
          letterSpacing: "0.04em", lineHeight: 1.1,
          whiteSpace: "nowrap",
        }}>{name}</div>
        {sub && <div style={{ fontSize: 8, fontWeight: 500, color: `${color}99`, letterSpacing: "0.12em", lineHeight: 1 }}>{sub}</div>}
      </div>
    </div>
  );

  return (
    <div style={{ background: "var(--fp-section-bg)", padding: "80px 0 72px", borderTop: "1px solid var(--fp-border-soft)" }}>
      <style>{`
        @keyframes marquee-left  { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes marquee-right { from { transform: translateX(-50%) } to { transform: translateX(0) } }
        .mq-left  { display:flex; width:max-content; animation: marquee-left  32s linear infinite; }
        .mq-right { display:flex; width:max-content; animation: marquee-right 32s linear infinite; }
        .mq-left:hover, .mq-right:hover { animation-play-state: paused; }
      `}</style>

      {/* 헤더 */}
      <div className="text-center mx-auto max-w-6xl px-6" style={{ marginBottom: 56 }}>
        <h3 style={{ fontSize: "clamp(22px,3.5vw,32px)", fontWeight: 800, color: "var(--fp-heading)", marginBottom: 12 }}>
          다양한 자영업자가 선택한 FlowPack
        </h3>
        <p style={{ fontSize: 15, color: "var(--fp-secondary)" }}>
          카페부터 뷰티샵, 음식점, 쇼핑몰까지 — 업종 불문 홍보가 쉬워집니다
        </p>
      </div>

      {/* Row 1: 좌→ */}
      <div style={{ overflow: "hidden", padding: "16px 0", marginBottom: 4 }}>
        <div className="mq-left">
          {[...row1, ...row1].map((l, i) => <LogoItem key={i} {...l} />)}
        </div>
      </div>

      {/* Row 2: ←우 */}
      <div style={{ overflow: "hidden", padding: "16px 0", marginBottom: 56 }}>
        <div className="mq-right">
          {[...row2, ...row2].map((l, i) => <LogoItem key={i} {...l} />)}
        </div>
      </div>

      {/* 카운터 통계 */}
      <div className="mx-auto max-w-3xl px-6">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0 }}>
          {[
            { target: 1200, suffix: "+", label: "누적 사용자" },
            { target: 48000, suffix: "+", label: "생성된 콘텐츠" },
            { target: 98, suffix: "%", label: "고객 만족도" },
          ].map((s, i) => (
            <div key={s.label} style={{
              textAlign: "center",
              padding: "28px 16px",
              borderRight: i < 2 ? "1px solid var(--fp-border-soft)" : "none",
            }}>
              <div style={{ fontSize: "clamp(32px,5vw,48px)", fontWeight: 800, color: "var(--fp-heading)", lineHeight: 1, marginBottom: 8 }}>
                <AnimatedCounter target={s.target} suffix={s.suffix} />
              </div>
              <p style={{ fontSize: 14, color: "var(--fp-secondary)", fontWeight: 500 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 마케팅 비용 비교 섹션 ──────────────────────────────── */
function CostComparisonSection() {
  const [contentCount, setContentCount] = useState(30);
  const agencyCostPerItem = 50000;
  const fpMonthlyCost = 19900;
  const agencyMonthlyCost = contentCount * agencyCostPerItem;
  const annualSaving = (agencyMonthlyCost - fpMonthlyCost) * 12;

  return (
    <section style={{ padding: "80px 0", background: "linear-gradient(180deg, #F8F7FF 0%, #EEF2FF 100%)" }}>
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center" style={{ marginBottom: 48 }}>
          <div className="fp-section-label" style={{ marginBottom: 12 }}>Cost Comparison</div>
          <h2 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 700, color: "var(--fp-heading)", marginBottom: 12 }}>
            마케팅 대행, 아직도 수수료 내고 계세요?
          </h2>
          <p style={{ fontSize: 16, color: "var(--fp-secondary)" }}>
            대행사에 건당 5~10만원, 매출 10~20% 수수료. 이제 그만 쓰세요.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ marginBottom: 40 }}>
          <div style={{ background: "#fff", border: "1.5px solid #FECACA", borderRadius: 20, padding: 32, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, right: 0, background: "#FEE2E2", color: "#DC2626", fontSize: 11, fontWeight: 700, padding: "4px 12px", borderBottomLeftRadius: 10 }}>기존 방식</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--fp-heading)", marginBottom: 20 }}>마케팅 대행사</h3>
            {[
              { label: "월 콘텐츠 30건", value: "~₩150만원" },
              { label: "수수료", value: "매출 10~20%" },
              { label: "건당 비용", value: "₩3~10만원" },
              { label: "대기시간", value: "3~7일" },
              { label: "수정 요청", value: "2~3회 제한" },
              { label: "24시간 대응", value: "✕" },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F3F4F6" }}>
                <span style={{ fontSize: 14, color: "var(--fp-secondary)" }}>{item.label}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#DC2626" }}>{item.value}</span>
              </div>
            ))}
          </div>
          <div style={{ background: "#fff", border: "2px solid var(--brand-primary)", borderRadius: 20, padding: 32, position: "relative", overflow: "hidden", boxShadow: "0 8px 24px rgba(99,102,241,0.15)" }}>
            <div style={{ position: "absolute", top: 0, right: 0, background: "var(--brand-primary)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 12px", borderBottomLeftRadius: 10 }}>추천</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--fp-heading)", marginBottom: 20 }}>FlowPack AI</h3>
            {[
              { label: "월 콘텐츠", value: "무제한" },
              { label: "수수료", value: "0%" },
              { label: "건당 비용", value: "₩0" },
              { label: "생성 시간", value: "5분" },
              { label: "수정", value: "무제한 재생성" },
              { label: "24시간 대응", value: "✓" },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F3F4F6" }}>
                <span style={{ fontSize: 14, color: "var(--fp-secondary)" }}>{item.label}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--brand-primary)" }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: "#fff", borderRadius: 20, border: "1.5px solid var(--fp-border)", padding: 32 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--fp-heading)", marginBottom: 20, textAlign: "center" }}>
            💰 월 콘텐츠 수로 절감액 계산해보기
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap", justifyContent: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fp-secondary)" }}>월 콘텐츠 수</span>
            <input type="range" min={10} max={100} step={5} value={contentCount} onChange={e => setContentCount(Number(e.target.value))}
              style={{ width: 200, accentColor: "var(--brand-primary)" }} />
            <span style={{ fontSize: 20, fontWeight: 800, color: "var(--brand-primary)", minWidth: 60 }}>{contentCount}건</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ textAlign: "center" }}>
            <div style={{ background: "#FEF2F2", borderRadius: 12, padding: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", marginBottom: 4 }}>대행사 월 비용</p>
              <p style={{ fontSize: 24, fontWeight: 800, color: "#DC2626" }}>₩{agencyMonthlyCost.toLocaleString()}</p>
            </div>
            <div style={{ background: "var(--brand-light)", borderRadius: 12, padding: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", marginBottom: 4 }}>FlowPack 월 비용</p>
              <p style={{ fontSize: 24, fontWeight: 800, color: "var(--brand-primary)" }}>₩{fpMonthlyCost.toLocaleString()}</p>
            </div>
            <div style={{ background: "#ECFDF5", borderRadius: 12, padding: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", marginBottom: 4 }}>연간 절감액</p>
              <p style={{ fontSize: 24, fontWeight: 800, color: "#059669" }}>₩{annualSaving.toLocaleString()}</p>
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <Link href="/register" className="fp-btn-primary inline-flex items-center gap-2" style={{ height: 48, padding: "0 28px", fontSize: 15 }}>
              지금 무료로 시작하기 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── 메인 컴포넌트 ───────────────────────────────────────── */
export default function RootPage(): React.ReactElement {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const nav = [
    { href: "/features", label: "기능" },
    { href: "/gallery", label: "갤러리" },
    { href: "/cases", label: "도입 사례" },
    { href: "/pricing", label: "요금제" },
    { href: "/contact", label: "문의하기" },
  ];

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family: 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }

        /* --- Brand Colors (Theme B: Indigo-Purple) --- */
        :root {
          --brand-primary: var(--brand-500);
          --brand-primary-hover: var(--brand-600);
          --brand-secondary: var(--fp-cyan);
          --brand-light: #EEF2FF;
          --brand-subtle: #F8F7FF;
          --brand-border: #C7D2FE;
          --fp-heading: #111827;
          --fp-body: #374151;
          --fp-secondary: #6B7280;
          --fp-muted: #9CA3AF;
          --fp-border: #E5E7EB;
          --fp-border-soft: #F3F4F6;
          --fp-section-bg: #F7F8FA;
          --fp-surface: #F9FAFB;
          --fp-success: #059669;
          --fp-error: #DC2626;
        }

        .fp-gradient-text {
          background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .fp-btn-primary {
          background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
          color: #fff;
          border-radius: 10px;
          font-weight: 600;
          font-size: 15px;
          transition: all 0.25s ease;
          box-shadow: 0 4px 14px rgba(99,102,241,0.35);
        }
        .fp-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(99,102,241,0.45);
        }
        .fp-btn-secondary {
          background: #fff;
          color: var(--fp-body);
          border: 1.5px solid var(--fp-border);
          border-radius: 10px;
          font-weight: 500;
          font-size: 15px;
          transition: all 0.25s ease;
        }
        .fp-btn-secondary:hover {
          border-color: var(--brand-primary);
          color: var(--brand-primary);
          background: var(--brand-light);
        }

        .fp-card {
          background: #fff;
          border: 1px solid var(--fp-border-soft);
          border-radius: 16px;
          transition: all 0.25s ease;
        }
        .fp-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.08);
          border-color: var(--brand-border);
        }
        .fp-card-feature {
          background: #fff;
          border: 1px solid var(--fp-border-soft);
          border-radius: 20px;
          transition: all 0.25s ease;
        }
        .fp-card-feature:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px rgba(99,102,241,0.1);
          border-color: var(--brand-border);
        }

        .fp-stat-card {
          background: linear-gradient(135deg, #F8F7FF, #EEF2FF);
          border: 1px solid var(--brand-border);
          border-radius: 16px;
        }

        .fp-testimonial {
          background: #fff;
          border: 1px solid var(--fp-border-soft);
          border-radius: 16px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
          transition: all 0.25s ease;
        }
        .fp-testimonial:hover {
          border-color: var(--brand-border);
          box-shadow: 0 8px 24px rgba(99,102,241,0.08);
        }

        .fp-badge-brand {
          background: var(--brand-light);
          color: var(--brand-primary);
          border: 1px solid var(--brand-border);
          border-radius: 9999px;
          font-size: 13px;
          font-weight: 600;
        }
        .fp-badge-violet {
          background: #EDE9FE;
          color: #7C3AED;
          border: 1px solid #DDD6FE;
          border-radius: 9999px;
          font-size: 13px;
          font-weight: 600;
        }

        .fp-section-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--brand-primary);
        }

        .fp-pill {
          background: var(--fp-surface);
          border: 1px solid var(--fp-border);
          border-radius: 9999px;
          transition: all 0.25s ease;
        }
        .fp-pill:hover {
          background: var(--brand-light);
          border-color: var(--brand-border);
          color: var(--brand-primary);
        }

        .fp-step-connector {
          background: linear-gradient(90deg, #C7D2FE, #DDD6FE);
          height: 2px;
        }

        .fp-cta-banner {
          background: linear-gradient(135deg, var(--brand-500) 0%, var(--fp-cyan) 100%);
          box-shadow: 0 20px 60px rgba(99,102,241,0.3);
        }

        .fp-faq-item { border-bottom: 1px solid var(--fp-border-soft); }
        .fp-faq-item:last-child { border-bottom: none; }
        .fp-comp-row:nth-child(odd) { background: var(--fp-surface); }
        .fp-comp-row:nth-child(even) { background: #fff; }

        .fp-mockup {
          box-shadow: 0 25px 60px rgba(99,102,241,0.15);
          border-radius: 16px;
          overflow: hidden;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .fp-float { animation: float 4s ease-in-out infinite; }

        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
      `}</style>

      {/* ── 헤더 ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50" style={{
        background: scrolled ? "rgba(255,255,255,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid var(--fp-border-soft)" : "1px solid transparent",
        transition: "all 0.3s ease"
      }}>
        <div className="mx-auto max-w-6xl px-6" style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" className="flex items-center gap-2.5">
            <div className="fp-btn-primary flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 10, padding: 0 }}>
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: "var(--fp-heading)" }}>FlowPack</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {nav.map((l) => (
              <Link key={l.href} href={l.href}
                style={{ fontSize: 14, fontWeight: 500, color: "var(--fp-secondary)", transition: "color 0.2s" }}
                className="hover:text-gray-900">{l.label}</Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" style={{ fontSize: 14, fontWeight: 500, color: "var(--fp-secondary)" }} className="hover:text-gray-900 transition-colors">로그인</Link>
            <Link href="/register" className="fp-btn-primary inline-flex items-center gap-1.5" style={{ height: 36, padding: "0 16px" }}>
              무료로 시작 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <button className="md:hidden p-2" style={{ color: "var(--fp-secondary)" }} onClick={() => setMobileMenu(!mobileMenu)}>
            <span className="text-lg">{mobileMenu ? "✕" : "☰"}</span>
          </button>
        </div>

        {mobileMenu && (
          <nav className="md:hidden px-6 pb-4 border-t" style={{ borderColor: "var(--fp-border-soft)" }}>
            <div className="flex flex-col gap-2 pt-4">
              {nav.map((l) => (
                <Link key={l.href} href={l.href}
                  style={{ fontSize: 14, fontWeight: 500, color: "var(--fp-secondary)", padding: "8px 0" }}
                  onClick={() => setMobileMenu(false)}>{l.label}</Link>
              ))}
              <Link href="/register" className="fp-btn-primary flex items-center justify-center mt-2"
                style={{ height: 44 }} onClick={() => setMobileMenu(false)}>무료로 시작</Link>
            </div>
          </nav>
        )}
      </header>

      {/* ── 히어로 ────────────────────────────────────────── */}
      <section style={{ paddingTop: 80, paddingBottom: 120, background: "#fff", position: "relative", overflow: "hidden" }}>
        {/* 배경 그라디언트 */}
        <div style={{ position: "absolute", top: -300, left: "50%", transform: "translateX(-50%)", width: 1000, height: 700, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(99,102,241,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(139,92,246,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div className="mx-auto max-w-6xl px-6 text-center" style={{ position: "relative" }}>
          {/* 배지 */}
          <div className="fp-badge-brand inline-flex items-center gap-2 mb-6" style={{ padding: "6px 16px" }}>
            <Sparkles className="h-3.5 w-3.5" />
            AI 기반 홍보 콘텐츠 플랫폼
          </div>

          {/* 헤드라인 */}
          <h1 style={{ fontSize: "clamp(36px, 5vw, 56px)", fontWeight: 800, lineHeight: 1.12, letterSpacing: "-0.02em", color: "var(--fp-heading)", marginBottom: 24 }}>
            홍보 콘텐츠,
            <br />
            <span className="fp-gradient-text">AI가 만들어드립니다</span>
          </h1>

          <p style={{ fontSize: 18, fontWeight: 400, lineHeight: 1.6, color: "var(--fp-secondary)", maxWidth: 520, margin: "0 auto 40px" }}>
            주제만 입력하면 카드뉴스와 블로그를 자동 생성하고,
            SNS와 블로그까지 한 번에 배포하세요.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
            <Link href="/register" className="fp-btn-primary inline-flex items-center gap-2" style={{ height: 52, padding: "0 32px", fontSize: 16 }}>
              1분 만에 무료 시작하기 <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/pricing" className="fp-btn-secondary inline-flex items-center gap-2" style={{ height: 52, padding: "0 32px", fontSize: 16 }}>
              요금제 보기
            </Link>
          </div>
          <p style={{ fontSize: 13, color: "var(--fp-muted)" }}>신용카드 없이 무료 시작 · 매월 10개 크레딧 제공</p>

          {/* 대시보드 목업 */}
          <div className="mt-16 mx-auto max-w-4xl fp-float" style={{ position: "relative" }}>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "20%", background: "linear-gradient(to top, #fff, transparent)", zIndex: 10, pointerEvents: "none" }} />
            <div className="fp-mockup bg-white">
              {/* 브라우저 크롬 */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", height: 44, borderBottom: "1px solid var(--fp-border-soft)", background: "var(--fp-surface)" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#F87171" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FBBF24" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#34D399" }} />
                </div>
                <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                  <div style={{ background: "#fff", border: "1px solid var(--fp-border)", borderRadius: 6, height: 24, display: "flex", alignItems: "center", paddingInline: 12, fontSize: 11, color: "var(--fp-muted)", width: 260 }}>
                    app.flowpack.dev/dashboard
                  </div>
                </div>
              </div>

              {/* 대시보드 내용 */}
              <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: 280 }}>
                {/* 사이드바 */}
                <div style={{ borderRight: "1px solid var(--fp-border-soft)", padding: 16, background: "var(--fp-surface)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Zap size={14} color="#fff" />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fp-heading)" }}>FlowPack</span>
                  </div>
                  {[
                    { icon: <BarChart2 size={14} />, label: "대시보드", active: true },
                    { icon: <Layers size={14} />, label: "콘텐츠", active: false },
                    { icon: <Image size={14} />, label: "카드뉴스", active: false },
                    { icon: <Share2 size={14} />, label: "배포", active: false },
                  ].map(item => (
                    <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, marginBottom: 2, background: item.active ? "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))" : "transparent", color: item.active ? "#fff" : "var(--fp-secondary)", fontSize: 12, fontWeight: item.active ? 600 : 400, cursor: "pointer" }}>
                      {item.icon} {item.label}
                    </div>
                  ))}
                </div>

                {/* 메인 영역 */}
                <div style={{ padding: 20 }}>
                  {/* KPI 바 */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
                    {[
                      { label: "이번 달 생성", value: "24", icon: <Sparkles size={14} color="var(--brand-500)" />, bg: "#EEF2FF" },
                      { label: "발행 완료", value: "18", icon: <CheckCircle2 size={14} color="#059669" />, bg: "#ECFDF5" },
                      { label: "크레딧 잔여", value: "76", icon: <Zap size={14} color="#D97706" />, bg: "#FFFBEB" },
                    ].map(k => (
                      <div key={k.label} style={{ background: k.bg, borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 10, color: "var(--fp-muted)", fontWeight: 600 }}>{k.label}</span>
                          {k.icon}
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--fp-heading)" }}>{k.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* 콘텐츠 리스트 */}
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--fp-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>최근 생성 콘텐츠</div>
                  {[
                    { title: "카카오뱅크 신규 서비스 안내", type: "카드뉴스", status: "발행완료", statusColor: "#059669", statusBg: "#ECFDF5" },
                    { title: "AI 마케팅 트렌드 2026", type: "블로그", status: "검토중", statusColor: "#D97706", statusBg: "#FFFBEB" },
                    { title: "스타트업A 월간 뉴스레터", type: "이메일", status: "발행완료", statusColor: "#059669", statusBg: "#ECFDF5" },
                  ].map(item => (
                    <div key={item.title} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, marginBottom: 4, background: "#fff", border: "1px solid var(--fp-border-soft)" }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fp-heading)" }}>{item.title}</div>
                        <div style={{ fontSize: 10, color: "var(--fp-muted)" }}>{item.type}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: item.statusColor, background: item.statusBg, padding: "2px 8px", borderRadius: 9999 }}>{item.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ── 기능 ─────────────────────────────────────────── */}
      <section style={{ padding: "96px 0", background: "#fff" }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center" style={{ marginBottom: 64 }}>
            <div className="fp-section-label" style={{ marginBottom: 12 }}>Features</div>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 36px)", fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.015em", color: "var(--fp-heading)", marginBottom: 16 }}>
              어떤 콘텐츠든, AI가 만들어드립니다
            </h2>
            <p style={{ fontSize: 16, color: "var(--fp-secondary)", maxWidth: 480, margin: "0 auto" }}>
              텍스트 콘텐츠부터 카드뉴스, 블로그까지. 하나의 주제로 모든 포맷을 한번에.
            </p>
          </div>
          {/* 스태거드 그리드 — 짝수 인덱스 카드는 아래로 40px */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 24, alignItems: "start" }}>
            {features.map((f, i) => (
              <div
                key={f.title}
                style={{
                  background: "#fff",
                  borderRadius: 20,
                  padding: "36px 28px",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  boxSizing: "border-box",
                  marginTop: i % 2 === 1 ? 40 : 0,
                  transition: "box-shadow 0.25s, transform 0.25s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 40px rgba(99,102,241,0.15)";
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 24px rgba(0,0,0,0.07)";
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                }}
              >
                {/* 원형 파스텔 아이콘 */}
                <div style={{
                  width: 52, height: 52, borderRadius: "50%",
                  background: f.iconBg, color: f.iconColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 24,
                }}>
                  {f.icon}
                </div>
                {/* 제목 — 브랜드 컬러 */}
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--fp-heading)", marginBottom: 12, lineHeight: 1.3 }}>
                  {f.title}
                </h3>
                {/* 설명 — flex-grow로 하단 링크를 밀어냄 */}
                <p style={{ fontSize: 14, color: "var(--fp-secondary)", lineHeight: 1.65, flexGrow: 1, marginBottom: 28 }}>
                  {f.desc}
                </p>
                {/* 하단 텍스트 링크 */}
                <Link href="/features" style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 12, fontWeight: 700, letterSpacing: "0.08em",
                  textTransform: "uppercase", color: "var(--brand-primary)",
                  textDecoration: "none",
                }}>
                  — LEARN MORE
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEO·플랫폼 연동 ──────────────────────────────── */}
      <IntegrationSection />

      {/* ── SNS 멀티채널 배포 캐러셀 ─────────────────────── */}
      <SnsDeploySection />



      {/* ── 3단계 ─────────────────────────────────────────── */}
      <section style={{ padding: "96px 0", background: "#fff" }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center" style={{ marginBottom: 64 }}>
            <div className="fp-section-label" style={{ marginBottom: 12 }}>How It Works</div>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 36px)", fontWeight: 700, color: "var(--fp-heading)" }}>3단계로 끝납니다</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8" style={{ position: "relative" }}>
            {[
              { n: "01", title: "주제 입력", desc: "만들고 싶은 콘텐츠의 주제와 톤을 선택합니다.", color: "var(--brand-500)", shadow: "rgba(99,102,241,0.3)" },
              { n: "02", title: "AI 생성", desc: "AI가 콘텐츠를 생성합니다. 마음에 들지 않으면 재생성.", color: "var(--fp-cyan)", shadow: "rgba(139,92,246,0.3)" },
              { n: "03", title: "배포", desc: "원하는 채널 선택 후 한 번에 배포. 예약도 가능합니다.", color: "#059669", shadow: "rgba(5,150,105,0.3)" },
            ].map((s, i) => (
              <div key={s.n} className="text-center" style={{ position: "relative" }}>
                {i < 2 && <div className="fp-step-connector hidden md:block" style={{ position: "absolute", top: 32, left: "65%", width: "70%", zIndex: 0 }} />}
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: s.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, margin: "0 auto 20px", boxShadow: `0 8px 20px ${s.shadow}` }}>
                    {s.n}
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--fp-heading)", marginBottom: 8 }}>{s.title}</h3>
                  <p style={{ fontSize: 14, color: "var(--fp-secondary)", lineHeight: 1.5 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 마케팅 비용 비교 ────────────────────── */}
      <CostComparisonSection />

      {/* ── 후기 ─────────────────────────────────────────── */}
      <section style={{ padding: "80px 0", background: "#fff" }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center" style={{ marginBottom: 48 }}>
            <div className="fp-section-label" style={{ marginBottom: 12 }}>Reviews</div>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 700, color: "var(--fp-heading)", marginBottom: 12 }}>FlowPack을 체험하신 분들의 생생한 후기</h2>
            <p style={{ fontSize: 16, color: "var(--fp-secondary)" }}>크리에이터부터 소형 브랜드, 대행사 등 다양한 팀이 이미 사용 중이에요.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div key={t.handle} className="fp-testimonial" style={{ padding: 24 }}>
                <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>
                    {t.avatar}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--fp-heading)" }}>{t.name}</p>
                    <p style={{ fontSize: 12, color: "var(--fp-muted)" }}>@{t.handle} · {t.role}</p>
                  </div>
                  <div className="ml-auto flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </div>
                <p style={{ fontSize: 14, color: "var(--fp-body)", lineHeight: 1.6, marginBottom: 16 }}>"{t.content}"</p>
                <div style={{ fontSize: 12, color: "var(--fp-muted)" }}>❤️ {t.likes}</div>
              </div>
            ))}
          </div>
        </div>
      </section>



      {/* ── 최종 CTA ─────────────────────────────────────── */}
      <section style={{ padding: "80px 0", background: "var(--fp-section-bg)", borderTop: "1px solid var(--fp-border-soft)" }}>
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, color: "var(--fp-heading)", marginBottom: 16 }}>
            지금 바로 <span className="fp-gradient-text">무료로 시작</span>하세요
          </h2>
          <p style={{ fontSize: 16, color: "var(--fp-secondary)", marginBottom: 32 }}>카드 없이, 약정 없이. 지금 바로 AI 콘텐츠를 경험하세요.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register" className="fp-btn-primary inline-flex items-center gap-2" style={{ height: 52, padding: "0 32px", fontSize: 16 }}>
              무료로 시작하기 <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/contact" className="fp-btn-secondary inline-flex items-center gap-2" style={{ height: 52, padding: "0 32px" }}>
              <Mail className="h-4 w-4" /> 문의하기
            </Link>
          </div>
        </div>
      </section>

      {/* ── 푸터 ─────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid var(--fp-border-soft)", padding: "48px 0", background: "#fff" }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8" style={{ marginBottom: 32 }}>
            <div>
              <div className="flex items-center gap-2.5" style={{ marginBottom: 16 }}>
                <div className="fp-btn-primary flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: 8, padding: 0 }}>
                  <Zap className="h-3.5 w-3.5 text-white" />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--fp-heading)" }}>FlowPack</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--fp-muted)" }}>AI 기반 홍보 콘텐츠 플랫폼</p>
            </div>
            {[
              { title: "서비스", links: [{ href: "/features", label: "기능" }, { href: "/gallery", label: "갤러리" }, { href: "/cases", label: "도입 사례" }, { href: "/pricing", label: "요금제" }, { href: "/contact", label: "문의하기" }] },
              { title: "회사", links: [{ href: "/privacy", label: "개인정보처리방침" }, { href: "/terms", label: "이용약관" }, { href: "/cookie", label: "쿠키 정책" }] },
              { title: "지원", links: [{ href: "/contact", label: "고객센터" }, { href: "mailto:support@flowpack.dev", label: "support@flowpack.dev" }, { href: "/design-system", label: "Design System" }] },
            ].map((col) => (
              <div key={col.title}>
                <h4 style={{ fontSize: 11, fontWeight: 700, color: "var(--fp-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((lnk) => (
                    <li key={lnk.href}>
                      <Link href={lnk.href} style={{ fontSize: 13, color: "var(--fp-secondary)", transition: "color 0.2s" }} className="hover:text-indigo-600">{lnk.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ paddingTop: 24, borderTop: "1px solid var(--fp-border-soft)", textAlign: "center", fontSize: 12, color: "var(--fp-muted)" }}>
            © 2026 FlowPack. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
