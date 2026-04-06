# US-030: 포스팅별 조회수 확인

> **Story ID**: US-030
> **Epic**: Epic 4: 통계 & 관리
> **优先순위**: P0
> **작성일**: 2026-03-31
> **Phase**: Phase 5

---

## 개요

사용자가 대시보드에서 전체 통계와 개별 콘텐츠별 성과를 확인한다.

---

## 사용자 스토리

> **As a** 홍보 담당자
> **I want to** 콘텐츠 성과를 확인
> **So that** 어떤 콘텐츠가 잘 되는지 파악

---

## acceptance criteria

### 대시보드 통계

- [ ] `/home` 페이지에 통계 카드 표시
- [ ] 이번 달 생성 수
- [ ] 총 조회수
- [ ] 배포 완료 수
- [ ] 전월 대비 trend 표시

### 상세 통계 페이지

- [ ] `/analytics` 페이지
- [ ] 기간 선택 (7일/30일/90일)
- [ ] 플랫폼별 성능 테이블
- [ ] 일별 추이 그래프 (Chart.js 또는 Recharts)

### 콘텐츠별 상세

- [ ] 특정 콘텐츠 클릭 시 상세 모달
- [ ] 플랫폼별 조회수/좋아요/공유
- [ ] 일별 추이 그래프

---

## 구현 참고사항

### Analytics API

```typescript
// app/api/analytics/route.ts
export async function GET(req: Request) {
  const session = await auth();
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "30d";

  const startDate = getStartDate(period);

  // 집계 쿼리
  const summary = await prisma.content.aggregate({
    where: {
      userId: session.user.id,
      createdAt: { gte: startDate },
    },
    _count: true,
  });

  const byPlatform = await prisma.analytics.groupBy({
    by: ["platform"],
    where: { recordedAt: { gte: startDate } },
    _sum: { viewCount: true, likeCount: true, shareCount: true },
  });

  const byDate = await prisma.$queryRaw`
    SELECT DATE(createdAt) as date, COUNT(*) as created
    FROM contents
    WHERE userId = ${session.user.id}
    AND createdAt >= ${startDate}
    GROUP BY DATE(createdAt)
  `;

  return Response.json({
    summary: {
      totalCreated: summary._count,
      totalPublished: /* ... */,
      totalViews: /* ... */,
    },
    byPlatform,
    byDate,
  });
}
```

### 차트 라이브러리

Recharts 사용 (Tailwind 친화적)

---

## 의존성

- `recharts` (`npm i recharts`)

---

## 추정 시간

**Story Point**: 5

**세부 추정**:
- API + 집계 쿼리: 2h
- 대시보드 카드: 1h
- 차트: 2h
- 상세 모달: 1h
- 테스트: 1h
