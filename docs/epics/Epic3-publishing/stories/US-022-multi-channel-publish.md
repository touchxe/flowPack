# US-022: 다채널 동시 배포

> **Story ID**: US-022
> **Epic**: Epic 3: 배포
> **优先순위**: P0
> **작성일**: 2026-03-31
> **Phase**: Phase 5

---

## 개요

사용자가 여러 SNS와 블로그에 원클릭으로 콘텐츠를 동시 배포한다.

---

## 사용자 스토리

> **As a** 홍보 담당자
> **I want to** 여러 플랫폼에 한 번에 배포
> **So that** 각 플랫폼마다 따로 배포하는 번거로움 없음

---

## acceptance criteria

### 배포 채널 선택

- [ ] 콘텐츠 상세/편집 페이지에 "배포" 버튼
- [ ] 배포 채널 선택 모달 표시
- [ ] 연동된 계정 목록 표시 (플랫폼별)
- [ ] 채널 선택/해제 체크박스
- [ ] "지금 배포" / "예약" 버튼

### 즉시 배포

- [ ] 선택된 모든 채널로 동시 배포 요청
- [ ] 각 채널별 진행 상태 실시간 표시
- [ ] 성공: 플랫폼 게시물 URL 표시
- [ ] 실패: 에러 메시지 표시

### 예약 배포

- [ ] 날짜/시간 선택
- [ ] PublishRecord 생성 (status: SCHEDULED)
- [ ] Vercel Cron으로 예약 시각에 배포 실행

### 부분 실패 처리

- [ ] 성공한 채널: "배포 완료" 상태
- [ ] 실패한 채널: 에러 메시지 + 재시도 버튼
- [ ] 실패해도 다른 채널 배포는 유지

---

## 구현 참고사항

### Publish API

```typescript
// app/api/publish/route.ts
export async function POST(req: Request) {
  const session = await auth();
  const { contentId, socialAccountIds, scheduledAt } = await req.json();

  const results = await Promise.all(
    socialAccountIds.map(async (accountId) => {
      const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });

      try {
        const result = await publishToPlatform(account, content);
        return {
          socialAccountId: accountId,
          status: "SUCCESS",
          platformPostId: result.id,
          platformPostUrl: result.url,
        };
      } catch (error) {
        return {
          socialAccountId: accountId,
          status: "FAILED",
          errorMessage: error.message,
        };
      }
    })
  );

  // PublishRecord 생성
  await Promise.all(
    results.map((r) =>
      prisma.publishRecord.create({
        data: {
          contentId,
          socialAccountId: r.socialAccountId,
          status: r.status === "SUCCESS" ? "SUCCESS" : "FAILED",
          platformPostId: r.platformPostId,
          platformPostUrl: r.platformPostUrl,
          errorMessage: r.errorMessage,
        },
      })
    )
  );

  return Response.json({ results });
}
```

### Instagram/Facebook 배포 (Meta Graph API)

```typescript
// server/services/meta-service.ts
export async function publishToInstagram(account: SocialAccount, content: Content) {
  const payload = {
    image_url: content.thumbnailUrl,
    caption: content.body,
  };

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${account.accountId}/media`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${decrypt(account.accessToken)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  return response.json();
}
```

---

## 테스트 시나리오 (BDD)

자세한 테스트 시나리오는 `docs/bdd/Epic3-publishing.md` 참조:

- `Scenario: 사용자가 복수의 SNS에 동시 배포한다`
- `Scenario: 일부 채널 배포 실패`
- `Scenario: 모든 채널 배포 실패`
- `Scenario: 사용자가 특정 시각에 배포를 예약한다`

---

## 추정 시간

**Story Point**: 8

**세부 추정**:
- 배포 API + 채널 선택 UI: 3h
- Meta Graph API 연동: 2h
- Twitter API 연동: 1.5h
- LinkedIn API 연동: 1.5h
- 예약 배포 (Cron): 2h
- 테스트: 2h
