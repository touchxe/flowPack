# 외부 글·사진 REST API 작업 로그

## 기본 정보

- 날짜: 2026-09-22
- Phase: Phase 5 구현
- 관련 Task: TASK-EXT-001

## 이번에 한 일

외부 자동화가 사용자별 API 키로 사진을 업로드하고 Markdown BLOG 초안을 등록·조회·수정할 수 있는 `/api/v1` REST API를 구현했다. 기존 장문 AI 생성도 동기 JSON API로 연결하고, 멱등 요청과 크레딧 예약 상태를 함께 저장하여 재전송·중단 시 중복 생성과 중복 차감을 막았다. 기존 브라우저 편집 경로에는 revision 증가와 연결된 미디어 삭제 방지를 추가했다.

## 핵심 결정 사항

| 결정 | 선택 | 이유 |
|---|---|---|
| 인터페이스 | REST 우선 | 외부 프로그램·curl·자동화에서 파일 전송과 오류 처리가 명확함 |
| 접속 범위 | Tailscale 내부 | 현재 NAS 공개 경계 유지 |
| 본문 | Markdown 입력 | 기존 장문 콘텐츠와 편집기 변환 경로 재사용 |
| 사진 | 선 업로드 후 mediaId 참조 | 소유권·용량·형식 검증과 본문 배치를 분리 |
| AI | 동기 JSON | 별도 worker 없이 초기 필수 범위를 완성 |
| 재시도 | DB 멱등 기록 | 글·사진·AI·크레딧 결과를 요청 키별 한 번만 확정 |

## 사용한 기술

- Next.js Route Handler, Prisma, PostgreSQL migration, Zod, Node crypto
- 기존 NAS/Cloudinary storage adapter와 AI provider adapter
- Node test runner, TypeScript, ESLint, Next production build

## 검증 결과

- 외부 API 단위 테스트: 6건 통과
- NAS 회귀 테스트: 250건 통과
- TypeScript: 통과
- 변경 파일 ESLint: 경고·오류 없음
- Prisma validate/generate 및 migration diff: 통과
- Next.js production build: 통과
- 기존 전체 프로젝트 lint 경고는 남아 있으나 이번 변경 파일에서 추가된 경고는 없음

현재 설정은 관리형 원격 DB로 분류되어 운영 mutation을 피했다. Docker Desktop이 응답하지 않아 임시 PostgreSQL 기반 API 통합 시험은 실행하지 못했다. migration 적용과 실환경 smoke는 기존 NAS PostgreSQL baseline/restricted gateway 배포 절차에서 수행한다.

## 다음 할 일

- 승인된 배포 단계에서 additive migration 적용
- 운영 테스트 사용자 키 발급
- 사진 업로드 → 글 등록 → revision 수정 → AI 생성 smoke
- 안정화 후 필요하면 MCP 어댑터를 별도 범위로 검토
