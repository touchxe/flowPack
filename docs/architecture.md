# FlowPack 시스템 아키텍처

> ⚠️ **읽기 전용 — 가상 CTO 감시 대상**  
> 변경 시 `docs/change-proposals/` 에 제안서 작성 → 사용자 승인 필수  
> **확정일**: 2026-03-31 | **Phase 3**

---

## 1. 시스템 구조 개요

```
┌─────────────────────────────────────────────────────────┐
│                     클라이언트 (브라우저)                  │
│   Next.js App Router (RSC + Client Components)          │
│   Tailwind CSS · shadcn/ui · Lucide · next-themes       │
│   Zustand (클라이언트 상태) · TanStack Query (서버 상태)  │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS
┌───────────────────────▼─────────────────────────────────┐
│                   Next.js API Routes                     │
│              (app/api/** — Edge / Node.js)               │
│   Auth.js v5 · Prisma ORM · Zod 유효성                  │
└───────────┬───────────────────────┬─────────────────────┘
            │                       │
    ┌───────▼──────┐       ┌────────▼────────┐
    │  PostgreSQL  │       │  외부 API        │
    │  (Supabase/  │       │  OpenAI · Meta  │
    │   Neon)      │       │  Twitter · Toss │
    └──────────────┘       └─────────────────┘
```

---

## 2. 폴더 구조 (app/ 디렉토리 기준)

```
app/                          ← Next.js 프로젝트 루트
├── app/                      ← App Router 페이지
│   ├── (public)/             ← 비회원 라우트 그룹
│   │   ├── (landing)/
│   │   │   └── page.tsx      ← /
│   │   ├── login/
│   │   │   └── page.tsx      ← /login
│   │   ├── register/
│   │   │   └── page.tsx      ← /register
│   │   ├── find-password/
│   │   │   └── page.tsx      ← /find-password
│   │   ├── pricing/
│   │   │   └── page.tsx      ← /pricing (공개)
│   │   ├── blog/
│   │   │   ├── page.tsx      ← /blog
│   │   │   └── [category]/
│   │   │       └── page.tsx  ← /blog/:category
│   │   └── contact/
│   │       └── page.tsx      ← /contact
│   │
│   ├── (app)/                ← 회원 전용 라우트 그룹
│   │   ├── layout.tsx        ← AppLayout (Sidebar + TopBar)
│   │   ├── home/
│   │   │   └── page.tsx      ← /home (대시보드)
│   │   ├── carousel-lab/
│   │   │   └── page.tsx      ← /carousel-lab
│   │   ├── video/
│   │   │   └── page.tsx      ← /video
│   │   ├── ai/
│   │   │   ├── longform/
│   │   │   │   └── page.tsx  ← /ai/longform
│   │   │   ├── bulk-link-to-post/
│   │   │   │   └── page.tsx  ← /ai/bulk-link-to-post
│   │   │   └── bulk-generate/
│   │   │       └── page.tsx  ← /ai/bulk-generate
│   │   ├── calendar/
│   │   │   └── page.tsx      ← /calendar
│   │   ├── social-accounts/
│   │   │   └── page.tsx      ← /social-accounts
│   │   ├── analytics/
│   │   │   └── page.tsx      ← /analytics
│   │   └── settings/
│   │       ├── profile/
│   │       │   └── page.tsx  ← /settings/profile
│   │       ├── persona/
│   │       │   └── page.tsx  ← /settings/persona
│   │       ├── notifications/
│   │       │   └── page.tsx  ← /settings/notifications
│   │       └── billing/
│   │           └── page.tsx  ← /settings/billing
│   │
│   ├── api/                  ← API Routes
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts  ← Auth.js 핸들러
│   │   ├── content/
│   │   │   ├── route.ts      ← GET/POST /api/content
│   │   │   └── [id]/
│   │   │       └── route.ts  ← GET/PUT/DELETE /api/content/:id
│   │   ├── generate/
│   │   │   ├── carousel/
│   │   │   │   └── route.ts  ← POST /api/generate/carousel
│   │   │   ├── blog/
│   │   │   │   └── route.ts  ← POST /api/generate/blog
│   │   │   └── image/
│   │   │       └── route.ts  ← POST /api/generate/image
│   │   ├── publish/
│   │   │   └── route.ts      ← POST /api/publish
│   │   ├── social/
│   │   │   └── route.ts      ← GET/POST/DELETE /api/social
│   │   ├── analytics/
│   │   │   └── route.ts      ← GET /api/analytics
│   │   └── payments/
│   │       └── route.ts      ← POST /api/payments
│   │
│   ├── layout.tsx            ← 루트 레이아웃 (ThemeProvider)
│   ├── globals.css           ← CSS 변수 + Tailwind directives
│   └── page.tsx              ← / 리다이렉트
│
├── components/
│   ├── ui/                   ← shadcn/ui 기본 컴포넌트
│   │   ├── button.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── avatar.tsx
│   │   ├── progress.tsx
│   │   ├── separator.tsx
│   │   ├── skeleton.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── select.tsx
│   │   ├── switch.tsx
│   │   ├── tabs.tsx
│   │   ├── toast.tsx
│   │   ├── tooltip.tsx
│   │   ├── popover.tsx
│   │   └── scroll-area.tsx
│   │
│   ├── layouts/              ← 레이아웃 컴포넌트
│   │   ├── app-layout.tsx    ← Sidebar + TopBar 조합
│   │   ├── sidebar.tsx       ← 좌측 네비게이션
│   │   ├── top-bar.tsx       ← 상단 헤더
│   │   └── theme-provider.tsx
│   │
│   └── common/               ← 재사용 공통 컴포넌트
│       ├── stat-card.tsx
│       ├── empty-state.tsx
│       ├── page-header.tsx
│       └── content-badge.tsx
│
├── features/                 ← 기능별 비즈니스 로직 + UI
│   ├── auth/                 ← 인증
│   ├── carousel/             ← 카드뉴스 생성
│   ├── blog/                 ← 블로그 생성
│   ├── calendar/             ← 콘텐츠 캘린더
│   ├── social/               ← SNS 연동
│   ├── analytics/            ← 통계
│   └── pricing/              ← 요금제
│
├── lib/                      ← 공통 유틸리티
│   ├── utils.ts              ← cn(), formatNumber(), formatDate()
│   ├── auth.ts               ← Auth.js 설정
│   ├── prisma.ts             ← Prisma 클라이언트 싱글턴
│   ├── openai.ts             ← OpenAI 클라이언트
│   └── validations/          ← Zod 스키마
│
├── server/                   ← 서버 전용 코드 (클라이언트에서 import 금지)
│   ├── db/                   ← DB 쿼리 함수
│   └── services/             ← 외부 API 서비스
│
├── stores/                   ← Zustand 스토어
│   └── use-app-store.ts
│
├── hooks/                    ← 커스텀 훅
│
├── types/                    ← 글로벌 타입
│   └── index.ts
│
├── prisma/
│   ├── schema.prisma         ← DB 스키마 (단일 출처)
│   └── migrations/
│
├── public/                   ← 정적 파일
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── components.json           ← shadcn 설정
```

---

## 3. 데이터 흐름

```
[Page / RSC]
  → server/db/ (Prisma) — 초기 데이터 로드 (SSR/SSG)
  → [Client Component] + TanStack Query — 동적 데이터 갱신
  → app/api/ Route Handler — API 호출
  → server/services/ — 외부 API 호출 (OpenAI, SNS 등)
```

---

## 4. 인증 흐름

```
Auth.js v5 (JWT 세션)
  소셜: Google → /api/auth/callback/google → 세션 생성
  소셜: Kakao → /api/auth/callback/kakao → 세션 생성
  소셜: Apple → /api/auth/callback/apple → 세션 생성
  이메일: credentials → bcrypt 검증 → 세션 생성

미들웨어 (middleware.ts):
  - (app)/* 경로 → 세션 없으면 /login 리다이렉트
  - /login, /register → 로그인 상태면 /home 리다이렉트
```

---

## 5. AI 생성 흐름

```
클라이언트 → POST /api/generate/{type}
  → Zod 입력 유효성 검사
  → 크레딧 잔액 확인 (DB)
  → OpenAI API 호출 (스트리밍 응답)
  → 결과 DB 저장 (draft)
  → 크레딧 차감
  → 응답 반환

이미지/영상 생성 (비동기):
  → Vercel Cron / Background 잡
  → 완료 시 이메일·카카오톡 알림
```

---

## 6. 네이밍 규칙 (파일)

| 대상 | 규칙 | 예시 |
|------|------|------|
| 페이지 파일 | `page.tsx` | `app/(app)/home/page.tsx` |
| 레이아웃 파일 | `layout.tsx` | `app/(app)/layout.tsx` |
| 컴포넌트 | kebab-case.tsx | `stat-card.tsx` |
| 훅 | use-*.ts | `use-content-list.ts` |
| 서비스 | *-service.ts | `openai-service.ts` |
| 스토어 | use-*-store.ts | `use-app-store.ts` |
| Zod 스키마 | *-schema.ts | `content-schema.ts` |
