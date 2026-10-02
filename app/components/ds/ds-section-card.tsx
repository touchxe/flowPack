/**
 * DsSectionCard — 설정 페이지 공통 섹션 카드
 * 아이콘 + 제목 + 설명 헤더가 있는 카드 컨테이너.
 * settings/profile의 SettingSection, notifications의 NotifSection,
 * billing의 .section-card를 대체합니다.
 */
import type { ReactNode } from "react";
import { card, iconBox } from "@/styles/tokens";

interface DsSectionCardProps {
  icon: ReactNode;
  title: string;
  desc: string;
  /** 카드에 적용할 아이콘 배경 색상 (기본: var(--fp-primary-subtle)) */
  iconBg?: string;
  /** 카드 자체에 추가할 인라인 스타일 */
  style?: React.CSSProperties;
  /** 하단에 마진을 줄지 여부 (기본: true → marginBottom 16) */
  bottomMargin?: boolean;
  children: ReactNode;
}

export function DsSectionCard({
  icon,
  title,
  desc,
  iconBg,
  style,
  bottomMargin = true,
  children,
}: DsSectionCardProps) {
  return (
    <div style={{ ...card, marginBottom: bottomMargin ? 16 : 0, ...style }}>
      <div className="flex items-center gap-3 border-b border-fp-border-soft px-4 pb-3.5 pt-4 sm:px-[22px] sm:pt-[18px]">
        <div style={{ ...iconBox, ...(iconBg ? { background: iconBg } : {}) }}>
          {icon}
        </div>
        <div className="min-w-0 break-words">
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--fp-heading)", margin: 0 }}>
            {title}
          </p>
          <p style={{ fontSize: 12, color: "var(--fp-muted)", margin: 0 }}>
            {desc}
          </p>
        </div>
      </div>
      <div className="min-w-0 p-4 sm:px-6 sm:py-5">{children}</div>
    </div>
  );
}
