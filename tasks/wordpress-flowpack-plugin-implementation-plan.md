# WordPress → FlowPack 플러그인 세부 구현계획

- 작성일: 2026-09-22
- 변경 제안: `docs/change-proposals/CP-009-wordpress-flowpack-connector.md`
- 상태: 로컬 구현·정적 검증 완료, 운영 gateway·DB migration·WordPress 실환경 검증 대기
- 예상 난이도: 상(7/10)
- 원칙: 테스트 선행, 공개 발행 금지, 비밀값 로그 금지, 단계별 배포 gate 통과

## 1. 권장 실행 순서

```text
P0 결정·연결성 검증
  → P1 FlowPack 계약 테스트
  → P2 capabilities·rendered API
  → P3 비동기 생성 job·worker
  → P4 WordPress 플러그인 기반
  → P5 생성 화면·job polling
  → P6 사진·본문 import
  → P7 장애·보안·호환 테스트
  → P8 제한 배포·운영 검증
```

P0, P3, P6은 중단 가능한 gate다. 앞 단계 기준을 충족하지 못하면 다음 단계로 넘어가지 않는다.

## 2. 작업 분해

### P0. 결정과 실환경 연결성 검증

예상: 0.5~1일

- [x] CP-009의 WP-01~WP-10 결정
- [x] 로컬 WordPress 7.1.1, PHP 8.2.29, 단일 사이트 확인
- [ ] WordPress 서버 shell 또는 호스팅 진단 기능에서 FlowPack DNS·443·TLS 확인
- [x] WordPress에 Tailscale 설치 불가 확인, 공개 HTTPS gateway 방식 확정
- [x] 로컬 WordPress의 localhost HTTPS 요청·사진 업로드·미디어 저장 확인
- [ ] API 키의 `content:generate`, `content:read`, `media:read`, `media:write` scope 준비
- [x] 플러그인을 별도 저장소로 분리

완료 gate:

- WordPress 서버에서 FlowPack까지 인증 없는 TLS handshake가 되고, 승인된 테스트 키로 인증 요청을 보낼 수 있다.
- 비밀값은 문서·명령 출력·CI 로그에 남지 않는다.

### P1. 계약과 BDD 테스트 고정

예상: 0.5~1일

- [x] 비동기 생성 요청·상태·실패 응답 스키마 확정
- [x] capabilities 응답에서 노출할 필드 확정
- [x] rendered 콘텐츠의 HTML과 media token 계약 확정
- [x] 멱등 범위, job 보존 기간, 최대 실행 시간, retry 정책 확정
- [x] FlowPack API BDD 작성
- [x] WordPress 사용자 흐름·실패 흐름 계약 테스트 작성
- [x] CP 승인 기록 후 `docs/api-contract.md` 반영

완료 gate:

- JSON 예시, HTTP 상태, error code, scope, 소유권 규칙이 테스트에서 명확하다.

### P2. FlowPack capabilities·rendered API

예상: 1~1.5일

- [x] `GET /api/v1/capabilities` route와 service 작성
- [x] key 상태, scope, API 버전, 이미지 제한만 반환하고 개인·비밀 정보 제외
- [x] `GET /api/v1/contents/:id/rendered` route 작성
- [x] 콘텐츠 렌더링 로직을 서버 service로 분리
- [x] markdown/html 입력을 정규화하고 위험 HTML·URL scheme 제거
- [x] mediaId와 본문 토큰의 소유권·일관성 검증
- [x] content read scope와 타 사용자 격리 테스트
- [x] API 문서와 curl 예시 추가

완료 gate:

- WordPress가 별도 Markdown 라이브러리 없이 안전한 HTML과 mediaId 목록을 받을 수 있다.

### P3. FlowPack 비동기 생성 job

예상: 2~3일

- [x] GenerationJob 데이터 모델·migration 제안과 승인
- [x] `POST /api/v1/generation-jobs/longform` 구현
- [x] `GET /api/v1/generation-jobs/:id` 구현
- [x] queued/running/succeeded/failed/canceled 상태 머신 구현
- [x] 기존 외부 API 인증·scope·멱등 서비스 재사용
- [x] 사용자 단위 AI 동시 실행 제한과 크레딧 예약 구현
- [x] worker claim, lease, 완료, 실패, 만료 복구 구현
- [x] AI 네트워크 호출 중 DB 트랜잭션을 열어두지 않음
- [x] 동일 job의 중복 실행·중복 콘텐츠·중복 차감 방지 테스트
- [x] worker 배포 단위와 운영 명령 작성
- [x] job 보존 만료 시각 기록

완료 gate:

- HTTP 요청이 종료된 뒤에도 job이 지속된다.
- 프로세스가 중간 종료되어도 lease 만료 뒤 한 번만 안전하게 복구된다.
- 성공 1건당 콘텐츠 1건과 크레딧 1회만 확정된다.

### P4. WordPress 플러그인 기반

예상: 1~1.5일

- [x] 플러그인 헤더, autoload, activation/deactivation/uninstall 구조 작성
- [x] DB 버전과 `{prefix}flowpack_jobs` 생성 migration 작성
- [x] Settings API로 Base URL과 API 키 설정 작성
- [x] `FLOWPACK_API_KEY` 상수 우선과 DB fallback 구현
- [x] option autoload false, 키 마스킹, 삭제 정책 구현
- [x] `FlowPack_Api_Client`에 timeout, header, JSON schema, 안전한 오류 구현
- [x] HTTPS origin 고정과 redirect 금지 구현
- [x] 연결 시험 REST route 작성
- [x] `permission_callback`, capability, nonce 계약 테스트
- [ ] 활성화·업그레이드·비활성화·제거 테스트

완료 gate:

- 관리자만 설정을 바꿀 수 있고 API 키가 화면·로그·진단 데이터에 노출되지 않는다.
- 연결 시험이 scope와 지원 기능을 정확히 표시한다.

### P5. 생성 화면과 로컬 job 처리

예상: 1~1.5일

- [x] FlowPack 관리자 메뉴와 생성 폼 작성
- [x] 입력 sanitize·validate와 최대 길이 적용
- [x] UUID 멱등 키와 local job 원자 생성
- [x] FlowPack 생성 job 시작 호출
- [x] WordPress 단일 cron event 예약
- [x] 상태 조회, 지수 backoff, Retry-After 구현
- [x] 관리자 화면의 짧은 local status polling 구현
- [x] 같은 contentId 재가져오기 시 기존 글 재사용 확인
- [x] deactivation 시 예약 event 정리

완료 gate:

- 관리자가 탭을 닫아도 생성 작업이 유실되지 않는다.
- 같은 요청 재처리로 FlowPack job이 중복 생성되지 않는다.

### P6. 사진과 본문 import

예상: 2~2.5일

- [x] contentId 기존 매핑 조회와 중복 방지
- [x] rendered 콘텐츠 schema 검증
- [x] 인증 헤더를 포함한 이미지 streaming download
- [x] redirect, 응답 크기, MIME, 파일 signature 검증
- [x] 임시 파일과 `media_handle_sideload()` 연결
- [x] alt text 저장과 attachment ID 매핑
- [x] media token을 WordPress figure로 치환
- [x] `wp_kses_post()` 최종 정제
- [x] `wp_insert_post()`로 draft 또는 pending 저장
- [x] 대표 이미지 설정
- [x] post meta와 job 상태 갱신 순서 구현
- [x] 실패 시 이번 실행의 attachment와 temp file 보상 정리
- [x] 로컬 WordPress에서 사진 없음과 1장·대표 이미지 있음 테스트

완료 gate:

- public WordPress 본문에 FlowPack 비공개 URL이나 Bearer 키가 남지 않는다.
- 부분 실패 시 WordPress 글과 고아 미디어가 남지 않는다.
- 재시도는 기존 성공 글과 첨부를 재사용한다.

### P7. 보안·장애·호환 검증

예상: 1~1.5일

- [ ] 401/402/403/409/413/415/422/429/5xx 매핑 테스트
- [ ] XSS, 잘못된 URL scheme, SSRF, redirect host 변경 테스트
- [ ] 비관리자와 nonce 없는 요청 거부 테스트
- [ ] API 응답 지연, 잘린 JSON, 잘못된 Content-Type 테스트
- [ ] 사진 다운로드 중단과 디스크 부족 테스트
- [ ] WP-Cron 중복 실행과 lock 경쟁 테스트
- [x] 로컬 WordPress 7.1.1·PHP 8.2.29 런타임 테스트
- [ ] Query Monitor 또는 동등 도구로 관리자 화면 쿼리·요청 확인
- [ ] 로그 redaction 점검

완료 gate:

- 필수 보안 테스트가 모두 통과하고 치명·높음 결함이 없다.
- 실패가 사용자에게 복구 가능한 문구로 표시되고 서버 비밀이 노출되지 않는다.

### P8. 제한 배포와 운영 검증

예상: 0.5~1일 + 관찰 기간

- [ ] FlowPack migration 백업·적용·worker 배포
- [ ] feature flag로 비동기 API 활성화
- [x] Local의 `dev.local`에 플러그인 ZIP 설치·활성화
- [ ] 실 API 키와 최소 scope 설정
- [x] 로컬 HTTPS mock으로 연결, 글, 사진, 재실행 smoke test
- [x] 시스템 cron 없이 WP-Cron 예약과 수동 polling 서비스 동작 확인
- [ ] 운영 지표와 경보 설정
- [x] 설치·환경 변수·API 키·문제 해결 문서 작성
- [ ] rollback rehearsal

완료 gate:

- 제한 사용자 환경에서 1주 관찰 후 중복 글 0건, 비밀 노출 0건, 고아 미디어 0건이다.
- 실패율과 처리 시간이 합의한 기준 안에 있다.

## 3. 파일 변경 예상 범위

정확한 파일명은 승인 후 현재 코드와 충돌을 다시 점검한다.

### FlowPack

```text
app/app/api/v1/capabilities/route.ts
app/app/api/v1/contents/[id]/rendered/route.ts
app/app/api/v1/generation-jobs/longform/route.ts
app/app/api/v1/generation-jobs/[id]/route.ts
app/lib/external-api/generation-jobs.ts
app/lib/external-api/render-content.ts
app/server/services/longform-generation-service.ts
app/prisma/schema.prisma
app/prisma/migrations/<timestamp>_add_generation_jobs/migration.sql
app/tests/unit/external-api-*.test.ts
docs/api-contract.md
docs/external-content-api.md
```

Prisma schema는 직접 수정 금지 규칙 때문에 DB 변경 승인 후에만 다룬다.

### WordPress 플러그인

별도 저장소로 확정했다.

```text
/Users/shin-youngbin/workspace/flowpack-wordpress-connector/**
```

## 4. 공수 범위

권장안 전체는 개발·테스트 기준 **10~14 개발일** 규모다. 운영 인프라 변경과 1주 관찰 기간은 별도다.

| 구간 | 예상 |
|---|---:|
| 결정·계약 | 1~2일 |
| FlowPack API·worker | 3~4.5일 |
| WordPress 플러그인 | 4.5~6.5일 |
| 보안·배포 검증 | 1.5~2일 |

동기 API를 그대로 호출하는 축소안은 기간을 줄일 수 있지만 PHP timeout과 중단 복구 위험 때문에 운영 기본안으로 채택하지 않는다.

## 5. 구현 시작 전 확인 목록

확정된 답은 다음과 같다.

1. WordPress에는 Tailscale을 설치할 수 없으므로 공개 HTTPS gateway를 사용한다.
2. 플러그인은 별도 저장소에 둔다.
3. 최소 환경은 WordPress 6.5+, PHP 8.1+이다.
4. FlowPack 비동기 generation job API와 worker 추가는 승인되었다.
5. 시스템 cron 사용 여부는 미정이다. WP-Cron으로 기본 동작하고 운영 진단에서 지연 가능성을 알린다.
6. API 키는 `wp-config.php` 상수를 우선하고 DB 저장 fallback을 제공한다.
7. 가져온 뒤 WordPress를 편집 기준으로 하며 자동 양방향 동기화는 제외한다.
8. 결과 상태는 `draft`가 기본이고 `pending`을 선택할 수 있다. 자동 공개는 제외한다.

배포 전에 남은 환경 확인은 공개 gateway의 도메인·TLS·공급자와 WordPress 서버의 outbound HTTPS 가능 여부다.

## 6. 2026-09-22 구현 결과

- FlowPack: capabilities, 비동기 generation job 등록·조회, rendered 콘텐츠, worker lease·크레딧 복구 구현
- 사진: WordPress 업로드 → FlowPack media API → 생성 글 연결 → WordPress 미디어 복사·대표 이미지 설정 구현
- NAS: 외부 API opt-in flag, 내부 전용 worker profile, `/api/v1/**` 전용 Nginx gateway 예시 구현
- WordPress: 별도 Git 저장소와 설치 ZIP 생성, draft/pending 선택, WP-Cron polling, nonce·capability·SSRF 방어 구현
- 검증: 외부 API·worker 17건, NAS 253건(공개 `/api/v1/**` gateway와 read-only 경계 포함), 플러그인 계약 10건, HTTPS mock과 실제 FlowPack 로컬 런타임의 인증·사진·비동기 상태·rendered·다운로드 계약, TypeScript, ESLint, Prisma validate, Next.js build 통과
- gateway: Local Nginx 1.26.1의 `nginx -t`로 TLS 인증서 로딩과 설정 문법 검증 통과
- 런타임 하네스: Local WordPress에서 DB 백업 후 draft/pending, 미디어, 대표 이미지, 중복 방지, 자동 공개 금지, 503 재시도, 부분 이미지 실패 보상 삭제를 검사하는 `tests/integration/run-local.sh` 추가·재실행 통과
- 로컬 WordPress 결과: 플러그인 0.1.0 활성, 필수 draft·pending과 추가 재시도 성공 글 확인, 대표 이미지·alt 반영, 같은 contentId 재가져오기 중복 없음, 사진 실패 작업은 글·신규 첨부 없음
- worker 복구: 마지막 lease 만료 작업을 실패 처리하고 예약 크레딧을 원자적으로 반환하는 reaper 추가
- worker 실행기: URL·secret·worker ID 시작 검증, 실제 내부 HTTP Bearer 요청, 빈 큐 idle delay, 오류 응답 body 정리와 backoff를 실행 테스트로 검증
- PostgreSQL: Docker 없이 Prisma 로컬 서버에서 두 migration 최초·재실행, 카탈로그와 제약 동작 확인
- 실제 로컬 전체 흐름: Local Nginx HTTPS → FlowPack 사진·job → 내부 worker → Local WordPress draft 5664·pending 5665, publish 0건 확인
- 공개 staging 실행기: 내부 worker를 공개하거나 WordPress에 secret을 전달하지 않고 public HTTPS job 상태만 polling하도록 추가
- 설치 ZIP: `flowpack-connector-0.1.0.zip` 생성, SHA-256 `99758fe9603765e3fd809fb1d59e95eec255e9a589e50f9dbe8a4fd7e54d576e`
- 미실행: 운영 DB migration, 실제 공개 DNS·TLS 설정, 실제 AI 크레딧을 사용한 staging smoke. 현재 Supabase pooler는 `tenant/user ... not found`, OpenAI는 `credit_balance_exhausted`를 반환해 유효한 배포 DB·도메인·AI 크레딧이 필요함
