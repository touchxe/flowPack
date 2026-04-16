# DESIGN.md — FlowPack Design System

FlowPack은 한국 시장을 타겟으로 하는 AI 기반 홍보 콘텐츠 SaaS 플랫폼이다. 디자인은 다우오피스, 메이크샵, 카카오뱅크 등 한국 주요 SaaS/핀테크 사이트의 시각 언어를 참조하여, **깨끗한 화이트 베이스 위에 신뢰감 있는 블루 액센트**로 구성한다. 전체적으로 "전문적이면서도 친근한" 한국식 SaaS 톤을 추구하며, 과도한 장식 대신 **충분한 여백과 부드러운 둥글기(radius)**로 고급감을 표현한다.

**핵심 특징:**
- 순백색(`#FFFFFF`) 베이스에 연그레이(`#F7F8FA`) 섹션이 교차하는 경쾌한 리듬
- Pretendard 폰트 패밀리 — 한글/영문 모두 아름다운 프리미엄 한국어 서체
- 블루-인디고 그라디언트(`#2563EB → #4F46E5`) CTA로 시선 흡인
- border-radius 12–20px의 넉넉한 둥글기 — 차가운 직각 대신 부드러운 곡선
- 멀티 레이어 소프트 섀도로 카드가 종이 위에 뜬 듯한 자연스러운 깊이
- 120px 이상의 넉넉한 섹션 패딩으로 "숨 쉴 공간" 확보

---

## 1. Visual Theme & Atmosphere

| 속성 | 값 |
|------|---|
| **모드** | Light (화이트 베이스) |
| **밀도** | Spacious — 넓은 여백, 충분한 padding |
| **분위기** | 전문적이면서도 친근한 (Professional-Friendly) |
| **디자인 철학** | "깨끗함이 신뢰를 만든다" — 불필요한 장식을 배제하고 콘텐츠와 기능에 집중 |
| **레퍼런스** | 다우오피스(그룹웨어), 메이크샵(이커머스), 카카오뱅크(핀테크) |

---

## 2. Color Palette & Roles

### Primary
| 이름 | Hex | 용도 |
|------|-----|------|
| **FlowPack Blue** | `#2563EB` | CTA 배경, 링크, 활성 상태, 주요 액션 |
| **Blue Hover** | `#1D4ED8` | CTA 호버 상태 |
| **Blue Light** | `#DBEAFE` | 블루 틴트 배경, 배지 배경, 선택된 항목 |
| **Blue Subtle** | `#EFF6FF` | 매우 연한 블루 배경, 히어로 데코레이션 |

### Accent (Gradient)
| 이름 | Hex | 용도 |
|------|-----|------|
| **Indigo** | `#4F46E5` | 그라디언트 끝점, 보조 액센트 |
| **Violet** | `#7C3AED` | 배지, NEW 태그, 데코레이션 |
| **Violet Light** | `#EDE9FE` | 바이올렛 배지 배경 |

### Neutral
| 이름 | Hex | 용도 |
|------|-----|------|
| **Heading** | `#111827` | 제목, 강조 텍스트 (gray-900) |
| **Body** | `#374151` | 본문 텍스트 (gray-700) |
| **Secondary** | `#6B7280` | 보조 텍스트, 캡션 (gray-500) |
| **Muted** | `#9CA3AF` | 비활성 텍스트, 플레이스홀더 (gray-400) |
| **Border** | `#E5E7EB` | 기본 테두리 (gray-200) |
| **Border Soft** | `#F3F4F6` | 연한 테두리, 디바이더 (gray-100) |

### Surface
| 이름 | Hex | 용도 |
|------|-----|------|
| **White** | `#FFFFFF` | 페이지 배경, 카드 배경 |
| **Section Gray** | `#F7F8FA` | 교차 섹션 배경 (다우오피스 참조) |
| **Surface Warm** | `#F9FAFB` | 입력 필드 배경, 사이드바 (gray-50) |
| **Overlay** | `rgba(0,0,0,0.4)` | 모달 오버레이 |

### Semantic
| 이름 | Hex | 용도 |
|------|-----|------|
| **Success** | `#059669` | 성공 상태, 완료 아이콘 |
| **Success BG** | `#ECFDF5` | 성공 배지 배경 |
| **Warning** | `#D97706` | 경고 상태 |
| **Warning BG** | `#FFFBEB` | 경고 배지 배경 |
| **Error** | `#DC2626` | 에러, 삭제, 위험 |
| **Error BG** | `#FEF2F2` | 에러 배지 배경 |
| **Info** | `#2563EB` | 정보 상태 (= Primary Blue) |
| **Info BG** | `#EFF6FF` | 정보 배지 배경 (= Blue Subtle) |

---

## 3. Typography Rules

### Font Family
- **Primary**: `'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', sans-serif`
- **Monospace**: `'JetBrains Mono', 'SF Mono', 'Fira Code', monospace`
- **CDN**: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css`

### Hierarchy
| Role | Size | Weight | Line Height | Letter Spacing | Color | 용도 |
|------|------|--------|-------------|----------------|-------|------|
| Display Hero | 48px (3rem) | 800 | 1.15 | -0.02em | `#111827` | 랜딩 페이지 메인 헤드라인 |
| Display | 36px (2.25rem) | 700 | 1.2 | -0.015em | `#111827` | 섹션 타이틀 |
| Heading 1 | 30px (1.875rem) | 700 | 1.3 | -0.01em | `#111827` | 페이지 제목 |
| Heading 2 | 24px (1.5rem) | 600 | 1.3 | -0.01em | `#111827` | 서브 섹션 |
| Heading 3 | 20px (1.25rem) | 600 | 1.4 | normal | `#111827` | 카드 제목, 기능 이름 |
| Body Large | 18px (1.125rem) | 400 | 1.6 | normal | `#374151` | 소개 텍스트, 리드 문단 |
| Body | 16px (1rem) | 400 | 1.6 | normal | `#374151` | 표준 본문 |
| Body Small | 14px (0.875rem) | 400 | 1.5 | normal | `#6B7280` | 보조 설명 |
| Caption | 13px (0.8125rem) | 500 | 1.4 | normal | `#6B7280` | 라벨, 메타 정보 |
| Micro | 12px (0.75rem) | 400 | 1.4 | normal | `#9CA3AF` | 타임스탬프, 미세 텍스트 |

### Principles
- **굵기 체계**: 한국어 본문은 영어보다 복잡한 글리프를 가지므로 400(본문)~700(제목) 범위의 **적당한 굵기**를 사용한다. Stripe처럼 300 lightweight를 쓰면 한글 가독성이 떨어진다.
- **Line Height**: 한글은 영어보다 글자 높이가 균일하므로 1.5~1.6 배의 넉넉한 행간이 필요하다.
- **음수 레터스페이핑**: 36px 이상의 큰 제목에만 -0.01em~-0.02em 적용. 본문은 기본값 유지.

---

## 4. Component Stylings

### Buttons

**Primary (Gradient)**
- Background: `linear-gradient(135deg, #2563EB, #4F46E5)`
- Text: `#FFFFFF`
- Padding: `10px 24px`
- Radius: `10px`
- Font: 15px Pretendard weight 600
- Shadow: `0 4px 14px rgba(37,99,235,0.35)`
- Hover: `transform: translateY(-1px)`, shadow 강화
- 용도: 가장 중요한 CTA ("무료로 시작하기", "카드뉴스 생성")

**Primary (Solid)**
- Background: `#2563EB`
- Text: `#FFFFFF`
- Padding: `10px 20px`
- Radius: `10px`
- Font: 15px Pretendard weight 600
- Hover: `#1D4ED8`
- 용도: 일반 확인 버튼 ("저장", "확인")

**Secondary (Outline)**
- Background: `#FFFFFF`
- Border: `1.5px solid #E5E7EB`
- Text: `#374151`
- Padding: `10px 20px`
- Radius: `10px`
- Font: 15px Pretendard weight 500
- Hover: border `#2563EB`, text `#2563EB`, bg `#EFF6FF`
- 용도: 보조 액션 ("취소", "요금제 보기")

**Ghost**
- Background: transparent
- Text: `#6B7280`
- Padding: `8px 16px`
- Radius: `8px`
- Font: 14px Pretendard weight 500
- Hover: bg `#F9FAFB`, text `#374151`
- 용도: 세 번째 우선순위 ("건너뛰기", "나중에")

**Destructive**
- Background: `#DC2626`
- Text: `#FFFFFF`
- Padding: `10px 20px`
- Radius: `10px`
- Font: 15px Pretendard weight 600
- Hover: `#B91C1C`
- 용도: 삭제, 비가역적 액션

### Cards

**Default Card**
- Background: `#FFFFFF`
- Border: `1px solid #F3F4F6`
- Radius: `16px`
- Padding: `24px`
- Shadow: `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)`
- Hover: `transform: translateY(-4px)`, shadow `0 20px 40px rgba(0,0,0,0.08)`, border `#DBEAFE`
- Transition: `all 0.25s ease`

**Feature Card (랜딩용)**
- Background: `#FFFFFF`
- Border: `1px solid #F3F4F6`
- Radius: `20px`
- Padding: `32px`
- Shadow: `0 4px 12px rgba(0,0,0,0.04)`
- 아이콘 영역: 56×56px, radius `16px`, 각 기능별 파스텔 배경색
- Hover: 위로 -4px, shadow 강화

**Stat Card (통계 카드)**
- Background: `linear-gradient(135deg, #F8FAFF, #F0F4FF)`
- Border: `1px solid #DBEAFE`
- Radius: `16px`
- Padding: `24px`
- 수치: 36px weight 800, gradient text (`#2563EB → #4F46E5`)
- 라벨: 13px weight 500, `#6B7280`

**Testimonial Card**
- Background: `#FFFFFF`
- Border: `1px solid #F3F4F6`
- Radius: `16px`
- Padding: `24px`
- Shadow: `0 2px 12px rgba(0,0,0,0.04)`
- 아바타: 44×44px circle, gradient bg (`#2563EB → #4F46E5`)
- 별점: `fill-amber-400 text-amber-400`

### Badges / Tags

**Blue Badge**
- Background: `#EFF6FF`
- Text: `#2563EB`
- Padding: `4px 12px`
- Radius: `9999px` (pill)
- Font: 13px weight 600
- Border: `1px solid #BFDBFE`

**Violet Badge (NEW)**
- Background: `#EDE9FE`
- Text: `#7C3AED`
- Padding: `4px 12px`
- Radius: `9999px`
- Font: 13px weight 600
- Border: `1px solid #DDD6FE`

**Success Badge**
- Background: `#ECFDF5`
- Text: `#059669`
- Padding: `2px 8px`
- Radius: `9999px`
- Font: 12px weight 600
- Border: `1px solid #A7F3D0`

**Error Badge**
- Background: `#FEF2F2`
- Text: `#DC2626`
- Padding: `2px 8px`
- Radius: `9999px`
- Font: 12px weight 600

### Inputs & Forms
- Background: `#FFFFFF`
- Border: `1.5px solid #E5E7EB`
- Radius: `10px`
- Padding: `10px 14px`
- Font: 15px Pretendard weight 400
- Placeholder: `#9CA3AF`
- Focus: border `#2563EB`, ring `0 0 0 3px rgba(37,99,235,0.1)`
- Label: `#374151`, 14px weight 500, margin-bottom 6px
- Error state: border `#DC2626`, ring `rgba(220,38,38,0.1)`

### Navigation (Header)
- Background: `#FFFFFF` / `rgba(255,255,255,0.9)` with `backdrop-filter: blur(12px)`
- Border bottom: `1px solid #F3F4F6`
- Position: sticky top-0 z-50
- Logo: 32×32px rounded-lg with gradient bg + Zap icon
- Brand name: 18px weight 700, `#111827`
- Nav links: 14px weight 500, `#6B7280`, hover `#111827`
- CTA: Primary gradient button, right-aligned
- Height: ~64px
- 다우오피스 참조: 깨끗한 수평 네비게이션, 적절한 간격

### Channel Pills (연동 채널 표시)
- Background: `#F9FAFB`
- Border: `1px solid #E5E7EB`
- Radius: `9999px`
- Padding: `8px 16px`
- Font: 14px weight 500, `#6B7280`
- Hover: bg `#EFF6FF`, border `#BFDBFE`, text `#2563EB`

---

## 5. Layout Principles

### Spacing Scale (8px base)
| Token | Value | 용도 |
|-------|-------|------|
| space-1 | 4px | 아이콘과 텍스트 사이 미세 간격 |
| space-2 | 8px | 인라인 요소 간격 |
| space-3 | 12px | 밀접한 관련 요소 간격 |
| space-4 | 16px | 카드 내부 요소 간격 |
| space-5 | 20px | 폼 필드 간격 |
| space-6 | 24px | 카드 패딩, 섹션 내부 그룹 간격 |
| space-8 | 32px | 컴포넌트 그룹 간격 |
| space-10 | 40px | 작은 섹션 간격 |
| space-12 | 48px | 섹션 내 주요 그룹 간격 |
| space-16 | 64px | 섹션 간격 (모바일) |
| space-20 | 80px | 섹션 간격 (태블릿) |
| space-24 | 96px | 섹션 간격 (데스크탑) |

### Grid & Container
- **Max content width**: 1200px (`max-w-6xl` = 1152px)
- **Page padding**: 24px (모바일), 32px (태블릿), 40px+ (데스크탑)
- **Column grid**: 1열(모바일) → 2열(태블릿) → 3~4열(데스크탑)
- **Gap**: 20px (카드 그리드), 32px (기능 섹션)

### Whitespace Philosophy
- **숨 쉬는 레이아웃**: 다우오피스, 카카오뱅크처럼 섹션 사이에 80px 이상의 넉넉한 여백을 둔다. 콘텐츠가 빼곡하면 한국 사용자에게 "복잡하다"는 인상을 준다.
- **소프트 교차**: 흰색(`#FFFFFF`) 섹션과 연그레이(`#F7F8FA`) 섹션이 번갈아 나타나며 시각적 리듬을 만든다. 하드한 구분선 대신 배경색 전환으로 자연스럽게 섹션을 분리한다.
- **카드 내부 여백**: 최소 24px 패딩. 한국 사용자는 좁은 패딩을 "싸 보인다"고 느낀다.

---

## 6. Depth & Elevation

### Shadow System
| Level | Shadow | 용도 |
|-------|--------|------|
| Level 0 (Flat) | none | 페이지 배경, 인라인 텍스트 |
| Level 1 (Subtle) | `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)` | 기본 카드, 입력 필드 |
| Level 2 (Standard) | `0 4px 12px rgba(0,0,0,0.06)` | 호버 상태 카드, 드롭다운 |
| Level 3 (Elevated) | `0 20px 40px rgba(0,0,0,0.08)` | 호버 활성 카드, 모달 |
| Level 4 (Floating) | `0 25px 50px rgba(0,0,0,0.12)` | 히어로 목업, 팝오버 |
| CTA Glow | `0 4px 14px rgba(37,99,235,0.35)` | Primary CTA 버튼 |
| Focus Ring | `0 0 0 3px rgba(37,99,235,0.1)` | 포커스 상태 |

### Shadow Philosophy
Stripe의 블루 틴트 섀도(`rgba(50,50,93,0.25)`)와 달리, FlowPack은 **중립적인 블랙 기반 섀도**를 사용한다. 이는 다우오피스, 카카오뱅크에서 관찰되는 한국 SaaS의 "깨끗한" 그림자 스타일을 따른 것이다. 대신 CTA 버튼에만 브랜드 컬러 글로우(`rgba(37,99,235,...)`)를 적용하여 행동 유도 요소를 강조한다.

---

## 7. Do's and Don'ts

### ✅ Do
- Pretendard를 모든 텍스트에 사용 — 한글/영문 통합 렌더링 최적
- 제목에 700~800 weight 사용 — 한글은 가는 weight에서 가독성이 떨어짐
- border-radius 12~20px로 부드럽게 — 한국 트렌드는 넉넉한 둥글기
- 흰색과 연그레이(`#F7F8FA`) 섹션을 교차 배치
- CTA에 `linear-gradient(135deg, #2563EB, #4F46E5)` 사용
- 카드 호버 시 `translateY(-4px)` + shadow 강화로 인터랙션 피드백
- 섹션 라벨("FEATURES", "HOW IT WORKS")을 11px uppercase로 표시
- 한국어 문장은 간결하게 — 한 문장 20자 이내 권장

### ❌ Don't
- weight 300으로 한글 제목 쓰지 않기 — 너무 가늘어서 읽기 어려움
- 순수 블랙(`#000000`)을 제목에 쓰지 않기 — `#111827` 사용
- border-radius 4px 이하의 뾰족한 모퉁이 사용 금지 — 차갑고 구식
- 진한 그림자(`opacity 0.25+`) 사용 금지 — 한국 라이트 테마에서 무거워 보임
- 네온/형광 색상 사용 금지 — 브랜드 블루와 충돌
- 좁은 패딩(12px 이하) 카드 금지 — 답답해 보임
- 영문 전용 디자인 패턴(all-caps body text 등) 금지

---

## 8. Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | <640px | 1열 레이아웃, Hero 36px, 섹션 padding 48px |
| Tablet | 640–1024px | 2열 그리드, Hero 42px, 섹션 padding 64px |
| Desktop | 1024–1280px | 3~4열 그리드, Hero 48px, 섹션 padding 96px |
| Large | >1280px | max-width 1200px 중앙 정렬, 양쪽 충분한 마진 |

### Touch Targets
- 버튼 최소 높이: 44px (모바일)
- 네비게이션 링크 간 간격: 최소 32px
- 카드 클릭 영역: 전체 카드
- 입력 필드 높이: 44px (모바일), 40px (데스크탑)

### Collapsing Strategy
- Hero: 48px → 36px, 패딩 축소
- Nav: 수평 링크 → 햄버거 메뉴 (md 이하)
- 기능 카드: 4열 → 2열 → 1열
- 통계 카드: 4열 → 2열 유지 (모바일에서도 2×2 그리드)
- FAQ: 최대 너비 축소, 좌우 패딩 감소
- CTA 배너: 수평 패딩 축소, 폰트 사이즈 한 단계 다운
- 대시보드 목업: `overflow: hidden`, 하단 fade 유지

---

## 9. Agent Prompt Guide

### Quick Color Reference
- Primary: `#2563EB` (Blue 600)
- Primary Hover: `#1D4ED8` (Blue 700)
- CTA Gradient: `linear-gradient(135deg, #2563EB, #4F46E5)`
- Heading: `#111827` (Gray 900)
- Body: `#374151` (Gray 700)
- Secondary text: `#6B7280` (Gray 500)
- Border: `#E5E7EB` (Gray 200)
- Background: `#FFFFFF`
- Section alt: `#F7F8FA`
- Success: `#059669`
- Error: `#DC2626`

### Example Component Prompts

**Hero Section:**
> "흰색 배경 위에 Hero 섹션. 헤드라인 48px Pretendard weight 800, color #111827, letter-spacing -0.02em. '홍보 콘텐츠,'는 #111827, 'AI가 만들어드립니다'는 gradient-text (#2563EB → #4F46E5). 서브타이틀 18px weight 400, #6B7280, line-height 1.6. CTA 버튼은 gradient(#2563EB → #4F46E5), 흰색 텍스트, radius 10px, shadow 0 4px 14px rgba(37,99,235,0.35). 보조 버튼은 #FFFFFF bg, 1.5px solid #E5E7EB, #374151 text, radius 10px."

**Feature Card:**
> "#FFFFFF 배경 카드, 1px solid #F3F4F6 border, radius 20px, padding 32px. 아이콘 영역 56×56px radius 16px (기능별 파스텔 bg — 블루 #EFF6FF, 그린 #ECFDF5, 앰버 #FFFBEB, 퍼플 #F5F3FF). 제목 16px weight 700, #111827. 설명 14px weight 400, #6B7280, line-height 1.5. 하이라이트 배지 13px weight 600, #2563EB text, #EFF6FF bg, pill radius."

**Navigation:**
> "흰색 sticky header, backdrop-filter blur(12px), border-bottom 1px solid #F3F4F6. 로고 왼쪽 32px gradient 아이콘 + 18px weight 700 'FlowPack'. Nav 링크 14px weight 500, #6B7280, hover #111827. 오른쪽 '로그인' 텍스트 링크 + gradient CTA '무료로 시작' 버튼."

**Stat Section:**
> "배경 #F7F8FA, 4열 그리드. 각 카드 gradient bg (#F8FAFF → #F0F4FF), 1px solid #DBEAFE, radius 16px, padding 24px. 숫자 36px weight 800 gradient-text (#2563EB → #4F46E5). 라벨 13px weight 500, #6B7280."

### Iteration Guide
1. 폰트: Pretendard Variable CDN 링크를 `<head>`에 포함
2. 색상: `#111827` 제목, `#374151` 본문, `#6B7280` 보조 — 이 3단계 회색이 핵심
3. 카드: radius 16~20px, 1px solid `#F3F4F6`, hover 시 -4px lift + shadow 강화
4. CTA: gradient(`#2563EB → #4F46E5`) + glow shadow — 페이지에서 가장 눈에 띄어야 함
5. 섹션: 흰색 ↔ `#F7F8FA` 교차, 섹션 padding 80px+ (모바일 48px+)
6. 섹션 라벨: 11px uppercase tracking-widest `#2563EB`
7. 배지: pill shape(9999px), 파스텔 배경 + 진한 텍스트
8. 모든 트랜지션: `0.25s ease` — 빠르지도 느리지도 않은 한국식 부드러움
