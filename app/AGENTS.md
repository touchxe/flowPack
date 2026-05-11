# FlowPack App Rules

이 파일은 `app/` 아래 Next.js 애플리케이션 작업에 적용된다.

## Stack

- Framework: Next.js 15 App Router
- Language: TypeScript
- Styling: Tailwind CSS + shadcn/ui
- UI primitives: Radix UI
- Icons: Lucide React only
- ORM/DB: Prisma + PostgreSQL
- Auth: Auth.js v5 / NextAuth.js v5
- Package manager: npm

## Commands

`app/` 디렉터리에서 실행한다.

- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- E2E tests: `npm run test:e2e`
- E2E UI: `npm run test:e2e:ui`
- Prisma schema sync: `npx prisma db push`

`package.json`에 `lint` 스크립트가 있지만 Next.js 15 환경에서 동작 여부를 확인하고 사용한다.

## Directory Rules

- Routes: `app/app/**`
- Public pages: `app/app/(public)/**`
- Authenticated pages: `app/app/(app)/**`
- API routes: `app/app/api/**`
- UI primitives: `app/components/ui/**`
- Layout components: `app/components/layouts/**`
- Common reusable components: `app/components/common/**`
- Feature-specific code: `app/features/**`
- Shared utilities: `app/lib/**`
- Server-only code: `app/server/**`
- Global types: `app/types/**`
- Prisma schema: `app/prisma/schema.prisma`
- E2E tests: `app/tests/e2e/**`

새 폴더를 만들기 전에 `../docs/architecture.md`의 구조와 맞는지 확인한다.

## Implementation Rules

- Server Components를 기본으로 하고, 상태/이벤트/브라우저 API가 필요한 컴포넌트에만 `'use client'`를 사용한다.
- 데이터 페칭은 Server Component, Route Handler, 또는 승인된 서버 상태 도구를 사용한다. `useEffect` 안의 초기 데이터 fetch는 피한다.
- 클라이언트 컴포넌트는 `@/lib/prisma`, `@/server/**`, 서버 전용 환경변수를 import하지 않는다.
- shadcn/ui 컴포넌트가 있으면 먼저 사용하고, 없으면 Tailwind와 Radix 조합으로 구현한다.
- Lucide React 외 아이콘 패키지를 추가하거나 사용하지 않는다.
- API 응답은 `../docs/api-contract.md`의 `{ success, data/error, code }` 형식과 상태 코드를 따른다.
- Prisma 모델/필드는 `../docs/db-schema.md`와 `prisma/schema.prisma`를 함께 확인한다.

## UI Copy And Design

- 사용자 대면 문구는 한국어를 기본으로 하고 `../docs/ux-copy.md`와 톤을 맞춘다.
- 한자/중국어/일본어 문자 혼용을 피한다.
- 버튼, 빈 상태, 에러, 로딩 문구는 `../docs/design-defaults.md` 패턴을 따른다.
- 앱 내부 화면은 업무용 SaaS답게 조용하고 스캔하기 쉬운 밀도를 우선한다.
- 랜딩/마케팅 화면도 과한 보라색 그라디언트, 유리모피즘, 불필요한 장식 카드를 피한다.

## Tests And Verification

- UI 변경 후 가능하면 Playwright로 관련 페이지를 확인한다.
- API/비즈니스 로직 변경은 계약, 인증, 에러 형식, 입력 검증을 함께 확인한다.
- 테스트 결과 산출물(`test-results/`, trace 등)은 필요하지 않으면 새로 커밋하지 않는다.

