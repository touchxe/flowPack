"use client";

import React from "react";

/**
 * ProblemCard — 사용자 페인포인트 카드.
 * 랜딩 "이런 고민, 있으신가요?" 섹션 등에서 사용.
 */
export interface ProblemCardProps {
  /** 아이콘 ReactNode */
  icon: React.ReactNode;
  /** 제목 */
  title: string;
  /** 설명 (줄바꿈 포함 가능) */
  desc: string;
  /** 추가 style */
  style?: React.CSSProperties;
}

export function ProblemCard({ icon, title, desc, style }: ProblemCardProps) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--fp-border-soft)",
        borderRadius: 16,
        padding: 24,
        transition: "all 0.25s ease",
        cursor: "default",
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
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "#FEF2F2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
          color: "#DC2626",
        }}
      >
        {icon}
      </div>

      {/* 제목 */}
      <p style={{ fontSize: 16, fontWeight: 700, color: "var(--fp-heading)", marginBottom: 8 }}>
        {title}
      </p>

      {/* 설명 */}
      <p style={{ fontSize: 14, color: "var(--fp-secondary)", lineHeight: 1.6, whiteSpace: "pre-line" }}>
        {desc}
      </p>
    </div>
  );
}
