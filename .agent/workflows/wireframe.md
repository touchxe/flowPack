---
description: Phase 2 - 시각적 합의. shadcn 컴포넌트 기반 와이어프레임 생성 및 UI 스펙 작성.
---

# 🎨 Phase 2: 시각적 합의 — 와이어프레임 우선

## 트리거 조건
Phase 1(/interview) + Phase 1.5(/benchmark) 완료 후 실행.

## 디자인 기본값 (상시 적용)
모든 와이어프레임과 UI 스펙은 `docs/design-defaults.md`를 따른다:
- **컴포넌트**: shadcn/ui 우선 사용 (커스텀보다 항상 먼저)
- **아이콘**: Lucide React만 사용
- **스타일**: Tailwind CSS utility class
- **원칙**: 미니멀 — 여백으로 말하라

---

## 경로 A: 와이어프레임이 제공된 경우

### Step 1: 이미지 분석
이미지를 분석하여 추출:
- 화면 목록 및 네비게이션 흐름
- 컴포넌트 트리 (shadcn 컴포넌트에 매핑)
- 인터랙션 포인트, 데이터 바인딩 포인트

### Step 2: shadcn 매핑
추출된 UI 요소를 shadcn/ui 컴포넌트에 매핑하라:
- 모달 → `<Dialog>`
- 드롭다운 → `<Select>` 또는 `<DropdownMenu>`
- 알림 → `<Alert>` 또는 `<Toast>`
- 표 → `<Table>`
- 폼 → `<Input>` + `<Button>` + `<Label>`
- 탭 → `<Tabs>`
- 카드 → `<Card>`

### Step 3: UI 스펙 생성
`docs/ui-spec-[screen-name].md` 형식으로 저장.

### Step 4: 누락 요소 제안
와이어프레임에 없지만 UX상 필요한 요소를 `[🆕 UI 제안]`으로 표시. 사용자 승인 후에만 반영.

---

## 경로 B: 와이어프레임이 없는 경우 (자동 생성)

### Step 1: 요구사항 + 벤치마킹 분석
- `docs/requirements-*.md` + `docs/prd.md`에서 사용자 작업 추출
- `docs/benchmarking/benchmark-report.md`에서 참조 사이트맵 참조
- `docs/sitemap.md`에서 확정된 페이지 목록 확인

### Step 2: 화면 목록 도출 (사이트맵 기반)
```
## 자동 도출 화면 목록
1. [AUTH] 로그인 / 회원가입
2. [LANDING] 랜딩 페이지 (비로그인)
3. [DASH] 메인 대시보드
4. [LIST] 데이터 목록
5. [DETAIL] 상세 보기
6. [FORM] 생성/수정 폼
7. [SETTINGS] 설정
```

### Step 3: shadcn 기반 ASCII 와이어프레임 자동 생성
각 화면에 대해 shadcn 컴포넌트명과 Lucide 아이콘을 직접 사용한 ASCII 와이어프레임을 생성하라.

예시:
```
┌─────────────────────────────────────────────┐
│ [icon:Menu] Logo    [Input:검색] [Avatar]    │ ← 헤더
├────────────┬────────────────────────────────┤
│ [Button]   │  grid grid-cols-3 gap-4        │
│  대시보드  │  ┌─[Card]───┐ ┌─[Card]───┐    │
│ [Button]   │  │[Badge]   │ │[Badge]   │    │
│  콘텐츠   │  │ 총 콘텐츠 │ │ 발행됨  │    │
└────────────┴────────────────────────────────┘
```

### Step 4: 사용자 확인 및 수정
1. `docs/wireframes/auto-[screen-name].md`에 저장
2. 화면별로 사용자 확인 요청
3. 피드백 반영 → 최종 확인 후 UI 스펙 생성

### Step 5: UI 제안 목록 작성
```
## 🆕 UI 제안 (사용자 승인 필요)
| # | 제안 요소 | shadcn 컴포넌트 | 위치 | 사유 | 상태 |
|---|----------|----------------|------|------|------|
| 1 | 로딩 스켈레톤 | Skeleton | 카드/테이블 | 데이터 로딩 UX | ⏳ |
| 2 | 에러 알림 | Toast (sonner) | 전역 | 네트워크 에러 피드백 | ⏳ |
```

---

## UI 스펙 문서 형식
`docs/ui-spec-[screen-name].md` 형식:
```
# UI 스펙: [화면명]

## 메타 정보
- 화면 ID: SCR-001
- 관련 요구사항: REQ-001
- 벤치마킹 참조: [사이트명] — [참조 요소]

## shadcn 컴포넌트 사용 목록
| 컴포넌트 | 용도 | 커스텀 여부 |

## Lucide 아이콘 사용 목록
| 아이콘 | 위치 | 용도 |

## 레이아웃 (Tailwind 명세)
## 상태(State) 목록
## API 연동
## 🆕 UI 제안 (사용자 승인 필요)
```

## 금지 사항
- shadcn에 있는 컴포넌트를 직접 구현하지 마라.
- Lucide에 없는 아이콘을 다른 라이브러리에서 가져오지 마라.
- 사용자 확인 없이 자동 생성 와이어프레임을 확정하지 마라.
- 승인 안 된 UI 제안을 구현하지 마라.

## 완료 조건
- [ ] 모든 화면의 와이어프레임 존재 (shadcn 컴포넌트 매핑 완료)
- [ ] 모든 화면의 UI 스펙 작성 완료
- [ ] 사용자 승인 완료
- [ ] UI 제안 승인/거부 처리 완료
- [ ] 네비게이션 흐름도 확정

완료 후 `/work-log`로 `logs/phase-2-wireframe.md` 작성. 다음: `/design-direction`
