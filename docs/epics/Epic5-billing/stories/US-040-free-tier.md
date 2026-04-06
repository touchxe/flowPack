# US-040: 무료 티어 사용

> **Story ID**: US-040
> **Epic**: Epic 5: 결제
> **优先순위**: P0
> **작성일**: 2026-03-31
> **Phase**: Phase 5

---

## 개요

새 사용자는 무료 티어로 시작하며 월간 크레딧을 부여받는다.

---

## 사용자 스토리

> **As a** 잠재 사용자
> **I want to** 무료로 FlowPack을Trial
> **So that**付费 전에 서비스를 체험

---

## acceptance criteria

### 무료 티어 시작

- [ ] 회원가입 시 플랜이 "FREE"로 설정
- [ ] 초기 크레딧 10건 부여
- [ ] 대시보드에 크레딧 잔액 표시

### 크레딧 표시

- [ ] 상단 네비게이션 또는 대시보드에 "3/10건" 표시
- [ ] 크레딧 잔액 클릭 시 상세 팝오버
- [ ] 사용 내역 표시

### 월간 리셋

- [ ] 매월 1일 크레딧 자동 리셋
- [ ] 리셋 시 알림 발송

---

## 구현 참고사항

### 크레딧 로직

```typescript
// server/services/credit-service.ts
export async function checkAndUseCredit(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const remaining = (user.creditsTotal - user.creditsUsed);

  if (remaining <= 0) {
    throw new CreditExhaustedError();
  }

  await prisma.user.update({
    where: { id: userId },
    data: { creditsUsed: { increment: 1 } },
  });
}

export async function resetMonthlyCredits() {
  // Vercel Cron: 매월 1일 실행
  const users = await prisma.user.findMany({
    where: {
      plan: "FREE",
      creditsResetAt: {
        lt: startOfCurrentMonth(),
      },
    },
  });

  await Promise.all(
    users.map((user) =>
      prisma.user.update({
        where: { id: user.id },
        data: {
          creditsUsed: 0,
          creditsResetAt: now(),
        },
      })
    )
  );
}
```

---

## 추정 시간

**Story Point**: 2

**세부 추정**:
- 크레딧 로직: 2h
- UI: 1h
- Cron: 1h
