# Phase 5 작업 로그: WordPress 복수 사이트 연동 DB 제약 수정

## 기본 정보

- 날짜: 2026-07-11
- Phase: Phase 5 구현
- 관련 Task: WordPress 연동 저장 오류 수정

## 이번에 한 일

WordPress 연결 테스트 성공 후 저장 단계에서 발생한 유일 제약 오류를 분석했다. 운영 DB의 `userId`, `platform` 유일 인덱스가 WordPress 복수 사이트 연결 구현과 충돌하는 것을 확인했다. 기존 인덱스를 사이트별 복합 유일 인덱스로 교체하는 Prisma 마이그레이션을 추가하고, DB 스키마 문서를 현재 구현과 일치시켰다.

## 핵심 결정 사항

| 결정 | 선택 이유 |
|------|----------|
| 기존 인덱스를 복합 유일 인덱스로 교체 | 동일 사이트 중복은 막고, 사용자당 여러 WordPress 사이트 연결을 허용하기 위해서 |
| 기존 데이터 유지 | 연결 정보와 배포 이력을 손상시키지 않기 위해서 |

## 다음 할 일

- WordPress 사이트를 두 개 이상 연결하는 흐름을 확인한다.

## 운영 적용 및 검증

Vercel production 환경의 Neon DB에 인덱스 교체 SQL을 적용했다. `social_accounts` 테이블에 `userId`, `platform`, `accountId` 복합 유일 인덱스가 존재함을 조회로 확인했다. DB가 Prisma 마이그레이션 이력을 사용하지 않고 풀러 연결에서 advisory lock을 지원하지 않아, 이번 변경은 단일 SQL 실행으로 적용했다.
