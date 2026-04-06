# US-016: 대량 기획 생성

> **Story ID**: US-016
> **Epic**: Epic 2: 콘텐츠 생성
> **우선순위**: P2
> **작성일**: 2026-03-31
> **Phase**: Phase 5

---

## 개요

여러 주제를 한 번에 입력하여 배치로 콘텐츠를 생성策划한다.

---

## 사용자 스토리

> **As a** 홍보 담당자
> **I want to** 여러 주제의 콘텐츠를 한번에策划
> **So that** 일괄적으로 홍보 일정을 관리

---

## acceptance criteria

### 대량 입력

- [ ] `/ai/bulk-generate` 페이지
- [ ] 테이블 형태 입력 UI
- [ ] 각 행: 주제, 유형(카드뉴스/블로그), 슬라이드 수
- [ ] 행 추가/삭제 가능
- [ ] 최소 1개, 최대 10개まで

### 배치 처리

- [ ] "일괄 생성" 버튼
- [ ] 각 항목 순차/병렬 생성
- [ ] 진행률 표시 (항목별 + 전체)
- [ ] 생성 완료 시 목록 표시
- [ ] 총 크레딧 사용량 표시

### 개별 관리

- [ ] 각 생성 항목별 상태 표시
- [ ] 개별 재시도/삭제 가능
- [ ] 완료된 항목 상세 보기 링크

---

## 구현 참고사항

### 큐 기반 처리

```typescript
// app/api/generate/bulk/route.ts
export async function POST(req: Request) {
  const { items } = await req.json();

  // 각 항목을 큐에 추가
  const results = await Promise.all(
    items.map(async (item) => {
      return {
        id: item.id,
        status: "queued",
        contentId: null,
      };
    })
  );

  // Background job으로 실제 처리
  // Vercel Cron 또는 큐 시스템 활용

  return Response.json({ items: results });
}
```

---

## 테스트 시나리오 (BDD)

자세한 테스트 시나리오는 `docs/bdd/Epic2-content-generation.md` 참조:

- `Scenario: 사용자가 여러 주제의 콘텐츠를 한 번에 생성策划한다`

---

## 추정 시간

**Story Point**: 3

**세부 추정**:
- UI 테이블: 2h
- 큐 로직: 2h
- 진행률 표시: 1h
- 테스트: 1h
