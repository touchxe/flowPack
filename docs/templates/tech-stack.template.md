# 기술 스택 — 변경 금지 (가상 CTO 관할)

> ⚠️ 이 파일은 읽기 전용입니다.
> 변경이 필요하면 `docs/change-proposals/`에 변경 제안서를 먼저 작성하세요.

---

## Frontend

| 항목 | 기술 | 버전 | 비고 |
|------|------|------|------|
| 프레임워크 | Next.js (App Router) | 15.x | Pages Router 사용 금지 |
| 언어 | TypeScript | 5.x | strict: true 필수 |
| 스타일링 | Tailwind CSS | 4.x | CSS Modules 금지 |
| UI 라이브러리 | shadcn/ui | latest | 커스텀 컴포넌트는 components/ui에 |
| 상태 관리 | Zustand | 5.x | Redux, MobX, Jotai 금지 |
| 폼 관리 | React Hook Form + Zod | - | Formik 금지 |
| 데이터 페칭 | TanStack Query | 5.x | useEffect 내 fetch 금지 |
| 아이콘 | Lucide React | latest | - |

## Backend

| 항목 | 기술 | 버전 | 비고 |
|------|------|------|------|
| API | tRPC | 11.x | REST API 직접 구현 금지 |
| ORM | Drizzle ORM | latest | Prisma 금지 |
| DB | PostgreSQL | 16 | Supabase 호스팅 |
| 인증 | Supabase Auth | - | 자체 구현 금지 |
| 파일 저장 | Supabase Storage | - | - |
| 이메일 | Resend | - | - |

## 인프라

| 항목 | 기술 | 비고 |
|------|------|------|
| 호스팅 | Vercel | - |
| DB 호스팅 | Supabase | - |
| 도메인/DNS | Vercel | - |
| 모니터링 | Vercel Analytics | - |
| 에러 추적 | (Phase 2에서 결정) | - |

## 개발 도구

| 항목 | 기술 |
|------|------|
| 패키지 매니저 | pnpm |
| 번들러 | Next.js 내장 (Turbopack) |
| 린터 | ESLint + Biome |
| 포매터 | Biome |
| 테스트 | Vitest + Playwright |
| Git 훅 | Husky + lint-staged |

---

## 금지 기술 목록

| 금지 기술 | 대체 기술 | 금지 사유 |
|----------|----------|----------|
| Express.js | tRPC | API 계층 통일 |
| Prisma | Drizzle ORM | 성능 + 타입 안전성 |
| Redux / MobX | Zustand | 과도한 보일러플레이트 |
| CSS Modules | Tailwind CSS | 스타일 통일성 |
| Formik | React Hook Form | 번들 사이즈 + 성능 |
| Axios | fetch (내장) | 불필요한 의존성 |
| Moment.js | date-fns | 번들 사이즈 |
| lodash (전체) | 필요 시 개별 import | 번들 사이즈 |

---

## 변경 이력

| 날짜 | 변경 내용 | 승인자 | 제안서 |
|------|----------|--------|--------|
| YYYY-MM-DD | 최초 작성 | YoungBin | - |
