# Graph Report - .  (2026-04-21)

## Corpus Check
- Large corpus: 296 files · ~478,678 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 1327 nodes · 2440 edges · 80 communities detected
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 57 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]

## God Nodes (most connected - your core abstractions)
1. `React` - 82 edges
2. `Prisma` - 74 edges
3. `POST()` - 57 edges
4. `AI 주도 서비스 개발 — 최종 통합 가이드 v2` - 56 edges
5. `GET()` - 51 edges
6. `Epics — 인덱스` - 48 edges
7. `FlowPack E2E 테스트 기획서` - 44 edges
8. `🚀 AI 주도 서비스 개발 프레임워크 v2` - 42 edges
9. `제품 요구사항 문서 (PRD) — FlowPack` - 41 edges
10. `DESIGN.md — FlowPack Design System` - 37 edges

## Surprising Connections (you probably didn't know these)
- `FlowPack DB 스키마` --semantically_similar_to--> `FlowPack API 계약`  [INFERRED] [semantically similar]
  docs\db-schema.md → docs\api-contract.md
- `와이어프레임: 홈 대시보드 (`/home`)` --semantically_similar_to--> `FlowPack 시스템 아키텍처`  [INFERRED] [semantically similar]
  docs\wireframes\auto-home-dashboard.md → docs\architecture.md
- `제품 요구사항 문서 (PRD) — FlowPack` --semantically_similar_to--> `FlowPack — 요구사항 정의서`  [INFERRED] [semantically similar]
  docs\prd.md → docs\requirements-main.md
- `GET()` --calls--> `format()`  [INFERRED]
  app\app\r\[id]\route.ts → app\app\(admin)\admin\users\[id]\user-detail-client.tsx
- `FlowPack 금지 패턴 목록` --semantically_similar_to--> `FlowPack 시스템 아키텍처`  [INFERRED] [semantically similar]
  docs\anti-patterns.md → docs\architecture.md

## Hyperedges (group relationships)
- **Authentication Flow** — readme_auth_js, readme_oauth_providers, auth_js, nextauth, api_contract_1_auth_js, api_contract_unauthorized, architecture_4, dependency_requests_next_auth_auth_js_v5 [INFERRED 0.85]
- **Content Generation Pipeline** — guide_8_4, api_contract_3_ai, api_contract_post_api_generate_carousel, api_contract_post_api_generate_blog, architecture_5_ai, prd_epic_2, requirements_main_4_5, epic2_content_generation [INFERRED 0.80]
- **Multi-Channel Publishing Flow** — design_channel_pills, instagram, wordpress, api_contract_4, api_contract_post_api_publish, api_contract_5_sns, api_contract_get_api_social, api_contract_post_api_social [INFERRED 0.80]

## Communities

### Community 0 - "Community 0"
Cohesion: 0.01
Nodes (11): fetchContents(), handleDelete(), handleSubmit(), fetchData(), handleRefund(), React, fetchData(), handlePing() (+3 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (63): requireAdmin(), fail(), loginViaApi(), ok(), runTests(), shot(), deleteFromCloudinary(), isCloudinaryConfigured() (+55 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (115): US-015, US-020, US-021, Epics — 인덱스, 파일 구조, Epic 목록, Epic1, Epic2 (+107 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (109): Auth.js, 와이어프레임: 블로그 생성 (`/ai/longform`), 목록 화면, 와이어프레임: 블로그 생성 (`/ai/longform`), 새 글 작성 폼 (모달 or 풀페이지), shadcn 컴포넌트 목록, 🆕 UI 제안, 와이어프레임: 홈 대시보드 (`/home`) (+101 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (103): FlowPack 금지 패턴 목록, 1. TypeScript 금지 패턴, 2. React / Next.js 금지 패턴, 3. 스타일링 금지 패턴, 4. API / 데이터 금지 패턴, 5. 보안 금지 패턴, 6. 성능 금지 패턴, 7. 파일 구조 금지 패턴 (+95 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (56): Epic 1: 인증 (Authentication), 엣지 케이스, API 계약, Epic1, Epic 1, Epic 1: 인증 (Authentication), Feature: 이메일 회원가입, Feature: Apple 소셜 로그인 (+48 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (52): AI 주도 서비스 개발 — 최종 통합 가이드 v2, 목차, 1. 전체 파이프라인 개요, 10. 참고 자료, 보안 감사관 (12-security-auditor.mdc), 1.1 핵심 철학, 1.2 파이프라인 흐름, 2. 설치 및 환경 구축 (+44 more)

### Community 7 - "Community 7"
Cohesion: 0.1
Nodes (40): FlowPack E2E 테스트 기획서, 1. 테스트 대상 페이지, 1.1 공개 페이지 (인증 불필요), 1.2 인증 페이지 (로그인 필요), 2. 테스트 시나리오, 2.1 인증 (Authentication), 2.2 콘텐츠 생성 (Content Generation), 2.3 SNS 연동 및 배포 (Publishing) (+32 more)

### Community 8 - "Community 8"
Cohesion: 0.1
Nodes (38): DESIGN.md — FlowPack Design System, 1. Visual Theme & Atmosphere, 2. Color Palette & Roles, 3. Typography Rules, 4. Component Stylings, 5. Layout Principles, 6. Depth & Elevation, 7. Do's and Don'ts (+30 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (11): loadImage(), optimizeFileImage(), optimizeImage(), closeForm(), handleDelete(), handleDrop(), handleFileUpload(), handleSave() (+3 more)

### Community 10 - "Community 10"
Cohesion: 0.1
Nodes (34): Epic 5: 결제 (Billing), 엣지 케이스, API 계약, Epic5, Epic 5, Epic 5: 결제 (Billing), Feature: 무료 티어 크레딧 정책, US-040: 무료 티어 사용 (+26 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (32): FlowPack 디자인 기본값, 1. 컴포넌트 임포트 기준, 10. 반응형 기준, 2. 버튼 사용 기준, 3. 아이콘 크기 기준, 4. 카드 패턴, 5. 폼 패턴, 6. 빈 상태 패턴 (+24 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (31): FlowPack API 계약, 공통 규칙, 1. 인증 (Auth.js 위임), 2. 콘텐츠 CRUD, 3. AI 생성, 4. 배포, 5. SNS 계정 연동, 6. 통계 (+23 more)

### Community 13 - "Community 13"
Cohesion: 0.12
Nodes (31): Epic 2: 콘텐츠 생성 (Content Generation), 엣지 케이스, API 계약, Epic2, Epic 2, Epic 2: 콘텐츠 생성 (Content Generation), Feature: 콘텐츠 편집, Feature: AI 홍보글 생성 - 파라미터 선택 (+23 more)

### Community 14 - "Community 14"
Cohesion: 0.13
Nodes (29): 🚀 AI 주도 서비스 개발 프레임워크 v2, 개요, 에이전트 12개, 🚀 AI 주도 서비스 개발 프레임워크 v2, Auth.js, BDD 테스트 시나리오, 커스텀 Cursor Rules 복사, Database (Supabase) (+21 more)

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (29): Epic 4: 통계 & 관리 (Analytics & Management), 엣지 케이스, API 계약, Epic4, Epic 4, Epic 4: 통계 & 관리 (Analytics & Calendar), Epic 4: 통계 & 관리 (Analytics & Management), Feature: 대시보드 통계 확인 (+21 more)

### Community 16 - "Community 16"
Cohesion: 0.13
Nodes (28): Epic 3: 배포 (Publishing), 엣지 케이스, API 계약, Epic3, Epic 3, Epic 3: 배포 (Publishing), Feature: 네이버 블로그 연동, Feature: Facebook Page 연동 (+20 more)

### Community 17 - "Community 17"
Cohesion: 0.18
Nodes (26): US-010, US-010, US-010, US-010, US-010: AI 홍보글 생성, 개요, acceptance criteria, AI 생성 요청 (+18 more)

### Community 18 - "Community 18"
Cohesion: 0.15
Nodes (25): 제품 요구사항 문서 (PRD), 변경 이력, 1. 프로젝트 개요, 1.1 문제 정의, 1.2 솔루션 요약, 1.3 대상 사용자, 1.4 성공 지표, 2.1 포함 (In Scope) (+17 more)

### Community 19 - "Community 19"
Cohesion: 0.11
Nodes (7): createSlideElement(), downloadBlob(), escapeHtml(), exportCarouselAsPdf(), handleExportPdf(), handleGenerate(), handleRegenerate()

### Community 20 - "Community 20"
Cohesion: 0.28
Nodes (16): US-012, US-012, US-012, US-012, US-012: AI 이미지 생성, 개요, acceptance criteria, 테스트 시나리오 (BDD) (+8 more)

### Community 21 - "Community 21"
Cohesion: 0.28
Nodes (16): US-013, US-013, US-013, US-013, US-013: URL을 입력해 콘텐츠 변환, 개요, acceptance criteria, 테스트 시나리오 (BDD) (+8 more)

### Community 22 - "Community 22"
Cohesion: 0.27
Nodes (15): 금지 패턴 — 변경 금지 (가상 CTO 관할), 코드 패턴, 1. 순환 의존, 1. any 타입 사용, 2. 비즈니스 로직의 UI 침투, 2. useEffect 내 데이터 페칭, 3. DB 직접 접근 (클라이언트), 3. God Component (300줄 이상 컴포넌트) (+7 more)

### Community 23 - "Community 23"
Cohesion: 0.15
Nodes (2): onDrop(), uploadFiles()

### Community 24 - "Community 24"
Cohesion: 0.4
Nodes (13): US-014, US-014, US-014, US-014, US-014, US-014: 카드뉴스(Carousel) 생성, 개요, acceptance criteria (+5 more)

### Community 25 - "Community 25"
Cohesion: 0.5
Nodes (10): detectChannel(), detectIndustry(), humanScroll(), humanType(), main(), rand(), scrapeBlogPost(), searchNaverBlog() (+2 more)

### Community 26 - "Community 26"
Cohesion: 0.5
Nodes (8): API 계약 — 변경 금지 (가상 CTO 관할), 공통 규칙, API 목록, API 계약 — 변경 금지 (가상 CTO 관할), Auth (인증), [Feature] (프로젝트별 추가), 이 파일은 읽기 전용입니다., User (사용자)

### Community 27 - "Community 27"
Cohesion: 0.46
Nodes (8): US-021: 블로그 연동, 개요, acceptance criteria, .env.local, Epic 3, Self-hosted WordPress 연결 테스트, US-021: 블로그 연동, WordPress 연동

### Community 28 - "Community 28"
Cohesion: 0.46
Nodes (8): 와이어프레임: 카드뉴스 생성 (`/carousel-lab`), 와이어프레임: 카드뉴스 생성 (`/carousel-lab`), Lucide 아이콘 목록, shadcn 컴포넌트 목록, Step 1: 생성 방법 선택, Step 2: 콘텐츠 입력 (바로 만들기 선택 시), Step 3: 결과 확인 및 편집, 🆕 UI 제안

### Community 29 - "Community 29"
Cohesion: 0.48
Nodes (5): handleCreate(), handleDelete(), handleToggle(), handleUpdate(), showToast()

### Community 30 - "Community 30"
Cohesion: 0.52
Nodes (7): US-031: 콘텐츠 캘린더 예약·관리, 개요, acceptance criteria, 예약 배포 Cron, Epic 4, US-031: 콘텐츠 캘린더 예약·관리, Vercel Cron

### Community 31 - "Community 31"
Cohesion: 0.73
Nodes (5): daysAgo(), main(), makeAiLog(), randomFrom(), randomInt()

### Community 32 - "Community 32"
Cohesion: 0.6
Nodes (4): handleApply(), handleClose(), handleGenerate(), handleRegenerate()

### Community 33 - "Community 33"
Cohesion: 0.5
Nodes (2): formatDate(), formatRelativeTime()

### Community 34 - "Community 34"
Cohesion: 0.5
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (2): main(), sleep()

### Community 36 - "Community 36"
Cohesion: 1.33
Nodes (3): UI 텍스트 사전, 공통, UI 텍스트 사전

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (1): prisma/set_admin.py 사용법: python prisma/set_admin.py your@email.com

### Community 60 - "Community 60"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Community 61"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Community 62"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Community 63"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Community 64"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Community 65"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Community 66"
Cohesion: 1.0
Nodes (0): 

### Community 67 - "Community 67"
Cohesion: 1.0
Nodes (0): 

### Community 68 - "Community 68"
Cohesion: 1.0
Nodes (0): 

### Community 69 - "Community 69"
Cohesion: 1.0
Nodes (0): 

### Community 70 - "Community 70"
Cohesion: 1.0
Nodes (0): 

### Community 71 - "Community 71"
Cohesion: 1.0
Nodes (0): 

### Community 72 - "Community 72"
Cohesion: 1.0
Nodes (0): 

### Community 73 - "Community 73"
Cohesion: 1.0
Nodes (0): 

### Community 74 - "Community 74"
Cohesion: 1.0
Nodes (0): 

### Community 75 - "Community 75"
Cohesion: 1.0
Nodes (0): 

### Community 76 - "Community 76"
Cohesion: 1.0
Nodes (0): 

### Community 77 - "Community 77"
Cohesion: 1.0
Nodes (0): 

### Community 78 - "Community 78"
Cohesion: 1.0
Nodes (0): 

### Community 79 - "Community 79"
Cohesion: 1.0
Nodes (1): Design Direction Preview

## Knowledge Gaps
- **103 isolated node(s):** `prisma/set_admin.py 사용법: python prisma/set_admin.py your@email.com`, `**읽기 전용 — 가상 CTO 감시 대상**`, `**읽기 전용 — 가상 CTO 감시 대상**`, `FORBIDDEN`, `UNAUTHORIZED` (+98 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 37`** (2 nodes): `layout.tsx`, `RootLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (2 nodes): `layout.tsx`, `AdminLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (2 nodes): `page.tsx`, `AdminDashboardPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (2 nodes): `page.tsx`, `AdminAiUsagePage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (2 nodes): `page.tsx`, `AdminContentsPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (2 nodes): `page.tsx`, `AdminNoticesPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (2 nodes): `page.tsx`, `AdminPaymentsPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (2 nodes): `page.tsx`, `AdminSettingsPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (2 nodes): `page.tsx`, `AdminSubscriptionsPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (2 nodes): `page.tsx`, `AdminUsersPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (2 nodes): `page.tsx`, `AdminUserDetailPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (2 nodes): `page.tsx`, `MediaPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (2 nodes): `page.tsx`, `SettingsPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (2 nodes): `page.tsx`, `PrivacyPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (2 nodes): `page.tsx`, `TermsPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (2 nodes): `AdminSidebar()`, `admin-sidebar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (2 nodes): `content-flow-sankey.tsx`, `getNodeColor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (2 nodes): `credit-exhausted-modal.tsx`, `CreditExhaustedModal()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (2 nodes): `skeleton.tsx`, `Skeleton()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (2 nodes): `create_admin.mjs`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (2 nodes): `seed-calendar.mjs`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (2 nodes): `seed_subscription.mjs`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (2 nodes): `set_admin.py`, `prisma/set_admin.py 사용법: python prisma/set_admin.py your@email.com`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (1 nodes): `middleware.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (1 nodes): `postcss.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (1 nodes): `tmp_admin.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (1 nodes): `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (1 nodes): `route.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (1 nodes): `public-footer.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (1 nodes): `auth.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (1 nodes): `prisma.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (1 nodes): `seed_calendar.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (1 nodes): `verify_seed.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 74`** (1 nodes): `playwright.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75`** (1 nodes): `visual-compare.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (1 nodes): `auth-pages.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 77`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 78`** (1 nodes): `_run_detect.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 79`** (1 nodes): `Design Direction Preview`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `React` connect `Community 0` to `Community 32`, `Community 4`, `Community 5`, `Community 6`, `Community 9`, `Community 11`, `Community 13`, `Community 14`, `Community 19`, `Community 22`, `Community 23`, `Community 29`?**
  _High betweenness centrality (0.314) - this node is a cross-community bridge._
- **Why does `Prisma` connect `Community 1` to `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 7`, `Community 13`, `Community 14`, `Community 15`, `Community 17`, `Community 30`?**
  _High betweenness centrality (0.180) - this node is a cross-community bridge._
- **Why does `FlowPack 기술 스택` connect `Community 4` to `Community 0`, `Community 1`, `Community 3`, `Community 5`, `Community 10`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Are the 24 inferred relationships involving `POST()` (e.g. with `requireAdmin()` and `isOpenAIConfigured()`) actually correct?**
  _`POST()` has 24 INFERRED edges - model-reasoned connections that need verification._
- **Are the 17 inferred relationships involving `GET()` (e.g. with `requireAdmin()` and `format()`) actually correct?**
  _`GET()` has 17 INFERRED edges - model-reasoned connections that need verification._
- **What connects `prisma/set_admin.py 사용법: python prisma/set_admin.py your@email.com`, `**읽기 전용 — 가상 CTO 감시 대상**`, `**읽기 전용 — 가상 CTO 감시 대상**` to the rest of the system?**
  _103 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.01 - nodes in this community are weakly interconnected._