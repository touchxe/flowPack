# CP-009: WordPress → FlowPack 글·사진 연동 플러그인

- 작성일: 2026-09-22
- 상태: 승인 — 구현 진행
- 관련 계약: `docs/api-contract.md`의 외부 콘텐츠 API v1
- 관련 구현: `app/app/api/v1/**`, `app/lib/external-api/**`
- 상세 실행계획: `tasks/wordpress-flowpack-plugin-implementation-plan.md`

## 1. 제안 요약

WordPress 관리자 화면에서 FlowPack AI 글 생성을 요청하고, 완료된 글과 사진을 WordPress의 **초안 글과 미디어 첨부파일**로 가져오는 별도 WordPress 플러그인을 만든다.

권장 데이터 방향은 다음 한 방향이다.

```text
WordPress 관리자
  → WordPress 플러그인 서버 코드
  → FlowPack 외부 REST API
  → 생성 상태 조회
  → 글·사진 내려받기
  → WordPress 미디어 라이브러리 + 초안 글 저장
```

기존 FlowPack의 `POST /api/publish/wordpress`는 FlowPack에서 WordPress로 직접 발행하는 기능이다. 새 플러그인은 WordPress 안에서 생성·가져오기를 시작하는 별도 사용 흐름이며, 기존 발행 기능을 대체하거나 재사용하지 않는다.

## 2. 난이도와 근거

- 전체 난이도: **상(7/10)**
- 단순 연결 테스트와 기존 콘텐츠 1건 가져오기: 중(4/10)
- AI 비동기 생성, 인증 사진 다운로드, 중복 방지, 실패 복구까지 포함한 운영형 플러그인: 상(7/10)

어려운 지점은 WordPress 화면 제작이 아니라 다음 세 가지다.

1. 기존 FlowPack API가 Tailscale 내부 전용이므로 `/api/v1/**`만 노출하는 공개 HTTPS gateway를 별도로 운영해야 한다.
2. 현재 AI 생성 API가 최대 수 분 동안 연결을 유지하는 동기 방식이어서 일반 PHP 요청 제한 시간과 맞지 않을 수 있다.
3. 비공개 FlowPack 사진을 WordPress가 인증 헤더로 내려받아 자체 미디어로 저장하고, 실패 시 중복·고아 파일을 남기지 않아야 한다.

## 3. 목표와 완료 기준

### 목표

- WordPress 관리자가 FlowPack 연결 정보를 저장하고 연결을 시험한다.
- WordPress에서 주제·키워드·톤·길이·작성 지침을 입력해 글 생성을 요청한다.
- 생성 작업의 진행 상태와 오류를 WordPress 관리자 화면에서 확인한다.
- 완료된 본문과 최대 10장의 JPG·PNG·WebP 이미지를 WordPress로 복사한다.
- 결과는 자동 공개하지 않는다. 기본은 WordPress `draft`이며 설정에서 `pending`을 선택할 수 있다.
- 대표 이미지는 WordPress 특성 이미지로 지정하고 본문 이미지는 WordPress 미디어 URL로 치환한다.
- 재시도·페이지 새로고침·작업 중단이 있어도 같은 FlowPack 콘텐츠로 WordPress 글이 중복 생성되지 않는다.

### 완료 기준

1. 지원 환경에서 연결 시험이 성공한다.
2. 생성 요청은 즉시 작업 ID를 반환하고 관리자 브라우저 연결이 끊겨도 계속된다.
3. 작업 성공 후 WordPress 편집 화면에서 제목, 본문, 본문 사진, 대체 텍스트, 대표 이미지를 확인할 수 있다.
4. 같은 작업 재시도는 기존 WordPress 글을 반환한다.
5. 401, 402, 409, 413, 415, 429, 5xx 오류가 관리자에게 구분되어 표시된다.
6. API 키·Authorization 헤더·본문 전문·사진 바이트가 로그에 남지 않는다.
7. 플러그인 비활성화 시 예약 작업이 해제되고, 제거 정책에 따라 설정과 작업 데이터가 처리된다.

## 4. 포함 범위와 제외 범위

### 1차 포함

- WordPress 6.5 이상, PHP 8.1 이상, 단일 사이트
- WordPress 관리자 전용 설정 화면과 글 생성 화면
- FlowPack API 키 인증
- 연결 시험
- AI 장문 글 생성 작업
- 생성 상태 조회 및 오류 재시도
- FlowPack 글 1건을 WordPress 초안으로 가져오기
- 인증이 필요한 FlowPack 사진을 WordPress 미디어로 복사
- 대표 이미지, 본문 이미지, alt text 반영
- 멱등 키, 콘텐츠 ID, revision, 미디어 매핑 저장
- 한국어 관리자 UI

### 1차 제외

- WordPress에서 FlowPack 콘텐츠를 지속적으로 양방향 동기화
- WordPress 게시글 수정 내용을 FlowPack으로 역전송
- 자동 공개, 예약 공개, 카테고리·태그 자동 생성
- 멀티사이트 네트워크 공통 설정
- WordPress.com 전용 배포
- 외부 URL 이미지 수집
- Gutenberg 사이드바 확장, Elementor 등 빌더 전용 연동
- 웹훅 공개 수신 엔드포인트

## 5. 필수 선행 조건

### 5.1 네트워크

WordPress가 설치된 **서버**에서 FlowPack Base URL의 443 포트로 HTTPS 요청이 가능해야 한다. 관리자 PC에서 열리는 것만으로는 충분하지 않다.

현재 API는 Tailscale 내부 사용을 전제로 하지만 WordPress 호스트에는 Tailscale을 설치할 수 없다. 따라서 다음 방식으로 확정한다.

- FlowPack 앞에 공개 HTTPS API gateway를 둔다.
- gateway는 `/api/v1/**`만 전달하고 관리자 화면, 내부 worker route, DB·스토리지 포트는 공개하지 않는다.
- NAS에서는 외부 API flag가 read-only 경계를 우회하지 않는다. migration과 `flowpack_app_rw` DB role을 포함한 통제된 read-write 전환 뒤에만 worker profile을 시작한다.
- FlowPack의 명시적 enable flag, API 키 scope, DB 기반 속도 제한, 키 만료·폐기, 요청 크기 제한을 함께 적용한다.
- WordPress는 공개 HTTPS origin만 저장하며 FlowPack 내부 주소를 알지 못한다.
- gateway 공급자·도메인·TLS 인증서의 실제 값은 배포 전에 확정하고 Git에 비밀값을 넣지 않는다.

### 5.2 FlowPack API 보완

현재 `POST /api/v1/generations/longform`은 동기 응답이다. 운영형 플러그인은 아래 비동기 계약이 필요하다.

| 메서드 | 경로 | 목적 | 성공 |
|---|---|---|---|
| GET | `/api/v1/capabilities` | 키·scope·지원 기능·제한 확인 | 200 |
| POST | `/api/v1/generation-jobs/longform` | 비동기 장문 생성 시작 | 202 |
| GET | `/api/v1/generation-jobs/:id` | 상태·오류·결과 콘텐츠 조회 | 200 |
| GET | `/api/v1/contents/:id/rendered` | WordPress용 정제 HTML과 미디어 참조 조회 | 200 |

작업 상태는 `queued → running → succeeded | failed | canceled`로 고정한다. 성공 상태에는 `contentId`를, 실패 상태에는 안전한 `errorCode`와 사용자 안내 메시지를 반환한다. POST에는 `Idempotency-Key`를 필수로 사용한다.

`rendered` 응답은 최소한 `title`, `html`, `revision`, `images`, `coverMediaId`를 제공한다. HTML의 사진 위치는 `flowpack-media:MEDIA_ID` 또는 명시적인 mediaId 토큰으로 유지하여 플러그인이 WordPress 첨부 URL로 안전하게 치환하게 한다. 플러그인은 반환 HTML도 `wp_kses_post()`로 다시 정제한다.

## 6. WordPress 플러그인 구조 제안

FlowPack Next.js 앱과 PHP 배포물의 생명주기가 다르므로 **별도 저장소**로 확정한다. 로컬 권장 경로는 `/Users/shin-youngbin/workspace/flowpack-wordpress-connector`이다.

```text
flowpack-connector/
├── flowpack-connector.php
├── uninstall.php
├── readme.txt
├── includes/
│   ├── class-plugin.php
│   ├── class-settings.php
│   ├── class-admin-page.php
│   ├── class-rest-controller.php
│   ├── class-api-client.php
│   ├── class-job-store.php
│   ├── class-generation-service.php
│   ├── class-import-service.php
│   ├── class-media-importer.php
│   └── class-error-mapper.php
├── assets/
│   ├── admin.js
│   └── admin.css
└── tests/
    ├── unit/
    └── integration/
```

- `Settings`: Base URL, 키 소스, 연결 시험, 삭제 정책을 관리한다.
- `REST controller`: 관리자 화면의 요청을 받고 nonce와 capability를 검증한다.
- `API client`: FlowPack 요청, 타임아웃, 응답 스키마, 재시도 가능 오류를 한곳에서 처리한다.
- `Job store`: 작업 상태, 멱등 키, 다음 확인 시간, 시도 횟수, FlowPack job/content ID, WordPress post ID를 저장한다.
- `Generation service`: 생성 시작과 상태 확인을 담당한다.
- `Import service`: 본문 정제, 미디어 치환, WordPress 초안 생성을 조율한다.
- `Media importer`: 인증 사진 다운로드, 실제 파일 검증, 미디어 등록, alt text, 정리를 담당한다.

1차에는 Composer와 JavaScript 빌드 도구를 추가하지 않는다. WordPress Core API와 네임스페이스 PHP 클래스로 구성한다. 테스트 실행 도구가 필요하면 플러그인 저장소의 개발 의존성으로만 둔다.

## 7. 관리자 화면

### 설정 > FlowPack

- FlowPack Base URL
- API 키 상태: `wp-config.php 상수 사용`, `저장됨`, `미설정`만 표시
- 연결 시험 버튼
- 확인된 scope와 API 기능 표시
- 마지막 성공 연결 시각과 안전한 오류 코드 표시

API 키는 우선 `wp-config.php`의 `FLOWPACK_API_KEY` 상수에서 읽는다. 상수가 없을 때만 DB 저장을 허용하며, 저장된 값은 다시 전체 표시하지 않고 option의 autoload를 끈다. 내보내기·진단 정보·로그에서 제외한다.

### FlowPack > 새 글 만들기

- 주제: 필수
- 키워드: 선택, 최대 20개
- 길이: 짧게·보통·길게
- 톤: FlowPack 허용값
- 업종: 선택
- 작성 지침: 선택
- `초안 만들기` 버튼

제출 후 같은 화면에서 `대기`, `생성 중`, `사진 가져오는 중`, `완료`, `실패`를 표시한다. 완료 시 `WordPress 초안 편집` 링크를 제공한다. 실패 시 안전한 안내와 재시도 버튼을 보여준다.

## 8. 작업과 데이터 모델

플러그인 전용 테이블을 사용한다. 여러 단계와 재시도 상태를 options/transients에 저장하지 않는다.

제안 테이블: `{prefix}flowpack_jobs`

| 필드 | 용도 |
|---|---|
| id | 로컬 bigint PK |
| public_id | 관리자 REST 요청에 쓰는 UUID |
| user_id | 요청한 WordPress 사용자 |
| idempotency_key | 같은 생성 재시도 식별자, unique |
| status | pending, generating, importing, succeeded, failed |
| flowpack_job_id | FlowPack 비동기 작업 ID |
| flowpack_content_id | 결과 콘텐츠 ID |
| flowpack_revision | 가져온 revision |
| wordpress_post_id | 생성된 초안 ID |
| attempt_count | 상태 조회·가져오기 시도 횟수 |
| next_attempt_at | 다음 실행 가능 시각 |
| error_code | 안전한 오류 코드 |
| error_message | 비밀값을 제거한 안내 |
| payload_json | 생성 옵션. 키와 본문 결과는 저장하지 않음 |
| created_at, updated_at | 감사·정리 기준 |

WordPress 글 meta:

- `_flowpack_content_id`
- `_flowpack_revision`
- `_flowpack_job_id`
- `_flowpack_imported_at`
- `_flowpack_media_map` — FlowPack mediaId와 WordPress attachment ID 매핑

`_flowpack_content_id`로 기존 글을 먼저 찾아 중복 생성을 방지한다. 1차에서는 가져오기 완료 후 WordPress가 편집 기준이 되며 자동 재동기화하지 않는다.

## 9. 상세 처리 흐름

### 9.1 연결 시험

1. `manage_options`와 REST nonce를 확인한다.
2. 저장된 고정 Base URL을 정규화하고 HTTPS를 강제한다.
3. `GET /api/v1/capabilities`에 Bearer 키를 전송한다.
4. `content:generate`, `content:read`, `media:read` scope와 API 버전을 확인한다.
5. 키 원문 없이 결과만 관리자 화면에 표시한다.

### 9.2 생성 시작

1. `edit_posts` capability와 nonce를 확인한다.
2. 입력을 sanitize·validate한다.
3. UUID v4 멱등 키와 로컬 job을 먼저 저장한다.
4. `POST /api/v1/generation-jobs/longform`을 호출한다.
5. 202의 job ID를 저장하고 단일 다음 실행 이벤트를 예약한다.
6. 관리자 화면은 로컬 job 상태만 짧게 polling한다.

같은 로컬 job의 네트워크 재시도에는 같은 멱등 키를 재사용한다. 사용자가 별도의 새 글을 요청한 경우에만 새 키를 만든다.

### 9.3 상태 확인

1. 예약 작업이 `GET /api/v1/generation-jobs/:id`를 호출한다.
2. `queued/running`이면 지수 backoff와 jitter를 적용해 다시 예약한다.
3. `succeeded`이면 contentId를 저장하고 가져오기 단계로 이동한다.
4. `failed`이면 error code를 저장하고 종료한다.
5. 429는 `Retry-After`를 우선하며, 502/503/네트워크 오류만 제한적으로 재시도한다.
6. 최대 대기 시간과 최대 시도 횟수를 넘으면 `failed`로 종료하되 수동 재시도를 허용한다.

WP-Cron은 페이지 요청 시 실행되므로 저트래픽 사이트에서는 지연될 수 있다. 운영 환경은 시스템 cron으로 `wp-cron.php`를 호출하는 구성을 권장한다. Action Scheduler 도입은 별도 승인 사항으로 둔다.

### 9.4 콘텐츠와 사진 가져오기

1. 기존 `_flowpack_content_id` 글이 있으면 그 글을 반환한다.
2. rendered 콘텐츠와 이미지 메타데이터를 가져온다.
3. 이미지 수, mediaId 중복, MIME, 선언 크기를 검증한다.
4. 각 `contentPath`를 Bearer 헤더로 다운로드한다.
5. 응답 크기를 스트리밍 중 제한하고 JPG·PNG·WebP 실제 파일 서명을 확인한다.
6. 임시 파일을 `media_handle_sideload()`로 WordPress 미디어에 등록한다.
7. `_wp_attachment_image_alt`를 설정하고 mediaId 매핑을 만든다.
8. 본문의 mediaId 토큰을 WordPress 이미지 블록 또는 안전한 `<figure><img>`로 바꾼다.
9. `wp_kses_post()`로 최종 HTML을 정제한다.
10. `wp_insert_post()`로 `draft` 글을 만든다.
11. coverMediaId에 해당하는 첨부파일을 `set_post_thumbnail()`로 설정한다.
12. post meta와 job 성공 상태를 저장한다.

필수 사진 하나라도 실패하면 글을 만들지 않는다. 이번 시도에서 새로 만든 첨부파일을 삭제하고 job을 실패 상태로 남긴다. 이미 과거 성공 작업에 매핑된 첨부파일은 삭제하지 않는다. 모든 임시 파일은 성공·실패 모두 정리한다.

## 10. 보안 요구사항

- 관리자 전용 설정은 `manage_options`, 글 생성은 `edit_posts`를 요구한다.
- 모든 관리자 쓰기 요청은 WordPress REST nonce와 `permission_callback`으로 보호한다.
- Base URL은 설정된 단일 HTTPS origin만 사용하고 호출마다 임의 URL을 받지 않는다.
- HTTP 호출은 공개 HTTPS 주소에 `wp_safe_remote_request()`를 사용하고 redirect를 따르지 않는다. SSRF 검증을 끄는 예외는 두지 않는다.
- redirect는 제한하고 다른 host로 바뀌면 Authorization 헤더를 전달하지 않는다.
- 응답 Content-Type, 크기, JSON 구조를 신뢰하지 않고 검증한다.
- 사진 최대 20 MiB·글당 최대 10장을 WordPress에서도 다시 제한한다.
- API 키, Authorization, 입력 전문, 생성 본문, 사진 바이트를 로그에 쓰지 않는다.
- 관리자에게 표시하는 원격 오류는 HTML escape하고 서버 내부 정보는 제거한다.
- WordPress에 저장하는 제목은 태그를 제거하고, 본문은 `wp_kses_post()`를 거친다.

## 11. 오류와 재시도 정책

| FlowPack 상태 | WordPress 처리 |
|---|---|
| 401 UNAUTHORIZED | 재시도 금지, 설정 화면으로 안내 |
| 403 INSUFFICIENT_SCOPE | 재시도 금지, 필요한 scope 표시 |
| 402 CREDIT_EXHAUSTED | 재시도 금지, 크레딧 안내 |
| 409 REQUEST_IN_PROGRESS | 같은 멱등 키로 상태 조회 또는 재호출 |
| 409 IDEMPOTENCY_CONFLICT | 구현 오류로 기록, 새 키 자동 생성 금지 |
| 409 REVISION_CONFLICT | 가져오기 중단, 최신 콘텐츠 재조회 |
| 413/415/422 | 재시도 금지, 해당 사진·입력 안내 |
| 429 | `Retry-After` 이후 재시도 |
| 502/503/네트워크 | 지수 backoff로 제한 재시도 |
| 기타 4xx | 재시도 금지 |

## 12. 테스트 전략

### FlowPack

- capabilities 인증·scope 응답
- 생성 job 상태 전이와 소유권 격리
- 같은 멱등 키의 중복 생성·중복 크레딧 차감 방지
- 실패 시 크레딧 예약 반환
- rendered HTML의 XSS·잘못된 mediaId 차단
- 다른 사용자의 job/content/media 접근 404 또는 403
- worker 재시작·lease 만료 후 안전한 복구

### WordPress 플러그인

- 설정 sanitize, 상수 우선, 마스킹, autoload false
- capability·nonce·REST permission 거부 테스트
- API 응답 스키마와 오류 매핑
- 202 → polling → succeeded 상태 전이
- 429 Retry-After와 5xx backoff
- 같은 contentId 중복 글 생성 방지
- 인증 이미지 다운로드, MIME·파일 서명·용량 제한
- 부분 실패 시 첨부파일·임시 파일 정리
- 본문 토큰 치환, HTML 정제, alt text, 대표 이미지
- 비활성화 시 예약 이벤트 정리

### 실환경 검증

- 실제 WordPress 서버에서 공개 API의 DNS, TLS, outbound HTTPS 확인
- 작은 글·사진 없음
- 사진 1장과 대표 이미지
- 사진 10장과 20 MiB 경계
- 생성 도중 관리자 탭 닫기
- 응답 유실 후 같은 멱등 키 재시도
- FlowPack 일시 중단 후 복구
- 저트래픽 WP-Cron 지연 확인

## 13. 배포와 롤백

1. FlowPack API 보완을 feature flag 뒤에 배포한다.
2. 운영 DB migration 후 worker와 상태 조회를 smoke test한다.
3. 제한된 API 키와 테스트 WordPress에서 플러그인을 설치한다.
4. 연결 시험, 글 1건, 사진 1건을 검증한다.
5. 1주간 오류율·생성 시간·가져오기 실패율을 관찰한 뒤 일반 배포한다.

롤백 시 플러그인을 비활성화하고 예약 이벤트를 해제한다. 생성된 WordPress 초안과 미디어는 사용자 데이터이므로 자동 삭제하지 않는다. FlowPack 비동기 엔드포인트는 신규 요청만 중단하고 이미 생성된 콘텐츠는 보존한다.

## 14. 결정이 필요한 항목

| ID | 확인 항목 | 권장 기본값 | 결정 영향 |
|---|---|---|---|
| WP-01 | WordPress 호스팅 형태와 서버 접근 권한 | Tailscale 불가, 공개 HTTPS gateway | 연결 방식 전체 |
| WP-02 | 플러그인 코드 저장 위치 | 별도 저장소 확정 | 배포·버전 관리 |
| WP-03 | 최소 WordPress/PHP 버전 | WP 6.5+, PHP 8.1+ | 호환 코드·테스트 범위 |
| WP-04 | 생성 처리 방식 | FlowPack 비동기 job API | 안정성·백엔드 작업량 |
| WP-05 | 스케줄러 | WP-Cron 기본, 시스템 cron 선택 | 작업 지연·운영 설정 |
| WP-06 | API 키 저장 | wp-config 상수 우선, DB fallback | 운영 편의·비밀 관리 |
| WP-07 | 가져오기 후 편집 기준 | WordPress가 기준, 자동 동기화 없음 | 충돌 정책 |
| WP-08 | 결과 상태 | draft 기본, pending 선택 | 자동 공개 없이 검토 흐름 제공 |
| WP-09 | Markdown 처리 | FlowPack rendered HTML + WP 재정제 | API 계약·플러그인 의존성 |
| WP-10 | 실패 시 사진 정책 | 전부 성공 또는 전부 정리 | 고아 미디어·사용자 경험 |

결정 사항은 사용자 승인으로 확정되었다. 공개 gateway의 실제 도메인·TLS·공급자와 WordPress 서버의 outbound HTTPS 가능 여부는 배포 gate에서 확인한다.
