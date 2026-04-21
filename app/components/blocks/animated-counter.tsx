"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * AnimatedCounter — 스크롤 진입 시 숫자가 카운트업되는 컴포넌트.
 * IntersectionObserver 기반으로 뷰포트 진입 시 애니메이션 시작.
 */
export interface AnimatedCounterProps {
  /** 목표 숫자 */
  target: number;
  /** 숫자 뒤 접미사 (예: "+", "%", "분") */
  suffix?: string;
  /** 숫자 앞 접두사 (예: "₩", "$") */
  prefix?: string;
  /** 애니메이션 지속시간 (ms, 기본: 1800) */
  duration?: number;
  /** 추가 style */
  style?: React.CSSProperties;
  /** 추가 className */
  className?: string;
}

export function AnimatedCounter({
  target,
  suffix = "",
  prefix = "",
  duration = 1800,
  style,
  className,
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || hasAnimated.current) return;
        hasAnimated.current = true;
        observer.disconnect();

        let start = 0;
        const step = target / (duration / 16);
        const timer = setInterval(() => {
          start += step;
          if (start >= target) {
            setCount(target);
            clearInterval(timer);
          } else {
            setCount(Math.floor(start));
          }
        }, 16);
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return (
    <span ref={ref} className={className} style={style}>
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}
