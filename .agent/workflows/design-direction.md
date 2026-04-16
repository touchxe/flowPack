---
description: Phase 2.5 - 디자인 방향 확정. 색상, 타이포, 레이아웃, 컴포넌트 스타일을 사전 정의.
---

# 🎨 Phase 2.5: 디자인 방향 설정

## 트리거
Phase 2(/wireframe) 완료 후, 실제 구현 전.

## Step 1: 디자인 키워드 도출
- **무드 키워드** 3~5개 (예: "모던", "미니멀", "신뢰감")
- **안티 키워드** (예: "유치한", "복잡한", "촌스러운")

## Step 2: 디자인 시스템 확정 → `docs/design-direction.md`
```markdown
# 디자인 방향
## 무드 / 색상 / 타이포그래피 / 레이아웃 / 컴포넌트 커스텀
- Primary: hsl(XXX, XX%, XX%) — [사유]
- 헤딩 폰트: [폰트명]
- 사이드바: w-60 (240px), 모바일에서 Sheet
```

## Step 3: shadcn 테마 설정
`app/globals.css`의 CSS 변수를 design-direction.md 기반으로 업데이트:
```css
@layer base {
  :root { --primary: [HSL값]; --primary-foreground: [HSL값]; }
  .dark { --primary: [HSL값]; }
}
```

## Step 4: 사용자 승인
승인 후 `docs/design-direction.md`는 `/architecture-guard` 감시 대상(읽기 전용)에 추가.

## Step 5: 작업 로그
`/work-log`로 `logs/phase-2.5-design-direction.md` 작성.

## 금지 사항
- 디자인 방향 없이 UI 구현을 시작하지 마라.
- shadcn 기본 테마를 무수정으로 사용하지 마라 (/evaluate 독창성 기준 FAIL).
