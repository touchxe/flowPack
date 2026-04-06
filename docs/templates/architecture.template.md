# 시스템 아키텍처 — 변경 금지 (가상 CTO 관할)

> ⚠️ 이 파일은 읽기 전용입니다.
> 변경이 필요하면 `docs/change-proposals/`에 변경 제안서를 먼저 작성하세요.

---

## 시스템 구성도

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Client    │────→│   Vercel     │────→│  Supabase    │
│  (Browser)  │←────│  (Next.js)   │←────│  (PostgreSQL)│
└─────────────┘     └──────┬───────┘     └──────────────┘
                           │
                    ┌──────┴───────┐
                    │   tRPC API   │
                    │  (Server)    │
                    └──────────────┘
```

## 폴더 구조

```
project-root/
├── .cursor/rules/          ← AI 에이전트 규칙
├── docs/                   ← 프로젝트 문서 (읽기 전용)
│   ├── prd.md
│   ├── tech-stack.md
│   ├── architecture.md
│   ├── api-contract.md
│   ├── db-schema.md
│   ├── anti-patterns.md
│   ├── wireframes/
│   ├── ui-spec-*.md
│   ├── change-proposals/
│   └── dependency-requests.md
├── tasks/                  ← 작업 관리
│   ├── workflow_state.md
│   ├── epic-*.md
│   └── completed/
├── src/
│   ├── app/                ← Next.js App Router
│   │   ├── (auth)/         ← 인증 라우트 그룹
│   │   ├── (dashboard)/    ← 대시보드 라우트 그룹
│   │   ├── api/trpc/       ← tRPC API 라우트
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/             ← shadcn/ui 컴포넌트
│   │   ├── layouts/        ← 레이아웃 컴포넌트
│   │   └── [feature]/      ← 기능별 컴포넌트
│   ├── features/           ← 비즈니스 로직
│   │   └── [feature]/
│   │       ├── actions.ts
│   │       ├── queries.ts
│   │       ├── mutations.ts
│   │       ├── schemas.ts
│   │       └── types.ts
│   ├── lib/                ← 공통 유틸리티
│   ├── server/             ← 서버 전용 코드
│   │   ├── db/             ← Drizzle 스키마 + 마이그레이션
│   │   ├── trpc/           ← tRPC 라우터
│   │   └── services/       ← 비즈니스 서비스
│   ├── stores/             ← Zustand 스토어
│   └── types/              ← 글로벌 타입
├── tests/                  ← 테스트
│   ├── features/
│   ├── step-definitions/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── public/                 ← 정적 자산
└── config files            ← (package.json, tsconfig, etc.)
```

## 데이터 흐름

```
[사용자 액션]
    → [React Component] (UI 이벤트)
    → [tRPC Mutation/Query] (타입 안전 API 호출)
    → [tRPC Router] (서버 사이드 처리)
    → [Service Layer] (비즈니스 로직)
    → [Drizzle ORM] (DB 접근)
    → [PostgreSQL/Supabase] (데이터 저장)
    ← [응답 역순]
```

## 인증 흐름

```
[로그인 요청] → [Supabase Auth] → [JWT 발급]
    → [클라이언트 쿠키 저장]
    → [이후 요청마다 JWT 첨부]
    → [서버에서 JWT 검증] → [사용자 식별]
```

---

## 핵심 설계 원칙
1. **Server-First**: 데이터 조회는 Server Component 우선
2. **Type-Safe End-to-End**: tRPC로 클라이언트~서버 타입 공유
3. **Feature-Based**: 기능 단위로 코드 조직
4. **Convention over Configuration**: 일관된 패턴 사용

---

## 변경 이력

| 날짜 | 변경 내용 | 승인자 | 제안서 |
|------|----------|--------|--------|
| YYYY-MM-DD | 최초 작성 | YoungBin | - |
