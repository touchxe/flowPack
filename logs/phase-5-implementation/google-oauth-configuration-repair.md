# Google OAuth Configuration 오류 복구 작업 로그

## 기본 정보
- **날짜**: 2026-09-02
- **Phase**: Phase 5: 운영 장애 수정
- **관련 Task**: Google 로그인 콜백 오류 복구

## 확인 결과
- 운영 `/api/auth/providers`, `/api/auth/session`, `/api/auth/csrf` 응답이 정상이다.
- Google Client ID가 존재하며 운영 도메인의 콜백 URL이 정상 생성된다.
- 따라서 OAuth 시작 버튼이나 `AUTH_SECRET` 누락 문제가 아니라, Google 인증 후 애플리케이션 콜백 처리 범위의 오류로 좁혔다.
- 앱은 JWT 세션 전략을 사용하지만 `signIn` 콜백에서 Prisma `Session` 테이블을 조회하고 갱신했다. 이 콜백 예외는 Auth.js에서 안전하지 않은 서버 오류로 분류되어 `?error=Configuration`으로 숨겨진다.

## 수정 사항
- JWT 로그인 콜백의 Prisma `Session` 조회·갱신을 제거했다.
- 로그인마다 JWT에 사용할 `sessionId`만 새로 발급하도록 단순화했다.
- 로그인 페이지가 Auth.js 오류 코드를 읽고 사용자에게 오류 원인을 안내하도록 보완했다.
- `Configuration` 오류 안내에 대한 Playwright 시나리오를 추가했다.

## 검증 결과
- Prisma Client 생성 성공
- Next.js 프로덕션 빌드 및 TypeScript 검사 성공
- Playwright 시나리오는 로컬 Firefox 실행 파일이 설치되지 않아 브라우저 시작 전에 중단됨

## 운영 확인
- 배포 후 Google 로그인 완료 및 `/home` 이동 여부를 확인한다.
- 오류가 지속되면 Vercel 함수 로그의 Auth.js 서버 오류를 기준으로 Google 토큰 교환과 Prisma Adapter 단계를 추가 점검한다.

## 추가 진단 계측
- 첫 수정 배포 후에도 `Configuration` 오류가 계속되어 세션 조회 로직이 주원인이 아님을 확인했다.
- Vercel 팀 로그는 현재 로컬 자격 증명으로 조회할 수 없어 Auth.js 오류 객체에서 비밀정보를 제외한 진단 코드만 추출하도록 계측했다.
- 기존 OAuth 콜백 리다이렉트에 허용된 진단 코드만 추가하며, 로그인 화면에서 데이터베이스 연결·스키마·충돌·Adapter·OAuth 콜백 오류를 구분해 표시한다.
- 계측 추가 후 Next.js 프로덕션 빌드와 TypeScript 검사가 통과했다.
- 운영 재시도 결과 Prisma Adapter 오류로 확인되어, Adapter 디버그 이벤트를 이용해 계정 조회·이메일 조회·사용자 생성·계정 연결·사용자 갱신 단계를 추가로 구분했다.
