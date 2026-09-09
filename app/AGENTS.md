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

## NAS 전체 이전 및 표준 배포 규칙

FlowPack 운영 앱·PostgreSQL·소유 파일은 NAS에 두고 사용자 접속은 Tailscale
Serve HTTPS만 사용한다. 공유기 포트포워딩과 공개 DSM·SSH·Docker·앱·DB
포트는 금지한다. 기존 Vercel, Neon, Cloudinary는 restore drill과 안정화
기간이 끝날 때까지 rollback source로 보존한다.

현재 안전하게 실행 가능한 준비 순서는 다음으로 고정한다.

```text
npm run nas:check -> npm run nas:dry-run -> PostgreSQL restore rehearsal
-> npm run lint -> npm run typecheck -> npx prisma validate
-> npm run test:nas -> npm run build -> npm run test:e2e
-> 의도한 tracked commit -> 배포 승인 대기
```

- 임의 `scp`, `rsync`, SFTP, 원격 소스 수정, 수동 `docker-compose up`을 정상
  배포 경로로 사용하지 않는다.
- release는 committed `HEAD`에서만 만들고 archive·파일 manifest checksum을
  검증한다. secret 경로, 미추적 파일, link, traversal entry를 거부한다.
- `nas:check`는 로컬 경계 검증 뒤 forced-command gateway의
  `system.preflight`만 호출한다. 직접 Docker, raw SSH 명령, SCP 검사는 하지 않는다.
- `release.receive`의 비동기 파일 streaming과 root-owned handler가 아직 승인되지
  않았으므로 `nas:deploy`와 `nas:verify`는 명시적 blocker로 종료해야 한다. 해당
  receipt가 구현·검증되기 전에는 이를 정상 배포 명령으로 설명하거나 우회하지 않는다.
- 향후 gateway release handler가 변경할 수 있는 대상은 root policy가 고정한
  immutable release namespace와 atomic current pointer뿐이다. client/operator는
  remote root, Compose/bin/env path를 전달하지 않는다.
- 실제 host, 계정, 경로, URL, key, dump 내용, 사용자 파일명은 Git에서 제외된
  operator/NAS 파일에만 두며 출력하지 않는다.
- 현재 SQLite 형식 migration은 NAS PostgreSQL에 실행하지 않는다. 실제
  Neon production schema drift가 0임을 확인하고 승인된 PostgreSQL baseline을 만든
  뒤에만 `prisma migrate deploy`를 허용한다. 운영에서 `prisma db push`는
  금지한다.
- DB dump와 media manifest는 scratch restore와 checksum 검증을 통과해야 한다.
  코드 rollback과 DB/file rollback을 같은 작업으로 주장하지 않는다.
- NAS가 write를 받은 뒤에는 reverse reconciliation 또는 명시적인 loss window
  없이 기존 Vercel/Neon으로 전환하지 않는다.
- 공개 callback relay가 별도 승인되기 전에는 Toss·Meta inbound webhook과
  외부 플랫폼이 NAS media URL을 가져가는 기능을 활성화하지 않는다.
- NAS에는 singleton scheduler 구현이 없으므로 로컬 scheduler 활성화를 정상
  단계로 간주하지 않는다. WordPress의 provider-side 예약만 유지하며, 공급자
  콘솔 인벤토리가 별도 작업을 발견하면 구현·리허설 전까지 절체를 중단한다.
- 전체 이전과 절체의 표준 제어면은 schema v2 `restricted-gateway-v1` 하나만
  사용한다. 클라이언트는 SSH 원격 명령을 보내지 않으며 `flowpack-v2`에 고정된
  forced-command 전용 `flowpack_gateway_ed25519` 키와 pin된 helper/policy/protocol
  digest를 요구한다. DSM 제약 때문에 승인된 administrators 그룹 계정은 허용하지만
  root 로그인과 기존 unrestricted 관리 키의 표준 사용은 금지한다.
- 표준 경로에서 raw shell, 직접 Docker/Compose, `scp`, SFTP, caller-controlled
  NAS root/path/bin/env를 금지한다. root-owned gateway 설치·UID→`flowpack-v2`
  단일 매핑·공식 protocol digest·action receipt가 모두 확인되기 전에는 mutation,
  commit, finalize를 `ACTION_NOT_ENABLED` 또는 로컬 fail-close로 중단한다.

승인 범위와 gate는 `docs/change-proposals/CP-007-nas-full-migration.md`를
따른다.
