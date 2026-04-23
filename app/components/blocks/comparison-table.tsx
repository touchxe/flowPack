"use client";

import React from "react";

/**
 * ComparisonTable — 두 옵션 비교 카드 (Before/After 또는 경쟁사/당사).
 */
export interface ComparisonItem {
  label: string;
  value: string;
}

export interface ComparisonTableProps {
  /** 왼쪽(비추천) 옵션 */
  left: {
    title: string;
    badge?: string;
    items: ComparisonItem[];
    accentColor?: string;
  };
  /** 오른쪽(추천) 옵션 */
  right: {
    title: string;
    badge?: string;
    items: ComparisonItem[];
    accentColor?: string;
  };
  /** 추가 style */
  style?: React.CSSProperties;
}

export function ComparisonTable({ left, right, style }: ComparisonTableProps) {
  const leftAccent = left.accentColor || "#DC2626";
  const rightAccent = right.accentColor || "var(--fp-primary-subtle0)";

  const renderColumn = (
    col: ComparisonTableProps["left"],
    accent: string,
    isRecommended: boolean
  ) => (
    <div
      style={{
        background: "#fff",
        border: isRecommended ? `2px solid ${accent}` : `1.5px solid ${accent}30`,
        borderRadius: 20,
        padding: 32,
        position: "relative",
        overflow: "hidden",
        boxShadow: isRecommended ? `0 8px 24px ${accent}20` : "none",
      }}
    >
      {/* 뱃지 */}
      {col.badge && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            background: isRecommended ? accent : `${accent}20`,
            color: isRecommended ? "#fff" : accent,
            fontSize: 11,
            fontWeight: 700,
            padding: "4px 12px",
            borderBottomLeftRadius: 10,
          }}
        >
          {col.badge}
        </div>
      )}

      <h3
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--fp-heading)",
          marginBottom: 20,
        }}
      >
        {col.title}
      </h3>

      {col.items.map((item) => (
        <div
          key={item.label}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "8px 0",
            borderBottom: "1px solid var(--fp-border-soft)",
          }}
        >
          <span style={{ fontSize: 14, color: "var(--fp-secondary)" }}>{item.label}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: accent }}>{item.value}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 24,
        ...style,
      }}
    >
      {renderColumn(left, leftAccent, false)}
      {renderColumn(right, rightAccent, true)}
    </div>
  );
}
