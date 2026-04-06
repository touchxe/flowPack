# US-004: 중복 로그인 방지

> **Story ID**: US-004
> **Epic**: Epic 1: 인증
> **우선순위**: P2
> **작성일**: 2026-03-31
> **Phase**: Phase 5

---

## 개요

동일 계정이 여러 기기에서 동시에 로그인되는 것을 방지한다. 새로운 기기에서 로그인하면 이전 세션이 무효화된다.

---

## 사용자 스토리

> **As a** 사용자
> **I want to** 내 계정이 다른 곳에서 사용될 때 알림을 받는다
> **So that** 보안을 유지할 수 있다

---

## acceptance criteria

### 중복 로그인 감지

- [ ] 사용자가 기기 A에서 로그인 → 세션 생성 (sessionId: S1)
- [ ] 동일한 사용자가 기기 B에서 로그인 → 세션 생성 (sessionId: S2)
- [ ] 기기 A의 세션이 무효화됨
- [ ] 기기 A의 브라우저: "다른 곳에서 로그인되었습니다" 알림
- [ ] 기기 A는 현재 페이지에서 로그아웃 처리됨
- [ ] 기기 B는 정상적으로 사용 가능

### 세션 무효화 로직

- [ ] Auth.js JWT 전략 사용 시: JWT에 `sessionId` 포함
- [ ] 새 로그인 시 이전 sessionId를 DB에서 무효화
- [ ] 미들웨어에서 sessionId 유효성 검증

### 알림

- [ ] 이전 세션 감지 시 토스트/모달로 안내
- [ ] 알림 내용: "다른 곳에서 로그인되었습니다. 다시 로그인해주세요."

---

## 구현 참고사항

### Session 테이블 활용

기존 `db-schema.md`의 Session 테이블 사용

```typescript
// session 처리 로직 (lib/auth.ts)
async function invalidateOtherSessions(currentSessionId: string, userId: string) {
  // 현재 세션을 제외한 모든 세션 무효화
  await prisma.session.updateMany({
    where: {
      userId,
      NOT: { id: currentSessionId },
    },
    data: { expires: new Date() }, // 만료 처리
  });
}
```

### Auth.js Callbacks 활용

```typescript
// lib/auth.ts callbacks
signIn: async ({ user, account }) => {
  if (account?.type === "oauth") {
    // OAuth 로그인 시 기존 세션 확인
    const existingSessions = await prisma.session.findMany({
      where: { userId: user.id },
    });
    // 다른 세션 무효화
    await prisma.session.updateMany({
      where: { userId: user.id, NOT: { id: existingSessions[0]?.id } },
      data: { expires: new Date() },
    });
  }
  return true;
}
```

### Client-side 세션 체크

```typescript
// components/providers/session-check.tsx
"use client";

useEffect(() => {
  const checkSession = setInterval(async () => {
    const session = await auth();
    if (session && session.sessionId !== currentSessionId) {
      toast.error("다른 곳에서 로그인되었습니다. 다시 로그인해주세요.");
      signOut();
    }
  }, 30000); // 30초마다 체크

  return () => clearInterval(checkSession);
}, []);
```

---

## 테스트 시나리오 (BDD)

자세한 테스트 시나리오는 `docs/bdd/Epic1-auth.md` 참조:

- `Scenario: 이미 로그인된 계정으로 다른 기기에서 로그인 시도`

---

## 의존성

- 기존 Auth.js 세션 관리 기능 활용

---

## 추정 시간

**Story Point**: 2

**세부 추정**:
- 세션 무효화 로직: 1.5h
- Client-side 세션 체크: 1h
- 테스트: 0.5h
