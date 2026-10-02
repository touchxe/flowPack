# Docker 없는 FlowPack → Local WordPress 전체 시험

이 문서는 운영 비밀값을 사용하거나 저장하지 않고, 로컬 PostgreSQL·HTTPS gateway·FlowPack worker·WordPress 플러그인의 전체 경로를 재현하는 절차다. 운영 배포를 대체하지 않으며 공개 DNS와 실제 CA 인증서는 별도 staging gate에서 확인한다.

## 구성

```text
Local WordPress
  → https://localhost:HTTPS_PORT/api/v1/**
  → Local Nginx
  → Next.js FlowPack
  → Prisma local PostgreSQL

내부 worker runner
  → http://127.0.0.1:FLOWPACK_PORT/api/internal/generation-worker/run
```

WordPress에는 HTTPS gateway와 최소 scope API 키만 설정한다. 내부 worker URL과 secret은 WordPress 설정에 저장하지 않는다. gateway는 `/api/v1/**`만 전달하고 내부 worker와 나머지 경로는 404로 종료해야 한다.

## 1. 로컬 PostgreSQL

`app/`에서 Prisma 공식 로컬 서버를 시작한다. Docker와 시스템 PostgreSQL 설치는 필요하지 않다.

```bash
npx prisma dev --experimental
```

CLI가 출력한 동적 포트의 URL을 사용한다. 이 환경에서 Prisma Client prepared statement 충돌이 있으면 쿼리에 `pgbouncer=true&connection_limit=1`을 추가한다. 실제 `.env` 파일은 바꾸지 말고 시험 프로세스의 `DATABASE_URL`로만 전달한다.

두 migration은 기존 핵심 테이블이 있는 격리 스키마에 각각 두 번 적용해 재실행 안전성을 확인한다.

```text
20260922090000_add_external_content_api
20260922130000_add_generation_jobs
```

전체 런타임 시험은 별도 PostgreSQL schema를 지정한 URL로 `prisma db push --skip-generate`를 실행한다. `db push`는 이 폐기 가능한 로컬 시험 스키마에만 사용하며 staging·운영에서는 승인된 migration 절차를 사용한다.

## 2. AI 성공 경로

실제 AI 크레딧을 사용하지 않는 로컬 시험은 다음 서버를 실행한다.

```bash
node scripts/openai-compatible-test-server.mjs
```

FlowPack 개발 서버에는 `FLOWPACK_AI_TEST_BASE_URL=http://127.0.0.1:3108/v1`과 비밀이 아닌 로컬 테스트 키를 전달한다. 이 override는 다음 조건을 모두 만족할 때만 동작한다.

- `NODE_ENV`가 production이 아님
- provider가 OpenAI 호환 경로임
- host가 `127.0.0.1`, `localhost`, `::1` 중 하나임
- URL에 사용자명, 비밀번호, query, fragment가 없음

프로덕션에서 이 환경 변수를 설정하면 FlowPack은 시작한 AI 요청을 거부한다. 실제 AI provider 시험은 유효한 크레딧이 있는 staging에서 별도로 수행한다.

## 3. 로컬 저장소와 FlowPack

시험 프로세스에 다음 값을 전달한다.

```text
FLOWPACK_EXTERNAL_API_ENABLED=true
FLOWPACK_WRITE_MODE=read-write
FLOWPACK_STORAGE_DRIVER=nas
FLOWPACK_STORAGE_ROOT=/private/tmp/flowpack-runtime-media
FLOWPACK_WORKER_SECRET=<32자 이상 임시 secret>
```

테스트 사용자와 `content:generate,content:read,media:write,media:read` scope의 임시 API 키를 로컬 DB에만 만든다. 테스트 종료 후 서버를 닫아도 운영 설정에는 영향이 없다.

## 4. HTTPS gateway

`app/ops/public-api/nginx-flowpack-api.conf.example`을 복사해 localhost 포트, 자체 서명 인증서, FlowPack upstream 포트만 시험값으로 바꾼다. 실행 전 `nginx -t`를 통과해야 한다.

필수 확인값은 다음과 같다.

```text
GET  /api/v1/capabilities (인증 없음)      → 401
GET  /api/v1/capabilities (최소 scope 키)  → 200
POST /api/internal/generation-worker/run   → 404
GET  /                                     → 404
```

## 5. Local WordPress

플러그인 저장소에서 `tests/integration/run-flowpack-runtime-local.sh`를 실행한다. 필요한 환경 변수와 Local PHP·WP-CLI·MySQL 경로는 같은 폴더의 `README.md`를 따른다.

runner는 다음을 검사한다.

1. WordPress 사진을 실제 FlowPack media API에 HTTPS로 업로드
2. 사진을 연결한 비동기 draft job 등록
3. 내부 URL에서 worker 1회 실행
4. rendered HTML과 인증 사진을 WordPress 미디어로 복사
5. alt와 대표 이미지가 있는 `draft` 저장
6. 별도 job을 `pending`으로 저장
7. FlowPack 글의 `publish` 건수가 0인지 확인
8. 종료 시 WordPress의 테스트 API URL·키를 원래 값으로 복원

runner는 시작 전에 WordPress DB를 백업한다. 성공한 draft와 pending은 사람이 확인할 수 있도록 남기며 테스트 API 키, URL, 예약 cron, 임시 상태 option은 남기지 않는다.

## 6. 2026-09-22 검증 결과

- PostgreSQL migration 최초 적용·재실행 성공
- 새 테이블·컬럼·FK·index·job status CHECK 확인
- 사진 업로드 201, 비동기 job 202, worker succeeded
- rendered 이미지 1건과 인증 사진 다운로드 200
- Local Nginx gateway의 `/api/v1/**` 전달 및 내부 경로 차단 확인
- Local WordPress draft 5664, pending 5665, publish 0
- draft 대표 이미지·alt 반영, 미해결 `flowpack-media:` token 0
- 테스트 설정·cron·임시 상태 정리 후 모든 로컬 서버 종료

최근 runner 분리 변경 이후에도 같은 전체 경로를 2026-09-22에 다시 실행했다.

- Local WordPress 7.1.1·PHP 8.2.29의 실행 중인 `dev-free` 사이트 사용
- 인증 없는 capabilities 401, 최소 scope 키 사용 시 200, 내부 worker·루트 404
- 사진 포함 draft 5687 생성, 대표 이미지 5686과 alt `실제 FlowPack 사진` 확인
- 사진 없는 pending 5688 생성, publish 0, 미해결 `flowpack-media:` token 0
- FlowPack job 2건 모두 `SUCCEEDED`, content 2건, media 1건, 사용 크레딧 2
- 종료 후 WordPress API URL·키·임시 상태·예약 cron 없음
- 재실행 전 DB 백업: `/private/tmp/flowpack-dev-before-runtime-recheck-20260922.sql`
- Next.js·Nginx·AI mock·Prisma dev 테스트 프로세스 정상 종료

실제 배포 완료에는 유효한 PostgreSQL, 공개 DNS·CA TLS, 실제 AI 크레딧으로 같은 smoke test를 다시 통과해야 한다.

## 7. 공개 staging 실행

공개 DNS·CA 인증서·배포 worker·AI 크레딧이 준비되면 플러그인 저장소의 `tests/integration/run-flowpack-staging-wordpress.sh`를 실행한다. 이 runner는 내부 worker URL이나 secret을 받지 않고 public `/api/v1/**` 상태만 polling한다.

```text
FLOWPACK_PUBLIC_API_URL=https://api.example.com
FLOWPACK_API_KEY=<최소 scope staging key>
FLOWPACK_STAGING_SMOKE_CONFIRM=CREATE_ONE_STAGING_DRAFT
```

WordPress·PHP·WP-CLI·MySQL 관련 환경 변수는 플러그인 `tests/integration/README.md`를 따른다. runner는 실제 AI 크레딧 1개, 사진 1개, WordPress 초안 1개를 생성한다. 정확한 confirmation이 없거나 URL이 IP literal·단일 호스트명·`.local`/`.localhost`·비 HTTPS·자격증명 포함 주소이면 DB 백업과 외부 호출 전에 중단한다. 따라서 공개 DNS 이름과 시스템이 신뢰하는 CA 인증서가 반드시 필요하다.
