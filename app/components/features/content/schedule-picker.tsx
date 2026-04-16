"use client";

// 발행 일정 선택 컴포넌트 — 즉시 배포 / 예약 배포 토글
import { useState } from "react";
import { CalendarDays, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface SchedulePickerProps {
  /** 부모에서 받은 현재 예약일 (없으면 undefined = 즉시 배포) */
  value: string | undefined;
  /** 값이 바뀔 때 호출 — undefined이면 즉시 배포 */
  onChange: (value: string | undefined) => void;
  /** 비활성화 여부 */
  disabled?: boolean;
  className?: string;
}

export function SchedulePicker({ value, onChange, disabled, className }: SchedulePickerProps) {
  const isScheduled = value !== undefined;

  // datetime-local 최솟값 (현재 시간)
  const minDateTime = new Date();
  minDateTime.setMinutes(minDateTime.getMinutes() + 5); // 최소 5분 후
  const minStr = minDateTime.toISOString().slice(0, 16);

  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 space-y-3", className)}>
      <div className="flex items-center gap-2 mb-1">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">발행 일정</span>
      </div>

      {/* 즉시 / 예약 탭 */}
      <div className="flex rounded-lg overflow-hidden border border-border text-sm">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(undefined)}
          className={cn(
            "flex-1 py-2 px-3 transition-colors font-medium",
            !isScheduled
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted"
          )}
        >
          즉시 배포
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            // 예약 선택 시 기본값: 현재 시간 + 1시간
            const d = new Date();
            d.setHours(d.getHours() + 1, 0, 0, 0);
            onChange(d.toISOString().slice(0, 16));
          }}
          className={cn(
            "flex-1 py-2 px-3 transition-colors font-medium",
            isScheduled
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted"
          )}
        >
          예약 배포
        </button>
      </div>

      {/* 예약 시 날짜/시간 입력 */}
      {isScheduled && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="schedule-datetime" className="text-xs flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              예약 날짜·시간
            </Label>
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="text-muted-foreground hover:text-foreground"
              title="예약 취소"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <input
            id="schedule-datetime"
            type="datetime-local"
            value={value}
            min={minStr}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value || undefined)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          {value && (
            <p className="text-xs text-primary font-medium">
              📅 {new Date(value).toLocaleString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })} 발행 예약됨
            </p>
          )}
        </div>
      )}
    </div>
  );
}
