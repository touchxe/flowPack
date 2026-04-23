"use client";

import React from "react";

/**
 * FeatureCard — 아이콘 + 제목 + 설명 + 태그 배지 카드.
 * 랜딩 기능 소개, 서비스 소개 등에 사용.
 *
 * @example
 * <FeatureCard
 *   icon={<Layers className="h-7 w-7" />}
 *   title="카드뉴스"
 *   desc="레퍼런스 디자인을 학습해 브랜드 톤에 맞는 카드뉴스를 5분 만에 자동 생성합니다."
 *   tag="5분 제작"
 *   iconBg="#EEF2FF"
 *   iconColor="var(--fp-primary-subtle0)"
 * />
 */
export interface FeatureCardProps {
  /** 아이콘 ReactNode */
  icon: React.ReactNode;
  /** 제목 */
  title: string;
  /** 설명 */
  desc: string;
  /** 태그 배지 텍스트 */
  tag?: string;
  /** 아이콘 배경색 */
  iconBg?: string;
  /** 아이콘 색상 (태그에도 사용) */
  iconColor?: string;
  /** 추가 style */
  style?: React.CSSProperties;
}

export function FeatureCard({
  icon,
  title,
  desc,
  tag,
  iconBg = "#EEF2FF",
  iconColor = "var(--fp-primary-subtle0)",
  style,
}: FeatureCardProps) {
  return (
    <div
      className="fp-card-feature"
      style={{
        background: "#fff",
        border: "1px solid var(--fp-border-soft)",
        borderRadius: 20,
        padding: 28,
        transition: "all 0.25s ease",
        ...style,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "translateY(-4px)";
        el.style.boxShadow = "0 20px 40px rgba(0,0,0,0.08)";
        el.style.borderColor = "#DBEAFE";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "";
        el.style.boxShadow = "";
        el.style.borderColor = "var(--fp-border-soft)";
      }}
    >
      {/* 아이콘 */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
          color: iconColor,
        }}
      >
        {icon}
      </div>

      {/* 제목 */}
      <p style={{ fontSize: 16, fontWeight: 700, color: "var(--fp-heading)", marginBottom: 6 }}>
        {title}
      </p>

      {/* 설명 */}
      <p style={{ fontSize: 13, color: "var(--fp-secondary)", lineHeight: 1.6, marginBottom: tag ? 12 : 0 }}>
        {desc}
      </p>

      {/* 태그 배지 */}
      {tag && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 10px",
            borderRadius: 9999,
            background: iconBg,
            color: iconColor,
            border: `1px solid ${iconColor}30`,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          ✓ {tag}
        </span>
      )}
    </div>
  );
}
