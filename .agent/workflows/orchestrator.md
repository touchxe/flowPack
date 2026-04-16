---
description: BMAD Method 기반 AI 주도 개발 마스터 오케스트레이터. 파이프라인 전체를 조율한다.
---

# 🎯 마스터 오케스트레이터 — FlowPack AI 개발 파이프라인

## 에이전트 체계 (12개)

### BMAD 기본 (6개) — _bmad/에서 로드
| 에이전트 | 주 활성 Phase |
|---------|-------------|
| Analyst | Phase 1 (요구사항 분석) |
| PM | Phase 1 (PRD, 유저스토리) |
| Architect | Phase 3 (아키텍처 설계) |
| Dev | Phase 5 (구현) |
| SM | Phase 5 (스토리 관리) |
| QA | Phase 6 (품질 검증) |

### 커스텀 보강 (6개) — .agent/workflows/에서 로드
| 에이전트 | 워크플로우 | 주 활성 Phase |
|---------|----------|-------------|
| 가상 CTO | /architecture-guard | 상시 (아키텍처 감시) |
| Evaluator | /evaluate | Phase 6 (분리된 평가) |
| 벤치마킹 | /benchmark | Phase 1.5 |
| UX 라이터 | /ux-writer | Phase 2 ~ 5 |
| 보안 감사관 | /security-audit | Phase 5 ~ 6 |
| 성능/DX | /perf-check | Phase 5 (Epic 완료 시) |

### 상시 적용 워크플로우
| 규칙 | 워크플로우 |
|------|----------|
| 코딩 표준 | /coding-standards |
| 작업 로그 | /work-log |

## 파이프라인

```
[Phase 0]   BMAD 설치 + /bmad-help
[Phase 1]   /interview — GIGO 차단, 엣지 케이스 발굴
[Phase 1.5] /benchmark — 참조 사이트 분석, 사이트맵 수립
[Phase 2]   /wireframe — shadcn 기반 와이어프레임 생성
[Phase 2.5] /design-direction — 색상/타이포/레이아웃 확정
[Phase 3]   /architecture-guard — 아키텍처 제약 잠금
[Phase 4]   /bdd — 테스트 선행 작성 (RED→GREEN→REFACTOR)
[Phase 5]   /prd-loop — 스프린트 계약 + 컨텍스트 핸드오프
[Phase 6]   /evaluate — 분리된 평가자 검증
[상시]      /coding-standards, /work-log
```

## 상시 참조 파일 (읽기 전용 — 가상 CTO 감시)
- `docs/tech-stack.md` — 기술 스택 제약
- `docs/architecture.md` — 시스템 아키텍처
- `docs/api-contract.md` — API 계약
- `docs/db-schema.md` — DB 스키마
- `docs/design-defaults.md` — 디자인 기본값 (Tailwind+shadcn+Lucide)
- `docs/design-direction.md` — 디자인 방향 (색상, 타이포, 레이아웃)
- `docs/anti-patterns.md` — 금지 패턴

## 핵심 원칙
1. **코드보다 문서가 먼저다.** 요구사항 → 벤치마킹 → 와이어프레임 → 아키텍처 → 테스트 → 코드.
2. **모호함을 채우지 마라.** 불확실하면 사용자에게 질문하라.
3. **제약 파일을 위반하지 마라.** 변경은 제안서 → 승인 프로세스를 거쳐라.
4. **테스트 없는 코드는 없다.** 모든 기능은 BDD 시나리오가 선행되어야 한다.
5. **상태를 추적하라.** 매 작업 완료 시 `tasks/workflow_state.md`를 업데이트하라.
6. **작업 로그를 남겨라.** 매 Phase 전환 시 `logs/`에 기록하라.
7. **shadcn 우선.** UI는 shadcn/ui 컴포넌트를 먼저 사용하라.
8. **자기 작업을 칭찬하지 마라.** 평가는 분리된 Evaluator(/evaluate)가 수행한다.

## 언어 규칙
- 코드 주석: 한국어
- 커밋 메시지: 한국어
- 문서: 한국어
- UI 텍스트: `docs/ux-copy.md` 참조 (한국어)
- 변수/함수명: 영어 (camelCase)
- 파일명: 영어 (kebab-case)

## 현재 프로젝트 상태 확인
`tasks/workflow_state.md`를 먼저 읽고 현재 Phase를 파악한 후 다음 단계를 안내하라.
