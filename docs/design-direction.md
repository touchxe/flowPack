# FlowPack 디자인 방향

> **작성일**: 2026-03-31  
> **Phase**: Phase 2.5  
> **상태**: 사용자 승인 대기  
> ⚠️ 승인 후 가상 CTO 감시 대상(읽기 전용)으로 전환됨

---

## 1. 무드

### 키워드
| 키워드 | 의미 |
|--------|------|
| **유려한 (Fluid)** | 콘텐츠가 물 흐르듯 생성·배포되는 FlowPack의 정체성 |
| **신뢰감 (Trustworthy)** | 사업체의 브랜드를 맡기는 툴 — 안정적이고 프로페셔널 |
| **역동적 (Dynamic)** | 마케팅 특성상 에너지 있는 느낌, 정적이지 않음 |
| **간결한 (Clean)** | 복잡한 마케팅을 단순하게 — 불필요한 시각 요소 제거 |
| **한국적 실용주의** | 국내 사용자(소호·스타트업)에게 친숙한 UI 패턴 |

### 안티 키워드 (금지)
| 금지 | 이유 |
|------|------|
| ❌ 보라색 / 바이올렛 그라디언트 | Mirra·수많은 AI 툴의 색상 — 차별화 불가 |
| ❌ 과도한 그라디언트 히어로 | AI 슬롭의 전형 — Evaluator FAIL 위험 |
| ❌ 유리모피즘 / 과도한 블러 | 무거운 렌더링, 시각 피로 |
| ❌ 3개 이상 강조색 | 색상 소음, 집중도 저하 |
| ❌ 빽빽한 레이아웃 | 숨막히는 UX — 여백으로 말한다 |

### 벤치마킹 참조
- **Linear.app**: 절제된 다크 UI + 정밀한 타이포그래피 (완성도 참조)
- **Vercel 대시보드**: 흰 배경 + 선명한 Primary + 최소한의 장식 (레이아웃 참조)
- **Toss**: 한국적 신뢰감 + 친근함 + 간결한 카드 패턴 (감성 참조)

---

## 2. 색상 시스템

### 브랜드 컬러 철학
> "Cyan Ocean" — 콘텐츠가 **흐르는(Flow)** 느낌의 깊은 청록색.  
> 보라색을 완전히 배제하고, 한국 B2B SaaS 시장에서 차별화.

### Light Mode 팔레트

| 변수 | HSL 값 | Hex 참조 | 용도 |
|------|--------|---------|------|
| `--primary` | `hsl(198, 88%, 38%)` | `#0B88B8` | 주요 CTA, 링크, 강조 |
| `--primary-foreground` | `hsl(0, 0%, 100%)` | `#FFFFFF` | Primary 위 텍스트 |
| `--secondary` | `hsl(200, 20%, 96%)` | `#F0F5F7` | 보조 배경, 호버 |
| `--accent` | `hsl(32, 95%, 54%)` | `#F59E0B` | 강조 CTA (무료 시작 등) |
| `--accent-foreground` | `hsl(0, 0%, 100%)` | `#FFFFFF` | Accent 위 텍스트 |
| `--background` | `hsl(0, 0%, 100%)` | `#FFFFFF` | 페이지 배경 |
| `--foreground` | `hsl(215, 25%, 12%)` | `#171F2E` | 기본 텍스트 |
| `--muted` | `hsl(210, 18%, 95%)` | `#EFF2F5` | 비활성 배경 |
| `--muted-foreground` | `hsl(215, 15%, 50%)` | `#6B7A96` | 보조 텍스트 |
| `--border` | `hsl(210, 20%, 90%)` | `#DDE3EC` | 테두리 |
| `--input` | `hsl(210, 20%, 90%)` | `#DDE3EC` | 입력 필드 테두리 |
| `--ring` | `hsl(198, 88%, 38%)` | `#0B88B8` | 포커스 링 |
| `--card` | `hsl(0, 0%, 100%)` | `#FFFFFF` | 카드 배경 |
| `--card-foreground` | `hsl(215, 25%, 12%)` | `#171F2E` | 카드 텍스트 |
| `--destructive` | `hsl(0, 84%, 60%)` | `#F03E3E` | 오류·삭제 |
| `--destructive-foreground` | `hsl(0, 0%, 100%)` | `#FFFFFF` | Destructive 위 텍스트 |
| `--popover` | `hsl(0, 0%, 100%)` | `#FFFFFF` | 팝오버 배경 |
| `--popover-foreground` | `hsl(215, 25%, 12%)` | `#171F2E` | 팝오버 텍스트 |
| `--radius` | `0.5rem` | — | 기본 둥글기 |

### Dark Mode 팔레트

| 변수 | HSL 값 | 용도 |
|------|--------|------|
| `--primary` | `hsl(198, 80%, 55%)` | Primary (밝게 조정) |
| `--primary-foreground` | `hsl(215, 25%, 8%)` | Primary 위 텍스트 |
| `--background` | `hsl(215, 28%, 7%)` | 다크 배경 |
| `--foreground` | `hsl(210, 15%, 92%)` | 기본 텍스트 |
| `--muted` | `hsl(215, 20%, 14%)` | 비활성 배경 |
| `--muted-foreground` | `hsl(215, 12%, 55%)` | 보조 텍스트 |
| `--border` | `hsl(215, 20%, 18%)` | 테두리 |
| `--card` | `hsl(215, 25%, 10%)` | 카드 배경 |

### 색상 사용 규칙
```
Primary (청록) → 주요 버튼, 링크, 활성 상태, 포커스 링
Accent (앰버)  → 무료 시작 CTA, 배지, 온보딩 강조
Muted          → 비활성 텍스트, 보조 정보, placeholder
Destructive    → 삭제, 오류, 경고
```

---

## 3. 타이포그래피

### 폰트 스택

| 용도 | 폰트 | 출처 | 이유 |
|------|------|------|------|
| **전체 (한/영)** | Pretendard | cdn.jsdelivr.net | 한국어 최적화 Variable Font, 가독성 최고 |
| **숫자/코드** | JetBrains Mono | Google Fonts | 통계·크레딧 숫자 가독성 |
| **폴백** | -apple-system, BlinkMacSystemFont, system-ui | — | 시스템 폰트 |

### 크기 체계 (Tailwind)

| 레벨 | 클래스 | 크기 | 용도 |
|------|--------|------|------|
| Display | `text-4xl font-bold` | 36px | 랜딩 히어로 제목 |
| H1 | `text-2xl font-semibold` | 24px | 페이지 제목 |
| H2 | `text-lg font-semibold` | 18px | 섹션 제목 |
| H3 | `text-base font-medium` | 16px | 카드 제목 |
| Body | `text-sm` | 14px | 기본 본문 |
| Caption | `text-xs text-muted-foreground` | 12px | 보조 설명 |

### 위계 원칙
- **최대 3단계**: Display/H1 → H2/H3 → Body
- **굵기**: semibold(600)은 제목만, medium(500)은 강조만, regular(400)은 본문
- **행간**: 제목 `leading-tight`, 본문 `leading-relaxed`

---

## 4. 레이아웃 시스템

### 기본 구조
```
최대 너비:    max-w-7xl (1280px), 랜딩은 max-w-screen-xl
사이드바:     w-60 (240px), border-r
콘텐츠 영역:  flex-1 overflow-auto
패딩:         px-6 py-6 (앱 내부), px-4 sm:px-6 lg:px-8 (랜딩)
```

### 그리드
| 용도 | 클래스 |
|------|--------|
| 통계 카드 (3열) | `grid grid-cols-1 sm:grid-cols-3 gap-4` |
| 기능 카드 (2열) | `grid grid-cols-1 md:grid-cols-2 gap-4` |
| 요금제 카드 (3열) | `grid grid-cols-1 md:grid-cols-3 gap-6` |
| 랜딩 기능 (3열) | `grid grid-cols-1 md:grid-cols-3 gap-8` |

### 간격 원칙
- **섹션 간격**: `space-y-6` (앱), `py-16 md:py-24` (랜딩)
- **카드 내부**: `p-5` 또는 `p-6`
- **폼 필드 간격**: `space-y-4`
- **아이콘 + 텍스트**: `gap-2`

---

## 5. 컴포넌트 커스텀 지침

### 버튼
```
Primary:   bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg
Accent:    bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg
Outline:   border border-input hover:bg-muted rounded-lg
Ghost:     hover:bg-muted rounded-lg
크기:      h-10 px-4 (default), h-9 px-3 (sm), h-11 px-6 (lg)
```

### 카드
```
기본:      border border-border rounded-xl bg-card shadow-sm
호버 카드: hover:shadow-md hover:border-primary/30 transition-all
통계 카드: p-5, 상단 아이콘(muted bg) + 수치 + 레이블
```

### 배지 (상태별)
```
완료:      bg-emerald-50 text-emerald-700 border-emerald-200
초안:      bg-amber-50 text-amber-700 border-amber-200
예약:      bg-blue-50 text-blue-700 border-blue-200
보관:      bg-muted text-muted-foreground
Beta:      bg-primary/10 text-primary
추천:      bg-accent/15 text-accent
```

### 사이드바
```
배경:      bg-background border-r
활성 메뉴: bg-primary/8 text-primary font-medium rounded-lg
호버:      hover:bg-muted rounded-lg
아이콘:    h-4 w-4 text-muted-foreground (비활성), text-primary (활성)
```

### 빈 상태 (Empty State)
```
레이아웃: flex flex-col items-center justify-center py-12 text-center
아이콘:   h-12 w-12 text-muted-foreground/40 mb-4
제목:     text-base font-medium text-foreground
설명:     text-sm text-muted-foreground mt-1
CTA:      mt-4 (Button)
```

---

## 6. globals.css CSS 변수

```css
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css');

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 215 25% 12%;
    --card: 0 0% 100%;
    --card-foreground: 215 25% 12%;
    --popover: 0 0% 100%;
    --popover-foreground: 215 25% 12%;
    --primary: 198 88% 38%;
    --primary-foreground: 0 0% 100%;
    --secondary: 200 20% 96%;
    --secondary-foreground: 215 25% 12%;
    --muted: 210 18% 95%;
    --muted-foreground: 215 15% 50%;
    --accent: 32 95% 54%;
    --accent-foreground: 0 0% 100%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: 210 20% 90%;
    --input: 210 20% 90%;
    --ring: 198 88% 38%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 215 28% 7%;
    --foreground: 210 15% 92%;
    --card: 215 25% 10%;
    --card-foreground: 210 15% 92%;
    --popover: 215 25% 10%;
    --popover-foreground: 210 15% 92%;
    --primary: 198 80% 55%;
    --primary-foreground: 215 25% 8%;
    --secondary: 215 20% 14%;
    --secondary-foreground: 210 15% 92%;
    --muted: 215 20% 14%;
    --muted-foreground: 215 12% 55%;
    --accent: 32 90% 58%;
    --accent-foreground: 215 25% 8%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;
    --border: 215 20% 18%;
    --input: 215 20% 18%;
    --ring: 198 80% 55%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-family: 'Pretendard Variable', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    font-feature-settings: 'kern' 1;
    -webkit-font-smoothing: antialiased;
  }
}
```

---

## 7. 디자인 원칙 요약

```
1. 여백이 곧 디자인이다   — 숨 쉬는 레이아웃, padding을 아끼지 말 것
2. 색은 의미로 쓴다       — Primary=행동, Accent=강조, Muted=보조
3. 보라색은 금지          — Mirra와의 차별화, AI 슬롭 회피
4. 한국어 가독성 우선     — Pretendard, line-height relaxed
5. 모션은 최소로          — transition-all duration-150, 과도한 애니메이션 금지
6. 다크모드 필수          — 라이트/다크 모두 설계
```

---

## 8. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-03-31 | 초안 작성 — Cyan Ocean 팔레트, Pretendard |
