# UI 디자인 기본값 — 전 페이지/요소 적용 (읽기 전용)

> ⚠️ 이 파일은 가상 CTO 감시 대상입니다.

## 기본 스택
- **CSS**: Tailwind CSS 4.x
- **컴포넌트**: shadcn/ui (최우선 사용)
- **아이콘**: Lucide React (유일한 아이콘 소스)

## 미니멀 원칙
1. **shadcn 우선**: shadcn/ui에 있으면 반드시 사용. 커스텀보다 항상 먼저.
2. **여백으로 말하라**: 요소 간 충분한 간격. 빽빽한 레이아웃 금지.
3. **색상 절제**: Primary 1개 + Neutral 그레이. 강조색 3개 이상 금지.
4. **타이포 위계**: 최대 3단계 (h1/h2/body).
5. **장식 최소화**: 불필요한 그라데이션, 그림자, 보더 남용 금지.

## 컴포넌트 의사결정 트리
```
1️⃣ shadcn/ui에 있는가? → YES → 사용 (커스텀 금지)
2️⃣ shadcn 조합으로 가능? → YES → components/ui/에 배치
3️⃣ Tailwind만으로 가능? → YES → utility class
4️⃣ 커스텀 필요 → components/[feature]/에, Tailwind 필수
```

## 아이콘 규칙
- Lucide React만 사용. 다른 아이콘 라이브러리 설치 금지.
- 기본 크기: 16px(인라인), 20px(버튼 내), 24px(강조)
- SVG 직접 삽입 금지.

## 금지 사항
| 금지 | 대안 |
|------|------|
| CSS Modules | Tailwind utility |
| styled-components | Tailwind utility |
| Heroicons / FontAwesome | Lucide React |
| 커스텀 모달 | shadcn Dialog |
| 커스텀 드롭다운 | shadcn Select / DropdownMenu |
| 커스텀 토스트 | shadcn Toast (sonner) |
| 인라인 style={{ }} | Tailwind className |
