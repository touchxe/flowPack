# FlowPack Agent Guide

이 파일은 Codex와 후속 AI 개발 도구가 작업 시작 전에 반드시 읽어야 하는 프로젝트 운영 규칙이다. 기존 Cursor 규칙과 BMAD 산출물을 보존하면서, 현재 코드베이스 기준으로 개발 시 지켜야 할 내용을 한곳에 묶는다.

## 프로젝트 개요

- 제품: FlowPack, AI 기반 홍보 콘텐츠 제작 및 멀티채널 배포 플랫폼.
- 앱 위치: `app/`가 실제 Next.js 프로젝트 루트다.
- 프레임워크: Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS, shadcn/ui, Lucide React.
- 백엔드: Next.js Route Handler, Auth.js v5, Prisma, PostgreSQL.
- 주요 도메인: 인증, AI 콘텐츠 생성, 미디어, SNS/WordPress 연동, 캘린더, 분석, 결제, 관리자.
- 현재 Git 기준 브랜치: `main`.

## 반드시 먼저 확인할 파일

작업 전에 아래 파일을 읽고 현재 요청과 충돌하지 않는지 확인한다.

- `tasks/workflow_state.md`: 프로젝트 진행 상태의 기준점.
- `docs/tech-stack.md`: 허용 기술 스택과 금지 기술.
- `docs/architecture.md`: 폴더 구조와 데이터 흐름.
- `docs/api-contract.md`: API 응답 형식, 엔드포인트, 에러 코드.
- `docs/db-schema.md`: Prisma/DB 스키마 기준.
- `docs/design-defaults.md`: shadcn, 버튼, 카드, 폼, 빈 상태, 로딩, 반응형 기준.
- `docs/design-direction.md`: 색상, 타이포그래피, 레이아웃 방향.
- `docs/anti-patterns.md`: 즉시 중단해야 하는 금지 패턴.
- `.cursor/rules/*.mdc`: 이전 개발 도구에서 사용하던 상세 에이전트 규칙.

위 문서들은 원칙적으로 읽기 전용이다. 변경이 필요하면 `docs/change-proposals/`에 제안서를 먼저 작성하고 사용자 승인을 받아야 한다.

## 개발 명령

명령은 `app/` 디렉터리에서 실행한다.

```bash
npm install
npm run dev
npm run build
npm run test:e2e
npx prisma generate
npx prisma db push
```

참고:
- `npm run build`는 `prisma generate && next build`를 실행한다.
- Playwright 설정 파일은 `app/tests/e2e/playwright.config.ts`이며 현재 `baseURL`은 `http://localhost:3002`다.
- 일반 개발 서버는 Next 기본값인 `http://localhost:3000`을 사용한다. 테스트 실행 전 포트 불일치를 반드시 확인한다.

## 접속 및 환경 정보

실제 비밀값은 절대 문서나 응답에 노출하지 않는다. 현재 로컬에는 `app/.env`, `app/.env.local`이 존재하며 `.gitignore`에 의해 제외된다.

필요하거나 코드에서 참조되는 환경 변수 이름:

- 인증: `NEXTAUTH_URL`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`
- 데이터베이스: `DATABASE_URL`
- AI: `OPENAI_API_KEY`
- 결제: `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`, `TOSS_WEBHOOK_SECRET`, `NEXT_PUBLIC_TOSS_CLIENT_KEY`
- Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`
- Meta/Threads: `META_APP_ID`, `META_APP_SECRET`, `THREADS_APP_ID`, `THREADS_APP_SECRET`
- 이메일/배포: `RESEND_API_KEY`, `VERCEL_URL`

보안 규칙:
- 서버 비밀값에 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
- 토큰, API 키, OAuth secret, DB URL 값을 채팅이나 문서에 그대로 쓰지 않는다.
- SNS 토큰은 평문 저장 금지다. 저장 로직을 만질 때 암호화 요구사항을 먼저 확인한다.

## 구현 규칙

- UI는 shadcn/ui 컴포넌트를 먼저 사용하고, 아이콘은 `lucide-react`만 사용한다.
- 스타일은 Tailwind와 CSS 변수 기반 토큰을 사용한다. CSS Modules, styled-components, emotion, 인라인 스타일은 금지다.
- 사용자 대면 텍스트는 한국어와 영어만 사용한다. 한자/일본어/중국어 문자가 섞이지 않게 한다.
- 변수/함수명은 영어 camelCase, 컴포넌트/타입은 PascalCase, 파일명은 kebab-case를 사용한다.
- `page.tsx`, `layout.tsx`를 제외한 컴포넌트는 named export를 기본으로 한다.
- TypeScript는 `strict` 기준이다. `any`, non-null assertion, 과도한 `as` 단언을 피하고 `unknown`, 타입 가드, Zod를 사용한다.
- API 응답은 `docs/api-contract.md`의 `{ success: true, data }` / `{ success: false, error, code }` 형식을 따른다.
- 새 API, 새 DB 필드, 새 폴더, 새 의존성은 기존 문서에 없으면 먼저 변경 제안 또는 의존성 요청을 작성한다.
- 클라이언트 컴포넌트에서 Prisma, 서버 비밀값, 서버 전용 모듈을 import하지 않는다.
- 데이터 페칭은 서버 컴포넌트, Route Handler, 또는 승인된 클라이언트 상태 도구를 사용한다. `useEffect` 안의 직접 fetch는 금지 패턴이다.
- 외부 API 실패는 삼키지 말고 로깅과 사용자 친화적 에러 응답을 남긴다.

## 테스트 및 검증

- 원칙은 BDD/테스트 선행이다. 최소한 변경한 기능의 핵심 경로는 Playwright 또는 관련 테스트로 확인한다.
- 기존 테스트 산출물은 `app/tests/`, `app/test-results/`, `app/tests/screenshots/`에 있다.
- 현재 `docs/tech-stack.md`는 Vitest와 TanStack Query를 기준으로 적고 있지만, `package.json`에는 아직 설치되어 있지 않다. 새로 추가하려면 `docs/dependency-requests.md`에 요청 사유를 남기고 승인받는다.
- 빌드 전 Prisma 스키마 변경이 있으면 `npx prisma generate`와 마이그레이션/DB push 필요 여부를 확인한다.

## 현재 주의할 불일치

- 루트 `README.md`와 일부 로그 파일은 인코딩이 깨져 보일 수 있다. UTF-8로 읽어도 깨지는 문서는 `app/README.md`와 `docs/` 문서를 우선 신뢰한다.
- `docs/design-direction.md`는 Cyan Ocean 방향을 말하지만, 현재 `tailwind.config.ts`와 `globals.css`에는 The Verge/Jelly Mint 계열 토큰이 추가되어 있다. 디자인 변경 작업 시 실제 구현 토큰과 문서 기준의 차이를 먼저 확인한다.
- `docs/api-contract.md`에는 `/api/generate/blog`가 있으나 실제 코드에는 `/api/generate/longform` 등 구현된 경로가 더 많다. API 작업 전 실제 라우트와 계약 문서의 차이를 확인하고, 새 계약이 필요하면 제안서를 작성한다.
- `app/prisma/schema.prisma`는 직접 수정 금지 주석이 있다. 스키마 변경은 문서/제안/승인 흐름을 따른다.

## 작업 기록

- 의미 있는 기능 변경, 아키텍처 변경, Phase/Sprint 진행 변경은 `tasks/workflow_state.md` 또는 `logs/`에 기록한다.
- 새 의존성이 필요하면 `docs/dependency-requests.md`에 이유, 대안 검토, 영향 범위, 상태를 남긴다.
- 아키텍처나 API/DB 계약을 바꿔야 하면 `docs/change-proposals/CP-###-title.md`를 먼저 만든다.
