# AI 주도 서비스 개발 — 최종 통합 가이드 v2

> **목적**: BMAD Method + Anthropic 하네스 패턴 기반의 AI 주도 SaaS/MVP 개발 프레임워크  
> **대상 도구**: Cursor AI (주력)  
> **에이전트**: 12개 (BMAD 6 + 커스텀 6)  
> **작성일**: 2026-03-31  

---

## 목차

1. [전체 파이프라인 개요](#1-전체-파이프라인-개요)
2. [설치 및 환경 구축](#2-설치-및-환경-구축)
3. [에이전트 체계](#3-에이전트-체계)
4. [Phase별 상세 가이드](#4-phase별-상세-가이드)
5. [제약 파일 체계](#5-제약-파일-체계)
6. [하네스 패턴 적용](#6-하네스-패턴-적용)
7. [디자인 시스템 기본값](#7-디자인-시스템-기본값)
8. [작업 로그 시스템](#8-작업-로그-시스템)
9. [파일 구조 전체](#9-파일-구조-전체)
10. [참고 자료](#10-참고-자료)

---

## 1. 전체 파이프라인 개요

### 1.1 핵심 철학

이 프레임워크는 5가지 핵심 문제를 해결합니다:

| 문제 | 해결 방법 | 담당 |
|------|----------|------|
| AI가 모호함을 그럴듯하게 채운다 (GIGO) | 인터뷰 에이전트가 엣지 케이스를 꼬치꼬치 질문 | Phase 1 |
| 텍스트 PRD만으로는 기획-구현 간극 발생 | 와이어프레임 우선 + Vision AI 역설계 | Phase 2 |
| AI가 임의로 기술 스택이나 DB를 변경 | 읽기 전용 제약 파일 + 가상 CTO 상시 감시 | Phase 3 (상시) |
| AI가 자기 작업을 관대하게 칭찬 | Generator-Evaluator 분리 (하네스 패턴) | Phase 5-6 |
| 테스트 없이 코드만 생산 | BDD 테스트 선행 + 자가 수정 루프 | Phase 4 |

### 1.2 파이프라인 흐름

```
[Phase 0]   환경 설정
            └→ BMAD 설치 + 커스텀 레이어 복사

[Phase 1]   인터뷰 에이전트
            └→ 요구사항 정제, 엣지 케이스 발굴
            └→ 산출물: requirements-*.md, prd.md

[Phase 1.5] 벤치마킹 🆕
            └→ 참조 URL 분석, 사이트맵 수립
            └→ 산출물: benchmark-report.md, sitemap.md

[Phase 2]   시각적 합의
            └→ 와이어프레임 (제공 or 자동 생성, shadcn 기반)
            └→ 산출물: wireframes/, ui-spec-*.md

[Phase 2.5] 디자인 방향 🆕
            └→ 색상, 타이포, 레이아웃, 컴포넌트 스타일 확정
            └→ 산출물: design-direction.md

[Phase 3]   가상 CTO
            └→ 아키텍처 확정, 제약 파일 잠금
            └→ 산출물: architecture.md, tech-stack.md, db-schema.md 등

[Phase 4]   BDD 테스트 선행
            └→ Given/When/Then 시나리오 → 테스트 코드 → RED 확인
            └→ 산출물: tests/features/*.feature, tests/**/*.test.ts

[Phase 5]   구현 루프 (하네스 통합) 🆕
            └→ 스프린트 계약 → 구현 → 자가 검증 → 평가
            └→ 컨텍스트 핸드오프 (장시간 작업 시)
            └→ 산출물: 구현 코드, contracts/, handoffs/

[Phase 6]   분리된 평가 🆕
            └→ 디자인 4기준 + 기능 검증 + 보안 + 성능
            └→ PASS/FAIL 판정
            └→ FAIL → Phase 5로 반환 (구체적 피드백)

[Phase 7]   코딩 표준 (상시 적용)

[상시]      작업 로그 (매 Phase 전환 시 기록) 🆕
```

---

## 2. 설치 및 환경 구축

### 2.1 사전 요구사항

- Node.js 20+ (BMAD 설치 필수)
- Cursor AI (Pro 플랜 권장)
- Git

### 2.2 Step-by-Step 설치

#### Step 1: 프로젝트 생성
```bash
mkdir my-saas-project && cd my-saas-project
git init
```

#### Step 2: BMAD Method 설치
```bash
npx bmad-method install
```

설치 프롬프트 응답:
- **설치 위치**: Current directory (현재 디렉토리)
- **모듈 선택**: BMad Method (BMM) ✅
- **AI 도구 선택**: Cursor ✅ (⭐ 표시된 것)

설치 완료 후 확인:
```bash
ls _bmad/          # BMAD 핵심 파일
ls .cursor/skills/ # BMAD 스킬 (bmad-help 등)
```

#### Step 3: 커스텀 레이어 설치
프레임워크 tar.gz를 다운로드한 후:
```bash
# 압축 해제
tar -xzf ai-dev-framework-v2.tar.gz

# 커스텀 Rules 복사 (.cursor/skills/와 공존)
cp ai-dev-framework-v2/.cursor/rules/*.mdc .cursor/rules/

# 문서 템플릿 복사
cp -r ai-dev-framework-v2/docs/ ./docs/
cp -r ai-dev-framework-v2/tasks/ ./tasks/
cp -r ai-dev-framework-v2/logs/ ./logs/
cp -r ai-dev-framework-v2/tests/ ./tests/
```

#### Step 4: 템플릿 활성화
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
cd ..
```

#### Step 5: Context7 MCP 설정 (선택 권장)
Cursor 설정 → MCP에 Context7 추가:
```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    }
  }
}
```
최신 라이브러리 문서를 실시간으로 참조할 수 있습니다.

#### Step 6: 시작
Cursor를 열고 입력:
```
새 SaaS 프로젝트를 시작합니다. 인터뷰 에이전트를 통해 요구사항을 정리해주세요.
```

또는 BMAD 도움말:
```
/bmad-help
```

---

## 3. 에이전트 체계

### 3.1 전체 구성 (12개)

```
BMAD 기본 6개 (자동 설치)        커스텀 6개 (.cursor/rules/)
─────────────────────          ────────────────────────
Analyst (분석가)                가상 CTO (아키텍처 감시)
PM (프로덕트 매니저)             Evaluator (하네스 분리 평가)
Architect (설계자)              벤치마킹 에이전트
Dev (개발자)                    UX 라이터
SM (스크럼 마스터)               보안 감사관
QA (품질 보증)                  성능/DX 엔지니어

상시 적용: 코딩 표준 + 작업 로그
```

### 3.2 BMAD와 커스텀의 역할 분담

| 영역 | BMAD 담당 | 커스텀 보강 |
|------|----------|-----------|
| 기획 | Analyst → 브레인스토밍, 시장조사 | 인터뷰 에이전트 → 엣지 케이스 강화 질문 |
| PRD | PM → PRD, 유저스토리, 수용기준 | BMAD PM 산출물을 소스 오브 트루스로 사용 |
| 아키텍처 | Architect → architecture.md | 가상 CTO → 읽기 전용 잠금 + 위반 감시 |
| 와이어프레임 | ❌ 없음 | 시각적 합의 → shadcn 기반 자동 생성 |
| 벤치마킹 | ❌ 없음 | URL 조사 + 사이트맵 + 채택 결정 |
| 디자인 방향 | ❌ 없음 | 색상/타이포/레이아웃 사전 확정 |
| 개발 | Dev → 스토리 기반 구현 | 스프린트 계약 + 제약 감시 레이어 |
| QA | QA → 테스트 전략 | Evaluator → 분리 평가 + 디자인 4기준 |
| UI 텍스트 | ❌ 없음 | UX 라이터 → 하드코딩 방지 |
| 보안 | ❌ 없음 | 보안 감사관 → OWASP 체크리스트 |
| 성능 | ❌ 없음 | 성능/DX → 번들 감시 |

### 3.3 각 에이전트 상세

#### 가상 CTO (03-architecture-guard.mdc)
- **역할**: 모든 코드 작성 시 제약 파일 위반을 실시간 감시
- **감시 대상**: tech-stack.md, api-contract.md, db-schema.md, architecture.md, design-defaults.md, anti-patterns.md
- **위반 시**: 즉시 코드 작성 중단 → 대안 제시 또는 변경 제안서 작성
- **변경 프로세스**: 변경 제안서(docs/change-proposals/) → 사용자 승인 → 제약 파일 업데이트

#### Evaluator — 하네스 분리 평가자 (07-evaluator-agent.mdc)
- **역할**: Generator(구현 에이전트)와 분리된 독립 평가
- **원칙**: "자기 작업을 칭찬하지 마라" (Anthropic 하네스 논문)
- **프론트엔드 4기준**: 디자인 품질(30%) / 독창성(30%) / 완성도(20%) / 기능성(20%)
- **AI 슬롭 감지**: 보라색 그라데이션, shadcn 무수정 기본 테마, 그라데이션 히어로 등
- **FAIL 시**: 구체적 피드백과 함께 구현으로 반환 (최대 3회)

#### UX 라이터 (11-ux-writer.mdc)
- **역할**: 모든 UI 텍스트(버튼, 에러, 빈 상태 등)의 사전 정의 및 일관성 관리
- **문제 해결**: AI가 "Submit", "Error occurred" 같은 영어 기본값으로 채우는 것 방지
- **산출물**: docs/ux-copy.md — 화면별 키-텍스트 매핑 테이블
- **톤**: 존댓말, 간결, 사용자 언어, 긍정적 표현 우선

#### 보안 감사관 (12-security-auditor.mdc)
- **역할**: 입력 검증(Zod), 인증/인가, XSS 방지, 환경변수 관리
- **근거**: AI 생성 코드 보안 취약점 비율 9.8~42.1% (학술 연구)
- **적용**: 매 Task 완료 시 보안 체크리스트 실행

#### 성능/DX 엔지니어 (13-performance-dx.mdc)
- **역할**: 번들 사이즈 감시, 리렌더링 탐지, N+1 쿼리 감지, 코드 가독성
- **기준선**: LCP < 2.5초, FID < 100ms, JS 번들 < 200KB (gzip)
- **적용**: 매 Epic 완료 시 성능 점검

---

## 4. Phase별 상세 가이드

### Phase 0: 환경 설정

**소요 시간**: 약 30분~1시간

**체크리스트**:
- [ ] BMAD 설치 (`npx bmad-method install`)
- [ ] 커스텀 레이어 복사 (14개 .mdc + 템플릿)
- [ ] 제약 파일 템플릿 활성화 (8개 .md)
- [ ] Context7 MCP 연결 (선택)
- [ ] BDD 프레임워크 설치 (프로젝트 초기화 후)
- [ ] 작업 로그 기록: `logs/phase-0-setup.md`

---

### Phase 1: 인터뷰 에이전트

**소요 시간**: 약 1~3시간

**프로세스**: BMAD Analyst를 활용하되, 01-interview-agent.mdc의 4라운드 질문으로 강화

| 라운드 | 질문 영역 | 핵심 질문 |
|--------|----------|----------|
| 1 | 핵심 파악 | 문제 정의, 대상 사용자, 핵심 가치 |
| 2 | 범위 확정 | MVP 포함/제외, 성공 지표 |
| 3 | 엣지 케이스 | 실패 시나리오, 동시성, 데이터 경계 |
| 4 | 제약 조건 | 성능, 보안, 외부 연동 |

**산출물**:
- `_bmad-output/prd.md` (BMAD PM이 생성) 또는 `docs/prd.md` (커스텀 템플릿)
- `docs/requirements-[feature].md`

**완료 조건**:
- 문제 정의 완료, MVP 범위 확정, 엣지 케이스 3개+, 성공 지표 1개+
- 작업 로그: `logs/phase-1-interview.md`

---

### Phase 1.5: 벤치마킹 🆕

**소요 시간**: 약 1~2시간

**프로세스**:
1. 사용자에게 참조 URL 수집 (최대 5개)
2. 각 URL 분석: 사이트맵, 기능, UX 패턴, 디자인 언어, 기술 단서
3. 벤치마킹 보고서 작성 → 채택/불채택 결정
4. 우리 서비스 사이트맵 초안 도출 → 사용자 확정

**산출물**:
- `docs/benchmarking/benchmark-report.md`
- `docs/sitemap.md`
- 작업 로그: `logs/phase-1.5-benchmarking.md`

---

### Phase 2: 시각적 합의

**소요 시간**: 약 2~4시간

**경로 분기**:
- **와이어프레임 제공 시**: Vision AI 분석 → shadcn 매핑 → UI 스펙
- **미제공 시**: 요구사항 + 사이트맵 기반 → shadcn 컴포넌트명 포함 ASCII 와이어프레임 자동 생성 → 사용자 확인

**와이어프레임 표기법** (shadcn + Lucide):
```
┌─[Card]───────┐
│ [Badge: 완료] │
│ 제목 텍스트   │
│ [icon:Clock]  │
│ [Button: 상세]│
└───────────────┘
```

**UI 제안**: 와이어프레임에 없지만 필요한 요소를 `[🆕 UI 제안]`으로 표시. 사용자 승인 후 반영.

**산출물**:
- `docs/wireframes/auto-[screen].md` 또는 제공 이미지
- `docs/ui-spec-[screen].md`
- 작업 로그: `logs/phase-2-wireframe.md`

---

### Phase 2.5: 디자인 방향 🆕

**소요 시간**: 약 1~2시간

**프로세스**:
1. 무드 키워드 3~5개 + 안티 키워드 선정
2. 색상 팔레트 정의 (HSL, shadcn 테마 변수 연동)
3. 타이포그래피 선정 (Google Fonts 또는 시스템 폰트)
4. 레이아웃 원칙 정의
5. shadcn 기본 테마 커스터마이징 방향

**산출물**:
- `docs/design-direction.md` (승인 후 가상 CTO 감시 대상에 추가)
- 작업 로그: `logs/phase-2.5-design-direction.md`

**핵심**: shadcn 기본 테마를 무수정으로 사용하면 Evaluator의 "독창성" 기준에서 FAIL 판정.

---

### Phase 3: 가상 CTO — 아키텍처 확정

**소요 시간**: 약 2~3시간

**프로세스**:
1. BMAD Architect 에이전트 활용 → architecture.md 생성
2. 기술 스택 확정 → tech-stack.md (읽기 전용 잠금)
3. API 계약 정의 → api-contract.md
4. DB 스키마 설계 → db-schema.md
5. 금지 패턴 정의 → anti-patterns.md
6. 모든 제약 파일을 "읽기 전용"으로 선언

**제약 파일 변경 프로세스**:
```
변경 필요 발견 → 변경 제안서 작성 (docs/change-proposals/)
    → 사용자 검토 → 승인 → 제약 파일 업데이트
                   → 거부 → 기존 제약 내 대안 구현
```

**산출물**:
- 제약 파일 6종 확정
- 작업 로그: `logs/phase-3-architecture.md`

---

### Phase 4: BDD 테스트 선행

**소요 시간**: 기능 규모에 따라 가변

**프로세스**:
1. 유저 스토리 → Given/When/Then 시나리오 변환
2. `.feature` 파일 또는 `.test.ts` 작성
3. 테스트 실행 → RED(실패) 확인
4. (Phase 5에서 구현 후 GREEN 확인)

**자가 수정 루프**:
```
테스트 실패 → 에러 분석 → 원인 3가지 추론 → 수정 시도
    → GREEN? → 전체 테스트 → 완료
    → RED? → 다음 원인 시도 (최대 5회)
    → 5회 후 RED → 사용자에게 보고
```

**산출물**:
- `tests/features/*.feature`
- `tests/**/*.test.ts`
- 작업 로그: `logs/phase-4-bdd.md`

---

### Phase 5: 구현 루프 (하네스 통합)

**소요 시간**: 프로젝트 규모에 따라 가변 (MVP 기준 수일~수주)

**Task 실행 사이클**:
```
[1] 계획 → 다음 Task 선택 (P0→P1→P2, 의존성 확인)
[1.5] 스프린트 계약 → Generator 제안 → Evaluator 검토 → 합의
[2] 테스트 작성 → RED 확인
[3] 구현 → BMAD Dev + 제약 파일 준수
[4] 검증 → GREEN 확인 + 전체 테스트
[5] 평가 → Evaluator 판정 (PASS/FAIL)
[6] 상태 업데이트 → workflow_state.md + 작업 로그
    → 다음 Task
```

**스프린트 계약** (tasks/contracts/TASK-XXX-contract.md):
각 Task 시작 전에 "무엇을 만들고, 어떻게 검증할 것인가"를 Generator와 Evaluator가 합의.

**컨텍스트 핸드오프** (tasks/handoffs/handoff-XXX.md):
5 Task 이상 연속 작업 시, 현재 상태를 구조화된 문서로 저장하고 새 세션에서 이어감.

**산출물**:
- 구현 코드 (src/)
- `tasks/contracts/TASK-XXX-contract.md`
- `tasks/handoffs/handoff-XXX.md` (필요 시)
- 작업 로그: `logs/phase-5-implementation/sprint-XXX.md`

---

### Phase 6: 분리된 평가

**프론트엔드 4기준** (Anthropic 하네스 기반):

| 기준 | 가중치 | 핵심 질문 | 최소 점수 |
|------|--------|----------|----------|
| 디자인 품질 | 30% | 전체가 일관된 무드를 형성하는가? | 70 |
| 독창성 | 30% | AI 슬롭 징후 없이 의도적 결정이 보이는가? | 70 |
| 완성도 | 20% | 타이포 위계, 간격, 반응형이 정확한가? | 70 |
| 기능성 | 20% | 주요 액션을 찾고 수행할 수 있는가? | 70 |

**백엔드 기준**: 스프린트 계약 충족도, 엣지 케이스, 보안, 회귀 버그

**판정**: 모든 기준 70점 이상 → PASS / 하나라도 미달 → FAIL + 구체적 피드백

**산출물**: `logs/phase-6-evaluation/eval-XXX.md`

---

## 5. 제약 파일 체계

### 읽기 전용 (가상 CTO 감시)

| 파일 | 내용 | 위반 시 |
|------|------|---------|
| `docs/tech-stack.md` | 허용 기술 + 금지 기술 | 즉시 중단, 대안 제시 |
| `docs/architecture.md` | 폴더 구조, 데이터 흐름 | 구조 변경 금지 |
| `docs/api-contract.md` | API 엔드포인트 계약 | 미정의 API 생성 금지 |
| `docs/db-schema.md` | 테이블/컬럼 정의 | 미정의 스키마 접근 금지 |
| `docs/design-defaults.md` | Tailwind+shadcn+Lucide 규칙 | shadcn 외 사용 금지 |
| `docs/design-direction.md` | 색상/타이포/레이아웃 | 방향 이탈 금지 |
| `docs/anti-patterns.md` | 금지 코드 패턴 | 패턴 사용 금지 |

### 참조용 (구현 시 활용)

| 파일 | 내용 |
|------|------|
| `docs/ux-copy.md` | UI 텍스트 사전 (하드코딩 방지) |
| `docs/sitemap.md` | 페이지 구조 및 우선순위 |
| `docs/benchmarking/benchmark-report.md` | 벤치마킹 결과 |

---

## 6. 하네스 패턴 적용

### 6.1 Anthropic 하네스 논문 핵심 (2026-03-24)

Anthropic 엔지니어링 팀이 발표한 "Harness design for long-running application development"의 핵심 발견 3가지를 적용했습니다:

**1) 자기 평가의 한계**
AI에게 자기 작업을 평가시키면 관대하게 칭찬합니다. "분리된 평가자"가 회의적 관점에서 평가하도록 설계하는 것이 핵심입니다.
→ **적용**: 07-evaluator-agent.mdc (Phase 6)

**2) 컨텍스트 불안 (Context Anxiety)**
컨텍스트 윈도우가 차면 AI가 조급하게 작업을 마무리하려 합니다. 컨텍스트 리셋(새 세션 + 구조화된 핸드오프)이 해결책입니다.
→ **적용**: tasks/handoffs/ (Phase 5)

**3) 스프린트 계약**
Generator와 Evaluator가 각 작업 시작 전에 "완료 기준"을 협상하면 스펙-구현 간 괴리가 줄어듭니다.
→ **적용**: tasks/contracts/ (Phase 5)

### 6.2 3-에이전트 구조

| 역할 | 하네스 원본 | 우리 프레임워크 매핑 |
|------|-----------|-------------------|
| Planner | 1~4문장 → 풀 스펙 확장 | BMAD Analyst + PM + 인터뷰 에이전트 |
| Generator | 스프린트 단위 구현 | BMAD Dev + 05-prd-todo-loop |
| Evaluator | Playwright로 실제 앱 테스트 + 채점 | 07-evaluator-agent + BMAD QA |

---

## 7. 디자인 시스템 기본값

### 7.1 기본 스택 (전 페이지/요소 적용)

| 항목 | 기술 | 비고 |
|------|------|------|
| CSS | Tailwind CSS 4.x | 유일한 스타일링 방법 |
| 컴포넌트 | shadcn/ui | 최우선 사용 |
| 아이콘 | Lucide React | 유일한 아이콘 소스 |

### 7.2 컴포넌트 의사결정 트리

```
1️⃣ shadcn/ui에 있는가? → YES → 사용 (커스텀 금지)
2️⃣ shadcn 조합으로 가능? → YES → components/ui/에 배치
3️⃣ Tailwind만으로 가능? → YES → utility class
4️⃣ 커스텀 필요 → components/[feature]/, Tailwind 필수
```

### 7.3 미니멀 원칙

1. **여백으로 말하라**: 빽빽한 레이아웃 금지
2. **색상 절제**: Primary 1개 + Neutral. 강조색 3개 이상 금지
3. **타이포 위계**: 최대 3단계 (h1/h2/body)
4. **장식 최소화**: 불필요한 그라데이션, 그림자 금지
5. **shadcn 기본 존중**: 과도한 커스텀 지양, 테마 변수로 조정

### 7.4 금지 사항

| 금지 | 대안 |
|------|------|
| CSS Modules, styled-components | Tailwind utility |
| Heroicons, FontAwesome 등 | Lucide React |
| 커스텀 모달 | shadcn Dialog |
| 커스텀 드롭다운 | shadcn Select / DropdownMenu |
| 커스텀 토스트 | shadcn Toast (sonner) |
| 인라인 style={{ }} | Tailwind className |

---

## 8. 작업 로그 시스템

### 8.1 목적
- 매 Phase 전환 시 블로그 포스팅용 원재료 자동 축적
- 프로젝트 히스토리 추적
- 회고 및 학습 기록

### 8.2 기록 트리거
1. Phase 전환 시 (필수)
2. Task 완료 시
3. Evaluator 피드백 수신 시
4. 아키텍처 변경 승인 시
5. 예상치 못한 문제 해결 시

### 8.3 로그 엔트리 구조

각 로그에는 다음 섹션이 포함됩니다:
- **기본 정보**: 날짜, Phase, 소요 시간, 관련 Task
- **이번에 한 일**: 3~5문장 구체적 서술
- **핵심 결정**: 결정 내용 + 선택지 비교 + 사유
- **사용한 도구/기술**: 구체적 사용법
- **어려웠던 점 / 배운 점**: 문제 → 해결 (블로그 핵심 재료)
- **AI와의 협업 노트**: 잘된 프롬프트, 실패한 시도
- **다음 할 일**: 다음 세션 연결

### 8.4 블로그 변환

| 로그 섹션 | 블로그 활용 |
|----------|-----------|
| 이번에 한 일 | 본문 |
| 핵심 결정 | 기술 인사이트 섹션 |
| 어려웠던 점 | 문제 해결 스토리 |
| AI 협업 노트 | AI 활용 팁 |
| 스크린샷 | 비주얼 자료 |

---

## 9. 파일 구조 전체

```
project-root/
│
├── _bmad/                          ← BMAD 핵심 (자동 설치, 터치 금지)
│   ├── core/
│   ├── bmm/
│   └── _config/
│
├── _bmad-output/                   ← BMAD 산출물 (자동 생성)
│   ├── prd.md
│   ├── architecture.md
│   └── stories/
│
├── .cursor/
│   ├── skills/                     ← BMAD 스킬 (자동 설치)
│   │   ├── bmad-help/SKILL.md
│   │   ├── bmad-agent-bmm-pm/SKILL.md
│   │   └── ...
│   └── rules/                      ← 커스텀 규칙 (14개)
│       ├── 00-master-orchestrator.mdc
│       ├── 01-interview-agent.mdc
│       ├── 02-visual-consensus.mdc
│       ├── 03-architecture-guard.mdc
│       ├── 04-bdd-verification.mdc
│       ├── 05-prd-todo-loop.mdc
│       ├── 06-coding-standards.mdc
│       ├── 07-evaluator-agent.mdc      ← 하네스
│       ├── 08-benchmarking.mdc         ← 벤치마킹
│       ├── 09-design-direction.mdc     ← 디자인 방향
│       ├── 10-work-log.mdc            ← 작업 로그
│       ├── 11-ux-writer.mdc           ← UX 라이터
│       ├── 12-security-auditor.mdc    ← 보안
│       └── 13-performance-dx.mdc      ← 성능
│
├── docs/
│   ├── templates/                  ← 템플릿 원본 (8종)
│   │   ├── tech-stack.template.md
│   │   ├── architecture.template.md
│   │   ├── api-contract.template.md
│   │   ├── db-schema.template.md
│   │   ├── anti-patterns.template.md
│   │   ├── design-defaults.template.md
│   │   ├── ux-copy.template.md
│   │   └── prd.template.md
│   ├── benchmarking/               ← 벤치마킹 결과
│   │   └── benchmark-report.md
│   ├── wireframes/                 ← 와이어프레임
│   ├── change-proposals/           ← 아키텍처 변경 제안
│   │
│   ├── tech-stack.md               ← 제약 파일 (읽기 전용)
│   ├── architecture.md
│   ├── api-contract.md
│   ├── db-schema.md
│   ├── design-defaults.md
│   ├── design-direction.md
│   ├── anti-patterns.md
│   ├── ux-copy.md                  ← UI 텍스트 사전
│   ├── sitemap.md                  ← 사이트맵
│   └── prd.md                      ← PRD
│
├── tasks/
│   ├── workflow_state.md           ← 진행 상태
│   ├── contracts/                  ← 스프린트 계약
│   │   └── TASK-XXX-contract.md
│   ├── handoffs/                   ← 컨텍스트 핸드오프
│   │   └── handoff-XXX.md
│   └── epic-*.md                   ← Epic별 Task
│
├── logs/                           ← 작업 로그 (블로그용)
│   ├── phase-0-setup.md
│   ├── phase-1-interview.md
│   ├── phase-1.5-benchmarking.md
│   ├── phase-2-wireframe.md
│   ├── phase-2.5-design-direction.md
│   ├── phase-3-architecture.md
│   ├── phase-4-bdd.md
│   ├── phase-5-implementation/
│   │   └── sprint-XXX.md
│   ├── phase-6-evaluation/
│   │   └── eval-XXX.md
│   └── summary.md                  ← 전체 요약 (자동 갱신)
│
├── tests/
│   ├── features/                   ← Gherkin .feature
│   ├── step-definitions/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── src/                            ← 소스 코드 (Phase 5에서 생성)
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── lib/
│   ├── server/
│   ├── stores/
│   └── types/
│
└── public/                         ← 정적 자산
```

---

## 10. 참고 자료

### 핵심 방법론

| 자료 | 출처 | 역할 |
|------|------|------|
| BMAD Method | github.com/bmad-code-org/BMAD-METHOD | 에이전트 프레임워크 기반 |
| BMAD 공식 문서 | docs.bmad-method.org | 설치, 워크플로우 가이드 |
| Harness Design (Anthropic) | anthropic.com/engineering/harness-design-long-running-apps | Generator-Evaluator 분리 패턴 |
| Effective Harnesses (Anthropic) | anthropic.com/engineering/effective-harnesses-for-long-running-agents | 컨텍스트 리셋, 태스크 분해 |
| Context Engineering (Anthropic) | anthropic.com/engineering/effective-context-engineering-for-ai-agents | 컨텍스트 윈도우 관리 |

### 개발 도구

| 도구 | 용도 |
|------|------|
| Cursor AI | 코딩 IDE (Plan Mode + Agent Mode) |
| Claude Opus/Sonnet | 기획 추론 + 코드 생성 |
| BMAD /bmad-help | 다음 할 일 안내 |
| Context7 MCP | 최신 라이브러리 문서 |
| Visily / Figma AI | 와이어프레임 (외부 생성 시) |
| shadcn/ui | UI 컴포넌트 |
| Lucide React | 아이콘 |
| Vitest + Playwright | 테스트 |

### 추가 참고

| 자료 | 출처 |
|------|------|
| Spec-Driven Development (Thoughtworks) | thoughtworks.com |
| TDD & BDD in the Age of AI | natshah.com |
| ATDD-Driven AI Development | paulmduvall.com |
| Kiro IDE (AWS) | kiro.dev |
| GitHub Spec Kit | github.com |
| PRD→Plan→Todo Workflow | developertoolkit.ai |

---

> **이 문서는 AI 주도 서비스 개발 프레임워크 v2의 Single Source of Truth입니다.**
> 프로젝트 아이디어가 정해지면, Phase 0부터 순서대로 진행하세요.
