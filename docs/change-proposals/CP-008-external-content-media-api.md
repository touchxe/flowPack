# CP-008: 외부 글 작성·사진 첨부 연동 상세 기획

- 작성일: 2026-09-22
- 상태: ✅ REST 1차 구현·로컬 검증 완료
- 요청 근거: 외부 API 또는 MCP 글 작성, 사진 첨부, 필수 범위의 상세 기획과 구현계획 작성
- 실행계획: `tasks/external-content-media-implementation-plan.md`
- 승인 근거: 사용자 요청 “목표로 지정하고 끝까지 작업 진행해.”
- 확정 범위: REST, Tailscale 내부 호출, 완성 글 등록과 AI 생성, Markdown, 파일 업로드, 동기 JSON AI 응답, 초안 저장
- 제외: MCP, 공개 인터넷 gateway, 외부 URL 이미지 수집, 발행

## 1. 목표와 완료 상태

외부 프로그램이 사용자 자격으로 사진을 업로드하고, 완성된 글을 등록하거나 FlowPack AI로 글을 생성한 뒤, 사진이 포함된 초안을 조회·수정할 수 있게 한다.

완료 상태는 실제 외부 호출로 만든 글이 기존 콘텐츠 목록·보기·편집 화면에서 열리고, 사진 순서·대표 이미지·본문 위치가 유지되며, 재시도 때문에 글과 크레딧 처리가 중복되지 않는 것이다.

초기 콘텐츠 유형은 BLOG로 한정한다. 초안 저장이 최종 상태이며 공개 발행은 별도 기능이다.

## 2. 현재 코드에서 확인한 사실

| 대상 | 현재 구현 | 이번 작업의 차이 |
|---|---|---|
| `app/app/api/generate/longform/route.ts` | 세션 인증, SSE 생성, BLOG/DRAFT 저장, 크레딧 증가 | 외부 인증 연결, 공통 서비스 분리, 동시성·재시도 정합성 |
| `app/app/api/contents/route.ts` | 세션 기반 목록·일괄 삭제 | 외부 초안 등록 기능 추가 필요 |
| `app/app/api/content/[id]/route.ts` | 세션 기반 조회·수정·삭제 | 외부 계약 및 사진 연결과 원자적 수정 |
| `app/app/api/content/[id]/images/route.ts` | URL/data URL로 이미지 연결 | 소유권 검증된 미디어 ID로 연결 |
| `app/app/api/media/upload/route.ts` | multipart 업로드, 용량 확인, MediaFile 생성 | 외부 인증, 중복·동시 업로드 처리 |
| `app/lib/storage.ts` | Cloudinary/NAS 저장 어댑터 | 기존 설정을 재사용 |
| `app/prisma/schema.prisma` | Content, ContentImage, MediaFile 존재 | 키·요청 기록 및 미디어 관계 보강 필요 |
| `app/components/features/content/tiptap-editor.tsx` | Markdown 입력을 HTML로 변환하는 경로 존재 | 사진 참조 왕복 및 안전한 렌더링 검증 |

문서상의 `POST /api/content`는 현재 구현에 없으며, 기존 응답도 계약 문서와 다르다. 새 계약은 버전 경로에 정의하고 기존 브라우저 호출의 호환성을 유지한다.

NAS/Tailscale는 저장소의 운영 정책이다. 실제 운영 전환 여부·실제 활성 스토리지·호출 가능한 주소는 구현/배포 전 읽기 전용 점검으로 확인하며 이 문서에서 단정하지 않는다.

## 3. 필수 사용자 흐름

### A. 외부에서 완성한 글과 사진 등록

1. 운영자가 지정 사용자용 키를 발급하여 호출자에게 안전하게 전달한다.
2. 호출자는 사진 파일을 한 장씩 업로드하여 mediaId를 받는다.
3. 제목, Markdown 본문, 사진 목록, 대표 사진 ID를 전송한다.
4. 서버는 소유권과 사진 참조를 검증하고 글·사진 연결을 한 트랜잭션으로 저장한다.
5. 호출자는 contentId로 결과를 조회한다. 사용자는 FlowPack에서 초안을 검토한다.

### B. FlowPack AI로 작성 후 사진 추가

1. 호출자가 주제·키워드·톤·길이·추가 지침을 보낸다.
2. 서버가 권한·사용 가능 크레딧을 확인하고 생성을 수행한다.
3. 생성 완료 후 초안 ID를 반환한다. 응답 형태는 D-07에서 결정한다.
4. 호출자가 사진을 업로드하고 글 수정으로 연결·배치한다.

초기 AI 생성 요청에는 사진 해석, 사진 기반 글 생성, AI의 사진 위치 자동 선정 기능을 넣지 않는다. 사진 배치는 호출자가 지정한다.

### C. 수정과 사진 교체

1. 최신 글과 revision을 조회한다.
2. 새 사진이 필요하면 먼저 업로드한다.
3. 제목·본문·전체 사진 목록·대표 사진 중 바꿀 필드와 expectedRevision을 전송한다.
4. 서버는 버전 일치와 최종 사진 참조를 검증한 뒤 한 번에 수정한다.
5. 글에서 사진을 빼는 것은 연결 해제이다. 원본 파일은 미디어 라이브러리에 남는다.

## 4. 기능 요구사항

| ID | 요구사항 | 완료 기준 |
|---|---|---|
| F-01 | 사용자별 외부 인증 | 유효한 키만 허용하고 만료·폐기·차단 사용자 키는 거부 |
| F-02 | 완성 글 등록 | BLOG/DRAFT로 저장, 사용자 ID와 상태는 서버가 결정 |
| F-03 | 결과 조회 | 제목·본문 형식·사진·대표 이미지·revision 반환 |
| F-04 | 부분 수정 | 생략 필드 유지, 충돌 시 덮어쓰지 않고 409 |
| F-05 | 사진 업로드 | 실제 파일 서명·크기·유형·사용자 용량 검증 후 저장 |
| F-06 | 사진 연결 | 본인 사진만 연결, 목록 순서·대체 텍스트·대표 이미지·본문 위치 반영 |
| F-07 | AI 생성 | 기존 장문 기능 재사용, 성공 결과와 크레딧 일관성 유지 |
| F-08 | 안전한 재시도 | 같은 키의 동일 요청은 같은 결과, 다른 입력은 409 |
| F-09 | 오류와 추적 | 공통 오류 코드와 requestId 제공, 비밀값을 로그에 남기지 않음 |

별도 개발자 UI, OAuth 서비스, 글 목록 검색, 외부 삭제 API, 카드뉴스, 예약·즉시 발행, 웹훅, 대량 생성, 외부 URL 수집, AI 이미지 생성은 초기 범위에 포함하지 않는다. MCP는 선택할 경우에만 추가한다.

## 5. 제안하는 최소 REST 계약

아래는 D-01에서 REST를 선택했을 때의 계약 초안이다.

| 메서드·경로 | 역할 | 권한 | 성공 |
|---|---|---|---|
| POST `/api/v1/media` | 이미지 한 장 업로드 | media:write | 201 |
| GET `/api/v1/media/:id/content` | 인증된 이미지 바이트 조회 | media:read | 200, 이미지 응답 |
| POST `/api/v1/contents` | 초안 등록 | content:write | 201 |
| GET `/api/v1/contents/:id` | 초안 조회 | content:read | 200 |
| PATCH `/api/v1/contents/:id` | 초안 수정·사진 배치 | content:write | 200 |
| POST `/api/v1/generations/longform` | AI 초안 생성 | content:generate | D-07에 따라 201 또는 202 |
| GET `/api/v1/generations/:id` | 생성 상태·결과 조회 | content:generate | 비동기 선택 시만 제공 |

인증 헤더는 `Authorization: Bearer <FLOWPACK_API_KEY>`이다. 키·사용자 ID는 URL에 넣지 않는다. 생성·업로드·수정 요청은 `Idempotency-Key`를 필수로 받는다.

JSON 성공은 `{ success: true, data: ... }`, 실패는 `{ success: false, error: "사용자 안내", code: "..." }`를 사용한다. 추적 ID는 `X-Request-Id` 헤더로 제공한다. 이미지 성공 응답만 바이너리 예외이며 인증 오류 등은 JSON이다.

### 5.1 사진 업로드

- 입력: `multipart/form-data`, `file` 1개.
- 출력 data: `id`, `name`, `mimeType`, `size`, `contentPath`.
- 경로는 인증이 필요한 상대 경로이며 공개 URL이 아니다.
- JPEG·PNG·WebP, 1장 최대 20 MiB, 글당 최대 10장 제안.
- 확장자와 클라이언트 MIME만 신뢰하지 않고 파일 서명도 검사한다.
- 요청 바이트 제한을 수신 단계부터 적용한다. Content-Length가 없는 요청도 제한한다.
- 동시 업로드가 계정 용량 한도를 우회하지 않도록 예약 용량을 원자적으로 관리한다.
- 실패하면 예약 용량을 해제한다. 신규 파일의 DB 저장 실패는 파일 정리로 보상한다.
- 정상 업로드 후 글에 연결하지 않은 사진은 일반 미디어로 유지하며 저장 용량에 포함한다.

### 5.2 글 등록 예시

```json
{
  "title": "가을 행사 안내",
  "bodyFormat": "markdown",
  "body": "# 행사 소개\n\n![행사장 전경](flowpack-media:media_example_1)\n\n참여 방법을 안내합니다.",
  "images": [
    { "mediaId": "media_example_1", "altText": "행사장 전경" }
  ],
  "coverMediaId": "media_example_1"
}
```

- `flowpack-media:`는 제안하는 API 입력용 사진 참조 표기이다. 일반 공개 URL이나 MCP 표준이 아니다.
- 필수: title(1~200자), bodyFormat, body(1~100,000자). 공백만 있는 필드는 거부한다.
- images는 생략 시 빈 배열이다. 배열 순서가 첨부 순서이고 동일 mediaId 중복은 거부한다.
- altText는 최대 500자, 생략 시 빈 문자열. 본문 사진의 대체 텍스트는 해당 Markdown 표기에서 가져온다.
- coverMediaId는 images에 포함된 ID만 허용한다. 생략 또는 null이면 명시적 대표 이미지를 설정하지 않는다. 기존 목록의 첫 이미지 fallback은 유지한다.
- 본문 사진 참조는 images에 포함되어야 한다. 존재하지 않거나 타인 소유인 ID는 원자적으로 거부한다.
- 임의 원격 이미지 URL, data URL, 로컬 파일 경로는 초기 입력에서 허용하지 않는다.
- 원격 페이지로 향하는 일반 링크는 허용된 http/https 스킴만 처리한다.
- API 입력에서 임의 HTML은 거부한다. 기존 편집기가 생성한 HTML은 별도 안전한 정규화 경로를 거친다.
- 입력 사진 표기는 서버에서 기존 브라우저가 읽을 수 있는 소유자 인증 미디어 경로로 변환한다.
- API 조회에서 관리 대상 사진 경로를 ID 표기로 복원하며 bodyFormat을 명시한다. 기존 편집기에서 HTML로 저장한 글은 HTML로 반환할 수 있다. Markdown 전용 입력을 선택하면 HTML 전체 본문 재전송은 지원하지 않고 제목·사진 메타데이터 수정은 가능하다.

응답 data는 `id`, `title`, `type: BLOG`, `status: DRAFT`, `body`, `bodyFormat`, `images`, `coverMediaId`, `revision`, `createdAt`, `updatedAt`을 포함한다. images에는 연결 ID, mediaId, altText, order, contentPath를 제공한다. 내부 storage key, 사용자 자격증명, AI 내부 로그는 반환하지 않는다.

### 5.3 수정 규칙

- `expectedRevision` 필수. 변경 가능한 필드는 title, bodyFormat/body, images, coverMediaId이다.
- body를 수정하면 bodyFormat도 함께 보낸다.
- images 생략은 유지, 빈 배열은 연결 전체 해제이다. 본문·대표 이미지가 해제된 사진을 참조하면 422로 거부한다.
- images 전체 교체와 본문 변경은 한 트랜잭션으로 반영한다.
- revision은 브라우저와 외부 API 모두의 콘텐츠 변경 경로에서 증가해야 한다.
- 초안이 아닌 글 수정은 초기 API에서 409로 거부한다.
- ContentImage 연결 해제는 MediaFile이나 다른 글의 사진을 삭제하지 않는다.

### 5.4 AI 생성 입력

```json
{
  "topic": "가을 행사 참여 안내",
  "keywords": ["지역 행사", "가족 참여"],
  "length": "medium",
  "tone": "friendly",
  "industry": "community",
  "instructions": "준비물과 참여 방법을 포함해주세요."
}
```

- 현재 longform 입력 의미를 재사용하고 문자열 길이·배열 개수 상한을 Zod로 제한한다.
- 제안 상한: topic 2,000자, keywords 20개/각 100자, industry 100자, instructions 10,000자.
- 성공한 글당 기존 크레딧 정책 1회를 적용한다. ADMIN/ENTERPRISE 예외는 유지한다.
- AI 생성 실패는 예약 크레딧 반환, 완료한 요청 재조회·재전송은 추가 차감 없음.
- 저장과 크레딧 확정은 동일 DB 트랜잭션으로 처리한다. AI 네트워크 호출 중 DB 트랜잭션을 열어 두지 않는다.
- 기존 브라우저 AI 경로도 같은 크레딧 예약 규칙을 사용해야 동시 요청 우회를 막을 수 있다.

### 5.5 필수 오류

| HTTP | code 예시 | 의미 |
|---|---|---|
| 400 | VALIDATION_ERROR | JSON·입력 필드 오류 |
| 401 | UNAUTHORIZED | 키 누락·만료·폐기 |
| 403 | INSUFFICIENT_SCOPE | 기능 권한 부족 또는 차단 계정 |
| 404 | NOT_FOUND | 대상 없음 또는 타인 소유 |
| 409 | REVISION_CONFLICT / IDEMPOTENCY_CONFLICT / REQUEST_IN_PROGRESS | 수정 충돌·다른 입력 재사용·처리 중 |
| 402 | CREDIT_EXHAUSTED | AI 크레딧 부족 |
| 413 | PAYLOAD_TOO_LARGE | 파일·요청 크기 초과 |
| 415 | UNSUPPORTED_MEDIA_TYPE | 지원하지 않는 이미지 형식 |
| 422 | INVALID_MEDIA_REFERENCE / STORAGE_QUOTA_EXCEEDED | 사진 연결 오류·용량 한도 |
| 429 | RATE_LIMITED | 호출 제한, Retry-After 제공 |
| 502/503 | GENERATION_FAILED / STORAGE_UNAVAILABLE | AI 또는 스토리지 실패 |

## 6. 인증·중복·동시성 설계

### API 키

- 개인/내부 자동화 기준 고엔트로피 랜덤 키를 발급하고 원문은 발급 시 한 번만 전달한다.
- DB에는 조회용 공개 prefix와 SHA-256 해시, 사용자 ID, scopes, 만료·폐기일을 저장한다.
- 초기 발급·목록·폐기는 운영 CLI로 제공한다. CLI는 일반 사용자 입력으로 임의 소유자를 선택하게 하지 않고 운영자 권한 아래 사용한다.
- 기본 유효기간 90일 제안. 교체 시 새 키 검증 후 기존 키를 폐기한다.
- 일반 호출 분당 60회/키, AI 동시 실행 1개/사용자 제안. 최종 수치는 D-08에서 확인한다.
- 제한 상태는 공유 DB 기준으로 적용하며 프로세스 메모리에만 의존하지 않는다.
- 토큰·본문·사진 바이트를 요청 로그에 기록하지 않는다. 키 ID, requestId, 작업 종류, 대상 ID, 상태, 소요 시간만 기록한다.

### 멱등 요청

- 유일 범위: 사용자 + 키 ID + HTTP 메서드 + 경로 + Idempotency-Key.
- JSON은 정규화된 입력 해시, 파일은 파일 바이트와 검증된 메타데이터 해시로 비교한다.
- 동시 요청은 DB 유일 제약으로 한 건만 실행한다.
- 처리 중에는 기존 상태를 반환하고 별도 작업을 만들지 않는다. 완료 후 같은 요청은 최초 결과를 재전달한다.
- 최소 24시간 기록 유지 제안. 보존 기간 이후 재사용은 새 요청일 수 있음을 문서화한다.
- AI 응답 유실은 자동 재생성하지 않는다. 먼저 저장된 작업·콘텐츠·크레딧 상태를 조회한다.

## 7. 데이터 모델 변경 제안

정확한 Prisma 필드·인덱스는 승인된 PostgreSQL 기준선에서 확정한다. 기존 DB에는 아직 적용하지 않는다.

| 모델 | 필드·제약 제안 | 목적 |
|---|---|---|
| ApiKey 신규 | id, userId, name, prefix, keyHash(unique), scopes, expiresAt, revokedAt, createdAt, lastUsedAt | 인증·폐기 |
| ExternalRequest 신규 | id, userId, apiKeyId, operation, path, idempotencyKey, requestHash, state, resourceId, responseStatus, responseData, errorCode, leaseExpiresAt, createdAt, expiresAt; 요청 범위 unique | 중복 방지·실행 복구 |
| Content 추가 | revision 기본 1 | 수정 충돌 확인 |
| ContentImage 추가 | mediaId nullable FK, contentId+mediaId unique | 신규 사진 소유권·원본 참조 |
| Content 추가 | coverMediaId nullable FK | 대표 이미지 관계; 기존 thumbnailUrl과 호환 |
| 사용량 예약 신규 | 사용자, 작업 ID unique, 종류(저장 용량/크레딧), 양, 상태, 만료일 | 계정 단위 동시 실행 한도 보장 |
| 호출 제한 신규 | 키/사용자, 시간 구간, 카운터, 복합 unique | 여러 프로세스에서 일관된 제한 |
| GenerationJob 조건부 | 사용자, 요청 ID unique, 입력, 상태, 결과 contentId, errorCode, lease·시도 정보 | 비동기 선택 시만 추가 |

- 기존 ContentImage URL은 유지하고 mediaId는 우선 null을 허용한다. 문자열이 비슷하다는 이유로 자동 연결하지 않는다.
- 신규 API는 소유권 확인된 MediaFile만 연결한다.
- 원본 삭제는 참조 중이면 거부한다. 기존 미디어 삭제·일괄 삭제 경로도 함께 보강한다.
- 크레딧·용량 예약은 사용자 단위 직렬화 또는 조건부 갱신으로 확보한다. 성공·실패 전이 시 한 번만 확정/해제한다.
- 정리 작업은 실행 중 lease를 확인한다. 스케줄러가 없는 환경에서는 운영 명령으로 실행하고 상시 자동 정리를 가정하지 않는다.
- 저장소의 PostgreSQL migration 제약을 따른다. 기존 SQLite 형식 migration 및 운영 db push를 사용하지 않는다.

## 8. 서비스 구조 및 기존 화면 호환

기존 architecture에 정의된 `app/server/services/`와 `app/lib/validations/`를 활용한다.

- 인증 어댑터가 `{ userId, credentialId, scopes }` 실행 주체를 만든다.
- 콘텐츠·미디어·생성 서비스는 실행 주체와 검증된 입력만 받는다.
- REST, 기존 세션 라우트, 선택적 MCP가 동일 서비스를 호출한다. 내부에서 HTTP로 자기 API를 다시 호출하지 않는다.
- 기존 브라우저 응답 형식과 SSE 이벤트는 어댑터에서 보존한다.
- 이미지 URL을 공개화하여 브라우저 표시를 해결하지 않는다. 브라우저는 기존 세션 인증 경로, 외부 도구는 Bearer 인증 경로를 사용한다.
- NAS 이미지 스트림은 인증된 파일 응답으로 처리한다. Cloudinary의 현재 공개 URL 사용 여부는 저장 드라이버 정책을 별도로 확인하며 API 인증이 CDN 자체의 비공개화를 보장한다고 표현하지 않는다.
- 본문 표시의 HTML 정제, 사진 스킴 제한, 편집 후 재저장 검증을 수행한다.

## 9. AI 응답 방식과 MCP의 조건부 범위

### 동기 JSON을 선택할 때

생성 완료까지 연결을 유지하고 201로 콘텐츠를 반환한다. 새 worker는 필요 없으나 실제 운영 요청 제한 시간 안에 생성이 끝나는지 먼저 측정한다. 시간 초과·프로세스 중단은 멱등 기록과 예약을 조정하며, 결과 불명확 상태에서 자동으로 AI 호출을 반복하지 않는다.

### 비동기를 선택할 때

202와 jobId를 반환하고 상태 조회로 결과를 제공한다. queued → running → succeeded/failed 상태, 지속 가능한 DB 큐, 작업 lease, 중단 복구, 별도 worker 실행·운영 검증이 필수이다. HTTP 응답 후 실행하는 fire-and-forget으로 대체하지 않는다. NAS 운영 규칙에 따라 worker 추가가 별도 배포 영향에 포함된다.

### MCP를 선택할 때

최소 도구는 create_content, get_content, update_content, generate_longform이며 비동기일 때 get_generation을 추가한다. 사진은 검증된 mediaId를 연결한다.

사진 파일 전달은 선택한 MCP 클라이언트의 실제 파일 접근 기능을 확인한 뒤 확정한다. 로컬 클라이언트가 파일을 읽어 업로드할 수 있는 구성과 원격 클라이언트의 구성을 구별한다. 원격 MCP에 로컬 파일 경로만 보내면 파일을 읽을 수 있다고 가정하지 않는다. 필요하면 사진 업로드는 REST를 병행한다.

MCP transport·인증·SDK는 클라이언트 선택 후 공식 문서와 호환성을 확인한다. 이 단계에서는 의존성을 설치하거나 MCP를 REST의 단순 경로 별칭으로 구현하지 않는다.

## 10. 결정 기록

| ID | 결정 사항 | 제안 기본값 | 다른 선택의 영향 |
|---|---|---|---|
| D-01 | REST / MCP / 둘 다 | REST | MCP는 후속 범위 |
| D-02 | 실제 호출 프로그램과 네트워크 | Tailscale 내 자체 프로그램 | 공개 gateway 없음 |
| D-03 | 완성 글 등록 / AI 생성 / 둘 다 | 둘 다 | — |
| D-04 | Markdown / HTML 입력 | Markdown | API 입력은 Markdown |
| D-05 | 파일 / URL 사진 입력 | 파일 | 외부 URL 수집 없음 |
| D-06 | 사진 형식·장수·크기 | JPG·PNG·WebP / 10장 / 장당 20 MiB | — |
| D-07 | AI 동기 / 비동기 | 동기 JSON | worker 없음 |
| D-08 | 키 만료·호출 한도·요청 기록 보존 | 90일 / 분당 60회 / 24시간 | 환경 설정으로 조정 가능 |
| D-09 | 초안 저장 / 발행 포함 | 초안 저장 | 발행 없음 |

위 결정으로 REST API와 필요한 DB 변경을 구현한다.

## 11. 제외 범위와 배포 경계

이 계획은 로컬 구현·검증까지 구체화한다. 운영 키 발급, DB migration 적용, 공개 접속 개방, 운영 배포는 실제 환경과 승인 범위를 확인한 뒤 수행한다. 기존 NAS restricted gateway와 baseline gate를 우회하지 않는다.

신규 REST 핵심은 기존 Next.js·Prisma·Zod·Node 기능으로 구현하는 것을 목표로 한다. MCP SDK나 추가 이미지 처리·worker 패키지가 필요하면 필요성·대안·영향을 먼저 별도 의존성 요청으로 기록한다.
