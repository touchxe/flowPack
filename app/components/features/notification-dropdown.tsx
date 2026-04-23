"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, Check, CheckCheck, Sparkles, AlertCircle, Send, XCircle,
  Zap, TrendingUp, CreditCard, Link as LinkIcon, Megaphone,
} from "lucide-react";
import { useNotifications, type NotificationItem } from "@/lib/use-notifications";

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

/* ── 시간 포맷 ── */
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

/* ── 알림 드롭다운 ── */
export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleItemClick = (item: NotificationItem) => {
    if (!item.isRead) markAsRead(item.id);
    if (item.actionUrl) {
      setOpen(false);
      router.push(item.actionUrl);
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* 벨 버튼 */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: 34, height: 34, borderRadius: 8,
          background: open ? "#F1F5F9" : "none",
          border: `1px solid ${open ? "#CBD5E1" : "#E2E8F0"}`,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          color: open ? "#3B82F6" : "#94A3B8", transition: "all 0.15s",
        }}
        onMouseEnter={e => {
          if (!open) {
            e.currentTarget.style.background = "#F8FAFC";
            e.currentTarget.style.color = "#3B82F6";
            e.currentTarget.style.borderColor = "#CBD5E1";
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.background = "none";
            e.currentTarget.style.color = "#94A3B8";
            e.currentTarget.style.borderColor = "#E2E8F0";
          }
        }}
      >
        <Bell size={15} />
      </button>

      {/* 미읽 뱃지 */}
      {unreadCount > 0 && (
        <span style={{
          position: "absolute", top: -3, right: -3,
          minWidth: 15, height: 15, borderRadius: "50%",
          background: "#EF4444", color: "#fff",
          fontSize: 9, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "2px solid #fff", padding: "0 2px",
        }}>
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}

      {/* 드롭다운 패널 */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: 380, maxHeight: 480,
          background: "#fff", borderRadius: 16,
          boxShadow: "0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          animation: "notifDropIn 0.2s ease",
          zIndex: 100,
        }}>
          <style>{`
            @keyframes notifDropIn {
              from { opacity: 0; transform: translateY(-6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {/* 헤더 */}
          <div style={{
            padding: "14px 18px", borderBottom: "1px solid #F3F4F6",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>알림</span>
              {unreadCount > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 700, color: "#fff",
                  background: "#3B82F6", borderRadius: 9999,
                  padding: "1px 7px", lineHeight: "16px",
                }}>
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, color: "var(--brand-500)",
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "4px 8px", borderRadius: 6,
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#EEF2FF")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                <CheckCheck size={13} /> 모두 읽음
              </button>
            )}
          </div>

          {/* 알림 목록 */}
          <div style={{ flex: 1, overflowY: "auto", maxHeight: 380 }}>
            {isLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                불러오는 중...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{
                padding: "48px 20px", textAlign: "center",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: "#F3F4F6", display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Bell size={20} color="#D1D5DB" />
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", margin: 0 }}>
                  새로운 알림이 없습니다
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const ts = TYPE_STYLES[item.type] ?? DEFAULT_STYLE;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    style={{
                      padding: "12px 18px",
                      display: "flex", gap: 12, alignItems: "flex-start",
                      cursor: item.actionUrl ? "pointer" : "default",
                      background: item.isRead ? "transparent" : "#F8FAFC",
                      borderBottom: "1px solid #F9FAFB",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#F1F5F9")}
                    onMouseLeave={e => (e.currentTarget.style.background = item.isRead ? "transparent" : "#F8FAFC")}
                  >
                    {/* 아이콘 */}
                    <div style={{
                      width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                      background: ts.bg, color: ts.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      marginTop: 2,
                    }}>
                      {ts.icon}
                    </div>

                    {/* 내용 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        {!item.isRead && (
                          <div style={{
                            width: 6, height: 6, borderRadius: "50%",
                            background: "#3B82F6", flexShrink: 0,
                          }} />
                        )}
                        <span style={{
                          fontSize: 13, fontWeight: item.isRead ? 500 : 700,
                          color: "#111827",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {item.title}
                        </span>
                      </div>
                      <p style={{
                        fontSize: 12, color: "#6B7280", margin: 0,
                        lineHeight: 1.4,
                        display: "-webkit-box", WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}>
                        {item.message}
                      </p>
                      <span style={{ fontSize: 11, color: "#C4C9D4", marginTop: 4, display: "block" }}>
                        {timeAgo(item.createdAt)}
                      </span>
                    </div>

                    {/* 읽음 체크 */}
                    {!item.isRead && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markAsRead(item.id); }}
                        title="읽음 처리"
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "#D1D5DB", padding: 4, borderRadius: 6,
                          display: "flex", marginTop: 2, flexShrink: 0,
                          transition: "color 0.12s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = "var(--brand-500)")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#D1D5DB")}
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* 풋터 */}
          {notifications.length > 0 && (
            <div style={{
              padding: "10px 18px", borderTop: "1px solid #F3F4F6",
              textAlign: "center",
            }}>
              <button
                onClick={() => { setOpen(false); router.push("/settings/notifications"); }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, color: "var(--brand-500)",
                  padding: "4px 8px", borderRadius: 6,
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#EEF2FF")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                알림 설정
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
