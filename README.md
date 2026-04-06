# 🚀 AI 주도 서비스 개발 프레임워크 v2

> BMAD Method 기반 + Anthropic 하네스 패턴 + 커스텀 에이전트 12개

---

## 개요

AI가 **모호함을 채우지 않고, 체계적으로 질문하고, 제약을 지키며, 테스트를 먼저 작성하고, 분리된 평가자가 검증하는** Cursor AI 개발 프레임워크입니다.

BMAD Method의 검증된 에이전트 시스템 위에, Anthropic 하네스 논문의 Generator-Evaluator 분리 패턴과 벤치마킹/디자인 방향/작업 로그 시스템을 추가했습니다.

## 파이프라인

```
[Phase 0]   BMAD 설치 + /bmad-help
[Phase 1]   인터뷰 에이전트 — GIGO 차단, 엣지 케이스 발굴
[Phase 1.5] 벤치마킹 — URL 조사, 사이트맵 수립 🆕
[Phase 2]   시각적 합의 — shadcn 기반 와이어프레임 자동 생성
[Phase 2.5] 디자인 방향 — 색상/타이포/레이아웃 확정 🆕
[Phase 3]   가상 CTO — 아키텍처 제약 잠금
[Phase 4]   BDD 테스트 선행 — RED→GREEN→REFACTOR
[Phase 5]   구현 루프 — 스프린트 계약 + 컨텍스트 핸드오프 🆕
[Phase 6]   분리된 평가자 — 디자인 4기준 + 기능 검증 🆕
[Phase 7]   코딩 표준 (상시)
        + 작업 로그 (전 Phase, 블로그용) 🆕
```

## 에이전트 12개

| 출처 | 에이전트 | 역할 |
|------|---------|------|
| BMAD | Analyst | 브레인스토밍, 요구사항 |
| BMAD | PM | PRD, 유저스토리 |
| BMAD | Architect | 아키텍처 설계 |
| BMAD | Dev | 스토리 기반 구현 |
| BMAD | SM | 워크플로우 관리 |
| BMAD | QA | 테스트, 품질 게이트 |
| 커스텀 | 가상 CTO | 아키텍처 감시 |
| 커스텀 | Evaluator | 분리된 품질 평가 (하네스) |
| 커스텀 | 벤치마킹 | 참조 사이트 분석 |
| 커스텀 | UX 라이터 | UI 텍스트 일관성 |
| 커스텀 | 보안 감사관 | 보안 취약점 감시 |
| 커스텀 | 성능/DX | 번들/성능 모니터링 |

---

## 설치 방법

### Step 1: 프로젝트 폴더 생성
```bash
mkdir my-saas-project && cd my-saas-project
```

### Step 2: BMAD Method 설치
```bash
npx bmad-method install
```
설치 중 선택:
- 설치 위치: **현재 디렉토리**
- 모듈: **BMad Method (BMM)** 선택
- AI 도구: **Cursor** 선택

### Step 3: 커스텀 레이어 복사
이 프레임워크의 파일들을 프로젝트에 복사:
```bash
# 커스텀 Cursor Rules 복사
cp -r [framework]/.cursor/rules/*.mdc .cursor/rules/

# 제약 파일 템플릿 복사
cp -r [framework]/docs/ ./docs/

# 작업 관리 복사
cp -r [framework]/tasks/ ./tasks/

# 작업 로그 디렉토리 복사
cp -r [framework]/logs/ ./logs/

# 테스트 구조 복사
cp -r [framework]/tests/ ./tests/
```

### Step 4: 템플릿 활성화
```bash
cd docs/
cp templates/tech-stack.template.md tech-stack.md
cp templates/architecture.template.md architecture.md
cp templates/api-contract.template.md api-contract.md
cp templates/db-schema.template.md db-schema.md
cp templates/anti-patterns.template.md anti-patterns.md
cp templates/design-defaults.template.md design-defaults.md
cp templates/ux-copy.template.md ux-copy.md
cp templates/prd.template.md prd.md
```

### Step 5: Cursor에서 시작
```
"새 SaaS 프로젝트를 시작합니다. 인터뷰 에이전트를 통해 요구사항을 정리해주세요."
```

또는 BMAD 도움말:
```
/bmad-help
```

---

## 파일 구조

```
project-root/
├── _bmad/                          ← BMAD 기본 (자동 설치)
├── _bmad-output/                   ← BMAD 산출물
├── .cursor/
│   ├── skills/                     ← BMAD 스킬 (자동 설치)
│   └── rules/                      ← 커스텀 규칙 (13개)
│       ├── 00-master-orchestrator.mdc
│       ├── 01-interview-agent.mdc
│       ├── 02-visual-consensus.mdc
│       ├── 03-architecture-guard.mdc
│       ├── 04-bdd-verification.mdc
│       ├── 05-prd-todo-loop.mdc
│       ├── 06-coding-standards.mdc
│       ├── 07-evaluator-agent.mdc     🆕 하네스
│       ├── 08-benchmarking.mdc        🆕
│       ├── 09-design-direction.mdc    🆕
│       ├── 10-work-log.mdc           🆕
│       ├── 11-ux-writer.mdc          🆕
│       ├── 12-security-auditor.mdc   🆕
│       └── 13-performance-dx.mdc     🆕
├── docs/
│   ├── templates/                  ← 템플릿 원본 (8종)
│   ├── benchmarking/               🆕
│   ├── wireframes/
│   └── change-proposals/
├── tasks/
│   ├── workflow_state.md
│   ├── contracts/                  🆕 스프린트 계약
│   └── handoffs/                   🆕 컨텍스트 핸드오프
├── logs/                           🆕 작업 로그
│   └── summary.md
└── tests/
```

## UI 기본값

모든 UI는 **Tailwind + shadcn/ui + Lucide React** 미니멀 구성:
- shadcn 컴포넌트 우선 사용 (커스텀보다 항상 먼저)
- Lucide React만 아이콘 소스 (다른 라이브러리 금지)
- 여백으로 말하는 미니멀 레이아웃
- 와이어프레임 단계부터 shadcn 컴포넌트명 직접 명시

## 기반 방법론

| 방법론 | 출처 | 적용 부분 |
|--------|------|----------|
| BMAD Method | github.com/bmad-code-org/BMAD-METHOD | 에이전트 체계, 워크플로우 |
| Harness Design | anthropic.com/engineering | Generator-Evaluator 분리, 스프린트 계약 |
| Spec-Driven Dev | Kiro/GitHub Spec Kit | 스펙 우선, 실행 가능한 검증 |
| BDD/ATDD | 업계 표준 | 테스트 선행, Given/When/Then |
# flowPack
# flowPack
