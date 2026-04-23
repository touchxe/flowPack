"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * CtaBanner — CTA 배너 블록.
 * 그라디언트/솔리드 배경 + 제목 + 서브 + 버튼.
 */
export interface CtaBannerProps {
  /** 메인 제목 */
  title: React.ReactNode;
  /** 서브 문구 */
  subtitle?: string;
  /** CTA 버튼 텍스트 */
  buttonText?: string;
  /** CTA 버튼 링크 */
  buttonHref?: string;
  /** 배경 스타일 (기본: gradient) */
  variant?: "gradient" | "dark" | "mint";
  /** 추가 style */
  style?: React.CSSProperties;
}

const VARIANT_STYLES: Record<string, { bg: string; textColor: string; subColor: string; btnBg: string; btnColor: string }> = {
  gradient: {
    bg: "linear-gradient(135deg, #1D4ED8, var(--brand-600))",
    textColor: "#fff",
    subColor: "rgba(255,255,255,0.7)",
    btnBg: "#fff",
    btnColor: "#2563EB",
  },
  dark: {
    bg: "#131313",
    textColor: "#fff",
    subColor: "#949494",
    btnBg: "var(--brand-500)",
    btnColor: "#000",
  },
  mint: {
    bg: "var(--brand-500)",
    textColor: "#000",
    subColor: "rgba(0,0,0,0.6)",
    btnBg: "#131313",
    btnColor: "var(--brand-500)",
  },
};

export function CtaBanner({
  title,
  subtitle,
  buttonText = "무료 체험 시작하기",
  buttonHref = "/register",
  variant = "gradient",
  style,
}: CtaBannerProps) {
  const v = VARIANT_STYLES[variant];

  return (
    <div
      style={{
        borderRadius: 20,
        padding: "48px 40px",
        background: v.bg,
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* 배경 장식 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(255,255,255,0.1), transparent)",
          pointerEvents: "none",
        }}
      />

      <p
        style={{
          fontSize: "clamp(20px, 3vw, 28px)",
          fontWeight: 800,
          color: v.textColor,
          marginBottom: 8,
          position: "relative",
        }}
      >
        {title}
      </p>

      {subtitle && (
        <p
          style={{
            fontSize: 15,
            color: v.subColor,
            marginBottom: 28,
            position: "relative",
          }}
        >
          {subtitle}
        </p>
      )}

      <Link
        href={buttonHref}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: 48,
          padding: "0 28px",
          borderRadius: 12,
          border: "none",
          background: v.btnBg,
          color: v.btnColor,
          fontSize: 15,
          fontWeight: 700,
          textDecoration: "none",
          position: "relative",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
      >
        {buttonText} <ArrowRight size={16} />
      </Link>
    </div>
  );
}
