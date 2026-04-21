"use client";

import React from "react";

/**
 * ChartPanel — 차트/피드를 감싸는 다크 테마 패널.
 * 관리자 대시보드, 분석 페이지 등에서 사용.
 */
export interface ChartPanelProps {
  /** 패널 제목 */
  title?: string;
  /** 제목 좌측 아이콘 */
  icon?: React.ReactNode;
  /** 테마 (기본: dark) */
  variant?: "light" | "dark";
  /** 자식 요소 */
  children: React.ReactNode;
  /** 추가 style */
  style?: React.CSSProperties;
}

export function ChartPanel({
  title,
  icon,
  variant = "dark",
  children,
  style,
}: ChartPanelProps) {
  const isDark = variant === "dark";

  return (
    <div
      style={{
        background: isDark ? "#0F172A" : "#fff",
        border: `1px solid ${isDark ? "#1E293B" : "var(--fp-border-soft)"}`,
        borderRadius: 16,
        padding: "18px 20px",
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {icon}
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: isDark ? "#CBD5E1" : "var(--fp-heading)",
            }}
          >
            {title}
          </p>
        </div>
      )}
      {children}
    </div>
  );
}
