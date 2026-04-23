"use client";

import React from "react";

/**
 * PlanBadge — 구독 플랜 배지.
 * 관리자 대시보드, 사용자 목록 등에서 사용.
 */
export interface PlanBadgeProps {
  /** 플랜 코드 (FREE, STARTER, PRO, ENTERPRISE) */
  plan: string;
  /** 추가 style */
  style?: React.CSSProperties;
}

const PLAN_COLORS: Record<string, string> = {
  FREE: "#64748b",
  STARTER: "var(--fp-primary-subtle0)",
  PRO: "var(--fp-primary-subtle0)",
  ENTERPRISE: "#F59E0B",
};

const PLAN_LABELS: Record<string, string> = {
  FREE: "FREE",
  STARTER: "STARTER",
  PRO: "PRO",
  ENTERPRISE: "ENT",
};

export function PlanBadge({ plan, style }: PlanBadgeProps) {
  const color = PLAN_COLORS[plan] ?? "#64748b";
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 800,
        color,
        background: color + "20",
        padding: "2px 8px",
        borderRadius: 5,
        textTransform: "uppercase",
        ...style,
      }}
    >
      {PLAN_LABELS[plan] ?? plan}
    </span>
  );
}

/**
 * StatusDot — 콘텐츠/아이템 상태 인디케이터.
 */
export interface StatusDotProps {
  /** 상태 코드 (DRAFT, SCHEDULED, PUBLISHED, ARCHIVED) */
  status: string;
  /** 추가 style */
  style?: React.CSSProperties;
}

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "초안", color: "#64748b" },
  SCHEDULED: { label: "예약", color: "#F59E0B" },
  PUBLISHED: { label: "발행", color: "#10b981" },
  ARCHIVED: { label: "보관", color: "#475569" },
};

export function StatusDot({ status, style }: StatusDotProps) {
  const cfg = STATUS_CFG[status] ?? { label: status, color: "#64748b" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 700,
        color: cfg.color,
        ...style,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: cfg.color,
          display: "inline-block",
        }}
      />
      {cfg.label}
    </span>
  );
}
