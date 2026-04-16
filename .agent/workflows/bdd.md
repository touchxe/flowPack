---
description: Phase 4 - BDD 기반 자기 검증. 테스트를 먼저 작성하고 통과할 때까지 자가 수정한다.
---

# 🧪 Phase 4: BDD 자기 검증 — 테스트가 곧 스펙이다

## 핵심 원칙
> "테스트 없는 코드는 존재하지 않는다."
> "코드를 먼저 짜지 마라. 기대 동작을 먼저 정의하라."

## 테스트 디렉토리 구조
```
tests/
├── features/              ← Gherkin .feature 파일 (행동 시나리오)
│   ├── auth.feature
│   └── ...
├── step-definitions/      ← feature → 코드 연결
├── unit/                  ← 함수/컴포넌트 단위 테스트
├── integration/           ← API/DB 통합 테스트
└── e2e/                   ← 사용자 흐름 E2E 테스트
```

---

## 구현 순서 (절대 위반 금지)

### Step 1: Gherkin 시나리오 작성 (Given/When/Then)
요구사항을 행동 시나리오로 번역하라.

```gherkin
Feature: 사용자 인증
  Scenario: 이메일로 로그인 성공
    Given 등록된 사용자 "test@example.com"이 존재한다
    When 이메일과 올바른 비밀번호로 로그인한다
    Then 로그인에 성공한다
    And 대시보드 페이지로 이동한다

  Scenario: 잘못된 비밀번호로 로그인 실패
    When 잘못된 비밀번호로 로그인한다
    Then "이메일 또는 비밀번호가 올바르지 않습니다" 에러 메시지가 표시된다
```

저장 위치: `tests/features/[feature-name].feature`

### Step 2: 단위 테스트 작성
```typescript
// tests/unit/auth/validate-email.test.ts
import { describe, it, expect } from 'vitest';
import { validateEmail } from '@/utils/validate-email';

describe('validateEmail', () => {
  it('올바른 이메일 형식을 통과시킨다', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });
  it('@ 없는 이메일을 거부한다', () => {
    expect(validateEmail('userexample.com')).toBe(false);
  });
});
```

### Step 3: RED 확인
```bash
npm test -- --run
```
테스트가 실패하는 것이 정상이다. 아직 구현 코드가 없으므로.

### Step 4: 구현 (GREEN)
테스트를 **정확히** 통과하는 최소한의 코드를 작성하라.
과도한 구현 금지 — 테스트가 요구하는 것만 구현하라.

### Step 5: 재검증
```bash
npm test -- --run
```
- GREEN이면 → Step 6으로
- RED이면 → 자가 수정 루프 진입

### Step 6: 리팩토링
코드 중복 제거, 네이밍 개선, 구조 정리.
리팩토링 후 반드시 테스트 재실행하여 GREEN 유지 확인.

---

## 자가 수정 루프 (Self-Healing Loop)

테스트 실패 시 다음 프로세스를 자동 수행하라:
```
테스트 실패 감지
    ↓
[1] 에러 메시지 분석 (어떤 테스트? 에러 타입? 기대값 vs 실제값?)
    ↓
[2] 원인 추론 (최대 3가지)
    ↓
[3] 수정 시도 (원인 A부터)
    ↓
[4] 결과 확인 → GREEN이면 전체 테스트 실행 → 완료
              → RED이면 원인 B로 이동
    ↓
[5] 최대 5회 반복 → 5회 후에도 RED → 사용자에게 보고
```

### 사용자 보고 형식
```markdown
## 🔴 자가 수정 실패 보고

### 실패 테스트: [파일명] - "[테스트명]"

### 시도한 수정 (5회)
1. [원인 A] → [수정 내용] → 결과: RED
2. [원인 B] → [수정 내용] → 결과: RED

### 분석 / 필요한 결정
```

---

## 테스트 커버리지 기준
| 영역 | 최소 커버리지 | 방법 |
|------|-------------|------|
| 비즈니스 로직 | 90% | 단위 테스트 |
| API 엔드포인트 | 100% | 통합 테스트 |
| 사용자 Critical Path | 100% | E2E 테스트 |
| 유틸리티 함수 | 80% | 단위 테스트 |
| UI 컴포넌트 | 70% | 컴포넌트 테스트 |

## 금지 사항
- 테스트 없이 기능 코드를 작성하지 마라.
- 실패하는 테스트를 삭제하거나 `.skip()`하지 마라.
- 테스트를 통과시키기 위해 테스트의 기대값을 수정하지 마라.
- `any` 타입으로 타입 에러를 회피하지 마라.
- 테스트에서 실제 외부 API를 호출하지 마라 (mock/stub 사용).
