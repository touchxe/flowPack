"use client";

import { useState } from "react";
import { X, Copy, Check, ExternalLink, ChevronRight, BookOpen, Zap, Shield, Globe } from "lucide-react";

/* ─── 플랫폼별 연동 가이드 데이터 ────────────────────────── */
export const INTEGRATION_GUIDES: Record<string, {
  title: string;
  type: "oauth" | "copy-paste" | "api-key";
  color: string;
  bg: string;
  steps: { title: string; desc: string; code?: string; link?: { label: string; url: string } }[];
  tips: string[];
}> = {
  WORDPRESS: {
    title: "WordPress 연동 가이드",
    type: "api-key",
    color: "#21759B",
    bg: "#F0F7FF",
    steps: [
      {
        title: "1. WordPress 관리자 페이지 접속",
        desc: "본인의 WordPress 사이트 관리자 페이지(yoursite.com/wp-admin)에 접속합니다.",
        link: { label: "WordPress 관리자 페이지 열기", url: "https://wordpress.com/wp-admin" },
      },
      {
        title: "2. Application Password 발급",
        desc: "사용자 > 프로필 > Application Passwords 섹션으로 이동합니다. 새 Application Name에 'FlowPack'을 입력하고 [Add New Application Password]를 클릭합니다.",
        code: "경로: WordPress 관리자 → 사용자 → 프로필 → Application Passwords",
      },
      {
        title: "3. 발급된 비밀번호 복사",
        desc: "화면에 표시되는 비밀번호를 반드시 즉시 복사하세요. 이 화면을 벗어나면 다시 확인할 수 없습니다.",
        code: "예시: xxxx xxxx xxxx xxxx xxxx xxxx (공백 포함 26자)",
      },
      {
        title: "4. FlowPack에 정보 입력",
        desc: "아래 필드에 WordPress 사이트 URL, 사용자명(로그인 ID), Application Password를 입력하고 [연결 테스트] 버튼을 클릭합니다.",
      },
      {
        title: "5. 연결 테스트 및 확인",
        desc: "연결 테스트가 성공하면 FlowPack에서 WordPress로 직접 포스트를 발행할 수 있습니다. REST API를 통해 제목, 본문, 카테고리, 태그, 대표이미지가 자동으로 설정됩니다.",
        code: "API 엔드포인트: https://yoursite.com/wp-json/wp/v2/posts",
      },
    ],
    tips: [
      "WordPress.com(유료 플랜) 또는 자체 호스팅 WordPress 모두 지원합니다.",
      "Application Password는 계정 비밀번호와 별개로 관리됩니다. 언제든 삭제 가능합니다.",
      "삭제 권한 없이 '게시' 권한만 있는 에디터 계정을 사용하는 것을 권장합니다.",
      "REST API가 비활성화된 경우 플러그인(WP REST API) 설치가 필요할 수 있습니다.",
    ],
  },
  INSTAGRAM: {
    title: "Instagram 연동 가이드",
    type: "oauth",
    color: "#E1306C",
    bg: "#FFF0F5",
    steps: [
      {
        title: "1. Meta for Developers 앱 생성",
        desc: "developers.facebook.com에 접속하여 Meta 개발자 계정을 만들고 새 앱을 생성합니다. 앱 유형은 '비즈니스'를 선택합니다.",
        link: { label: "Meta for Developers 열기", url: "https://developers.facebook.com" },
      },
      {
        title: "2. Instagram Graph API 권한 추가",
        desc: "앱 대시보드에서 [제품 추가] → [Instagram Graph API]를 선택합니다. instagram_basic, instagram_content_publish, pages_read_engagement 권한을 요청합니다.",
        code: "필요 권한:\n- instagram_basic\n- instagram_content_publish\n- pages_read_engagement\n- pages_show_list",
      },
      {
        title: "3. Instagram 비즈니스 계정 연결",
        desc: "Instagram 계정을 Facebook 페이지와 연결해야 합니다. Instagram 앱 설정 → 계정 → '페이지와 연결'에서 Facebook 페이지를 선택합니다.",
        code: "Instagram 설정 → 계정 → Facebook 연결",
      },
      {
        title: "4. FlowPack에서 OAuth 연동",
        desc: "'연결하기' 버튼을 클릭하면 Facebook OAuth 화면이 뜹니다. 비즈니스 계정으로 로그인하고 요청된 권한을 모두 승인합니다.",
      },
      {
        title: "5. 2단계 발행 프로세스",
        desc: "Instagram API는 2단계로 발행합니다. ① 미디어 컨테이너 생성 → ② 발행 요청. FlowPack이 자동으로 처리합니다.",
        code: "Step 1: POST /media (이미지 URL + 캡션)\nStep 2: POST /media_publish (컨테이너 ID)",
      },
    ],
    tips: [
      "일반 개인 계정은 지원되지 않습니다. 비즈니스 또는 크리에이터 계정이 필요합니다.",
      "Instagram API는 이미지/동영상 미디어가 필수입니다. 텍스트만의 발행은 불가합니다.",
      "하루 발행 한도: 계정당 25개 (Meta API 정책).",
      "앱 검수를 통과하면 모든 사용자가 연동 가능합니다. 검수 전에는 테스터 계정만 연동 가능합니다.",
      "스레드(Threads)는 별도 API를 사용합니다. 현재 개발 중입니다.",
    ],
  },
  GOOGLE_SEARCH_CONSOLE: {
    title: "Google Search Console 연동 가이드",
    type: "oauth",
    color: "#4285F4",
    bg: "#EFF6FF",
    steps: [
      {
        title: "1. Google Search Console 속성 추가",
        desc: "search.google.com/search-console에 접속하여 사이트를 추가합니다. URL 접두사 방식을 권장합니다.",
        link: { label: "Google Search Console 열기", url: "https://search.google.com/search-console" },
      },
      {
        title: "2. 소유권 확인",
        desc: "HTML 태그 방식으로 소유권을 확인합니다. FlowPack이 제공하는 메타 태그를 사이트의 <head>에 삽입합니다.",
        code: '<meta name="google-site-verification" content="YOUR_CODE" />',
      },
      {
        title: "3. FlowPack OAuth 연동",
        desc: "'연결하기' 버튼 → Google 계정 로그인 → Search Console 접근 권한 승인.",
        code: "필요 권한: Search Console API (읽기/쓰기)",
      },
      {
        title: "4. 사이트맵 자동 제출",
        desc: "FlowPack에서 새 글을 발행할 때마다 Google에 사이트맵을 자동으로 제출합니다. 색인 요청도 자동으로 처리됩니다.",
        code: "사이트맵 URL: https://yoursite.com/sitemap.xml",
      },
      {
        title: "5. 색인 현황 확인",
        desc: "FlowPack 통계 페이지에서 Google 검색 노출수, 클릭수, 평균 순위를 확인할 수 있습니다.",
      },
    ],
    tips: [
      "사이트맵 자동 제출로 새 글의 색인 속도를 높일 수 있습니다.",
      "Google Search Console 데이터는 2~3일의 지연이 있습니다.",
      "Core Web Vitals 모니터링도 FlowPack 통계에서 확인 예정입니다.",
      "YouTube Search Console(유튜브 검색 성과)은 별도입니다.",
    ],
  },
};

/* ─── 가이드 모달 컴포넌트 ────────────────────────────────── */
interface IntegrationGuideModalProps {
  platform: string;
  onClose: () => void;
}

export function IntegrationGuideModal({ platform, onClose }: IntegrationGuideModalProps) {
  const guide = INTEGRATION_GUIDES[platform];
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  if (!guide) return null;

  const copyToClipboard = (text: string, stepIdx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedStep(stepIdx);
      setTimeout(() => setCopiedStep(null), 2000);
    });
  };

  const typeBadge = {
    "oauth": { label: "OAuth 자동 연동", color: "#6366F1", bg: "#EEF2FF" },
    "copy-paste": { label: "복사+붙여넣기", color: "#D97706", bg: "#FFFBEB" },
    "api-key": { label: "API Key 연동", color: "#059669", bg: "#ECFDF5" },
  }[guide.type];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      {/* 배경 블러 */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} />

      {/* 모달 */}
      <div style={{
        position: "relative", zIndex: 1,
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 640,
        maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
        margin: "0 16px",
      }}>
        {/* 헤더 */}
        <div style={{ padding: "24px 28px", borderBottom: "1px solid #F3F4F6", background: guide.bg, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 }}>{guide.title}</h2>
              <span style={{ fontSize: 11, fontWeight: 700, color: typeBadge.color, background: typeBadge.bg, padding: "3px 10px", borderRadius: 9999 }}>
                {typeBadge.label}
              </span>
            </div>
            <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>단계별로 따라하시면 5분 안에 연동이 완료됩니다.</p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(0,0,0,0.06)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={18} color="#6B7280" />
          </button>
        </div>

        {/* 스텝 내용 (스크롤) */}
        <div style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}>
          {/* 단계 목록 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
            {guide.steps.map((step, idx) => (
              <div key={idx} style={{ background: "#FAFAFA", border: "1.5px solid #E5E7EB", borderRadius: 14, padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: guide.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0, marginTop: 1 }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 6px" }}>{step.title}</p>
                    <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 10px", lineHeight: 1.6 }}>{step.desc}</p>

                    {/* 코드 블록 */}
                    {step.code && (
                      <div style={{ position: "relative", background: "#1F2937", borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
                        <pre style={{ fontSize: 11, color: "#D1FAE5", fontFamily: "monospace", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{step.code}</pre>
                        <button onClick={() => copyToClipboard(step.code!, idx)}
                          style={{ position: "absolute", top: 8, right: 8, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#9CA3AF", fontSize: 11 }}>
                          {copiedStep === idx ? <Check size={12} color="#34D399" /> : <Copy size={12} />}
                          {copiedStep === idx ? "복사됨" : "복사"}
                        </button>
                      </div>
                    )}

                    {/* 외부 링크 */}
                    {step.link && (
                      <a href={step.link.url} target="_blank" rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: guide.color, textDecoration: "none", background: guide.bg, padding: "6px 14px", borderRadius: 8 }}>
                        <ExternalLink size={12} /> {step.link.label}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 팁 섹션 */}
          <div style={{ background: "#FFF7ED", border: "1.5px solid #FCD34D", borderRadius: 14, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Zap size={16} color="#D97706" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#92400E" }}>연동 팁</span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {guide.tips.map((tip, idx) => (
                <li key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#78350F" }}>
                  <ChevronRight size={14} style={{ flexShrink: 0, marginTop: 2, color: "#D97706" }} />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 푸터 액션 */}
        <div style={{ padding: "16px 28px", borderTop: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FAFAFA" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Shield size={14} color="#9CA3AF" />
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>연동 정보는 암호화되어 안전하게 보관됩니다</span>
          </div>
          <button onClick={onClose}
            style={{ padding: "9px 20px", background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── 네이버 블로그 클립보드 복사 유틸 ───────────────────── */
export function buildNaverContent(title: string, content: string, tags: string[]): string {
  const tagStr = tags.map(t => `#${t}`).join(" ");
  return `${title}\n\n${content}\n\n${tagStr}`;
}
