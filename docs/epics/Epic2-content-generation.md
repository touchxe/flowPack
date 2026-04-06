# Epic 2: 콘텐츠 생성 (Content Generation)

> **작성일**: 2026-03-31
> **Phase**: Phase 5
> **상태**: ⏳ 스프린트 대기
> **Epic ID**: EPIC-2

---

## 개요

AI를 사용하여 홍보 콘텐츠(카드뉴스, 블로그, 이미지)를 생성하고, 사용자가 직접 편집할 수 있는 기능을 제공한다.

---

## 사용자 스토리 목록

| Story ID | 제목 | 우선순위 | 상태 |
|----------|------|----------|------|
| [US-010](./stories/US-010-ai-content-generation.md) | AI 홍보글 생성 | P0 | ⏳ 대기 |
| [US-011](./stories/US-011-content-edit.md) | 생성된 글 직접 편집 | P0 | ⏳ 대기 |
| [US-012](./stories/US-012-ai-image-generation.md) | AI 이미지 생성 | P1 | ⏳ 대기 |
| [US-013](./stories/US-013-url-to-content.md) | URL을 입력해 콘텐츠 변환 | P1 | ⏳ 대기 |
| [US-014](./stories/US-014-carousel-generation.md) | 카드뉴스 생성 | P0 | ⏳ 대기 |
| [US-015](./stories/US-015-longform-blog-generation.md) | 장문 블로그 생성 | P0 | ⏳ 대기 |
| [US-016](./stories/US-016-bulk-generation.md) | 대량 기획 생성 | P2 | ⏳ 대기 |

---

## 기술 요구사항

- **AI Provider**: OpenAI API (GPT-4o)
- **Streaming**: SSE (Server-Sent Events)
- **Image Generation**: DALL-E 3
- **Content Storage**: PostgreSQL (Prisma)
- **File Storage**: Supabase Storage (이미지)

---

## API 계약

- `POST /api/generate/carousel` — 카드뉴스 생성 (SSE)
- `POST /api/generate/blog` — 블로그 생성 (SSE)
- `POST /api/generate/image` — 이미지 생성
- `GET/POST/PUT/DELETE /api/content` — 콘텐츠 CRUD

---

## 테스트 시나리오

전체 테스트 시나리오는 `docs/bdd/Epic2-content-generation.md` 참조

---

## 진행 로드맵

1. **Sprint 1**: US-010/US-014 카드뉴스 생성 기본 + US-011 편집
2. **Sprint 2**: US-015 블로그 생성
3. **Sprint 3**: US-012 이미지 생성
4. **Sprint 4**: US-013 URL 변환 + US-016 대량 기획
