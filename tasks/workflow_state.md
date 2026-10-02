# 🔄 Workflow State

> 이 파일은 AI 에이전트가 자동으로 업데이트합니다.
> 현재 프로젝트의 진행 상태를 추적하는 Single Source of Truth입니다.

---

## 프로젝트 정보
- **프로젝트명**: FlowPack (홍보 콘텐츠 제작 및 배포 플랫폼)
- **시작일**: 2026-03-31
- **현재 Phase**: Phase 5 완료 → Sprint 001 계약 대기

## 파이프라인 진행 상태

| Phase | 단계 | 상태 | 완료일 |
|-------|------|------|--------|
| 0 | 환경 설정 (BMAD + 커스텀 레이어) | ✅ 완료 | 2026-03-31 |
| 1 | 인터뷰 에이전트 (요구사항 정제) | ✅ 완료 | 2026-03-31 |
| 1.5 | 벤치마킹 | ✅ 완료 | 2026-03-31 |
| 2 | 시각적 합의 (와이어프레임) | ✅ 완료 | 2026-03-31 |
| 2.5 | 디자인 방향 확정 | ✅ 완료 | 2026-03-31 |
| 3 | 가상 CTO (아키텍처 확정) | ✅ 완료 | 2026-03-31 |
| 4 | BDD 테스트 선행 작성 | ✅ 완료 | 2026-03-31 |
| 5 | PRD+Todo 루프 (Story 파일 + Sprint 계약) | ✅ 완료 | 2026-03-31 |
| 6 | 최종 검증 | ⏳ 대기 | - |

## 현재 진행
- **현재 Task**: TASK-WP-001 WordPress → FlowPack 커넥터
- **Task 상태**: ✅ Docker 없는 로컬 전체 E2E 완료 (유효한 배포 PostgreSQL·공개 DNS/TLS·AI 크레딧 staging gate 대기)
- **마지막 업데이트**: 2026-09-22

## 완료 이력
| Task ID | 제목 | 완료일 | 테스트 결과 |
|---------|------|--------|------------|
| PHASE-0 | 환경 설정 (BMAD + 커스텀 레이어 + 템플릿 활성화) | 2026-03-31 | N/A |
| PHASE-1 | 인터뷰 에이전트 (FlowPack 요구사항 정제, PRD 작성) | 2026-03-31 | N/A |
| PHASE-1.5 | 벤치마킹 (Mirra 분석, 사이트맵 확정) | 2026-03-31 | N/A |
| PHASE-2 | 시각적 합의 (P0 페이지 9종 와이어프레임 생성) | 2026-03-31 | N/A |
| PHASE-2.5 | 디자인 방향 (Cyan Ocean 팔레트 + Pretendard 확정) | 2026-03-31 | N/A |
| PHASE-3 | 아키텍처 확정 (6종 제약 파일 + Prisma 스키마) | 2026-03-31 | N/A |
| PHASE-4 | BDD 테스트 선행 작성 (5 Epic 65개 시나리오) | 2026-03-31 | N/A |
| PHASE-5 | Story 파일 생성 (26개) + Sprint 001 계약 | 2026-03-31 | N/A |
| TASK-EXT-001 | 외부 API 키 기반 글·사진·AI 생성 REST API | 2026-09-22 | 단위 6건, NAS 250건, typecheck/lint/build 통과 |
| TASK-WP-001 | 공개 API·비동기 worker·WordPress 글·사진 플러그인 | 2026-09-22 | API·worker 17건, NAS 253건, 플러그인 10건, 실제 HTTPS FlowPack→worker→Local WP draft/pending·사진 E2E 2회, typecheck/lint/build 통과 |

## 잠금된 제약 파일 (읽기 전용)
| 파일 | 내용 |
|------|------|
| `docs/tech-stack.md` | 허용 기술 스택 + 금지 목록 |
| `docs/architecture.md` | 폴더 구조 + 데이터 흐름 |
| `docs/db-schema.md` | Prisma 스키마 11개 테이블 |
| `docs/api-contract.md` | 8개 도메인 API 계약 |
| `docs/anti-patterns.md` | 27개 금지 패턴 |
| `docs/design-defaults.md` | 컴포넌트 사용 기준 |
| `docs/design-direction.md` | Cyan Ocean 팔레트 + Pretendard |

## 차단된 항목
없음 — Sprint 001 진입 준비 완료

## BDD 문서 (Phase 4 산출물)
| 파일 | Epic | 시나리오 수 |
|------|------|------------|
| `docs/bdd/Epic1-auth.md` | Epic 1: 인증 | 15개 |
| `docs/bdd/Epic2-content-generation.md` | Epic 2: 콘텐츠 생성 | 14개 |
| `docs/bdd/Epic3-publishing.md` | Epic 3: 배포 | 13개 |
| `docs/bdd/Epic4-analytics-calendar.md` | Epic 4: 통계 & 관리 | 10개 |
| `docs/bdd/Epic5-billing.md` | Epic 5: 결제 | 13개 |
| **총계** | | **65개** |

## Story 파일 (Phase 5 산출물)
| Epic | Stories | Points |
|------|---------|--------|
| Epic 1: 인증 | 4개 | 15 |
| Epic 2: 콘텐츠 생성 | 7개 | 27 |
| Epic 3: 배포 | 5개 | 22 |
| Epic 4: 통계 & 관리 | 4개 | 13 |
| Epic 5: 결제 | 6개 | 17 |
| **총계** | **26개** | **94** |

## Sprint 현황
| Sprint | Stories | Points | 상태 |
|--------|---------|--------|------|
| Sprint 001 | US-001, US-002 | 10 | ⏳ 계약 대기 |
| Sprint 002 | US-003, US-004 | 5 | 📋 계획 |
| Sprint 003 | US-010, US-014 | 13 | 📋 계획 |
| Sprint 004 | US-011, US-015 | 10 | 📋 계획 |
| Sprint 005 | US-012, US-013 | 6 | 📋 계획 |
| Sprint 006+ | 나머지 | 50 | 📋 계획 |

## 변경 로그
| 날짜 | 변경 내용 | 사유 |
|------|----------|------|
| 2026-03-31 | 워크플로우 초기화 | 프레임워크 설정 |
| 2026-03-31 | Phase 0~1.5 완료 | 요구사항, 벤치마킹 |
| 2026-03-31 | Phase 2, 2.5 완료 | 와이어프레임, 디자인 방향 |
| 2026-03-31 | Phase 3 완료 | 6종 제약 파일 잠금 완료 |
| 2026-03-31 | Phase 4 완료 | BDD 5 Epic 65개 시나리오 작성 |
| 2026-03-31 | Phase 5 완료 | Story 26개 생성 + Sprint 001 계약서 |
| 2026-07-11 | 도입 사례 페이지 카드 UI 개선 | 성과 중심 Featured 카드, 상세 다이얼로그, 업종 필터 접근성 개선 |
| 2026-07-13 | Starter·Pro 요금 10배 조정 | 월간·연간 결제 금액, 요금 안내, 관리자 MRR 집계 기준 동기화 |
| 2026-08-28 | 라이트 테마 전역 고정 | 도메인·브라우저별 로컬 테마와 색상 오버라이드로 인한 화면 색상 불일치 방지 |
| 2026-08-28 | Sky Mint 컬러 토큰 적용 | 지정 블루·민트 팔레트 기반으로 라이트 화면의 텍스트 대비와 행동 색상 보정 |
| 2026-08-31 | 이메일·아이디 로그인 추가 | 기존 이메일 로그인 유지, 선택 아이디 등록과 Credentials 인증 확장 |
| 2026-09-02 | 장문 초안 생성 운영 DB 스키마 불일치 복구 | 누락된 username·notifications 스키마용 무손실 마이그레이션과 호환 쿼리 추가 |
| 2026-09-02 | 장문 생성·작성 지침 오류 진단 강화 | 작성 지침 선택기 상태 복구, 단계별 생성 오류 코드, 재발 방지 마이그레이션 추가 |
| 2026-09-02 | Google OAuth Configuration 오류 복구 | JWT 로그인 콜백의 불필요한 Prisma 세션 의존 제거 및 인증 오류 안내 추가 |
| 2026-09-02 | 대시보드 파란 버튼 대비·요금 정합화 | 파란 CTA 흰색 텍스트 통일, Starter·Pro 월 99,000원·199,000원 및 결제 기준 동기화 |
| 2026-09-22 | 외부 글·사진 REST API 구현 | API 키, 멱등 처리, 사진 첨부, revision 수정, AI 생성·크레딧 복구 추가 |
| 2026-09-22 | WordPress 커넥터 로컬 구현 | 공개 `/api/v1` gateway 경계, 비동기 worker, 사진 업로드·초안 가져오기 플러그인 추가 |
