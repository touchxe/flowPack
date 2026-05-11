# FlowPack 프로젝트 분석 요약

작성일: 2026-05-11

## 한 줄 요약

FlowPack은 AI로 카드뉴스, 블로그, SNS 콘텐츠를 만들고 Instagram, Threads, WordPress 등으로 배포하는 Next.js 기반 B2B SaaS 앱이다. 기존 개발은 BMAD 방식과 Cursor 규칙을 중심으로 진행되었고, 요구사항/아키텍처/디자인/BDD 문서가 `docs/`, `.cursor/rules/`, `tasks/`, `logs/`에 남아 있다.

## 현재 코드 구조

- 실제 앱 루트: `app/`
- 라우팅: `app/app/`의 Next.js App Router
- 공개 페이지: `app/app/(public)/`
- 로그인 후 앱 페이지: `app/app/(app)/`
- 관리자 페이지: `app/app/(admin)/admin/`
- API Route Handler: `app/app/api/`
- 공통 UI: `app/components/ui/`, `app/components/common/`, `app/components/ds/`
- 기능 UI: `app/components/features/`
- 서버/외부 연동: `app/lib/`
- DB 스키마: `app/prisma/schema.prisma`
- 테스트: `app/tests/`, `app/test-results/`

## 기술 스택

- Next.js 15, React 19, TypeScript strict
- Tailwind CSS, shadcn/ui, Radix UI, Lucide React
- Auth.js v5, Prisma, PostgreSQL
- OpenAI SDK, Cloudinary, Vercel Blob, Toss Payments, Resend
- Playwright E2E
- npm 사용. yarn/pnpm 혼용 금지

주의: `docs/tech-stack.md`에는 TanStack Query, React Hook Form, Vitest가 기준으로 적혀 있지만 현재 `app/package.json`에는 설치되어 있지 않다. 새로 도입하려면 의존성 요청서를 먼저 작성해야 한다.

## 실행 방법

`app/`에서 실행한다.

```bash
npm install
npm run dev
npm run build
npm run test:e2e
```

추가로 Prisma 관련 작업은 다음 명령을 사용한다.

```bash
npx prisma generate
npx prisma db push
```

Playwright 설정은 `app/tests/e2e/playwright.config.ts`에 있으며 현재 `baseURL`은 `http://localhost:3002`다. 일반 Next 개발 서버 기본 포트는 `3000`이므로 테스트 전 포트를 확인해야 한다.

## 환경 변수와 접속 정보

로컬에 `app/.env`, `app/.env.local`이 존재한다. 값은 비밀정보이므로 공개하지 않고, 필요한 키 이름만 관리한다.

현재 확인된 환경 변수:

- `DATABASE_URL`
- `NEXTAUTH_URL`, `AUTH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`
- `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`
- `OPENAI_API_KEY`
- `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`, `TOSS_WEBHOOK_SECRET`, `NEXT_PUBLIC_TOSS_CLIENT_KEY`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`
- `META_APP_ID`, `META_APP_SECRET`
- `THREADS_APP_ID`, `THREADS_APP_SECRET`
- `RESEND_API_KEY`, `VERCEL_URL`

보안 원칙:

- 환경 변수 값, 토큰, DB URL, OAuth secret은 문서와 채팅에 노출하지 않는다.
- 클라이언트에 필요한 값만 `NEXT_PUBLIC_`을 붙인다.
- 서버 비밀키를 `NEXT_PUBLIC_`으로 만들지 않는다.
- SNS 토큰 저장/수정 작업은 암호화 요구사항을 먼저 확인한다.

## 기존 규칙의 핵심

- 문서 우선: 요구사항, 벤치마킹, 와이어프레임, 아키텍처, 테스트, 코드 순서를 지향한다.
- 잠금 문서 준수: `docs/tech-stack.md`, `docs/architecture.md`, `docs/api-contract.md`, `docs/db-schema.md`, `docs/design-defaults.md`, `docs/design-direction.md`, `docs/anti-patterns.md`는 승인 없이 수정하지 않는다.
- 새 API, DB 필드, 폴더, 의존성이 필요하면 변경 제안 또는 의존성 요청을 먼저 작성한다.
- UI는 shadcn/ui 우선, 아이콘은 Lucide React만 사용한다.
- Tailwind와 CSS 변수 토큰을 사용하고 CSS Modules, styled-components, emotion, 인라인 스타일은 금지한다.
- 사용자 대면 텍스트는 한국어/영어만 사용한다. 한자, 일본어, 중국어 혼용은 금지한다.
- TypeScript `any`, non-null assertion, 과도한 `as` 단언은 피한다.
- `page.tsx`, `layout.tsx` 외에는 named export를 우선한다.
- API 응답은 `{ success: true, data }` 또는 `{ success: false, error, code }` 형식을 따른다.
- 테스트 없는 기능 구현은 피하고, 변경한 핵심 경로는 검증한다.

## 진행 상태

`tasks/workflow_state.md` 기준:

- Phase 0~5 완료
- Phase 6 최종 검증 대기
- Sprint 001 계약 준비 상태로 기록되어 있음
- Sprint 001 범위는 `US-001` 소셜 로그인과 `US-002` 이메일 로그인

다만 실제 코드에는 인증, 관리자, 결제, AI 생성, 미디어, SNS 연동 등 Sprint 001 이후 기능도 상당 부분 구현되어 있다. 후속 작업은 문서상 진행 상태와 실제 구현 상태의 차이를 먼저 확인해야 한다.

## 테스트/품질 상태

- Playwright 스크린샷과 결과물이 `app/tests/screenshots/`, `app/test-results/`에 남아 있다.
- `app/tests/playwright-result.txt`에는 관리자 흐름 일부가 통과하고 일부가 실패한 기록이 있다. 인코딩이 깨져 보이지만 결과는 5/9 통과, 4개 실패로 읽힌다.
- 실패 항목은 사이드바 메뉴, 사용자 목록, 일부 관리자 페이지 데이터/상태와 관련된 것으로 보인다.

## 주요 리스크와 확인 포인트

- 문서와 실제 구현 사이 차이가 있다. API 경로, 디자인 토큰, 설치된 의존성, 진행 상태를 작업 전 비교해야 한다.
- 루트 `README.md`와 일부 로그는 인코딩이 깨져 보인다. 신뢰 가능한 최신 요약은 `app/README.md`, `docs/`, `AGENTS.md`를 우선한다.
- `app/prisma/schema.prisma`에는 직접 수정 금지 주석이 있다. DB 변경은 제안서와 승인 흐름을 거쳐야 한다.
- `app/tailwind.config.ts`에는 기존 Cyan Ocean 문서와 다른 The Verge/Jelly Mint 계열 토큰이 있다. UI 작업 전 현재 적용된 디자인 토큰을 확인한다.
- `.env` 파일이 로컬에 존재하므로 작업 중 출력이나 커밋에 섞이지 않게 주의한다.

## 앞으로의 작업 시작 체크리스트

1. `AGENTS.md`와 관련 `docs/*` 잠금 문서를 읽는다.
2. `git status --short --branch`로 사용자 변경분을 확인한다.
3. 요청 범위에 맞는 실제 라우트, 컴포넌트, Prisma 모델을 확인한다.
4. 새 의존성/API/DB/폴더가 필요한지 판단한다.
5. 필요 시 `docs/change-proposals/` 또는 `docs/dependency-requests.md`를 먼저 작성한다.
6. 구현 후 `npm run build`, 관련 Playwright 테스트, 또는 최소 타입/동작 검증을 수행한다.
