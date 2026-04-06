# US-021: 블로그 연동

> **Story ID**: US-021
> **Epic**: Epic 3: 배포
> **优先순위**: P0
> **작성일**: 2026-03-31
> **Phase**: Phase 5

---

## 개요

사용자가 네이버 블로그와 WordPress를 FlowPack에 연동한다.

---

## 사용자 스토리

> **As a** 홍보 담당자
> **I want to** 블로그도 함께 연동
> **So that** 블로그에도 콘텐츠를 배포

---

## acceptance criteria

### 네이버 블로그 연동

- [ ] "네이버 블로그 연결" 버튼
- [ ] 네이버 로그인 페이지로 리다이렉트
- [ ] 로그인/동의 후 callback 처리
- [ ] SocialAccount 생성 (platform: NAVER_BLOG)

### WordPress 연동

- [ ] "WordPress 연결" 버튼
- [ ] WordPress.com: OAuth flow
- [ ] Self-hosted: URL + Application Password 입력
- [ ] 연결 테스트 후 SocialAccount 생성

### 공통

- [ ] 연동 해제 기능
- [ ] 연결 상태 표시 (활성/비활성)

---

## 구현 참고사항

### Self-hosted WordPress 연결 테스트

```typescript
export async function testWordPressConnection(url: string, username: string, appPassword: string) {
  const response = await fetch(`${url}/wp-json/wp/v2/users/me`, {
    headers: {
      Authorization: `Basic ${btoa(`${username}:${appPassword}`)}`,
    },
  });

  if (!response.ok) {
    throw new Error("WordPress 연결 실패");
  }

  const user = await response.json();
  return { blogUrl: url, username: user.name };
}
```

---

## 환경 변수

```bash
# .env.local
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret
WORDPRESS_CLIENT_ID=your_wordpress_client_id
WORDPRESS_CLIENT_SECRET=your_wordpress_client_secret
```

---

## 추정 시간

**Story Point**: 3

**세부 추정**:
- 네이버 블로그: 1.5h
- WordPress: 2h
- UI: 1h
