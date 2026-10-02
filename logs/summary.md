# 프로젝트 작업 요약

> 이 파일은 매 작업 로그 작성 시 자동으로 갱신됩니다.

## 타임라인
|| 날짜 | Phase | 주요 내용 | 소요 시간 |
||------|-------|----------|----------|
|| 2026-03-31 | Phase 0 | BMAD v6.2.2 설치 + 커스텀 레이어 + 템플릿 활성화 | 약 30분 |
|| 2026-03-31 | Phase 1 | FlowPack 요구사항 정제, PRD + requirements-main.md 작성 | 약 1시간 |
|| 2026-03-31 | Phase 1.5 | Mirra 벤치마킹, 차별화 포인트 도출, 사이트맵 확정 | 약 1시간 |
|| 2026-03-31 | Phase 2 | P0 페이지 9종 + 공통 레이아웃 shadcn 와이어프레임 생성 | 약 1시간 |
|| 2026-03-31 | Phase 2.5 | Cyan Ocean 팔레트 + Pretendard 폰트 디자인 시스템 확정 | 약 30분 |
|| 2026-03-31 | Phase 컴포넌트 | Next.js 프로젝트 셋업 + 공용 컴포넌트 라이브러리 구축 | 약 1시간 |
|| 2026-03-31 | Phase 3 | 아키텍처 확정 — 6종 제약 파일 + Prisma 스키마 11테이블 | 약 1시간 |
|| 2026-03-31 | Phase 4 | BDD 테스트 시나리오 — 5 Epic 65개 Gherkin 시나리오 작성 | 약 1시간 30분 |
|| 2026-07-11 | Phase 5 | WordPress 복수 사이트 연동 DB 유일 제약 정합화 | - |
|| 2026-09-02 | Phase 5 | 대시보드 파란 버튼 흰색 텍스트 및 Starter·Pro 요금 정합화 | 약 30분 |
|| 2026-09-22 | Phase 5 | 외부 API 키 기반 글·사진·AI 생성 REST API 구현 | 약 2시간 |

## 누적 통계
- 총 소요 시간: 7.5h
- 완료 Task: 8개 (PHASE-0 ~ PHASE-4, TASK-EXT-001 포함)
- 잠금된 제약 파일: 7개
- BDD 시나리오: 65개 (Epic 1~5)
- 아키텍처 변경: 1건 (CP-008)
- Evaluator FAIL → 수정: 0건

## 핵심 배운 점 (Top 5)
1. **보라색 회피 = 차별화 전략**: AI 서비스 대부분이 보라/바이올렛을 사용하므로, Cyan Ocean으로 차별화하면 벤치마킹 대비 명확한 포지셔닝 가능
2. **HSL 색상 시스템**: CSS 변수를 HSL로 정의하면 명도/채도 조절이 직관적이고, 다크모드 전환이 용이
3. **계약 우선(Contract-First) 아키텍처**: API 계약과 DB 스키마를 먼저 정의하면 구현 중 일관성 유지가 쉽고 누락이 없음
4. **Prisma 복합 인덱스**: (userId, status), (userId, type) 복합 인덱스 설계를 미리 하면 쿼리 최적화 방향이 명확해짐
5. **금지 패턴 선제 차단**: 구현 전에 anti-patterns.md를 작성하면 코드 리뷰 비용과 리팩토링 횟수가 줄어듦

## 블로그 포스팅 후보 주제
- [ ] **AI 서비스 차별화**: 보라색 그라디언트를 피하고 독창적 디자인 시스템 만드는 법
- [ ] **shadcn + Pretendard**: 한국어 SaaS 프로젝트를 위한 최적 디자인 스택
- [ ] **Contract-First API 설계**: 구현 전 API 계약서 작성이 왜 중요한가
- [ ] **BMAD Method 실전기**: AI 주도 개발 파이프라인으로 FlowPack 만들기
- [ ] **Prisma + PostgreSQL 스키마 설계**: SaaS 크레딧 시스템과 소셜 계정 암호화 패턴
- [ ] **BDD 시나리오 선행 개발**: 테스트 없는 코드는 없다 — Gherkin으로 사용자 플로우 설계하기

## 2026-10-02 전체 변경 Git 통합 검증

- 사용자 요청에 따라 FlowPack 저장소의 전체 미커밋 변경을 작업 브랜치·PR을 통해 main에 통합한다. 환경 변수, 로컬 DB, node_modules, 빌드 및 테스트 산출물은 기존 ignore 규칙대로 제외한다.
- 외부 API 테스트 17/17, NAS 회귀 테스트 253/253, TypeScript 검사, Prisma schema validate, production build 통과. ESLint 오류 0건, 기존 경고 78건. 이번 세션에서 WordPress 실환경 E2E와 운영 migration은 실행하지 않았다.
- 기존 Node 24 지원 커밋 이후 남아 있던 NAS 테스트의 Node 범위 기대값을 package.json의 >=20 <25와 동기화했다.
- 시스템 Node 실행 오류를 번들 Node 24로 우회하고, ENOSPC 발생 후 재생성 가능한 Next.js cache와 실패한 standalone 산출물을 정리하여 빌드를 재검증했다.
- 운영 배포·공개 staging 검증은 기존 gate를 유지한다.
