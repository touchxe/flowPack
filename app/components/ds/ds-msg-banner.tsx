/**
 * DsMsgBanner — 성공/에러/경고/정보 메시지 배너
 * settings/profile, notifications, billing에서 공통 사용.
 */
import type { ReactNode } from "react";
import { Check, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { t } from "@/styles/tokens";

type BannerType = "success" | "error" | "warning" | "info";

interface DsMsgBannerProps {
  type: BannerType;
  text: string;
  /** 좌측 커스텀 아이콘 (기본 아이콘 자동 생성) */
  icon?: ReactNode;
}

const ICON_MAP: Record<BannerType, ReactNode> = {
  success: <Check size={15} />,
  error:   <AlertCircle size={15} />,
  warning: <AlertTriangle size={15} />,
  info:    <Info size={15} />,
};

const STYLE_MAP: Record<BannerType, React.CSSProperties> = {
  success: t.success,
  error:   t.error,
  warning: t.warning,
  info:    t.info,
};

export function DsMsgBanner({ type, text, icon }: DsMsgBannerProps) {
  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 13,
        fontWeight: 600,
        marginBottom: 20,
        ...STYLE_MAP[type],
      }}
    >
      {icon ?? ICON_MAP[type]}
      {text}
    </div>
  );
}
