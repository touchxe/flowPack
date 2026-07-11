# 변경 제안서: CP-003 WordPress 복수 사이트 연동 유일 제약 정합화

## 현재 상태

- `SocialAccount` 모델과 WordPress 연동 화면은 사용자당 WordPress 사이트를 최대 5개까지 연결하도록 구현되어 있습니다.
- 애플리케이션 스키마는 `userId`, `platform`, `accountId` 복합 유일 제약을 선언합니다.
- 운영 DB의 초기 마이그레이션에는 `userId`, `platform` 유일 인덱스가 남아 있습니다.
- 따라서 이미 WordPress 계정이 하나 있는 사용자가 다른 사이트를 연결하면 `Unique constraint failed on the fields: (userId, platform)` 오류가 발생합니다.

## 변경 제안

`social_accounts` 테이블의 기존 `userId`, `platform` 유일 인덱스를 제거하고, `userId`, `platform`, `accountId` 복합 유일 인덱스로 교체합니다.

## 변경 사유

현재 UI와 API가 제공하는 WordPress 복수 사이트 연결 기능을 운영 DB 제약과 일치시켜 연결 저장 실패를 해소합니다. 동일 WordPress 사이트의 중복 연결은 계속 차단합니다.

## 영향 범위

- 영향받는 파일:
  - `app/prisma/migrations/20260711103000_allow_multiple_wordpress_sites/migration.sql`
  - `docs/db-schema.md`
- 영향받는 기능: WordPress 사이트 연결 및 계정 목록 표시
- 마이그레이션 필요 여부: 예
- 기존 데이터 영향: 기존 행은 유지되며, 이후 같은 사용자가 다른 WordPress 사이트를 추가할 수 있습니다.

## 대안 비교

| 기준 | 현재 방식 | 제안 방식 | 대안 B: WordPress 단일 사이트만 유지 |
|------|----------|----------|--------------------------------------|
| 다중 사이트 연결 | 불가능 | 가능 | 불가능 |
| 기존 UI와의 일치 | 불일치 | 일치 | UI 및 API 축소 필요 |
| 데이터 손실 | 없음 | 없음 | 기존 데이터 유지 |
| 유지보수 | 오류 재발 가능 | 스키마와 코드가 일치 | 기능 요구와 충돌 |

## 리스크

- 인덱스 교체 중 매우 짧은 메타데이터 잠금이 발생할 수 있습니다.
- 마이그레이션을 적용하지 않은 배포 환경에서는 오류가 계속됩니다.

## 승인

- 승인일: 2026-07-11
- 승인 근거: 사용자 요청 "진행해."
- 적용일: 2026-07-11
- 상태: ✅ 운영 DB 적용 완료
