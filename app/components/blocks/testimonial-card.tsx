"use client";

import React from "react";

/**
 * TestimonialCard — 사용자 후기 카드.
 * 아바타 + 이름 + 핸들 + 역할 + 본문 + 좋아요 수.
 */
export interface TestimonialCardProps {
  /** 표시 이름 */
  name: string;
  /** SNS 핸들 (예: @devoutsource_kim) */
  handle: string;
  /** 직함/역할 */
  role: string;
  /** 아바타 텍스트 (이니셜) */
  avatar: string;
  /** 후기 본문 */
  content: string;
  /** 좋아요 수 */
  likes?: number;
  /** 추가 style */
  style?: React.CSSProperties;
}

export function TestimonialCard({
  name,
  handle,
  role,
  avatar,
  content,
  likes,
  style,
}: TestimonialCardProps) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--fp-border-soft)",
        borderRadius: 16,
        padding: 24,
        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        transition: "all 0.25s ease",
        ...style,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "#C7D2FE";
        el.style.boxShadow = "0 8px 24px rgba(99,102,241,0.08)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "var(--fp-border-soft)";
        el.style.boxShadow = "0 2px 12px rgba(0,0,0,0.04)";
      }}
    >
      {/* 프로필 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--fp-primary-subtle0), var(--brand-600))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          {avatar}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--fp-heading)" }}>{name}</p>
          <p style={{ fontSize: 12, color: "var(--fp-muted)" }}>
            @{handle} · {role}
          </p>
        </div>
        <div style={{ color: "#FBBF24", fontSize: 13, flexShrink: 0 }}>★★★★★</div>
      </div>

      {/* 본문 */}
      <p style={{ fontSize: 14, color: "var(--fp-body)", lineHeight: 1.6, marginBottom: likes ? 12 : 0 }}>
        {content}
      </p>

      {/* 좋아요 */}
      {likes !== undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--fp-muted)" }}>
          <span>♥</span>
          <span style={{ fontWeight: 600 }}>{likes.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
