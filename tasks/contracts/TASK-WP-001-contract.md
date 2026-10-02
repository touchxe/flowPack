# 완료 계약: TASK-WP-001 WordPress → FlowPack 커넥터

## 사용자 요구사항

| 요구사항 | 현재 상태 | 증거 |
|---|---|---|
| Tailscale 없이 공개 HTTPS 연결 | 구현·실제 로컬 gateway 통과, 운영 주소 대기 | Local Nginx에서 인증 없는 capabilities 401·최소 scope 키 사용 시 200, 내부 worker·루트 404, Local WP HTTPS 호출 성공 |
| FlowPack 비동기 생성 API와 worker | 구현·PostgreSQL 런타임 통과 | generation job route·service·migration, 실제 queued → succeeded/failed, 내부 worker 인증·크레딧 처리 |
| WordPress 플러그인은 별도 위치 | 완료 | `/Users/shin-youngbin/workspace/flowpack-wordpress-connector` |
| 글과 사진 가져오기 | 실제 FlowPack 런타임 → Local WordPress 통과 | 최초 WordPress 글 5664 및 재검증 글 5687에서 사진·본문·alt·대표 이미지 확인 |
| 결과를 초안 또는 검토 대기로 선택 | 실제 FlowPack 런타임 통과 | 최초 draft 5664·pending 5665, 재검증 draft 5687·pending 5688, publish 0건 |
| 시스템 cron을 몰라도 기본 동작 | 구현 완료 | WP-Cron 단일 이벤트와 관리자 상태 polling |
| 양방향 동기화 제외 | 완료 | FlowPack → WordPress import만 구현 |
| 실패·중복·비밀값 안전성 | 구현·실환경 검증 완료 | 멱등 키, contentId 중복 방지, Local WP의 503 재시도·부분 이미지 실패 보상 삭제, worker lease reaper, uninstall secret 정리 |
| 설치·운영 문서 | 완료 | API 가이드, CP-009, 상세 계획, 플러그인 readme, 로컬 실행 스크립트 |

## 현재 검증 기준선

- 외부 API·worker 테스트: 17/17
- NAS·gateway·write-boundary 테스트: 253/253
- WordPress 계약 테스트: 10/10
- Local WordPress E2E: HTTPS mock → 사진 업로드 → 비동기 상태 → draft/pending import 통과
- Local WordPress 실패 E2E: 503 + Retry-After 뒤 최종 성공, 두 번째 필수 사진 실패 시 글 0건·신규 첨부 0건 확인
- 종료 상태: 테스트 API URL·키 없음, 테스트 cron 없음, 실패 job 1건과 성공 job 7건의 이력만 보존
- Worker 실행기 HTTP 검증: Bearer·worker ID 전송, 빈 큐 idle delay, 503 error backoff, secret 비로그 확인
- Docker 없는 Prisma PostgreSQL에서 두 additive migration 최초 적용·재실행 통과, 테이블·컬럼·FK·index·status CHECK 확인
- 실제 FlowPack 로컬 런타임: 사진 201, job 202, worker succeeded, rendered 이미지 1건, 인증 사진 200, 업로드·job 멱등 replay 확인
- 실제 HTTPS gateway → Local WordPress: 사진 포함 draft 5664, pending 5665, publish 0건
- runner 분리 후 실제 전체 E2E 재검증: 사진 포함 draft 5687·대표 이미지 5686·alt, pending 5688, 미해결 token 0, publish 0
- 재검증 FlowPack 상태: job 2건 모두 `SUCCEEDED`, content 2건, media 1건, 크레딧 2/10 사용
- 실제 OpenAI 키 연결은 429 `credit_balance_exhausted`; 성공 orchestration은 프로덕션에서 금지된 loopback OpenAI 호환 서버로 검증
- 시험 종료 후 WordPress API URL·키·cron·임시 상태 없음, 테스트 서버 4개 모두 정상 종료
- 공개 staging runner: 내부 worker URL·secret 없이 공인 HTTPS API만 사용, 명시적 쓰기 confirmation 없거나 IP literal·단일 이름·로컬 도메인이면 실행 거부
- TypeScript, 변경 파일 ESLint, Prisma validate, Next.js production build 통과
- Nginx 1.26.1 설정 문법과 TLS 인증서 로딩 통과
- 설치 ZIP SHA-256: `99758fe9603765e3fd809fb1d59e95eec255e9a589e50f9dbe8a4fd7e54d576e`

## 운영 완료 gate

다음 항목은 코드 완료 기준이 아니라 실제 운영 연결을 증명하기 위한 필수 gate다.

- [ ] 공개 API 도메인과 TLS 인증서 적용
- [ ] 승인된 PostgreSQL에 두 additive migration 적용
- [ ] NAS read-write mode와 `flowpack_app_rw` DB role의 통제된 전환
- [ ] `FLOWPACK_EXTERNAL_API_ENABLED=true`, `COMPOSE_PROFILES=external-api`, 32자 이상 worker secret 적용
- [ ] WordPress 최소 scope API 키 발급·설정
- [ ] 유효한 실제 AI 크레딧으로 FlowPack → worker → WordPress 글 1건·사진 1건 staging smoke
- [ ] API 주소·키·worker secret 비노출 및 rollback 확인

현재 `app/.env`와 `.env.local`은 같은 원격 Supabase pooler를 가리키지만, 2026-09-22 읽기 전용 `SELECT 1` 확인에서 `tenant/user ... not found`로 연결이 거부됐다. Docker 없는 Prisma 로컬 PostgreSQL에서는 migration과 전체 런타임을 검증했지만, 배포 완료에는 유효한 테스트/운영 PostgreSQL과 공개 도메인이 필요하다. 실제 OpenAI 키도 같은 날 429 `credit_balance_exhausted`를 반환했으므로 staging smoke 전에 크레딧 복구가 필요하다.
