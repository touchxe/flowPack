# [Phase 2] 작업 로그 — 시각적 합의 (와이어프레임)

## 기본 정보
- **날짜**: 2026-03-31
- **Phase**: Phase 2: 시각적 합의
- **소요 시간**: 약 2시간
- **관련 Task**: PHASE-2

## 이번에 한 일
Mirra 실내부 UX 탐색(브라우저 자동화)으로 얻은 레이아웃 패턴을 참고해, FlowPack의 P0 핵심 화면 9개 + 공통 레이아웃의 shadcn 기반 ASCII 와이어프레임을 자동 생성했다. 각 화면에 shadcn 컴포넌트 목록, Lucide 아이콘 목록, Tailwind 레이아웃 명세, UI 제안 표를 포함했다.

## 생성된 와이어프레임 목록
| 파일 | 화면 | URL |
|------|------|-----|
| auto-layout-nav.md | 공통 사이드바/탑바 | — |
| auto-landing.md | Landing Page | `/` |
| auto-login.md | 로그인 / 회원가입 | `/login`, `/register` |
| auto-home-dashboard.md | 홈 대시보드 | `/home` |
| auto-carousel-lab.md | 카드뉴스 생성 (3단계) | `/carousel-lab` |
| auto-blog-generation.md | 블로그 생성 | `/ai/longform` |
| auto-calendar.md | 콘텐츠 캘린더 | `/calendar` |
| auto-social-accounts.md | SNS 계정 연동 | `/social-accounts` |
| auto-pricing.md | 요금제 | `/pricing` |

## 핵심 결정 사항
| 결정 | 내용 | 근거 |
|------|------|------|
| 사이드바 레이아웃 | Mirra 유사 (좌측 w-60) | 업계 표준, 벤치마킹 검증 |
| 콘텐츠 제작 Collapsible | 메뉴 그룹으로 묶기 | 5개 생성 기능 정리 |
| 3단계 마법사 | 카드뉴스 생성 플로우 | Mirra 검증 패턴 |
| 빈 상태 혜택 제시 | SNS 미연동, 빈 목록 | Mirra 패턴 채택 |
| 게이팅 모달 | 캘린더 SNS 연동 전 | 연동 유도, Mirra 검증 |

## Mirra 대비 FlowPack 차별화 (와이어프레임에 반영)
- 네이버 블로그 연동 UI 포함 (SNS 계정 연동 채널 목록)
- 카카오톡 알림 설정 (설정 > 알림)
- 대량 기획 메뉴 별도 존재 (Mirra는 없음)
- **보라색 금지** → Phase 2.5에서 색상 확정

## 다음 할 일
- 사용자 와이어프레임 검토 및 승인
- Phase 2.5: 디자인 방향 확정 (색상/타이포/레이아웃 — 보라색 제외)
- P1 화면 와이어프레임 (영상, URL→콘텐츠, 대량기획, 통계, 설정)

## 산출물
- `docs/wireframes/auto-*.md` 9개 파일 ✅
