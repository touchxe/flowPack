"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

/**
 * KpiCard — 관리자 대시보드용 KPI 카드.
 * 다크/라이트 테마 variant 지원. 이전 대비 성장률 표시.
 */
export interface KpiCardProps {
  /** 카드 제목 (예: "총 가입자") */
  title: string;
  /** 메인 값 (숫자 또는 문자열) */
  value: string | number;
  /** 보조 설명 */
  sub: string;
  /** 전월 대비 성장률 (%) */
  growth?: number | null;
  /** 아이콘 컴포넌트 */
  icon: React.ElementType;
  /** 액센트 색상 */
  accent: string;
  /** 테마 (기본: dark) */
  variant?: "light" | "dark";
  /** 추가 style */
  style?: React.CSSProperties;
}

export function KpiCard({
  title,
  value,
  sub,
  growth,
  icon: Icon,
  accent,
  variant = "dark",
  style,
}: KpiCardProps) {
  const isDark = variant === "dark";

  return (
    <div
      style={{
        background: isDark ? "#0F172A" : "#fff",
        border: `1px solid ${isDark ? "#1E293B" : "var(--fp-border-soft)"}`,
        borderRadius: 16,
        padding: "20px 22px",
        transition: "all 0.2s",
        ...style,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = accent + "60";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = isDark ? "#1E293B" : "var(--fp-border-soft)";
      }}
    >
      {/* 헤더: 제목 + 아이콘 */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: isDark ? "#64748B" : "var(--fp-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
          }}
        >
          {title}
        </p>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: accent + "20",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={16} color={accent} />
        </div>
      </div>

      {/* 메인 값 */}
      <p
        style={{
          fontSize: 30,
          fontWeight: 800,
          color: isDark ? "#F1F5F9" : "var(--fp-heading)",
          marginBottom: 4,
        }}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>

      {/* 보조 텍스트 */}
      <p style={{ fontSize: 11, color: isDark ? "#475569" : "var(--fp-muted)" }}>{sub}</p>

      {/* 성장률 */}
      {growth !== undefined && growth !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 10 }}>
          {growth > 0 ? (
            <TrendingUp size={12} color="#10b981" />
          ) : growth < 0 ? (
            <TrendingDown size={12} color="#ef4444" />
          ) : (
            <Minus size={12} color={isDark ? "#475569" : "var(--fp-muted)"} />
          )}
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: growth > 0 ? "#10b981" : growth < 0 ? "#ef4444" : isDark ? "#475569" : "var(--fp-muted)",
            }}
          >
            {growth > 0 ? "+" : ""}
            {growth}% 전월 대비
          </span>
        </div>
      )}
    </div>
  );
}
