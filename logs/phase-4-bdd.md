# [Phase 4] BDD 테스트 시나리오 작성

## 기본 정보
- **날짜**: 2026-03-31
- **Phase**: Phase 4: BDD 테스트 선행 작성
- **소요 시간**: 약 1시간 30분
- **관련 Task**: PHASE-4

## 이번에 한 일
FlowPack 프로젝트의 5개 Epic(Epic 1~5)에 대해 Gherkin 포맷의 BDD 테스트 시나리오를 작성했다. 각 Epic당 Feature/Scenario를 정의하고, Happy Path와 엣지 케이스를 모두 커버하도록 했다.

## 핵심 결정 사항
| 결정 | 선택지 | 선택 이유 |
|------|--------|----------|
| Gherkin 포맷 선택 | Cucumber/Gherkin | 가장 널리 사용되는 BDD 표기법, 비개발자도 이해 가능 |
| 시나리오 분류 | Epic별 파일 분리 | Epic 단위로 관리하고 검색하기 쉽도록 |
| 태그 체계 도입 | @epic1~5, @auth 등 | 테스트 실행 시 필터링 가능 |
| 엣지 케이스 별도 분리 | Scenario Outline 사용 안 함 | 구체적 시나리오로 우선 작성 |

## 사용한 도구/기술
- **문서 포맷**: Markdown + Gherkin
- **태그 체계**: @epic1~5, @auth, @content, @publish, @analytics, @billing, @happy-path, @edge-case

## 어려웠던 점 / 배운 점
- **어려웠던 점**: 엣지 케이스를 어디까지 커버할지 결정하는 것이 어려웠다. 너무 세밀하면 문서가 과해지고, 너무 대충이면 테스트로서의 가치가 떨어진다.
- **배운 점**: 시나리오를 쓸 때 "Given-When-Then" 구조를 엄격하게 지키면 사용자 플로우가 명확해진다.

## AI와의 협업 노트
- BDD 시나리오 작성은 반복적이지만 정형화된 작업이라 AI가 효과적
- PRD의 사용자 스토리를 기반으로 시나리오를 자동으로 생성 가능
- 엣지 케이스는 사용자가 직접 검토하는 것이 좋음

## 다음 할 일
- **Phase 5**: PRD+Todo 루프 — 스프린트 계약 후 실제 구현 시작
- 각 Epic 시나리오를 기반으로 구현-ready Story 파일 생성 필요

## 스크린샷/참조
- 산출물: `docs/bdd/` 디렉토리 (5개 Epic 파일 + README.md)
