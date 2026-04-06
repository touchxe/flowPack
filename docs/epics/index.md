# Epics — 인덱스

> **프로젝트**: FlowPack
> **작성일**: 2026-03-31
> **Phase**: Phase 5

---

## Epic 목록

| Epic ID | 제목 | Stories | 총 Points | 상태 |
|---------|------|---------|-----------|------|
| EPIC-1 | 인증 | 4개 | 15 | ⏳ 스프린트 대기 |
| EPIC-2 | 콘텐츠 생성 | 7개 | 27 | ⏳ 스프린트 대기 |
| EPIC-3 | 배포 | 5개 | 22 | ⏳ 스프린트 대기 |
| EPIC-4 | 통계 & 관리 | 4개 | 13 | ⏳ 스프린트 대기 |
| EPIC-5 | 결제 | 6개 | 17 | ⏳ 스프린트 대기 |
| **합계** | | **26개** | **94** | |

---

## Story Points 합계

| 우선순위 | Points |
|----------|--------|
| P0 (Critical) | 48 |
| P1 (High) | 32 |
| P2 (Medium) | 14 |
| **총합** | **94** |

---

## Sprint Planning 가이드

| Sprint | Stories | 예상 Points | 내용 |
|--------|---------|-------------|------|
| Sprint 1 | US-001, US-002 | 10 | 인증 (소셜 + 이메일) |
| Sprint 2 | US-003, US-004 | 5 | 비밀번호 재설정 + 중복 로그인 |
| Sprint 3 | US-010, US-014 | 13 | AI 카드뉴스 생성 |
| Sprint 4 | US-011, US-015 | 10 | 콘텐츠 편집 + 블로그 생성 |
| Sprint 5 | US-012, US-013 | 6 | 이미지 생성 + URL 변환 |
| Sprint 6 | US-016 | 3 | 대량 기획 |
| Sprint 7 | US-020, US-021 | 11 | SNS/블로그 연동 |
| Sprint 8 | US-022 | 8 | 다채널 배포 |
| Sprint 9 | US-023, US-024 | 3 | 계정 관리 |
| Sprint 10 | US-030, US-031 | 10 | 통계 + 캘린더 |
| Sprint 11 | US-032, US-033 | 3 | 목록 관리 + 아카이브 |
| Sprint 12 | US-040, US-045 | 4 | 무료 티어 + 알림 |
| Sprint 13 | US-041, US-042 | 10 | 결제 + 구독 |
| Sprint 14 | US-043, US-044 | 3 | 내역 + 결제수단 |

---

## 파일 구조

```
docs/epics/
├── index.md                    # 이 파일
├── Epic1-auth.md              # Epic 1 개요
├── Epic1-auth/
│   ├── index.md                # Stories 인덱스
│   └── stories/
│       ├── US-001-social-login.md
│       ├── US-002-email-login.md
│       ├── US-003-password-reset.md
│       └── US-004-duplicate-login-prevention.md
├── Epic2-content-generation.md
├── Epic2-content-generation/
│   ├── index.md
│   └── stories/
│       └── ... (7개 Story)
├── Epic3-publishing.md
├── Epic3-publishing/
│   ├── index.md
│   └── stories/
│       └── ... (5개 Story)
├── Epic4-analytics-calendar.md
├── Epic4-analytics-calendar/
│   ├── index.md
│   └── stories/
│       └── ... (4개 Story)
├── Epic5-billing.md
└── Epic5-billing/
    ├── index.md
    └── stories/
        └── ... (6개 Story)
```
