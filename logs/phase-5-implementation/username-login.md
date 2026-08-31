# 아이디 로그인 구현 작업 로그

## 기본 정보

- 날짜: 2026-08-31
- Phase: Phase 5 구현
- 관련 변경: CP-007

## 이번에 한 일

- 이메일 로그인은 유지하고 아이디 또는 이메일 입력으로 Credentials 인증을 확장했다.
- 신규 가입에서 선택 아이디를 저장하고, 기존 회원이 프로필에서 현재 비밀번호 확인 후 아이디를 최초 등록할 수 있게 했다.
- User.username nullable unique 마이그레이션, API 계약·DB 문서·BDD 시나리오·E2E 페이지 검사를 함께 갱신했다.

## 검증

- `node node_modules/typescript/bin/tsc --noEmit` 통과
- `npm run build` 통과

## 다음 할 일

- 배포 환경에서 Prisma 마이그레이션 적용 후 이메일·아이디 로그인과 기존 이메일 계정 회귀를 확인한다.
