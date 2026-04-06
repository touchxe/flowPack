# 와이어프레임: 공통 레이아웃 (사이드바 + 상단바)
> SCR-000 | 공통 | 자동생성 | 2026-03-31

---

## 앱 레이아웃 (회원 영역 전체 적용)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [TOP BAR — h-14 border-b]                                                │
│  [icon:Zap] FlowPack    [Badge: 무료체험 D-N]   flex-1   [icon:Bell]     │
│                                                          [Avatar: 유저]  │
│                                                          └─[DropdownMenu]│
│                                                            프로필         │
│                                                            설정           │
│                                                            요금제 업그레이드│
│                                                            로그아웃       │
├──────────────────────────────────────────────────────────────────────────┤
│ [LEFT SIDEBAR — w-60 border-r flex-col]                                  │
│                                                                          │
│  ┌─[워크스페이스 선택]──────────────────────────────┐                   │
│  │ [icon:Building2] Personal Workspace  [icon:ChevronDown]│             │
│  └──────────────────────────────────────────────────┘                   │
│                                                                          │
│  ── 콘텐츠 제작 ───────────────────────────────────                     │
│  [Collapsible: AI로 콘텐츠 제작  [icon:ChevronDown]]                    │
│  │  [icon:LayoutGrid]  카드뉴스 생성    [Badge: 추천]                   │
│  │  [icon:Video]       영상 생성        [Badge: Beta]                   │
│  │  [icon:FileText]    블로그 생성                                       │
│  │  [icon:Link]        URL → 콘텐츠                                     │
│  │  [icon:ListChecks]  대량 기획                                         │
│                                                                          │
│  [icon:Sparkles]  AI 스타일 수정                                         │
│                                                                          │
│  ── 관리 ─────────────────────────────────────────                      │
│  [icon:Calendar]  콘텐츠 관리                                            │
│  [icon:Share2]    SNS 계정 연동                                           │
│  [icon:BarChart3] 통계                                                   │
│                                                                          │
│  ── flex-1 (spacer) ───────────────────────────────                     │
│                                                                          │
│  ─────────────────────────────────────────────────                      │
│  [Button: SNS 계정 연동하기]  ← 미연동 시만 표시                          │
│  [Button(ghost): 친구 초대하고 할인받기]                                  │
│                                                                          │
│  [icon:Settings]  설정                                                   │
│  [icon:CreditCard] 요금제                                                │
│                                                                          │
│  ─────────────────────────────────────────────────                      │
│  [Badge: free] 잔여 크레딧: N건                                           │
│  [Progress: N/10]                                                        │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 모바일 레이아웃 (md 이하)

```
┌────────────────────────────────────┐
│ [icon:Menu]  [icon:Zap] FlowPack   │  ← Top Bar
│              [icon:Bell] [Avatar]  │
├────────────────────────────────────┤
│                                    │
│       [Main Content]               │
│                                    │
│                                    │
├────────────────────────────────────┤
│ [icon:  ] [icon:   ] [icon:  ] [+]│  ← Bottom Nav
│ 홈       콘텐츠     관리       생성 │
└────────────────────────────────────┘

사이드바 → [Sheet] (왼쪽에서 슬라이드)
```

## shadcn 컴포넌트 목록
| 컴포넌트 | 용도 |
|---------|------|
| Sheet | 모바일 사이드바 |
| DropdownMenu | 상단 아바타 메뉴 |
| Collapsible | 콘텐츠 제작 메뉴 그룹 |
| Badge | 플랜, 추천, Beta 표시 |
| Progress | 크레딧 잔여량 |
| Button | SNS 연동, 친구 초대 |
| Avatar | 사용자 프로필 |
| Separator | 섹션 구분선 |

## Lucide 아이콘 목록
| 아이콘 | 위치 |
|--------|------|
| Zap | 로고 |
| Bell | 알림 |
| Building2 | 워크스페이스 |
| ChevronDown | 드롭다운 |
| LayoutGrid | 카드뉴스 |
| Video | 영상 |
| FileText | 블로그 |
| Link | URL→콘텐츠 |
| ListChecks | 대량 기획 |
| Sparkles | AI 스타일 |
| Calendar | 캘린더 |
| Share2 | SNS 연동 |
| BarChart3 | 통계 |
| Settings | 설정 |
| CreditCard | 요금제 |
| Menu | 모바일 햄버거 |

## 레이아웃 (Tailwind)
- 전체: `flex h-screen overflow-hidden`
- 사이드바: `hidden md:flex w-60 flex-col border-r bg-background`
- 메인 래퍼: `flex-1 flex flex-col overflow-hidden`
- 탑바: `h-14 border-b flex items-center px-4`
- 콘텐츠: `flex-1 overflow-auto p-6`
