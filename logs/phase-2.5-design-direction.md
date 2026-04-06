# [Phase 2.5] 디자인 방향 작업 로그

## 기본 정보
- **날짜**: 2026-03-31
- **Phase**: Phase 2.5 — 디자인 방향
- **소요 시간**: 약 30분
- **관련 Task**: PHASE-2.5

## 이번에 한 일
Phase 2 와이어프레임 완료 후, 실제 구현 전 색상·타이포·레이아웃·컴포넌트 스타일을 사전에 확정하는 디자인 시스템 문서를 작성했다. Mirra 벤치마킹에서 파악한 "AI 보라색 슬롭" 문제를 회피하기 위해 "Cyan Ocean" 팔레트를 주 색상으로 채택했다. CSS 변수 기반의 shadcn 테마를 설계하고, Pretendard Variable 폰트를 한국어 최적화 목적으로 선정했다. 최종 결과물은 `docs/design-direction.md`와 시각적 미리보기 HTML(`docs/design-direction-preview.html`)로 저장했다.

## 핵심 결정 사항

| 결정 | 선택지 | 선택 이유 |
|------|--------|-----------|
| 브랜드 색상 | 보라(Mirra 동일) vs **Cyan Ocean** vs 네이비 | Mirra 차별화 필수, Cyan은 "흐름(Flow)" 의미와 부합, 한국 B2B에서 희소한 색 |
| Accent 색상 | 오렌지 vs **Amber** vs 그린 | CTA의 에너지감, 청록과 보색 대비로 강조 효과 극대화 |
| 폰트 | Noto Sans KR vs **Pretendard** vs 시스템 폰트 | Pretendard Variable은 한국어 웹 표준, 서브셋 CDN 지원, 다양한 굵기 |
| 다크모드 | 선택 vs **필수** | 현대 SaaS 표준, Evaluator "완성도" 기준 충족 |
| 컴포넌트 기본값 | 기본 shadcn | rounded-lg(버튼), rounded-xl(카드)로 미세 조정 |

## 사용한 도구/기술
- **디자인 원칙**: Linear.app(정밀도), Vercel(여백), Toss(한국적 신뢰감) 참조
- **색상 시스템**: HSL 기반 CSS 변수 (shadcn 테마 호환)
- **폰트**: cdn.jsdelivr.net Pretendard Variable Dynamic Subset

## 어려웠던 점 / 배운 점
- **문제**: "보라색만 피하면 된다"는 단순 회피가 아니라, FlowPack 고유 브랜드 아이덴티티를 만들어야 했다. Cyan은 "신뢰"와 "역동성"을 동시에 표현하지만, 지나치게 차갑게 보일 위험이 있었다.
- **해결**: Amber Accent를 보조 강조색으로 설정해 따뜻함을 보완. Primary-cool + Accent-warm의 대비 구조.
- **배운 점**: 색상은 단순 미적 판단이 아니라 사용자 신뢰·행동 유도와 직결된다. B2B SaaS에서 파란계열(신뢰)과 오렌지/앰버(행동 촉구) 조합은 HubSpot, Intercom 등 검증된 패턴이다.

## AI와의 협업 노트
- Mirra 벤치마킹 데이터를 기반으로 "안티 패턴 → 대안" 방식으로 설계 방향을 도출한 것이 효과적
- shadcn CSS 변수 구조를 완전히 준수하여 Phase 5 구현 때 별도 작업 최소화
- HTML 미리보기(`design-direction-preview.html`)를 생성하여 사용자가 코드 없이 색상/폰트/컴포넌트를 확인 가능

## 다음 할 일
1. 사용자 디자인 방향 승인 (`docs/design-direction.md` → 읽기 전용 전환)
2. Phase 3: 아키텍처 확정 (6종 제약 파일 작성)
   - `docs/tech-stack.md`
   - `docs/architecture.md`
   - `docs/api-contract.md`
   - `docs/db-schema.md`
   - `docs/anti-patterns.md`
   - `docs/design-defaults.md`

## 스크린샷/참조
- `docs/design-direction.md` — 디자인 시스템 본문
- `docs/design-direction-preview.html` — 시각적 미리보기 (브라우저에서 열기)
