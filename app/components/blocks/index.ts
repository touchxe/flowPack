/**
 * FlowPack 블록 컴포넌트 라이브러리.
 *
 * 재사용 가능한 UI 블록 — 랜딩 페이지, 대시보드, 마케팅 페이지 등에서 import.
 *
 * @example
 * import { SectionHeader, FeatureCard, KpiCard } from "@/components/blocks";
 */

// ── 섹션 레이아웃 ──
export { SectionHeader } from "./section-header";
export type { SectionHeaderProps } from "./section-header";

// ── 카드 블록 ──
export { StatCard } from "./stat-card";
export type { StatCardProps } from "./stat-card";

export { FeatureCard } from "./feature-card";
export type { FeatureCardProps } from "./feature-card";

export { TestimonialCard } from "./testimonial-card";
export type { TestimonialCardProps } from "./testimonial-card";

export { KpiCard } from "./kpi-card";
export type { KpiCardProps } from "./kpi-card";

export { ProblemCard } from "./problem-card";
export type { ProblemCardProps } from "./problem-card";

export { ChartPanel } from "./chart-panel";
export type { ChartPanelProps } from "./chart-panel";

// ── 인터랙션 블록 ──
export { FaqAccordion } from "./faq-accordion";
export type { FaqAccordionProps, FaqItem } from "./faq-accordion";

export { AnimatedCounter } from "./animated-counter";
export type { AnimatedCounterProps } from "./animated-counter";

// ── 배너/테이블 ──
export { CtaBanner } from "./cta-banner";
export type { CtaBannerProps } from "./cta-banner";

export { ComparisonTable } from "./comparison-table";
export type { ComparisonTableProps, ComparisonItem } from "./comparison-table";

// ── 배지 ──
export { PlanBadge, StatusDot } from "./badges";
export type { PlanBadgeProps, StatusDotProps } from "./badges";
