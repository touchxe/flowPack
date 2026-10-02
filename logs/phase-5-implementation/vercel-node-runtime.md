# Vercel 운영 배포 Node 런타임 복구

- 날짜: 2026-10-02
- 요청: 모바일 수정의 운영 적용

## 원인과 변경

Vercel main ac6c121 운영 배포와 모바일 PR 프리뷰가 Node.js 20 지원 종료로
빌드 시작 전에 거부되는 것을 배포 화면에서 확인했다.
앱 및 lockfile 루트의 engines.node를 >=20 <25로 확장한다.
Vercel은 지원하는 최신 Node.js 24를 선택한다. 로컬·NAS Node 20 호환 범위는
유지한다. 패키지 버전, DB, 환경 변수, NAS 배포 설정을 변경하지 않는다.

근거: https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
공식 문서는 >=20.0.0 범위가 최신 24.x로 매핑됨을 설명한다.
실제 배포 화면은 20.x가 discontinued 상태임을 명시한다.

## 검증

package.json/lockfile engines 일치와 semver의 Node 20·22·24 허용 및
25 제외를 확인한다. 앞선 모바일 UI의 타입 검사·린트·분리 소스 빌드와
35개 레이아웃 검사 및 결제 7개 너비 검사는 통과했다.
런타임 범위와 작업 기록만 포함하며 Vercel Node 24 빌드로 호환을 검증한다.
운영 완료는 production READY 및 flowpack.ai.kr 응답 확인 후 판정한다.
