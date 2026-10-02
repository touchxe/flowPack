# FlowPack 외부 글·사진 API 사용 가이드

외부 API는 API 키가 있는 자동화 프로그램을 위한 기능이다. 모든 생성 결과는 BLOG 초안으로 저장된다. API 키와 실제 호스트 주소를 소스 코드나 로그에 남기지 않는다. WordPress는 Tailscale 대신 `/api/v1/**`만 전달하는 공개 HTTPS gateway를 사용한다.

사용 전 `20260922090000_add_external_content_api`와 `20260922130000_add_generation_jobs` PostgreSQL migration이 승인된 배포 절차로 적용되어 있어야 한다. NAS 운영 환경에서는 restricted gateway와 baseline 검증을 거치며 운영 `prisma db push`를 사용하지 않는다. 외부 API는 `FLOWPACK_EXTERNAL_API_ENABLED=true`, worker는 32자 이상의 `FLOWPACK_WORKER_SECRET`이 필요하다.

NAS에서는 외부 API flag만 켜면 안 된다. `FLOWPACK_WRITE_MODE=read-write`와 `flowpack_app_rw` 사용자의 `DATABASE_URL`로 통제된 전환이 끝난 뒤에만 `COMPOSE_PROFILES=external-api`를 활성화한다. read-only 상태에서는 capabilities 같은 GET만 가능하고 사진 업로드·생성 job 등록·worker 실행은 `MAINTENANCE_READ_ONLY`로 차단된다.

## 1. API 키 운영

프로젝트의 `app/` 디렉터리에서 실행한다.

```bash
npm run external-api:key -- create user@example.com automation-name
npm run external-api:key -- list user@example.com
npm run external-api:key -- revoke API_KEY_ID
```

create 출력의 token은 한 번만 표시된다. 비밀 저장소에 보관하고 `Authorization: Bearer YOUR_FLOWPACK_API_KEY` 헤더로 사용한다. 기본 키는 90일간 유효하며 모든 외부 콘텐츠·미디어 scope를 갖는다. create의 세 번째 인자로 유효 일수, 네 번째 인자로 쉼표로 구분한 scope를 전달할 수 있다.

WordPress 플러그인에는 쓰지 않는 `content:write`를 제외한 최소 scope만 발급한다.

```bash
npm run external-api:key -- create user@example.com wordpress 90 content:generate,content:read,media:write,media:read
```

## 2. 사진 업로드

쓰기 요청의 Idempotency-Key에는 호출 작업마다 만든 UUID 같은 고유값을 사용한다. 네트워크 오류로 같은 요청을 재전송할 때는 같은 값을 유지한다.

```bash
curl -X POST "https://YOUR_FLOWPACK_API_HOST/api/v1/media" \
  -H "Authorization: Bearer YOUR_FLOWPACK_API_KEY" \
  -H "Idempotency-Key: upload-unique-id" \
  -F "file=@/absolute/path/photo.jpg"
```

응답의 `data.id`가 mediaId이다. JPG·PNG·WebP만 지원하며 장당 최대 20 MiB이다.

## 3. 사진이 포함된 글 등록

```bash
curl -X POST "https://YOUR_FLOWPACK_API_HOST/api/v1/contents" \
  -H "Authorization: Bearer YOUR_FLOWPACK_API_KEY" \
  -H "Idempotency-Key: content-unique-id" \
  -H "Content-Type: application/json" \
  --data '{
    "title": "가을 행사 안내",
    "bodyFormat": "markdown",
    "body": "# 행사 안내\n\n![행사장 전경](flowpack-media:MEDIA_ID)",
    "images": [{"mediaId":"MEDIA_ID","altText":"행사장 전경"}],
    "coverMediaId": "MEDIA_ID"
  }'
```

사진은 먼저 업로드해야 한다. 본문에서 사용한 mediaId는 images 목록에도 있어야 하며, 대표 사진도 images에 포함해야 한다.

## 4. 조회와 수정

```bash
curl "https://YOUR_FLOWPACK_API_HOST/api/v1/contents/CONTENT_ID" \
  -H "Authorization: Bearer YOUR_FLOWPACK_API_KEY"
```

수정할 때 조회 결과의 revision을 expectedRevision으로 보낸다.

```bash
curl -X PATCH "https://YOUR_FLOWPACK_API_HOST/api/v1/contents/CONTENT_ID" \
  -H "Authorization: Bearer YOUR_FLOWPACK_API_KEY" \
  -H "Idempotency-Key: update-unique-id" \
  -H "Content-Type: application/json" \
  --data '{"expectedRevision":1,"title":"수정된 제목"}'
```

다른 편집이 먼저 저장되면 409 `REVISION_CONFLICT`가 반환된다. 최신 글을 다시 조회하고 변경 내용을 합친 뒤 새로운 Idempotency-Key로 요청한다.

## 5. AI 글 생성

```bash
curl -X POST "https://YOUR_FLOWPACK_API_HOST/api/v1/generations/longform" \
  -H "Authorization: Bearer YOUR_FLOWPACK_API_KEY" \
  -H "Idempotency-Key: generation-unique-id" \
  -H "Content-Type: application/json" \
  --data '{
    "topic":"소상공인을 위한 SNS 마케팅",
    "keywords":["소상공인","SNS 마케팅"],
    "length":"medium",
    "tone":"friendly",
    "instructions":"실행 체크리스트를 포함해주세요."
  }'
```

연결을 유지한 채 생성이 끝나면 201과 초안을 반환한다. 클라이언트 제한 시간은 300초 이상을 권장한다. 응답을 받지 못했을 때 같은 Idempotency-Key로 재요청하면 완료된 최초 결과를 받으며 추가 생성·차감하지 않는다. `REQUEST_IN_PROGRESS`이면 잠시 뒤 같은 요청을 다시 보낸다.

WordPress처럼 장시간 HTTP 연결이 불안정한 환경은 비동기 API를 사용한다.

```http
GET /api/v1/capabilities
POST /api/v1/generation-jobs/longform
GET /api/v1/generation-jobs/JOB_ID
GET /api/v1/contents/CONTENT_ID/rendered
```

POST는 202와 `queued` 작업을 반환한다. 미리 업로드한 사진을 `images`와 `coverMediaId`로 함께 보내면 본문 끝과 대표 이미지에 연결된다. 상태 조회 결과가 `succeeded`이면 `contentId`의 rendered endpoint를 조회하고, 각 이미지 `contentPath`를 같은 Bearer 키로 다운로드한다. 비공개 FlowPack 이미지 주소를 공개 WordPress 본문에 직접 넣지 않는다. 429 응답은 `Retry-After` 이후 다시 시도한다.

worker는 공개 gateway가 아니라 내부 주소의 `/api/internal/generation-worker/run`만 호출한다. `FLOWPACK_WORKER_SECRET`은 32자 이상이어야 하며 URL에 자격증명을 넣지 않는다. 한 건을 처리하면 바로 다음 작업을 조회하고, 빈 큐의 204 응답에는 5초, HTTP·네트워크 오류에는 15초 대기한다. 응답 본문과 로그에는 worker secret을 남기지 않는다.

Docker 없는 전체 로컬 검증 절차는 `docs/local-wordpress-flowpack-runtime-test.md`를 따른다. `FLOWPACK_AI_TEST_BASE_URL`은 개발 모드의 loopback OpenAI 호환 시험 서버에만 사용할 수 있고 production에서는 거부된다.

## 6. 주요 오류

| 상태 | code | 대응 |
|---|---|---|
| 401 | UNAUTHORIZED | 키·만료·폐기 상태 확인 |
| 403 | INSUFFICIENT_SCOPE | 키 scope 확인 |
| 402 | CREDIT_EXHAUSTED | AI 크레딧 확인 |
| 409 | IDEMPOTENCY_CONFLICT | 다른 작업에는 새 키 사용 |
| 409 | REQUEST_IN_PROGRESS | 같은 키로 잠시 뒤 재요청 |
| 409 | REVISION_CONFLICT | 최신 글 조회 후 다시 수정 |
| 413 | PAYLOAD_TOO_LARGE | 사진 크기 축소 |
| 415 | UNSUPPORTED_MEDIA_TYPE | JPG·PNG·WebP 사용 |
| 422 | INVALID_MEDIA_REFERENCE | 사진 소유권·images·본문 참조 확인 |
| 503 | STORAGE_UNAVAILABLE / AI_NOT_CONFIGURED | 서버 설정 확인 |
