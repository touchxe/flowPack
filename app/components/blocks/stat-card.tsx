"use client";

import React from "react";

/**
 * StatCard — 숫자 강조 통계 카드.
 * 랜딩 stats 섹션, 대시보드 요약 등에 사용.
 *
 * @example
 * <StatCard value="90%" label="콘텐츠 제작 시간 절감" />
 */
export interface StatCardProps {
  /** 큰 숫자/값 */
  value: React.ReactNode;
  /** 설명 라벨 */
  label: string;
  /** 테마 (light = 랜딩, dark = 대시보드) */
  variant?: "light" | "dark";
  /** 추가 style */
  style?: React.CSSProperties;
}

export function StatCard({
  value,
  label,
  variant = "light",
  style,
}: StatCardProps) {
  const isLight = variant === "light";

  return (
    <div
      style={{
        background: isLight
          ? "linear-gradient(135deg, #F8FAFF, #F0F4FF)"
          : "#0F172A",
        border: `1px solid ${isLight ? "#DBEAFE" : "#1E293B"}`,
        borderRadius: 16,
        padding: 24,
        textAlign: "center",
        ...style,
      }}
    >
      <div
        style={{
          fontSize: 36,
          fontWeight: 800,
          lineHeight: 1,
          marginBottom: 4,
          ...(isLight
            ? {
                background: "linear-gradient(135deg, var(--fp-primary-subtle0), var(--brand-600))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }
            : { color: "#F1F5F9" }),
        }}
      >
        {value}
      </div>
      <p
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: isLight ? "var(--fp-secondary)" : "#64748B",
        }}
      >
        {label}
      </p>
    </div>
  );
}
