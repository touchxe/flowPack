# [Phase 3] 아키텍처 작업 로그

## 기본 정보
- **날짜**: 2026-03-31
- **Phase**: Phase 3 — 가상 CTO (아키텍처 확정)
- **소요 시간**: 약 1시간
- **관련 Task**: PHASE-3

## 이번에 한 일
PRD, 사이트맵, 디자인 방향을 기반으로 6종 아키텍처 제약 파일을 모두 작성하고 잠금 처리했다. 기술 스택은 Next.js 15 App Router + TypeScript strict + Tailwind/shadcn + Zustand + TanStack Query + Prisma + PostgreSQL + Auth.js v5 + OpenAI API + Toss Payments로 확정했다. DB 스키마는 Prisma schema.prisma로 11개 테이블을 정의했고, API 계약은 8개 도메인 엔드포인트를 문서화했다. 금지 패턴 목록에는 TypeScript any, useEffect 데이터 페칭, 보라색 하드코딩, CSS Modules 등 27개 패턴을 명시했다.

## 핵심 결정 사항

| 결정 | 선택지 | 선택 이유 |
|------|--------|-----------|
| 인증 | Clerk vs **Auth.js v5** vs Supabase Auth | 비용(Clerk 유료), 유연성, Next.js 공식 지원 |
| ORM | Drizzle vs **Prisma** vs 직접 쿼리 | 타입 안전성, 마이그레이션 관리, 팀 친숙도 |
| DB 호스팅 | **Supabase/Neon** vs PlanetScale | PostgreSQL 전용, 무료 티어, 스토리지 통합 |
| 결제 | Stripe vs **Toss Payments** | 한국 결제 표준, 원화 지원, 카카오페이 연동 |
| API 방식 | tRPC vs **Next.js API Routes** | 단순성, 점진적 도입 가능, 복잡도 낮음 |
| 이메일 | SendGrid vs **Resend** | 개발자 친화적, React 이메일 템플릿 지원 |
| AI API 스트리밍 | Polling vs **SSE (Server-Sent Events)** | 실시간 생성 피드백 UX 필수 |

## 생성된 파일

| 파일 | 상태 |
|------|------|
| `docs/tech-stack.md` | ✅ 잠금 (읽기 전용) |
| `docs/architecture.md` | ✅ 잠금 (읽기 전용) |
| `docs/db-schema.md` | ✅ 잠금 (읽기 전용) |
| `docs/api-contract.md` | ✅ 잠금 (읽기 전용) |
| `docs/anti-patterns.md` | ✅ 잠금 (읽기 전용) |
| `docs/design-defaults.md` | ✅ 잠금 (읽기 전용) |
| `docs/dependency-requests.md` | 변경 가능 (요청서) |
| `docs/change-proposals/` | 변경 가능 (제안서) |
| `app/prisma/schema.prisma` | ✅ 생성 (변경은 제안서 필요) |

## 어려웠던 점 / 배운 점
- **문제**: API 계약을 미리 정의하면 구현 단계에서 제약이 생기지만, 정의하지 않으면 API 일관성이 무너진다.
- **결론**: "계약 우선(Contract-First)" 방식이 장기적으로 유지보수 비용을 낮춘다. 미확정 부분은 ⚠️로 명시하고 구현 시 확정.
- **배운 점**: Prisma enum + 인덱스 설계를 미리 하면 쿼리 최적화 방향이 명확해진다 (userId+status, userId+type 복합 인덱스).

## AI와의 협업 노트
- PRD → 사이트맵 → DB 스키마 순서로 도출하면 누락 테이블이 거의 없음
- API 계약은 페이지별 필요 데이터를 역추적하는 방식이 효과적
- 금지 패턴 목록은 "기존 코드에서 발견한 문제"가 아닌 "미래에 발생할 문제"를 선제 차단하는 도구

## 다음 할 일
1. Phase 4: BDD 테스트 선행 작성 (Playwright E2E + Vitest 단위)
2. P0 핵심 Epic별 Feature 파일 작성 (US-001~US-022)
3. RED 상태 확인 후 Phase 5 구현 루프 진입

## 스크린샷/참조
- `docs/tech-stack.md` → 기술 스택 전체 목록
- `docs/architecture.md` → 폴더 구조 + 데이터 흐름도
- `docs/db-schema.md` → Prisma 스키마 11개 테이블
- `docs/api-contract.md` → 8개 도메인 API 엔드포인트
- `docs/anti-patterns.md` → 27개 금지 패턴
- `docs/design-defaults.md` → 컴포넌트 사용 기준
