# Epic 3: 배포 (Publishing)

> **작성일**: 2026-03-31
> **Phase**: Phase 5
> **상태**: ⏳ 스프린트 대기
> **Epic ID**: EPIC-3

---

## 개요

사용자가 SNS(Instagram, Facebook, Twitter/X, LinkedIn)와 블로그(네이버, WordPress)를 연동하고, 여러 채널에 원클릭으로 콘텐츠를 배포할 수 있다.

---

## 사용자 스토리 목록

| Story ID | 제목 | 우선순위 | 상태 |
|----------|------|----------|------|
| [US-020](./stories/US-020-sns-connection.md) | SNS 계정 연동 | P0 | ⏳ 대기 |
| [US-021](./stories/US-021-blog-connection.md) | 블로그 연동 | P0 | ⏳ 대기 |
| [US-022](./stories/US-022-multi-channel-publish.md) | 다채널 동시 배포 | P0 | ⏳ 대기 |
| [US-023](./stories/US-023-account-disconnect.md) | SNS 계정 연동 해제 | P1 | ⏳ 대기 |
| [US-024](./stories/US-024-token-expiry.md) | SNS 토큰 만료 처리 | P1 | ⏳ 대기 |

---

## 기술 요구사항

- **SNS API**: Meta Graph API, Twitter API v2, LinkedIn API
- **Blog API**: Naver Blog API, WordPress REST API
- **OAuth**: 각 플랫폼별 OAuth 2.0

---

## API 계약

- `GET/POST/DELETE /api/social` — SNS 계정 CRUD
- `POST /api/publish` — 다채널 배포

---

## 테스트 시나리오

전체 테스트 시나리오는 `docs/bdd/Epic3-publishing.md` 참조

---

## 진행 로드맵

1. **Sprint 3**: US-020/US-021 SNS/블로그 연동
2. **Sprint 4**: US-022 다채널 배포
3. **Sprint 5**: US-023/US-024 계정 관리
