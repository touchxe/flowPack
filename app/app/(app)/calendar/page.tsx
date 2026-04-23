"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Send, Edit, CalendarDays, Clock } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ContentTypeBadge, ContentStatusBadge } from "@/components/common/content-badge";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  isSameDay, addMonths, subMonths, startOfWeek, endOfWeek,
} from "date-fns";
import { ko } from "date-fns/locale";
import { DsPageHeader } from "@/components/ds/ds-page-header";

interface Content {
  id: string; title: string; type: string;
  status: string; scheduledAt: string | null; createdAt: string;
}

const typeMap: Record<string, "carousel" | "blog" | "video" | "bulk"> = {
  CAROUSEL: "carousel", BLOG: "blog", VIDEO: "video", BULK: "bulk",
};
const statusMap: Record<string, "complete" | "draft" | "scheduled" | "archived"> = {
  PUBLISHED: "complete", DRAFT: "draft", SCHEDULED: "scheduled", ARCHIVED: "archived",
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SCHEDULED: { bg: "#EEF2FF", text: "var(--fp-primary-subtle0)", border: "#C7D2FE" },
  PUBLISHED: { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" },
  DRAFT:     { bg: "#F9FAFB", text: "#9CA3AF", border: "#E5E7EB" },
};

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);

  useEffect(() => { fetchContents(); }, [currentMonth]);

  const fetchContents = async () => {
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const res = await fetch(`/api/contents?year=${year}&month=${month}`);
      if (res.ok) { const d = await res.json(); setContents(d.contents); }
      else setContents([]);
    } catch { setContents([]) }
    finally { setLoading(false); }
  };

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }),
  });

  const getContentsForDate = (date: Date) =>
    contents.filter(c => c.scheduledAt && isSameDay(new Date(c.scheduledAt), date));

  const today = new Date();
  const selectedContents = selectedDate ? getContentsForDate(selectedDate) : [];

  // 이번 달 통계
  const thisMonthContents = contents.filter(c => c.scheduledAt && isSameMonth(new Date(c.scheduledAt), currentMonth));
  const scheduledCount = thisMonthContents.filter(c => c.status === "SCHEDULED").length;
  const publishedCount = thisMonthContents.filter(c => c.status === "PUBLISHED").length;

  return (
    <div style={{ padding: "24px 28px" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        .cal-nav-btn { width:34px; height:34px; borderRadius:9px; background:var(--fp-card-bg); border:1.5px solid var(--fp-border); display:flex; alignItems:center; justifyContent:center; cursor:pointer; transition:all 0.15s; color:var(--fp-body); }
        .today-btn { height:34px; padding:0 14px; borderRadius:9px; background:var(--fp-card-bg); border:1.5px solid var(--fp-border); font-size:13px; font-weight:600; cursor:pointer; color:var(--fp-body); transition:all 0.15s; }
        .new-btn { display:inline-flex; align-items:center; gap:7px; height:36px; padding:0 16px; border-radius:9px; font-size:13px; font-weight:700; cursor:pointer; border:none; background:var(--brand-gradient); color:#fff; text-decoration:none; box-shadow:var(--fp-shadow-card); transition:all 0.2s; }
      `}</style>

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
        <DsPageHeader title="콘텐츠 캘린더" desc="예약된 콘텐츠를 확인하고 관리하세요" />
        <Link href="/carousel-lab" className="new-btn"><Plus size={14} /> 새 콘텐츠</Link>
      </div>

      {/* 이번 달 요약 KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "이번 달 전체", value: thisMonthContents.length, color: "var(--fp-primary-subtle0)", bg: "var(--fp-primary-subtle)" },
          { label: "예약됨", value: scheduledCount, color: "var(--fp-warning)", bg: "var(--fp-warning-bg)" },
          { label: "배포 완료", value: publishedCount, color: "var(--fp-success)", bg: "var(--fp-success-bg)" },
        ].map((k, i) => (
          <div key={i} style={{ background: "var(--fp-card-bg)", border: "1.5px solid var(--fp-border)", borderRadius: 12, padding: "14px 18px", boxShadow: "var(--fp-shadow-card)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--fp-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0, marginBottom: 4 }}>{k.label}</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: k.color, margin: 0 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* 캘린더 + 사이드바 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
        {/* 캘린더 본체 */}
        <div style={{ background: "var(--fp-card-bg)", border: "1.5px solid var(--fp-border)", borderRadius: 16, overflow: "hidden" }}>
          {/* 월 네비게이션 */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--fp-border-soft)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--fp-heading)", margin: 0 }}>
              {format(currentMonth, "yyyy년 M월", { locale: ko })}
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} style={{ width: 34, height: 34, borderRadius: 9, background: "var(--fp-card-bg)", border: "1.5px solid var(--fp-border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--fp-body)" }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setCurrentMonth(new Date())} style={{ height: 34, padding: "0 14px", borderRadius: 9, background: "var(--fp-card-bg)", border: "1.5px solid var(--fp-border)", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--fp-body)" }}>
                오늘
              </button>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} style={{ width: 34, height: 34, borderRadius: 9, background: "var(--fp-card-bg)", border: "1.5px solid var(--fp-border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--fp-body)" }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div style={{ padding: "16px" }}>
            {/* 요일 헤더 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 8 }}>
              {WEEKDAYS.map(d => (
                <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--fp-muted)", padding: "6px 0", textTransform: "uppercase" }}>{d}</div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
              {days.map((day, i) => {
                const dayContents = getContentsForDate(day);
                const isThisMonth = isSameMonth(day, currentMonth);
                const isToday = isSameDay(day, today);
                const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;

                return (
                  <div key={i} onClick={() => setSelectedDate(isSelected ? null : day)}
                    style={{
                      minHeight: 80, padding: "6px", borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
                      background: isSelected ? "var(--fp-primary-subtle)" : isToday ? "var(--fp-section-bg)" : "var(--fp-card-bg)",
                      border: `1.5px solid ${isSelected ? "var(--fp-primary-subtle0)" : isToday ? "var(--fp-primary-border)" : "var(--fp-border-soft)"}`,
                      opacity: isThisMonth ? 1 : 0.4,
                    }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4,
                      background: isSelected ? "var(--fp-primary-subtle0)" : "transparent",
                      fontSize: 12, fontWeight: isToday || isSelected ? 800 : 500,
                      color: isSelected ? "#fff" : isToday ? "var(--fp-primary-subtle0)" : "var(--fp-body)",
                    }}>
                      {format(day, "d")}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {dayContents.slice(0, 2).map(c => {
                        const sc = STATUS_COLORS[c.status] || STATUS_COLORS.DRAFT;
                        return (
                          <div key={c.id} onClick={e => { e.stopPropagation(); setSelectedContent(c); }}
                            style={{ fontSize: 10, fontWeight: 600, padding: "2px 5px", borderRadius: 4, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                            {c.title.slice(0, 8)}
                          </div>
                        );
                      })}
                      {dayContents.length > 2 && (
                        <div style={{ fontSize: 10, color: "#9CA3AF", paddingLeft: 2 }}>+{dayContents.length - 2}개</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 범례 */}
            <div style={{ display: "flex", gap: 16, marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--fp-border-soft)" }}>
              {[["예약됨", "#EEF2FF", "var(--fp-primary-subtle0)"], ["배포 완료", "#ECFDF5", "#059669"], ["초안", "#F9FAFB", "#9CA3AF"]].map(([label, bg, color]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: bg, border: `1px solid ${color}30` }} />
                  <span style={{ fontSize: 11, color: "var(--fp-muted)" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 사이드바 */}
        <div style={{ background: "var(--fp-card-bg)", border: "1.5px solid var(--fp-border)", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--fp-border-soft)", display: "flex", alignItems: "center", gap: 8 }}>
            <CalendarDays size={16} color="var(--fp-primary-subtle0)" />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--fp-heading)", margin: 0 }}>
              {selectedDate ? format(selectedDate, "M월 d일 (EEE)", { locale: ko }) : "날짜 선택"}
            </h3>
          </div>
          <div style={{ flex: 1, padding: "14px", overflowY: "auto" }}>
            {!selectedDate ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--fp-muted)", fontSize: 13 }}>
                달력에서 날짜를 선택하세요
              </div>
            ) : selectedContents.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 12 }}>예정된 콘텐츠가 없습니다</p>
                <Link href="/carousel-lab" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--fp-primary-subtle0)", background: "#EEF2FF", padding: "7px 14px", borderRadius: 8, textDecoration: "none" }}>
                  <Plus size={12} /> 새 콘텐츠
                </Link>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selectedContents.map(c => (
                  <div key={c.id} onClick={() => setSelectedContent(c)}
                    style={{ padding: "12px", border: "1.5px solid var(--fp-border)", borderRadius: 12, cursor: "pointer", transition: "all 0.15s", background: "var(--fp-card-bg)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--fp-primary-border)"; (e.currentTarget as HTMLElement).style.background = "var(--fp-section-bg)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--fp-border)"; (e.currentTarget as HTMLElement).style.background = "var(--fp-card-bg)"; }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--fp-heading)", marginBottom: 6, lineHeight: 1.3 }}>{c.title}</p>
                    {c.scheduledAt && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--fp-muted)" }}>
                        <Clock size={11} /> {format(new Date(c.scheduledAt), "HH:mm")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 상세 다이얼로그 */}
      <Dialog open={!!selectedContent} onOpenChange={() => setSelectedContent(null)}>
        <DialogContent style={{ borderRadius: 20, padding: "28px" }}>
          <DialogHeader>
            <DialogTitle style={{ fontSize: 16, fontWeight: 800 }}>{selectedContent?.title}</DialogTitle>
            <DialogDescription style={{ fontSize: 12 }}>콘텐츠 상세 정보</DialogDescription>
          </DialogHeader>
          {selectedContent && (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <ContentTypeBadge type={typeMap[selectedContent.type] || "carousel"} />
                <ContentStatusBadge status={statusMap[selectedContent.status] || "draft"} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20, fontSize: 13 }}>
                <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 14px" }}>
                  <p style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>생성일</p>
                  <p style={{ color: "#111827", fontWeight: 600 }}>{format(new Date(selectedContent.createdAt), "yyyy. MM. dd", { locale: ko })}</p>
                </div>
                {selectedContent.scheduledAt && (
                  <div style={{ background: "#EEF2FF", borderRadius: 10, padding: "10px 14px" }}>
                    <p style={{ color: "var(--fp-primary-subtle0)", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>예약일</p>
                    <p style={{ color: "#111827", fontWeight: 600 }}>{format(new Date(selectedContent.scheduledAt), "MM. dd HH:mm", { locale: ko })}</p>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href={`/content/${selectedContent.id}/edit`} style={{ flex: 1 }}>
                  <button style={{ width: "100%", height: 42, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <Edit size={14} /> 편집
                  </button>
                </Link>
                {selectedContent.status === "SCHEDULED" && (
                  <button style={{ flex: 1, height: 42, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", background: "linear-gradient(135deg,var(--fp-primary-subtle0),var(--fp-primary-subtle0))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}>
                    <Send size={14} /> 지금 배포
                  </button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
