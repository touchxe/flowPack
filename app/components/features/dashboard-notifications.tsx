"use client";

import { useNotifications } from "@/lib/use-notifications";
import { useRouter } from "next/navigation";
import {
  Bell, Sparkles, AlertCircle, Send, XCircle,
  Zap, TrendingUp, CreditCard, Link as LinkIcon, Megaphone,
  ArrowRight,
} from "lucide-react";

/* ── 알림 타입별 아이콘/색상 맵 ── */
const TYPE_STYLES: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  CONTENT_CREATED:  { icon: <Sparkles size={14} />,     color: "var(--brand-500)", bg: "#EEF2FF" },
  CONTENT_FAILED:   { icon: <AlertCircle size={14} />,  color: "#EF4444", bg: "#FEF2F2" },
  PUBLISH_SUCCESS:  { icon: <Send size={14} />,         color: "#059669", bg: "#ECFDF5" },
  PUBLISH_FAILED:   { icon: <XCircle size={14} />,      color: "#DC2626", bg: "#FEF2F2" },
  CREDIT_LOW:       { icon: <Zap size={14} />,          color: "#D97706", bg: "#FFF7ED" },
  CREDIT_EXHAUSTED: { icon: <Zap size={14} />,          color: "#EF4444", bg: "#FEF2F2" },
  VIEW_MILESTONE:   { icon: <TrendingUp size={14} />,   color: "#059669", bg: "#ECFDF5" },
  PAYMENT_SUCCESS:  { icon: <CreditCard size={14} />,   color: "var(--brand-500)", bg: "#EEF2FF" },
  SOCIAL_CONNECTED: { icon: <LinkIcon size={14} />,     color: "#3B82F6", bg: "#EFF6FF" },
  SYSTEM_NOTICE:    { icon: <Megaphone size={14} />,    color: "var(--brand-500)", bg: "#EEF2FF" },
};
const DEFAULT_STYLE = { icon: <Bell size={14} />, color: "#9CA3AF", bg: "#F3F4F6" };

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

/**
 * 대시보드 홈용 알림 인라인 카드
 * — 미읽 알림이 있을 때만 표시
 */
export function DashboardNotifications() {
  const { notifications, unreadCount, isLoading, markAsRead } = useNotifications(5);
  const router = useRouter();

  // 미읽 알림만 필터, 최대 3개
  const unreadItems = notifications.filter((n) => !n.isRead).slice(0, 3);

  // 로딩 중이거나 미읽 알림 없으면 렌더링 안함
  if (isLoading || unreadItems.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Bell size={16} color="var(--brand-500)" />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>최근 알림</h2>
          <span style={{
            fontSize: 11, fontWeight: 700, color: "#fff",
            background: "#EF4444", borderRadius: 9999,
            padding: "1px 7px", lineHeight: "16px",
          }}>
            {unreadCount}
          </span>
        </div>
      </div>

      <div style={{
        background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14,
        overflow: "hidden",
      }}>
        {unreadItems.map((item, idx) => {
          const ts = TYPE_STYLES[item.type] ?? DEFAULT_STYLE;
          return (
            <div
              key={item.id}
              onClick={() => {
                markAsRead(item.id);
                if (item.actionUrl) router.push(item.actionUrl);
              }}
              style={{
                padding: "12px 18px",
                display: "flex", gap: 12, alignItems: "center",
                cursor: item.actionUrl ? "pointer" : "default",
                borderBottom: idx < unreadItems.length - 1 ? "1px solid #F3F4F6" : "none",
                transition: "background 0.12s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#F8F7FF")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {/* 아이콘 */}
              <div style={{
                width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                background: ts.bg, color: ts.color,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {ts.icon}
              </div>

              {/* 내용 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  fontSize: 13, fontWeight: 600, color: "#111827",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  display: "block",
                }}>
                  {item.message}
                </span>
              </div>

              {/* 시간 + CTA */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: "#C4C9D4" }}>{timeAgo(item.createdAt)}</span>
                {item.actionUrl && (
                  <ArrowRight size={13} color="#C4C9D4" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
