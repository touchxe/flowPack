"use client";

import { useState, useEffect, useCallback } from "react";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  metadata?: string | null;
  isRead: boolean;
  createdAt: string;
}

interface UseNotificationsReturn {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * 알림 조회 + 읽음 처리 훅
 * 30초 간격으로 미읽 카운트 자동 폴링
 */
export function useNotifications(limit = 8): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/user/notifications/inbox?limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // 조회 실패 무시
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  // 초기 로드 + 30초 폴링
  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(timer);
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    // 낙관적 UI 업데이트
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch("/api/user/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      // 실패 시 다음 폴링에서 자동 복구
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await fetch("/api/user/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      // 실패 시 다음 폴링에서 자동 복구
    }
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
