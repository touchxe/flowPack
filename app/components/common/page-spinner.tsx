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
    <div className="flex min-h-[400px] animate-fade-in flex-col items-center justify-center gap-5">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500 shadow-glow">
        <Loader2 size={28} className="animate-spin text-black" />
      </div>

      <span className="text-base font-semibold text-fp-muted">
        {label}
      </span>
    </div>
  );
}
