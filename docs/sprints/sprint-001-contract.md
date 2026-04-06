# Sprint 001 — 계약서

> **프로젝트**: FlowPack
> **스프린트 번호**: 1
> **시작일**: 2026-03-31
> **종료일**: 2026-04-06 (예상)
> **계약일**: 2026-03-31

---

## 스프린트 목표

**Epic 1: 인증**의 핵심 기능인 소셜 로그인(Google, Kakao, Apple)과 이메일/비밀번호 로그인을 완성하여 사용자가 서비스에 가입하고 로그인할 수 있게 한다.

---

## 이번 스프린트에 포함될 Stories

| Story ID | 제목 | Points | 상태 |
|----------|------|--------|------|
| US-001 | 소셜 계정으로 가입·로그인 | 5 | ⏳ 대기 |
| US-002 | 이메일·비밀번호로 가입·로그인 | 5 | ⏳ 대기 |

**이번 스프린트 총 Points**: 10

---

## 정의 완료 (Definition of Done)

### US-001 소셜 로그인

- [ ] Google OAuth 로그인/로그아웃 가능
- [ ] Kakao OAuth 로그인/로그아웃 가능
- [ ] Apple OAuth 로그인/로그아웃 가능
- [ ] JWT 세션 쿠키 생성 및 관리
- [ ] 미들웨어로 보호 라우트 설정
- [ ] BDD 시나리오 모두 통과

### US-002 이메일 로그인

- [ ] 이메일 회원가입 폼 + Validation
- [ ] 비밀번호 Validation (8자+, 숫자, 특수문자)
- [ ] bcrypt 해싱으로 비밀번호 저장
- [ ] 이메일 로그인 성공/실패 처리
- [ ] BDD 시나리오 모두 통과

---

## 기술 체크리스트

- [ ] Auth.js v5 설정 완료
- [ ] Prisma Adapter 연동
- [ ] Google/Kakao/Apple Provider 설정
- [ ] Credentials Provider 설정
- [ ] bcrypt 설치 및 설정
- [ ] 환경 변수 설정 (.env.local)
- [ ] 미들웨어 라우트 보호 구현
- [ ] Zod 스키마 작성

---

## 환경 변수 (필요한 것만)

```bash
# .env.local
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
KAKAO_CLIENT_ID=your_kakao_client_id
KAKAO_CLIENT_SECRET=your_kakao_client_secret
APPLE_CLIENT_ID=your_apple_client_id
APPLE_CLIENT_SECRET=your_apple_client_secret
```

---

## 제외 사항 (이번 스프린트에서)

- 비밀번호 재설정 (US-003) — Sprint 2로 연기
- 중복 로그인 방지 (US-004) — Sprint 2로 연기
- 실제 OAuth Provider 앱 생성 및 승인 — 개발 시 더미/테스트 계정 활용

---

## 검수 기준

1. 모든 BDD 시나리오가 녹색 (passing)
2. Pull Request 리뷰 완료
3. 코드 리ント/타입 체크 통과
4. 开发 서버에서手動 测试 완료

---

## 승인

| 역할 | 이름 | 날짜 | 서명 |
|------|------|------|------|
| Product Owner | 사용자 | 2026-03-31 | ____________ |
| Scrum Master | AI Agent | 2026-03-31 | ____________ |
| Developer | AI Agent | 2026-03-31 | ____________ |

---

## 이후 스프린트 로드맵

| Sprint | Stories | 목표 |
|--------|---------|------|
| Sprint 2 | US-003, US-004 | 인증 보완 |
| Sprint 3 | US-010, US-014 | AI 카드뉴스 생성 |
| Sprint 4 | US-011, US-015 | 편집 + 블로그 |
| Sprint 5 | US-012, US-013 | 이미지 + URL 변환 |
