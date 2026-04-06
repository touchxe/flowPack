# US-020: SNS 계정 연동

> **Story ID**: US-020
> **Epic**: Epic 3: 배포
> **우선순위**: P0
> **작성일**: 2026-03-31
> **Phase**: Phase 5

---

## 개요

사용자가 Instagram, Facebook, Twitter/X, LinkedIn 계정을 FlowPack에 연동한다.

---

## 사용자 스토리

> **As a** 홍보 담당자
> **I want to** SNS 계정을 연동
> **So that** 콘텐츠를 해당 플랫폼에 배포할 수 있다

---

## acceptance criteria

### Instagram 연동

- [ ] `/social-accounts` 페이지에 "Instagram 연결" 버튼
- [ ] 클릭 시 Meta OAuth consent screen 표시
- [ ] Instagram Business/Creator 계정 선택 및 권한 승인
- [ ] 연동 성공 시 SocialAccount 레코드 생성
- [ ] 계정 목록에 표시 (계정명, 플랫폼 아이콘)

### Facebook Page 연동

- [ ] "Facebook 연결" 버튼
- [ ] Meta OAuth → Facebook Page 선택
- [ ] SocialAccount 생성 (platform: FACEBOOK)

### Twitter/X 연동

- [ ] "X(Twitter) 연결" 버튼
- [ ] Twitter OAuth 표시
- [ ] 권한 승인 후 SocialAccount 생성

### LinkedIn 연동

- [ ] "LinkedIn 연결" 버튼
- [ ] LinkedIn OAuth 표시
- [ ] 권한 승인 후 SocialAccount 생성

### 공통

- [ ] Personal 계정 경고 (Instagram)
- [ ] OAuth 취소 처리
- [ ] 중복 연동 방지 (기존 계정 보여주기)

---

## 구현 참고사항

### SocialAccount 테이블 활용

```typescript
// server/db/social-account-service.ts
export async function createSocialAccount(userId: string, data: {
  platform: SocialPlatform;
  accountName: string;
  accountId: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}) {
  return prisma.socialAccount.create({
    data: {
      userId,
      platform: data.platform,
      accountName: data.accountName,
      accountId: data.accountId,
      accessToken: encrypt(data.accessToken), // 암호화
      refreshToken: data.refreshToken ? encrypt(data.refreshToken) : null,
      tokenExpiresAt: data.tokenExpiresAt,
    },
  });
}
```

### OAuth 콜백 처리

```typescript
// app/api/auth/callback/[provider]/route.ts
// 각 플랫폼별 OAuth 콜백 처리
// Google, Kakao, Apple → Auth.js가 처리
// SNS 플랫폼은 별도 처리 필요
```

---

## 환경 변수

```bash
# .env.local
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
```

---

## 의존성

- 각 SNS 플랫폼 SDK (선택)

---

## 추정 시간

**Story Point**: 8 (SNS 연동 전체)

**세부 추정**:
- Instagram/Facebook (Meta): 4h
- Twitter/X: 2h
- LinkedIn: 2h
