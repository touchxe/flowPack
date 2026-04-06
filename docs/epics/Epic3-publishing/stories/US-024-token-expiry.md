# US-024: SNS 토큰 만료 처리

> **Story ID**: US-024
> **Epic**: Epic 3: 배포
> **优先순위**: P1
> **작성일**: 2026-03-31
> **Phase**: Phase 5

---

## 개요

SNS API access token이 만료되었을 때 자동 감지 및 재인증 유도.

---

## acceptance criteria

- [ ] API 호출 시 401 응답 감지
- [ ] 토큰 만료 안내 모달 표시
- [ ] 재연결 버튼 클릭 시 OAuth 재시작
- [ ] Refresh Token이 있는 경우 자동 갱신 시도

---

## 구현 참고사항

```typescript
// server/services/platform-service.ts
async function publishWithRetry(account: SocialAccount, content: Content) {
  try {
    return await publishToPlatform(account, content);
  } catch (error) {
    if (error.status === 401) {
      // 토큰 만료 - 갱신 시도
      if (account.refreshToken) {
        const newTokens = await refreshAccessToken(account);
        await prisma.socialAccount.update({
          where: { id: account.id },
          data: {
            accessToken: encrypt(newTokens.accessToken),
            tokenExpiresAt: newTokens.expiresAt,
          },
        });
        return publishToPlatform(account, content);
      }
      throw new TokenExpiredError(account.id);
    }
    throw error;
  }
}
```

---

## 추정 시간

**Story Point**: 2
