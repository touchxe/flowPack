"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * FaqAccordion — FAQ 아코디언.
 * 질문 클릭 시 슬라이드-다운 답변 표시.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqAccordionProps {
  /** FAQ 목록 */
  items: FaqItem[];
  /** 추가 style (외부 래퍼) */
  style?: React.CSSProperties;
}

export function FaqAccordion({ items, style }: FaqAccordionProps) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, ...style }}>
      {items.map((faq, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            style={{
              borderBottom: "1px solid var(--fp-border-soft)",
              overflow: "hidden",
            }}
          >
            {/* 질문 버튼 */}
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "20px 0",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--fp-heading)",
                  flex: 1,
                  paddingRight: 16,
                }}
              >
                {faq.q}
              </span>
              <ChevronDown
                size={18}
                color="var(--fp-muted)"
                style={{
                  transition: "transform 0.2s ease",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0)",
                  flexShrink: 0,
                }}
              />
            </button>

            {/* 답변 (확장) */}
            <div
              style={{
                maxHeight: isOpen ? 400 : 0,
                opacity: isOpen ? 1 : 0,
                transition: "max-height 0.3s ease, opacity 0.2s ease",
                overflow: "hidden",
              }}
            >
              <p
                style={{
                  fontSize: 14,
                  color: "var(--fp-secondary)",
                  lineHeight: 1.7,
                  paddingBottom: 20,
                }}
              >
                {faq.a}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
