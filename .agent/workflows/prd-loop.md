---
description: Phase 5 - PRD 기반 자율 구현 루프. 하네스 스프린트 계약 + 컨텍스트 핸드오프 포함.
---

# 🔄 Phase 5: 구현 루프 (하네스 통합)

## 참조 파일
- PRD: `docs/prd.md`
- 스토리: `docs/epics/` (Epic별 Story 파일)
- 상태 추적: `tasks/workflow_state.md`

## Task 실행 사이클

### Phase 1: 계획 (Plan)
1. `tasks/workflow_state.md`에서 현재 상태 파악
2. 미완료 Task 중 의존성 충족된 것을 P0→P1→P2 순으로 선택
3. PRD + UI 스펙 + API 계약에서 요구사항 확인
4. 구현 접근 방식 2~3가지 도출

### Phase 1.5: 스프린트 계약 (Sprint Contract) ← 하네스 핵심
Generator(구현 AI)가 제안서를 작성하고 사용자 승인을 받은 후 시작:

```markdown
# 스프린트 계약: TASK-XXX [제목]

## 구현 범위
- [ ] 구현할 항목 1
- [ ] 구현할 항목 2

## 테스트 가능한 완료 기준
| # | 기준 | 검증 방법 |
|---|------|----------|
| 1 | [기준] | [어떻게 테스트하는가] |

## 영향받는 파일
- app/...
- tests/...

## 제약 확인
- tech-stack.md 준수: ✅
- api-contract.md 정합: ✅
- design-defaults.md 준수: ✅

## 상태: ⏳ 사용자 승인 대기
```

승인 후 `tasks/contracts/TASK-XXX-contract.md`에 저장.

### Phase 2: 테스트 작성 (Test First)
`/bdd` 워크플로우 규칙에 따라 수행.

### Phase 3: 구현 (Implement)
- 매 파일 작성 시 `/architecture-guard` 제약 파일 확인
- `docs/design-defaults.md` 준수 (shadcn 우선)
- `docs/ux-copy.md` 참조 (UI 텍스트)
- 린트 + 타입 체크 통과

### Phase 4: 검증 (Verify)
- 해당 Task 테스트 실행 → GREEN 확인
- 전체 테스트 실행 → 회귀 버그 없음 확인
- RED면 자가 수정 루프 (최대 5회)

### Phase 5: 평가 (Evaluate) ← 하네스
`/evaluate` 워크플로우로 분리된 평가 수행.
- PASS → Phase 6으로
- FAIL → 구체적 피드백 → Phase 3으로 복귀

### Phase 6: 상태 업데이트 + 로그
- Task → ✅ 완료
- `tasks/workflow_state.md` 업데이트
- `/work-log`로 `logs/phase-5-implementation/sprint-XXX.md` 작성

---

## 컨텍스트 핸드오프 (하네스)

5 Task 이상 연속 작업 또는 대화가 매우 길어질 때 핸드오프 파일을 작성하라:

```markdown
# tasks/handoffs/handoff-XXX.md

## 프로젝트 상태 요약
- 완료: TASK-001 ~ TASK-005
- 진행 중: TASK-006 (Phase 3: 구현 중, 70% 완료)
- 알려진 이슈: [목록]

## 다음 세션 지시
1. TASK-006 나머지 구현 완료
2. 테스트 실행 및 검증
3. TASK-007 스프린트 계약 작성

## 참조 파일
- tasks/contracts/TASK-006-contract.md
- docs/ui-spec-dashboard.md

## 아키텍처 결정 이력
| 결정 | 내용 | 사유 |
|------|------|------|
```

새 세션에서 이 파일을 먼저 읽고 작업을 이어간다.

## 금지 사항
- 스프린트 계약 없이 구현을 시작하지 마라.
- 의존성 미충족 Task를 시작하지 마라.
- 한 번에 여러 Task를 동시에 진행하지 마라.
- `tasks/workflow_state.md` 업데이트를 잊지 마라.
- 작업 로그를 생략하지 마라.
