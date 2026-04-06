# Epic 4: 통계 & 관리 (Analytics & Calendar)

> **작성일**: 2026-03-31
> **Phase**: Phase 5
> **상태**: ⏳ 스프린트 대기
> **Epic ID**: EPIC-4

---

## 개요

콘텐츠 배포 후 플랫폼별 조회수, 좋아요, 공유 수 등의 통계를 확인하고, 콘텐츠 캘린더에서 예약 및 관리를 할 수 있다.

---

## 사용자 스토리 목록

| Story ID | 제목 |优先순위 | 상태 |
|----------|------|----------|------|
| [US-030](./stories/US-030-analytics-dashboard.md) | 포스팅별 조회수 확인 | P0 | ⏳ 대기 |
| [US-031](./stories/US-031-calendar-management.md) | 콘텐츠 캘린더 예약·관리 | P0 | ⏳ 대기 |
| [US-032](./stories/US-032-content-list-management.md) | 콘텐츠 목록 관리 | P1 | ⏳ 대기 |
| [US-033](./stories/US-033-content-archive.md) | 콘텐츠 아카이브 | P2 | ⏳ 대기 |

---

## 기술 요구사항

- **Analytics Storage**: PostgreSQL (Analytics 테이블)
- **Calendar UI**: 커스텀 또는 라이브러리
- **Cron**: Vercel Cron (통계 집계)

---

## API 계약

- `GET /api/analytics` — 통계 조회
- `GET/POST/PUT/DELETE /api/content` — 콘텐츠 CRUD

---

## 테스트 시나리오

전체 테스트 시나리오는 `docs/bdd/Epic4-analytics-calendar.md` 참조

---

## 진행 로드맵

1. **Sprint 5**: US-030 통계 대시보드
2. **Sprint 6**: US-031 캘린더
3. **Sprint 7**: US-032/033 목록 관리
