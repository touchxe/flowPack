# WordPress → FlowPack 커넥터 구현 기록

- 일자: 2026-09-22
- 변경 제안: `docs/change-proposals/CP-009-wordpress-flowpack-connector.md`
- 플러그인 저장소: `/Users/shin-youngbin/workspace/flowpack-wordpress-connector`
- 상태: 로컬 구현·검증 완료, 운영 배포 gate 대기

## 구현

- 공개 외부 API를 NAS에서 명시적으로 활성화하는 `FLOWPACK_EXTERNAL_API_ENABLED` 경계
- API 키의 기능·scope를 확인하는 `/api/v1/capabilities`
- 내구성 있는 `generation_jobs` 테이블과 202 생성 job API
- lease 기반 내부 generation worker와 별도 Compose profile
- WordPress용 정제 HTML 및 mediaId 참조 응답
- 최대 10장 JPG·PNG·WebP의 WordPress → FlowPack 업로드와 결과 글 연결
- FlowPack 비공개 사진을 WordPress 미디어로 sideload하고 alt·대표 이미지 반영
- WordPress draft 기본, pending 선택, 자동 publish 금지
- WP-Cron 기반 상태 확인, 멱등 키, 콘텐츠 ID 기반 중복 방지
- `/api/v1/**`만 전달하는 Nginx gateway 예시

## 검증

- `npm run test:external-api`: 17/17 통과
- `npm run test:nas`: 253/253 통과. 공개 HTTPS gateway가 `/api/v1/**`만 전달하고 내부 worker route를 노출하지 않으며 외부 API flag가 read-only 경계를 우회하지 않는 계약 포함
- WordPress 계약 테스트: 10/10 통과
- HTTPS mock 서버의 인증, JPG 업로드, queued → running → succeeded, rendered HTML, 인증 이미지 다운로드 직접 호출 통과
- Local WordPress 7.1.1·PHP 8.2.29에 ZIP 설치·활성화 성공
- 로컬 HTTPS mock과 실제 WordPress DB·미디어를 사용한 통합시험 통과
- 초기 HTTPS mock 결과: draft 1건, pending 1건, publish 0건, 대표 이미지·alt 반영, 미해결 media token·Bearer 문자열 0건
- 통합시험 재실행 후에도 FlowPack 글은 2건으로 유지되어 contentId 중복 방지 확인
- 확장 통합시험에서 503 + Retry-After 뒤 `generating` 유지·재시도 예약·최종 성공 확인
- 두 번째 필수 사진 다운로드 실패 시 WordPress 글 수와 FlowPack 첨부 수가 늘지 않아 신규 첨부 보상 삭제 확인
- 확장 시험 종료 후 API URL·키 빈 값, 예약된 테스트 cron 없음, 성공 job 7건·의도된 실패 job 1건 확인
- Docker 없는 `tests/integration/run-local.sh` 작성 및 재실행 통과
- PHP 13개 파일 임시 PHP parser 구문 분석 통과
- TypeScript와 변경 파일 ESLint 통과
- `npx prisma validate` 통과
- `npm run build` 통과. 기존 코드 경고만 존재
- Local Nginx 1.26.1의 `nginx -t`로 공개 gateway 설정 문법과 TLS 인증서 로딩 통과
- worker 최대 재시도 직후 프로세스가 종료돼도 만료 lease를 실패 처리하고 예약 크레딧을 복구하도록 보완
- worker 실행기를 import 가능한 단위로 분리하고 URL 자격증명·짧은 secret·안전하지 않은 worker ID를 시작 시 거부하도록 보완
- localhost HTTP 실행 시험으로 Bearer·worker ID 헤더, 204 idle delay, 503 error backoff, secret 비로그를 확인
- Docker 없는 `prisma dev` PostgreSQL에서 외부 API·generation job migration을 각각 두 번 적용해 재실행 안전성 확인
- PostgreSQL 카탈로그에서 새 테이블 3개, 컬럼, 외래키, unique index, job 상태 CHECK를 확인하고 잘못된 상태 INSERT 거부 확인
- 로컬 NAS 저장소를 사용하는 실제 FlowPack API에서 사진 201, 비동기 job 202, worker 성공, rendered 이미지와 인증 사진 다운로드 200, 두 멱등 replay 확인
- Local Nginx HTTPS gateway 런타임에서 capabilities 200, 내부 worker·루트 404 확인
- 실제 FlowPack API·worker를 Local WordPress 플러그인에 연결해 사진 포함 draft 5664와 pending 5665 생성, publish 0건 확인
- 시험 종료 후 WordPress API URL·키·cron·임시 상태 없음, Next·Nginx·AI mock·Prisma dev 서버 정상 종료
- 실제 OpenAI 키는 429 `credit_balance_exhausted`를 반환했다. 성공 orchestration은 개발 모드·loopback 전용 OpenAI 호환 서버로 검증했으며 프로덕션에서는 해당 override가 거부된다.
- 공개 staging용 `run-flowpack-staging-wordpress.sh` 추가: 내부 worker 좌표 없이 공인 HTTPS API만 사용하고, 사진 포함 초안 1건을 생성한 뒤 배포 worker 완료를 최대 5분 polling
- staging runner는 정확한 `CREATE_ONE_STAGING_DRAFT` confirmation 없이는 DB 백업·API 호출 전에 중단됨을 실행 확인
- staging runner가 localhost뿐 아니라 IP literal·단일 호스트명·`.local` 주소를 DB 접근 전에 거부하도록 보강하고 사설 IP·`.local`·단일 이름 거부를 실행 확인
- runner 분리 변경 후 Docker 없는 전체 E2E 재실행 통과: 인증 없는 capabilities 401, 최소 scope 키 사용 시 200, 내부 worker·루트 404
- 재실행에서 실제 FlowPack job 2건 모두 성공하고 Local WordPress draft 5687·pending 5688 생성, draft 대표 이미지 5686·alt·미해결 token 0·publish 0 확인
- 재실행 종료 후 API URL·키·임시 상태·cron 없음, 테스트 서버 4개 종료 확인. WordPress DB 백업은 `/private/tmp/flowpack-dev-before-runtime-recheck-20260922.sql`
- 설치 ZIP SHA-256: `99758fe9603765e3fd809fb1d59e95eec255e9a589e50f9dbe8a4fd7e54d576e`

## 배포 gate

다음 항목은 유효한 자격증명이나 운영 대상이 없어 실행하지 않았다.

1. PostgreSQL migration `20260922090000_add_external_content_api`, `20260922130000_add_generation_jobs` 적용
2. 공개 API 도메인, TLS 인증서, gateway 공급자 확정
3. 운영 환경의 `FLOWPACK_EXTERNAL_API_ENABLED=true`, `COMPOSE_PROFILES=external-api`, `FLOWPACK_WORKER_SECRET` 설정
4. 최소 scope API 키 발급
5. 실제 공개 FlowPack API와 테스트 WordPress를 연결한 staging smoke test
6. 실제 OpenAI 크레딧 복구 후 외부 AI provider smoke test

로컬 WordPress 최초 시험 전 DB를 `/private/tmp/flowpack-dev-before-local-runner-20260922.sql`, 확장 실패·재시도 시험 전 DB를 `/private/tmp/flowpack-dev-before-failure-retry-tests-20260922.sql`, 실제 FlowPack 연결 전 DB를 `/private/tmp/flowpack-dev-before-actual-runtime-20260922.sql`, 최종 재검증 전 DB를 `/private/tmp/flowpack-dev-before-runtime-recheck-20260922.sql`에 백업했다. 테스트용 API 주소와 키는 실행 후 빈 값으로 복원했고 플러그인만 활성 상태로 유지했다. 현재 FlowPack `.env`의 DB는 원격 Supabase이므로 운영 여부를 확인하지 않고 migration을 적용하지 않았다.

추가로 `prisma migrate status`와 Prisma Client의 읽기 전용 `SELECT 1`로 현재 DB 상태를 확인했다. 두 설정 파일은 같은 Supabase pooler를 가리키지만 서버가 `tenant/user ... not found`로 연결을 거부해 migration 이력도 읽을 수 없었다. 공개 smoke 전 유효한 테스트/배포 PostgreSQL 접속정보가 반드시 필요하다.
