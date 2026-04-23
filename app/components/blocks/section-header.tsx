"use client";

import React from "react";

/**
 * SectionHeader — 모든 랜딩/대시보드 섹션의 표준 제목 블록.
 * label (UPPERCASE 카테고리) + title + subtitle 3행 구조.
 *
 * @example
 * <SectionHeader label="Features" title="왜 FlowPack인가?" subtitle="기획부터 배포까지 5분 완성" />
 */
export interface SectionHeaderProps {
  /** UPPERCASE 카테고리 라벨 (예: "FEATURES", "PRICING") */
  label?: string;
  /** 메인 제목 – React 노드 허용 (br, span 등) */
  title: React.ReactNode;
  /** 서브 설명 */
  subtitle?: React.ReactNode;
  /** 라벨 액센트 색상 (기본: var(--fp-primary-subtle0)) */
  accentColor?: string;
  /** 정렬 (기본: center) */
  align?: "left" | "center";
  /** 추가 className */
  className?: string;
  /** 추가 style */
  style?: React.CSSProperties;
}

export function SectionHeader({
  label,
  title,
  subtitle,
  accentColor = "var(--fp-primary-subtle0)",
  align = "center",
  className = "",
  style,
}: SectionHeaderProps) {
  return (
    <div
      className={className}
      style={{
        textAlign: align,
        marginBottom: 48,
        ...style,
      }}
    >
      {label && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: accentColor,
            marginBottom: 12,
          }}
        >
          {label}
        </div>
      )}
      <h2
        style={{
          fontSize: "clamp(24px, 3.5vw, 32px)",
          fontWeight: 700,
          color: "var(--fp-heading)",
          marginBottom: subtitle ? 12 : 0,
          lineHeight: 1.3,
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p style={{ fontSize: 16, color: "var(--fp-secondary)", lineHeight: 1.6 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
