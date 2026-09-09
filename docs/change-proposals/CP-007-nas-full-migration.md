# 변경 제안서: CP-007 NAS 전체 이전 및 PostgreSQL 기준선 재구성

## 현재 상태

- 애플리케이션은 Vercel 계열 런타임과 Neon PostgreSQL 17을 사용한다.
- Prisma datasource는 PostgreSQL이지만, 저장소의 초기 migration SQL에는
  SQLite 전용 `DATETIME`과 `PRAGMA`가 남아 있다.
- 미디어는 Cloudinary, DB data URL, 외부 URL에 분산되어 있다.
- 인증 세션, OAuth 토큰, WordPress Application Password, 결제 자료가 DB와
  환경변수에 걸쳐 존재한다.
- Toss·Meta 웹훅과 Instagram·Threads 미디어 수집은 인터넷에서 접근 가능한
  callback 또는 asset URL을 필요로 한다.

## 변경 제안

FlowPack의 애플리케이션, PostgreSQL 데이터, 자격증명 연속성, 소유 미디어,
예약 작업을 프로젝트 전용 NAS Compose로 이전한다.

- PostgreSQL과 파일 디렉터리는 프로젝트별로 분리하고 외부 포트를 공개하지
  않는다.
- 웹 포트는 NAS loopback에만 바인딩하고 Tailscale Serve HTTPS로 제공한다.
- 실제 Neon production 스키마를 introspection한 뒤 PostgreSQL baseline migration을
  생성한다. 현재 SQLite migration을 NAS PostgreSQL에 실행하지 않는다.
- Cloudinary와 DB URL을 manifest로 조사하고, 소유권이 확인된 파일만
  checksum과 함께 NAS storage key로 이전한다.
- `AUTH_SECRET`과 기존 `SOCIAL_TOKEN_ENCRYPTION_KEY`를 보존한 상태에서 SNS
  토큰 복호화를 검증한 뒤에만 별도 키 회전을 허용한다.
- 배포 표준은 `nas:check` → `nas:dry-run` → 커밋 → `nas:deploy`로 고정하며,
  DB backup, 실제 restore drill, HTTPS health, source/data rollback 경계를
  포함한다.

## 공개 기능 경계

이번 승인 범위는 Tailscale 전용 HTTPS이다. 따라서 다음 기능은 소유 도메인의
최소 공개 relay가 별도 승인되기 전까지 cutover 시 비활성화한다.

- Toss webhook 수신
- Meta deauthorize 및 data-deletion callback
- Instagram·Threads가 NAS 파일을 직접 가져가는 발행
- tailnet 외부의 공개 콘텐츠 링크

NAS, DSM, SSH, Docker, PostgreSQL 포트는 어떤 경우에도 공개하지 않는다.
향후 relay를 승인하더라도 영구 DB와 원본 파일은 NAS에 유지하고 relay는
검증된 최소 payload만 전달해야 한다.

## 영향 범위

- `app/Dockerfile.nas`, `app/docker-compose.nas.yml`
- `app/scripts/nas-*`
- `app/package.json`, `app/next.config.ts`
- `app/prisma/schema.prisma`, PostgreSQL baseline 및 검증 도구
- NAS 파일 storage adapter와 media API
- 환경변수 예시와 운영 문서
- 예약 발행 worker 및 health route

## 데이터 보호 규칙

1. Neon 원본은 최종 전환 후 최소 30일 보존한다.
2. dump, 파일 manifest, 백업은 Git과 배포 archive에서 제외하고 암호화한다.
3. 원본 dump를 빈 임시 PostgreSQL에 복원해 검증하기 전에는 cutover하지 않는다.
4. table row count, sequence, FK/index/enum, 주요 결정적 집계를 비교한다.
5. 파일마다 기존 식별자, 새 storage key, byte size, MIME, SHA-256을 기록한다.
6. NAS write 시작 뒤의 rollback은 역방향 데이터 이전 없이 완료로 간주하지
   않는다.
7. 코드 rollback, DB restore, 파일 restore를 독립적으로 검증한다.

## 구현 순서

1. Neon·Vercel·Cloudinary·OAuth provider를 읽기 전용 inventory한다.
2. NAS Compose, PostgreSQL role, storage directory, backup directory를 만든다.
3. PostgreSQL baseline과 로컬 storage adapter를 구현한다.
4. 초기 dump·전체 파일을 rehearsal 환경에 복원한다.
5. 인증, 업로드·다운로드, 콘텐츠, AI, WordPress, 예약 작업을 시험한다.
6. source를 maintenance/read-only로 전환하고 최종 dump·파일 delta를 복원한다.
7. Tailscale HTTPS에서 smoke test 후 사용자 write를 활성화한다. scheduler는
   별도 singleton 구현·검증이 완료될 때까지 source와 NAS 모두 비활성 상태로 둔다.
8. restore·rollback drill과 off-NAS backup을 확인한 뒤 안정화 기간을 시작한다.

## 검증 기준

- 저장소 quality gate와 NAS check/dry-run이 모두 통과한다.
- Compose config에 공개 DB 포트가 없고 웹은 loopback에만 바인딩된다.
- 현재 SQLite migration이 NAS PostgreSQL에서 실행되지 않는다.
- 임시 DB restore와 데이터 비교 보고서가 성공한다.
- 미디어 manifest의 count, total bytes, SHA-256 검증이 성공한다.
- 세션 재로그인, 비밀번호 로그인, SNS 토큰 복호화가 시험 계정에서 검증된다.
- Tailscale HTTPS health와 핵심 사용자 흐름이 성공한다.
- scheduler 단일 소유권과 rollback 절차가 증거로 남는다.

## 승인

- 승인 근거: 사용자 요청 “DB까지 전체 이전” 및 활성 전체 이전 목표
- 적용일: 2026-08-23
- 상태: ✅ 구현 진행 승인

운영 절차와 cutover/rollback 상태 머신은
`docs/operations/FLOWPACK_NAS_FULL_MIGRATION.md`를 따른다.
