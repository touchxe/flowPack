# 변경 제안서: CP-002 SNS 계정 OAuth 보안 정리

## 현재 상태

- 실제 구현은 `/api/social-accounts` 네임스페이스를 사용하지만 `docs/api-contract.md`에는 `/api/social`로 기록되어 있다.
- `SocialAccount` 실제 Prisma 스키마는 `@@unique([userId, platform, accountId])`로 복수 계정을 허용하지만 `docs/db-schema.md`는 `@@unique([userId, platform])` 기준이다.
- Instagram, Threads 토큰과 WordPress Application Password가 `SocialAccount.accessToken`에 평문 문자열로 저장된다.
- Facebook, Twitter/X, LinkedIn은 실제 OAuth가 아니라 mock 계정 생성 fallback이 남아 있다.

## 변경 제안

- 기존 화면/라우트와 호환되는 `/api/social-accounts`를 SNS 계정 연동 공식 API로 정리한다.
- API 응답 형식을 `{ success: true, data }` / `{ success: false, error, code }`로 통일한다.
- `AUTH_SECRET` 또는 `SOCIAL_TOKEN_ENCRYPTION_KEY`에서 파생한 키로 SNS 토큰을 암호화한다.
- OAuth `state`를 HMAC 서명하고 콜백에서 사용자, 플랫폼, 만료 시간을 검증한다.
- Facebook, Twitter/X, LinkedIn은 실제 OAuth URL과 콜백을 구현하고, 환경변수 미설정 시 mock 계정을 만들지 않고 설정 오류로 안내한다.
- WordPress 연동은 현재 정상 동작 중이므로 이번 변경 범위에서 제외한다.

## 변경 사유

- 토큰 평문 저장은 `docs/anti-patterns.md` 보안 금지 패턴과 충돌한다.
- 실제 사용자 계정 연결 기능은 OAuth state 검증과 토큰 보호가 선행되어야 한다.
- mock 연동 fallback은 프로덕션에서 사용자가 실제 연동으로 오해할 수 있다.

## 영향 범위

- 영향받는 파일:
  - `app/lib/social-token-crypto.ts`
  - `app/lib/oauth-state.ts`
  - `app/lib/integrations/*`
  - `app/app/api/social-accounts/**`
  - `app/app/(app)/social-accounts/page.tsx`
- 영향받는 기능:
  - Instagram, Threads, Facebook, Twitter/X, LinkedIn 계정 연동
  - SNS 계정 목록/해제 응답 포맷
  - SNS 발행 시 저장 토큰 파싱
- 마이그레이션 필요 여부: 아니오

## 대안 비교

| 기준 | 현재 방식 | 제안 방식 | 대안 B |
|------|-----------|-----------|--------|
| 보안 | 토큰 평문 저장 | 암호화 저장 | 외부 KMS 도입 |
| 복잡도 | 낮지만 위험 | 중간 | 높음 |
| 운영 안정성 | mock fallback으로 오동작 가능 | 설정 누락을 명시적 오류로 처리 | 플랫폼별 별도 서비스 분리 |
| 문서 정합성 | API/DB 문서와 구현 불일치 | 현재 구현 기준으로 제안 정리 | 코드를 문서의 `/api/social`로 이동 |

## 리스크

- 기존 평문 토큰과 신규 암호화 토큰이 공존할 수 있어 파서에서 하위 호환이 필요하다.
- Facebook Page, X, LinkedIn은 앱 권한 심사 및 환경변수 설정이 완료되어야 실제 OAuth가 성공한다.
- WordPress는 이번 변경 범위에서 제외하므로 추후 별도 암호화 마이그레이션이 필요할 수 있다.

## 상태: 승인됨

사용자가 WordPress 제외 후 나머지 제안 내용 진행을 승인했다.
