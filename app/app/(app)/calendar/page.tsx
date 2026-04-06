"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Send, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContentTypeBadge, ContentStatusBadge } from "@/components/common/content-badge";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { ko } from "date-fns/locale";

interface Content {
  id: string;
  title: string;
  type: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
}

const typeMap: Record<string, "carousel" | "blog" | "video" | "bulk"> = {
  CAROUSEL: "carousel",
  BLOG: "blog",
  VIDEO: "video",
  BULK: "bulk",
};

const statusMap: Record<string, "complete" | "draft" | "scheduled" | "archived"> = {
  PUBLISHED: "complete",
  DRAFT: "draft",
  SCHEDULED: "scheduled",
  ARCHIVED: "archived",
};

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);

  useEffect(() => {
    fetchContents();
  }, [currentMonth]);

  const fetchContents = async () => {
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const res = await fetch(`/api/contents?year=${year}&month=${month}`);
      
      if (res.ok) {
        const data = await res.json();
        setContents(data.contents);
      } else {
        console.error("Failed to fetch contents");
        setContents([]);
      }
    } catch (err) {
      console.error("Failed to fetch contents:", err);
      setContents([]);
    } finally {
      setLoading(false);
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getContentsForDate = (date: Date) => {
    return contents.filter((content) => {
      if (!content.scheduledAt) return false;
      const contentDate = new Date(content.scheduledAt);
      return isSameDay(contentDate, date);
    });
  };

  const weekDays = ["월", "화", "수", "목", "금", "토", "일"];

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <Link
          href="/home"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          홈으로
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">콘텐츠 캘린더</h1>
            <p className="text-muted-foreground mt-2">
              예약된 콘텐츠를 확인하고 관리하세요
            </p>
          </div>
          <Link href="/carousel-lab">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              새 콘텐츠
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-xl">
                {format(currentMonth, "yyyy년 M월", { locale: ko })}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  오늘
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Week days header */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="text-center text-sm font-medium text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((day, index) => {
                  const dayContents = getContentsForDate(day);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div
                      key={index}
                      className={`min-h-24 p-1 border rounded-lg transition-colors cursor-pointer ${
                        isCurrentMonth ? "bg-background" : "bg-muted/30"
                      } ${isToday ? "border-primary" : "border-border"}`}
                      onClick={() => setSelectedDate(day)}
                    >
                      <div
                        className={`text-sm font-medium mb-1 ${
                          isCurrentMonth ? "" : "text-muted-foreground"
                        } ${isToday ? "text-primary" : ""}`}
                      >
                        {format(day, "d")}
                      </div>
                      <div className="space-y-1">
                        {dayContents.slice(0, 2).map((content) => (
                          <div
                            key={content.id}
                            className="text-xs p-1 rounded bg-primary/10 text-primary truncate"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedContent(content);
                            }}
                          >
                            {content.title.slice(0, 10)}
                          </div>
                        ))}
                        {dayContents.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{dayContents.length - 2}개
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-primary/10" />
                  <span className="text-xs text-muted-foreground">예약됨</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-green-100" />
                  <span className="text-xs text-muted-foreground">배포완료</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-yellow-100" />
                  <span className="text-xs text-muted-foreground">초안</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Selected Date Contents */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedDate
                  ? format(selectedDate, "M월 d일", { locale: ko })
                  : "날짜를 선택하세요"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDate ? (
                getContentsForDate(selectedDate).length > 0 ? (
                  <div className="space-y-3">
                    {getContentsForDate(selectedDate).map((content) => (
                      <div
                        key={content.id}
                        className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedContent(content)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <ContentTypeBadge type={typeMap[content.type] || "carousel"} />
                          <ContentStatusBadge status={statusMap[content.status] || "draft"} />
                        </div>
                        <p className="text-sm font-medium">{content.title}</p>
                        {content.scheduledAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(content.scheduledAt), "HH:mm")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">예정된 콘텐츠가 없습니다</p>
                    <Link href="/carousel-lab">
                      <Button variant="outline" size="sm" className="mt-3">
                        <Plus className="h-4 w-4 mr-1" />
                        새 콘텐츠
                      </Button>
                    </Link>
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>좌측 달력에서 날짜를 선택하세요</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Content Detail Dialog */}
      <Dialog open={!!selectedContent} onOpenChange={() => setSelectedContent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedContent?.title}</DialogTitle>
            <DialogDescription>콘텐츠 상세 정보</DialogDescription>
          </DialogHeader>
          {selectedContent && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ContentTypeBadge type={typeMap[selectedContent.type] || "carousel"} />
                <ContentStatusBadge status={statusMap[selectedContent.status] || "draft"} />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">생성일</p>
                  <p className="font-medium">
                    {format(new Date(selectedContent.createdAt), "yyyy년 M월 d일", { locale: ko })}
                  </p>
                </div>
                {selectedContent.scheduledAt && (
                  <div>
                    <p className="text-muted-foreground">예약일</p>
                    <p className="font-medium">
                      {format(new Date(selectedContent.scheduledAt), "yyyy년 M월 d일 HH:mm", { locale: ko })}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Link href={`/content/${selectedContent.id}/edit`} className="flex-1">
                  <Button variant="outline" className="w-full">
                    <Edit className="h-4 w-4 mr-2" />
                    편집
                  </Button>
                </Link>
                {selectedContent.status === "SCHEDULED" && (
                  <Button className="flex-1">
                    <Send className="h-4 w-4 mr-2" />
                    지금 배포
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
