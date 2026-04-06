# Epic 1: 인증 (Authentication)

> **작성일**: 2026-03-31
> **Phase**: Phase 5
> **상태**: ⏳ 스프린트 대기
> **Epic ID**: EPIC-1

---

## 개요

사용자가 안전하게 FlowPack 서비스에 가입하고 로그인할 수 있도록 한다. 소셜 로그인(Google, Kakao, Apple)과 이메일/비밀번호 로그인을 지원하며, 비밀번호 재설정과 중복 로그인 방지 기능을 포함한다.

---

## 사용자 스토리 목록

| Story ID | 제목 | 우선순위 | 상태 |
|----------|------|----------|------|
| [US-001](./stories/US-001-social-login.md) | 소셜 계정으로 가입·로그인 | P0 | ⏳ 대기 |
| [US-002](./stories/US-002-email-login.md) | 이메일·비밀번호로 가입·로그인 | P0 | ⏳ 대기 |
| [US-003](./stories/US-003-password-reset.md) | 비밀번호 재설정 | P1 | ⏳ 대기 |
| [US-004](./stories/US-004-duplicate-login-prevention.md) | 중복 로그인 방지 | P2 | ⏳ 대기 |

---

## 기술 요구사항

- **Auth Provider**: Auth.js v5 (NextAuth)
- **Session Strategy**: JWT
- **소셜 OAuth**: Google, Kakao, Apple
- **Password**: bcrypt 해싱
- **Middleware**: 세션 기반 라우트 보호

---

## API 계약

- `GET/POST /api/auth/[...nextauth]` — Auth.js 핸들러

---

## 테스트 시나리오

전체 테스트 시나리오는 `docs/bdd/Epic1-auth.md` 참조

---

## 진행 로드맵

1. **Sprint 1**: US-001 소셜 로그인 + US-002 이메일 로그인
2. **Sprint 2**: US-003 비밀번호 재설정
3. **Sprint 3**: US-004 중복 로그인 방지
