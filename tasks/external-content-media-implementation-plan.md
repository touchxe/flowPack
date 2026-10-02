# 외부 글·사진 연동 세부 구현계획

- 작성일: 2026-09-22
- 상세 기획: `docs/change-proposals/CP-008-external-content-media-api.md`
- 현재 단계: REST 구현·로컬 검증 완료, 운영 DB 적용·실환경 smoke는 배포 단계에서 수행
- 구현 단위: 아래 순서대로 진행하며 각 단위의 핵심 테스트를 먼저 작성한다.
- 계획의 API·DB·파일명은 제안이며 아직 구현 또는 배포 완료를 뜻하지 않는다.

## 1. 순서와 의존관계

T0 계약 확정 → T1 DB·공통 기반 → T2 인증 → T3 사진 업로드 → T4 글·사진 연결 → T5 AI 생성 → T6 선택적 MCP → T7 통합 검증·사용 가이드.

T5는 AI 생성 선택 시, T6는 MCP 선택 시만 수행한다. 인터페이스와 무관한 콘텐츠·미디어 서비스는 공유한다.

## 2. 작업별 실행 명세

### T0. 계약 및 작업 기준 확정

작업:

- CP-008 D-01~D-09에서 확정값과 보류값을 기록한다.
- 실제 호출 도구, 서버 요청 제한 시간, 활성 스토리지, NAS 전환 상태를 읽기 전용 확인한다.
- 필요한 API만 남기고 입력·응답 예시 및 오류 코드를 확정한다.
- 승인 범위에 맞춰 API·DB·아키텍처 문서 변경과 task contract를 준비한다.
- 사진 입력 20 MiB와 multipart overhead를 고려한 프록시·앱 제한을 정한다.
- 최신 DB 기준선과 migration gate 상태를 확인한다.

완료: API 목록, 사진 입력 규칙, AI 실행 방식, 인증·접속 경로가 문서에 명시됨. worker·공개 gateway는 선택 여부와 추가 작업 범위가 구분됨.

### T1. DB 및 공통 서비스 기반

대상 제안:

- `app/prisma/schema.prisma`, 승인된 PostgreSQL migration
- `app/lib/validations/external-content-schema.ts`
- `app/lib/validations/external-media-schema.ts`
- `app/server/services/external-request-service.ts`
- `app/server/services/usage-reservation-service.ts`

작업:

1. API 키, 멱등 기록, 용량·크레딧 예약, 호출 제한 모델을 추가한다.
2. Content revision, ContentImage mediaId, Content coverMediaId 관계를 추가한다.
3. 기존 레코드는 nullable 관계로 보존하고 신규 레코드의 무결성 제약을 정의한다.
4. 트랜잭션 내 멱등 요청 획득·응답 저장과 예약 상태 전이를 구현한다.
5. 오류 타입을 정의하여 서비스 오류를 HTTP 상태·공통 code로 매핑한다.
6. 실행 lease 및 중단된 요청의 운영 복구 명령을 정의한다.

검증:

- 빈 임시 PostgreSQL 및 기존 형태 fixture에서 migration 성공.
- 기존 콘텐츠·사진 개수와 기존 URL 보존.
- 같은 멱등 키의 병렬 요청에서 작업이 한 번만 획득됨.
- 키 충돌, 트랜잭션 rollback, 예약 중복 확정·해제 방지.

완료: 운영 DB 접속 없이 임시 DB에서 변경·호환성 검증 가능.

### T2. 외부 인증과 키 운영

대상 제안:

- `app/server/services/api-key-service.ts`
- `app/server/services/external-auth-service.ts`
- `app/scripts/external-api-key.mjs`
- `app/lib/auth.config.ts`, `app/middleware.ts`는 실제 적용 경로 확인 후 필요 시 수정

작업:

1. 키 발급·목록·폐기 CLI와 운영자 사용 절차를 만든다.
2. Bearer 파싱, 키 해시 확인, 만료·폐기·사용자 차단·scope 검사를 구현한다.
3. 브라우저 로그인으로 redirect되지 않고 API JSON 401을 반환하는지 확인한다.
4. 공유 DB 기반 호출 제한, requestId, 비밀값 제외 로그를 붙인다.
5. 인증 성공 후에도 각 서비스가 소유권을 검사하도록 실행 주체 타입을 전달한다.

검증: 누락·잘못된 키·만료·폐기·권한 부족·차단 사용자·타인 접근, 한도 초과, 로그에 키 원문 미포함.

완료: 브라우저 쿠키 없는 호출자가 지정된 본인 자원만 접근.

### T3. 사진 업로드·다운로드

대상 제안:

- `app/server/services/media-service.ts`
- `app/app/api/v1/media/route.ts`
- `app/app/api/v1/media/[id]/content/route.ts`
- 기존 `app/app/api/media/upload/route.ts` 및 관련 삭제 경로
- 기존 `app/lib/storage.ts`, `app/lib/nas-storage.mjs`

작업:

1. 파일 업로드 처리를 공통 서비스로 옮기고 브라우저 응답 호환을 유지한다.
2. 스트리밍 수신 바이트 제한, 허용 형식·파일 서명 검증을 적용한다.
3. 예약 용량 확보 → 파일 저장 → MediaFile·멱등 응답 저장 → 예약 해제로 처리한다.
4. 실패 시 이번 요청에서 만든 파일만 정리하며, 정리 실패는 추적 가능한 상태로 남긴다.
5. 외부 바이너리 조회에서 소유권·media:read를 검증한다.
6. 동일 업로드 재전송은 최초 mediaId를 반환한다.
7. 사진의 기존 글 참조를 확인하여 원본 삭제가 글 이미지를 깨뜨리지 않도록 한다.

검증: JPEG·PNG·WebP 정상, 빈 파일, 위장 MIME, SVG 거부, 용량 초과, Content-Length 없는 초과 요청, 저장 실패, DB 실패, 정리 실패, 동시 용량 초과, 다운로드 타인 접근.

완료: 인증된 업로드·조회 가능, 오류·재시도 시 파일과 용량 기록이 일치.

### T4. 글 CRUD 및 사진 배치

대상 제안:

- `app/server/services/content-service.ts`
- `app/server/services/content-media-service.ts`
- `app/app/api/v1/contents/route.ts`
- `app/app/api/v1/contents/[id]/route.ts`
- 기존 `app/app/api/content/[id]/route.ts`, 이미지 라우트
- `app/components/features/content/tiptap-editor.tsx`, 보기·편집 컴포넌트는 호환 수정이 필요한 경우에만 변경

작업:

1. 신규 BLOG/DRAFT 생성과 조회·부분 수정 서비스를 구현한다.
2. 사진 ID를 일괄 조회하여 본인 소유·존재 여부를 확인한다.
3. Markdown 사진 참조를 파싱하고 기존 이미지 조회 경로로 변환한다. 단순 문자열 전체 치환에 의존하지 않는다.
4. 글·사진 순서·대체 텍스트·대표 이미지·revision을 동일 트랜잭션으로 저장한다.
5. expectedRevision으로 조건부 갱신하며 경합 시 409를 반환한다.
6. 기존 브라우저의 글/사진 변경도 revision을 증가시키도록 보강한다.
7. 사진 연결 GET 등 관련 기존 라우트의 소유권 검사를 확인·보강한다.
8. 기존 편집기의 Markdown→HTML 변환 뒤 조회·수정에서 bodyFormat을 정확히 표시한다.
9. 본문 HTML 정제와 script·위험 URL 방어를 확인한다.

검증: 사진 없는 글, 여러 사진, 본문 중간 삽입, 대표 이미지, 순서 변경, 사진 교체·해제, 타인 사진, 미존재 참조, 본문에 남은 제거 사진, 동시 수정, UI 편집 후 재조회.

완료: 외부 글이 기존 목록·보기·편집에서 동일하게 보이고 재저장 후 사진이 유지.

### T5. AI 생성 공통화

대상 제안:

- `app/server/services/longform-generation-service.ts`
- `app/app/api/v1/generations/longform/route.ts`
- 기존 `app/app/api/generate/longform/route.ts`
- 기존 크레딧 사용 생성 경로: carousel, bulk, url-to-content, image 등 실제 차감 지점 조사 후 필요한 예약 연동

공통 작업:

1. longform의 프롬프트 구성·스트리밍·제목 생성·정규화·저장을 분리한다.
2. 기존 UI의 SSE status/chunk/title/done/error 계약을 유지한다.
3. 크레딧 예약 후 AI를 호출하고 콘텐츠 저장·크레딧 확정·요청 완료를 원자적으로 처리한다.
4. 다른 생성 경로와 동시 실행해도 크레딧을 초과하지 않도록 공통 사용량 정책을 연결한다.
5. 생성 실패·응답 유실·클라이언트 종료·프로세스 중단을 구분한다.
6. 이미 저장한 글은 재사용한다. 결과 불명확 작업은 자동 재생성하지 않고 상태를 복구한다.

동기 선택 시: 실제 서버 제한 시간과 생성 소요 시간을 확인하고 JSON 응답·timeout 복구를 구현한다.

비동기 선택 시 추가 대상:

- GenerationJob migration
- `app/app/api/v1/generations/[id]/route.ts`
- `app/scripts/generation-worker.mjs` 또는 승인된 동등 실행 방식
- NAS worker 실행 정의와 운영 절차

비동기 추가 작업: 지속 큐, 원자적 claim, lease·heartbeat, 프로세스 재시작 복구, 상태 조회, 명확한 실패 코드. 외부 AI 호출 결과가 불명확한 작업을 무조건 재실행하지 않는다.

검증: AI stub 기반 성공·실패·지연·중단, 크레딧 부족, 한도 경계 병렬 요청, 관리자 예외, 중복 요청, 저장 실패. 실제 AI 시험은 계정·비용 범위가 확인된 환경에서 소량 수행한다.

완료: 한 요청당 하나의 초안과 한 번의 크레딧 확정. 기존 UI 스트리밍 회귀 없음.

### T6. MCP 어댑터 — 선택 시만

1. 실제 사용할 MCP 클라이언트·transport·인증과 파일 전달 방법을 확정한다.
2. 공식 문서로 호환성을 확인하고 필요한 SDK 의존성 요청을 작성한다.
3. 콘텐츠·생성 공통 서비스에 도구 입력 스키마를 연결한다.
4. 사진 업로드는 클라이언트 지원을 검증하여 구현하고, REST 병행이면 사용 절차에 명시한다.
5. 실제 클라이언트에서 도구 검색·호출·오류·재시도를 검증한다.

완료: 선택한 클라이언트에서 글과 사진 작성 시나리오가 끝까지 성공. REST만 구현하고 MCP 완료로 표시하지 않음.

### T7. 통합 검증 및 인수 문서

작업:

- Playwright APIRequestContext를 이용해 인증 없는 외부 호출 조건에서 API 통합 테스트.
- API 작성 → 브라우저 로그인 → 목록·보기·편집 → 저장 → API 재조회 E2E.
- 기존 Playwright baseURL 3002와 실행 서버 포트를 일치시킨다.
- 테스트용 독립 PostgreSQL·격리된 스토리지·사용자 fixture를 사용한다.
- 외부 파일 정리·키 폐기·테스트 데이터 정리는 이번 테스트의 ID로만 제한한다.
- lint, typecheck, Prisma validate, 변경 기능 테스트, 관련 NAS 테스트, build를 수행한다.
- curl 호출 예제, 오류·재시도 처리, 키 교체·폐기, 사진 ID 사용법을 작성한다.
- DB·파일·코드 복구를 구분한 배포 체크리스트를 작성한다.

완료: 아래 인수 기준을 충족한 결과와 미실행 항목의 사유가 기록됨. 배포는 기존 restricted gateway와 migration gate를 충족할 때 진행.

## 3. 필수 인수 기준

| ID | 시나리오 | 기대 결과 |
|---|---|---|
| AC-01 | 키로 사진 2장 업로드 후 글 등록 | 1개 초안, 2개 사진 연결, 지정 대표 이미지 |
| AC-02 | 같은 등록·업로드 요청 병렬 재전송 | 각 작업 결과 ID 동일, 중복 데이터 없음 |
| AC-03 | 같은 멱등 키로 다른 입력 | 409, 기존 결과 변경 없음 |
| AC-04 | 타인 글·사진 조회 또는 연결 | 거부, 데이터 노출·부분 저장 없음 |
| AC-05 | 키 만료·폐기·scope 부족 | 정해진 인증/권한 오류 |
| AC-06 | 위장 파일·과대 파일·동시 용량 초과 | 업로드 거부, 용량 정합성 유지 |
| AC-07 | 본문 사진 위치·순서·대표 이미지 수정 | 조회 및 브라우저 표시 일치 |
| AC-08 | API와 UI에서 동시 수정 | stale API revision은 409 |
| AC-09 | 브라우저 편집 후 재조회 | bodyFormat 정확, 사진 링크·대표 이미지 유지 |
| AC-10 | 연결된 원본 삭제 시도 | 삭제 거부, 다른 글 영향 없음 |
| AC-11 | AI 성공·실패·재시도·응답 유실 | 초안·예약·크레딧 중복 확정 없음 |
| AC-12 | 다른 생성 기능과 동시 요청 | 사용자 크레딧 한도 초과 없음 |
| AC-13 | 비동기 worker 중단·재시작 | 선택 시 작업 상태 복구, 중복 생성 방지 |
| AC-14 | MCP에서 실제 작성 | 선택 시 글·사진 흐름 전체 성공 |

## 4. 검증 방식과 의존성

설치된 Playwright와 Node test runner를 우선 사용한다. Vitest 등 새 테스트 프레임워크를 전제로 하지 않는다. AI·스토리지 오류는 stub/fault injection으로 재현하고 정합성 테스트는 실제 임시 PostgreSQL에서 실행한다.

DB migration, 파일 저장, 크레딧 경쟁 조건은 모의 객체 테스트만으로 완료 판정하지 않는다. 로그에 비밀값이 없는지도 검사한다.

## 5. 변경 범위와 운영 복구

- 일반 UI 디자인 변경 없음. 기존 편집/표시 호환에 필요한 수정만 수행.
- 신규 API와 스키마는 CP-008 확정 후 계약 문서에 반영.
- 키가 저장된 환경변수나 실제 키 원문을 Git·문서·예제에 포함하지 않음.
- 초기 migration은 nullable 관계·새 테이블 중심으로 구성. rollback 시 신규 데이터가 있는 테이블을 무조건 drop하지 않음.
- 기능 중단 시 외부 API를 차단하고 키를 폐기할 수 있어야 함. 생성 worker는 신규 claim을 중단하고 실행 상태를 보존.
- 코드 rollback과 데이터/파일 복구는 별도 절차. 기존 운영 배포 blocker를 구현 성공으로 해소됐다고 간주하지 않음.

## 6. 진행 체크리스트

- [x] 기존 구현·사진 저장 경로 확인
- [x] 상세 기획과 변경 제안 작성
- [x] 단계별 작업·검증·완료 기준 작성
- [x] API 종류·호출 환경·AI 응답 방식 확인
- [x] 계약·DB 변경 확정
- [x] T1 DB·공통 기반
- [x] T2 인증
- [x] T3 사진
- [x] T4 글·사진 연결
- [x] T5 AI 생성 — 동기 JSON
- [x] T6 MCP — REST 우선 결정에 따라 제외
- [x] T7 정적·단위·NAS 회귀·production build 및 인수 문서

운영 적용 메모: 현재 DATABASE_URL은 관리형 원격 DB로 분류되어 이 작업에서 migration을 직접 실행하지 않았다. Docker Desktop도 로컬 검증 시 응답하지 않아 임시 PostgreSQL 통합 테스트는 수행하지 못했다. 승인된 PostgreSQL baseline/restricted gateway 배포 단계에서 migration 적용 후 사진 업로드→글 등록→수정→AI 생성 smoke를 수행한다.

다음 작업의 진입점: CP-008의 D-01·D-02·D-03·D-07을 확인하고 API 목록을 확정한 뒤 T0를 완료한다.
