"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * 페이지 로딩 스피너
 *
 * 사용법:
 * 1. Server Component → loading.tsx에서 export
 * 2. Client Component → { loading && <PageSpinner /> }
 *
 * @param label  표시 문구 (기본: "불러오는 중...")
 * @param delay  딜레이(ms) — 깜빡임 방지용, 기본 0
 */
interface PageSpinnerProps {
  label?: string;
  delay?: number;
}

export function PageSpinner({ label = "불러오는 중...", delay = 0 }: PageSpinnerProps) {
  const [visible, setVisible] = useState(delay === 0);

  useEffect(() => {
    if (delay > 0) {
      const timer = setTimeout(() => setVisible(true), delay);
      return () => clearTimeout(timer);
    }
  }, [delay]);

  if (!visible) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 400,
        gap: 16,
        animation: "fp-spinner-in 0.3s ease",
      }}
    >
      <style>{`
        @keyframes fp-spinner-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fp-spinner-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.25); }
          50%      { box-shadow: 0 0 0 12px rgba(99,102,241,0); }
        }
      `}</style>

      {/* 브랜드 아이콘 래퍼 */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "linear-gradient(135deg, var(--fp-primary-subtle0, #6366F1), var(--fp-primary-subtle0, #22D3EE))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "fp-spinner-pulse 1.8s ease-in-out infinite",
        }}
      >
        <Loader2 size={24} color="#fff" className="animate-spin" />
      </div>

      {/* 라벨 */}
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "#9CA3AF",
          letterSpacing: "-0.01em",
        }}
      >
        {label}
      </span>
    </div>
  );
}
