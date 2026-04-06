# FlowPack 기술 스택

> ⚠️ **읽기 전용 — 가상 CTO 감시 대상**  
> 변경 시 `docs/change-proposals/` 에 제안서 작성 → 사용자 승인 필수  
> **확정일**: 2026-03-31 | **Phase 3**

---

## 1. 프론트엔드

| 카테고리 | 기술 | 버전 | 비고 |
|---------|------|------|------|
| 프레임워크 | **Next.js** | ^15.2 | App Router 전용 |
| 언어 | **TypeScript** | ^5 | strict: true 필수 |
| 스타일링 | **Tailwind CSS** | ^3.4 | CSS Modules/styled-components 금지 |
| UI 컴포넌트 | **shadcn/ui** | latest | Radix UI 기반 |
| 아이콘 | **Lucide React** | ^0.484 | 다른 아이콘 라이브러리 금지 |
| 다크모드 | **next-themes** | ^0.4 | — |
| 클래스 유틸 | **clsx + tailwind-merge** | latest | cn() 헬퍼로 통합 |
| CVA | **class-variance-authority** | ^0.7 | 컴포넌트 variant 관리 |
| 상태 관리 | **Zustand** | ^5 | prop drilling 3단계 이상 시 사용 |
| 서버 상태 | **TanStack Query** | ^5 | useEffect 내 fetch 금지 |
| 폼 | **React Hook Form** | ^7 | Zod 연동 필수 |
| 유효성 | **Zod** | ^3 | 스키마 정의 단일 출처 |

---

## 2. 백엔드

| 카테고리 | 기술 | 버전 | 비고 |
|---------|------|------|------|
| API 레이어 | **Next.js API Routes** | — | `app/api/` 폴더 |
| 인증 | **NextAuth.js (Auth.js v5)** | ^5 | JWT 세션 전략 |
| ORM | **Prisma** | ^6 | DB 스키마 단일 출처 |
| 데이터베이스 | **PostgreSQL** | 16+ | Supabase 또는 Neon 호스팅 |
| 파일 스토리지 | **Supabase Storage** | — | 이미지/영상 업로드 |
| 이메일 | **Resend** | ^4 | 트랜잭션 이메일 |
| 알림 (카카오) | **카카오 알림톡 API** | — | 결제/배포 알림 |
| 백그라운드 잡 | **Vercel Cron** | — | 예약 배포, 통계 집계 |

---

## 3. AI / 외부 API

| 카테고리 | 기술 | 버전 | 비고 |
|---------|------|------|------|
| 텍스트 생성 | **OpenAI API (GPT-4o)** | — | 콘텐츠 생성 핵심 |
| 이미지 생성 | **OpenAI DALL-E 3** | — | 카드뉴스 이미지 |
| SNS 배포 | **Meta Graph API** | v21+ | Instagram·Facebook |
| SNS 배포 | **Twitter API v2** | — | X(트위터) |
| SNS 배포 | **LinkedIn API** | v2 | — |
| 블로그 배포 | **네이버 블로그 Open API** | — | 네이버 블로그 |
| 블로그 배포 | **WordPress REST API** | — | WordPress.com/self-hosted |
| 결제 | **Toss Payments** | — | 한국 결제 표준 |

---

## 4. 개발 도구

| 카테고리 | 기술 | 비고 |
|---------|------|------|
| 패키지 매니저 | **npm** | yarn/pnpm 혼용 금지 |
| 린터 | **ESLint** | next/core-web-vitals 설정 |
| 포매터 | **Prettier** | — |
| 테스트 | **Playwright** (E2E) + **Vitest** (단위) | Jest 금지 |
| 타입 체크 | `tsc --noEmit` | CI 필수 |

---

## 5. 인프라

| 카테고리 | 기술 | 비고 |
|---------|------|------|
| 호스팅 | **Vercel** | Edge Runtime 활용 |
| DB 호스팅 | **Supabase** 또는 **Neon** | PlanetScale 금지 (MySQL) |
| CDN | **Vercel Edge Network** | — |
| 모니터링 | **Vercel Analytics** + **Sentry** | — |

---

## 6. 금지 목록

| 기술 | 금지 이유 |
|------|---------|
| CSS Modules / styled-components / emotion | Tailwind로 통일 |
| Heroicons / FontAwesome / react-icons | Lucide 전용 |
| Axios | fetch 네이티브 사용 (Next.js 캐싱 활용) |
| Redux / Recoil / Jotai | Zustand으로 통일 |
| SWR | TanStack Query로 통일 |
| Prisma Studio 직접 배포 | 보안 위험 |
| any 타입 | unknown + 타입 가드 사용 |
| moment.js | date-fns 또는 Intl API 사용 |
| Jest | Vitest 사용 |
| MySQL / MongoDB | PostgreSQL 전용 |
