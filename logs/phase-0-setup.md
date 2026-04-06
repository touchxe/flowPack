# [Phase 0] 작업 로그 — 환경 설정

## 기본 정보
- **날짜**: 2026-03-31
- **Phase**: Phase 0: 환경 설정
- **소요 시간**: 약 30분
- **관련 Task**: PHASE-0

## 이번에 한 일
BMAD Method v6.2.2를 `npx bmad-method install` 명령으로 설치했다. 인터랙티브 CLI가 TTY 환경을 요구해 파이핑이 여러 번 실패했고, 결국 `--directory` 플래그를 명시적으로 지정함으로써 디렉토리 프롬프트를 건너뛰어 설치를 완료했다. 이후 커스텀 레이어(`.cursor/rules/` 14개 .mdc)는 이미 존재했고, `docs/templates/`의 8종 템플릿을 `docs/`에 복사해 제약 파일을 활성화했다. `tasks/contracts/`, `tasks/handoffs/` 디렉토리도 생성해 스프린트 계약·컨텍스트 핸드오프 구조를 준비했다.

## 핵심 결정 사항
| 결정 | 선택지 | 선택 이유 |
|------|--------|---------|
| BMAD 모듈 | BMM vs 다른 모듈 | 가이드 기준 BMM이 Agile AI 개발에 최적 |
| 언어 설정 | English vs Korean | 전 프로젝트 한국어 정책 준수 |
| 출력 폴더 | {output_folder} → _bmad-output | 가이드 파일 구조 표준화 |

## 사용한 도구/기술
- `npx bmad-method install`: `--directory`, `--modules bmm`, `--tools cursor`, `--communication-language Korean`, `--yes` 플래그 조합으로 비대화형 설치
- PowerShell `Copy-Item`: 템플릿 8종 일괄 복사
- PowerShell `Rename-Item`: `{output_folder}` → `_bmad-output` 이름 변경

## 어려웠던 점 / 배운 점
- **문제**: BMAD CLI가 `@clack/prompts` 기반 인터랙티브 UI를 사용해, 파이핑(`echo`, 뉴라인)이 텍스트 입력 필드에 타이핑되는 형태로 작동함
- **해결**: `--directory` 플래그로 첫 번째 텍스트 입력 프롬프트를 건너뛰고, 나머지는 `--yes`로 처리
- **배운 점**: Clack 기반 CLI는 TTY 감지를 하므로, 비대화형 자동화 시 해당 프롬프트에 해당하는 플래그를 반드시 사전에 지정해야 함

## AI와의 협업 노트
- `npx bmad-method install --help`로 사전에 플래그 목록을 확인한 것이 핵심이었음
- PowerShell에서 `ls -la` 등 Unix 명령이 동작하지 않음 → `Get-ChildItem` 사용

## 다음 할 일
- 프로젝트 아이디어 확정 (사용자 결정)
- Phase 1: 인터뷰 에이전트 시작 (`01-interview-agent.mdc` 활성화)

## 설치 완료 항목
- ✅ `_bmad/` — BMAD core + bmm 모듈
- ✅ `.cursor/skills/` — 43개 스킬
- ✅ `.cursor/rules/` — 14개 커스텀 규칙
- ✅ `docs/` — 8종 제약 파일 활성화
- ✅ `_bmad-output/` — 산출물 폴더
- ✅ `tasks/contracts/`, `tasks/handoffs/` — 스프린트 구조
