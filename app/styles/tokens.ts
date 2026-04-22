/**
 * FlowPack Design Token Module
 * ─────────────────────────────
 * globals.css의 :root / .dark CSS 변수를 참조하는 스타일 객체 모음.
 * 이 파일 하나를 수정하면 모든 DS 컴포넌트와 페이지에 일괄 반영됩니다.
 *
 * 사용법:
 *   import { t, card, inputBase } from "@/styles/tokens";
 *   <div style={{ ...card }}>
 *     <h2 style={t.heading}>제목</h2>
 *   </div>
 */
import type { CSSProperties } from "react";

/* ═══════════════════════════════════════════════════════
   단일 토큰 (Atomic Tokens)
   ═══════════════════════════════════════════════════════ */
export const t = {
  /* ── 배경 ── */
  pageBg:    { background: "var(--fp-page-bg)" }    as CSSProperties,
  cardBg:    { background: "var(--fp-card-bg)" }    as CSSProperties,
  sectionBg: { background: "var(--fp-section-bg)" } as CSSProperties,

  /* ── 텍스트 ── */
  heading:   { color: "var(--fp-heading)" }   as CSSProperties,
  body:      { color: "var(--fp-body)" }      as CSSProperties,
  secondary: { color: "var(--fp-secondary)" } as CSSProperties,
  muted:     { color: "var(--fp-muted)" }     as CSSProperties,

  /* ── 보더 ── */
  border:       "var(--fp-border)",
  borderSoft:   "var(--fp-border-soft)",
  borderStrong: "var(--fp-border-strong)",

  /* ── 그림자 ── */
  shadowCard:  "var(--fp-shadow-card)",
  shadowHover: "var(--fp-shadow-hover)",

  /* ── 상태 ── */
  success: {
    background: "var(--fp-success-bg)",
    color: "var(--fp-success-text)",
    border: "1.5px solid var(--fp-success-border)",
  } as CSSProperties,
  error: {
    background: "var(--fp-error-bg)",
    color: "var(--fp-error-text)",
    border: "1.5px solid var(--fp-error-border)",
  } as CSSProperties,
  warning: {
    background: "var(--fp-warning-bg)",
    color: "var(--fp-warning-text)",
    border: "1.5px solid var(--fp-warning-border)",
  } as CSSProperties,
  info: {
    background: "var(--fp-info-bg)",
    color: "var(--fp-info-text)",
    border: "1.5px solid var(--fp-info-border)",
  } as CSSProperties,
  emergency: {
    background: "var(--fp-emergency-bg)",
    color: "var(--fp-emergency-text)",
    border: "1.5px solid var(--fp-emergency-border)",
  } as CSSProperties,
} as const;

/* ═══════════════════════════════════════════════════════
   복합 스타일 (Composite Styles)
   ═══════════════════════════════════════════════════════ */

/** 카드 컨테이너 (설정 섹션, 콘텐츠 카드 공용) */
export const card: CSSProperties = {
  background: "var(--fp-card-bg)",
  border: "1.5px solid var(--fp-border)",
  borderRadius: 16,
  overflow: "hidden",
  boxShadow: "var(--fp-shadow-card)",
};

/** 섹션 헤더 구분선 */
export const sectionHeader: CSSProperties = {
  padding: "18px 22px 14px",
  borderBottom: "1px solid var(--fp-border-soft)",
  display: "flex",
  alignItems: "center",
  gap: 12,
};

/** 아이콘 배경 박스 (36×36 pill) */
export const iconBox: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: "var(--fp-primary-subtle)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

/** 폼 인풋 기본 스타일 */
export const inputBase: CSSProperties = {
  width: "100%",
  height: 42,
  padding: "0 14px",
  border: "1.5px solid var(--fp-border)",
  borderRadius: 10,
  fontSize: 14,
  color: "var(--fp-heading)",
  background: "var(--fp-card-bg)",
  outline: "none",
  boxSizing: "border-box",
};

/** 폼 인풋 비활성 상태 */
export const inputDisabled: CSSProperties = {
  ...inputBase,
  background: "var(--fp-section-bg)",
  cursor: "not-allowed",
};

/** Primary CTA 버튼 */
export const btnPrimary: CSSProperties = {
  height: 42,
  padding: "0 24px",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  border: "none",
  background: "var(--fp-gradient-primary)",
  color: "var(--fp-white)",
  display: "flex",
  alignItems: "center",
  gap: 8,
  transition: "all 0.2s",
};

/** Secondary 버튼 (outline) */
export const btnSecondary: CSSProperties = {
  height: 42,
  padding: "0 20px",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  border: "1.5px solid var(--fp-border)",
  background: "var(--fp-card-bg)",
  color: "var(--fp-body)",
  transition: "all 0.15s",
  whiteSpace: "nowrap",
};

/** Destructive 버튼 */
export const btnDestructive: CSSProperties = {
  height: 42,
  padding: "0 20px",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  border: "1.5px solid var(--fp-error-border)",
  background: "var(--fp-error-bg)",
  color: "var(--fp-error-text)",
  transition: "all 0.2s",
};

/** 라벨 스타일 */
export const label: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--fp-body)",
  display: "block",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

/** 헬퍼 노트 텍스트 */
export const noteText: CSSProperties = {
  fontSize: 11,
  color: "var(--fp-muted)",
  marginTop: 5,
};

/** 구분선 */
export const divider: CSSProperties = {
  borderBottom: "1px solid var(--fp-border-soft)",
};
