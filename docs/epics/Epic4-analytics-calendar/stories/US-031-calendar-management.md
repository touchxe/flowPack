# US-031: 콘텐츠 캘린더 예약·관리

> **Story ID**: US-031
> **Epic**: Epic 4: 통계 & 관리
> **优先순위**: P0
> **작성일**: 2026-03-31
> **Phase**: Phase 5

---

## 개요

사용자가 월간/주간 캘린더에서 예약된 콘텐츠를 확인하고 관리한다.

---

## 사용자 스토리

> **As a** 홍보 담당자
> **I want to** 예약된 콘텐츠를 캘린더에서 관리
> **So that** 콘텐츠 일정을 한눈에 파악

---

## acceptance criteria

### 캘린더 뷰

- [ ] `/calendar` 페이지
- [ ] 월간/주간 뷰 토글
- [ ] 예약된 콘텐츠가 해당 날짜에 표시
- [ ] 콘텐츠 제목 + 상태 배지

### 예약 관리

- [ ] 예약 항목 클릭 시 상세/편집
- [ ] 드래그로 날짜 변경
- [ ] 예약 시간 변경
- [ ] "지금 배포" 버튼
- [ ] "취소" 버튼 → 초안으로 복귀

### Vercel Cron

- [ ] 매일 자정 Cron 실행
- [ ] 예약 시간이 지난 항목 자동 배포
- [ ] 배포 완료 알림 발송

---

## 구현 참고사항

### 캘린더 컴포넌트

```typescript
// components/features/calendar/calendar-view.tsx
import { Calendar } from "@/components/ui/calendar";

function ContentCalendar() {
  const [date, setDate] = useState<Date>(new Date());

  return (
    <div className="flex gap-4">
      <Calendar
        mode="single"
        selected={date}
        onSelect={setDate}
        className="rounded-md border"
        modifiers={{
          hasContent: getDatesWithContent(),
        }}
        modifiersClassNames={{
          hasContent: "bg-primary text-primary-foreground",
        }}
      />
      <ContentList date={date} />
    </div>
  );
}
```

### 예약 배포 Cron

```typescript
// app/api/cron/scheduled-publish/route.ts
export async function POST(req: Request) {
  // Vercel Cron 헤더 검증
  if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const scheduledContents = await prisma.content.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: now },
    },
    include: { user: true },
  });

  for (const content of scheduledContents) {
    await publishContent(content);
    await prisma.content.update({
      where: { id: content.id },
      data: { status: "PUBLISHED", publishedAt: now },
    });
  }

  return Response.json({ processed: scheduledContents.length });
}
```

---

## 의존성

- `date-fns` (날짜 처리)

---

## 추정 시간

**Story Point**: 5

**세부 추정**:
- 캘린더 UI: 3h
- 드래그 앤 드롭: 2h
- Cron 설정: 1h
- 테스트: 1h
