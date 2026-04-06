# FlowPack 디자인 기본값

> ⚠️ **읽기 전용 — 가상 CTO 감시 대상**  
> `docs/design-direction.md` 기반 구현 레퍼런스  
> **확정일**: 2026-03-31 | **Phase 3**

---

## 1. 컴포넌트 임포트 기준

```typescript
// ✅ 순서: shadcn → Lucide → 내부
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Loader2 } from 'lucide-react';
import { StatCard } from '@/components/common/stat-card';
```

---

## 2. 버튼 사용 기준

| 상황 | variant | 예시 |
|------|---------|------|
| 주요 CTA (저장, 생성) | `default` (Primary) | "콘텐츠 생성", "저장" |
| 랜딩 무료 시작 CTA | `accent` (Amber) | "무료로 시작하기", "7일 무료 체험" |
| 보조 액션 | `outline` | "미리보기", "취소" |
| 아이콘 전용 버튼 | `ghost` + `size="icon"` | 삭제·편집 아이콘 |
| 삭제·위험 액션 | `destructive` | "계정 삭제", "영구 삭제" |

```typescript
// 로딩 상태 패턴
<Button disabled={isLoading}>
  {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
  {isLoading ? '생성 중...' : '콘텐츠 생성'}
</Button>
```

---

## 3. 아이콘 크기 기준

| 위치 | 크기 | Tailwind 클래스 |
|------|------|----------------|
| 인라인 텍스트 | 16px | `h-4 w-4` |
| 버튼 내부 | 16px | `h-4 w-4` |
| 사이드바 메뉴 | 16px | `h-4 w-4` |
| 통계 카드 아이콘 | 20px | `h-5 w-5` |
| 빈 상태(EmptyState) | 24~32px | `h-6 w-6` ~ `h-8 w-8` |
| 랜딩 기능 아이콘 | 24px | `h-6 w-6` |

---

## 4. 카드 패턴

```typescript
// 기본 카드
<Card>
  <CardHeader>
    <CardTitle>제목</CardTitle>
  </CardHeader>
  <CardContent>
    {/* 내용 */}
  </CardContent>
</Card>

// 통계 카드 → StatCard 컴포넌트 사용
<StatCard
  title="이번 달 생성"
  value={3}
  subtitle="/ 10건"
  trend={20}
  trendLabel="전월 대비"
  icon={<FileText className="h-5 w-5" />}
/>

// 호버 효과 카드
<Card className="cursor-pointer transition-shadow hover:shadow-md hover:border-primary/20">
```

---

## 5. 폼 패턴

```typescript
// React Hook Form + Zod
const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
  defaultValues: { title: '' },
});

// 필드 레이아웃
<div className="space-y-4">
  <div className="space-y-2">
    <Label htmlFor="title">제목</Label>
    <Input id="title" placeholder="제목 입력..." {...form.register('title')} />
    {form.formState.errors.title && (
      <p className="text-xs text-destructive">
        {form.formState.errors.title.message}
      </p>
    )}
  </div>
</div>
```

---

## 6. 빈 상태 패턴

```typescript
// EmptyState 컴포넌트 사용
<EmptyState
  icon={<FileText className="h-8 w-8" />}
  title="아직 콘텐츠가 없어요"
  description="AI로 첫 번째 홍보 콘텐츠를 만들어보세요. 주제만 입력하면 됩니다."
  action={{
    label: '첫 콘텐츠 만들기',
    onClick: () => router.push('/carousel-lab'),
  }}
/>
```

---

## 7. 로딩 상태 패턴

```typescript
// 스켈레톤 (목록)
{isLoading ? (
  <div className="space-y-3">
    {Array.from({ length: 3 }).map((_, i) => (
      <Skeleton key={i} className="h-20 w-full rounded-xl" />
    ))}
  </div>
) : (
  <ContentList items={data} />
)}

// 전체 페이지 로딩
<div className="flex h-64 items-center justify-center">
  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
</div>
```

---

## 8. 페이지 레이아웃 표준

```typescript
// 앱 내부 페이지 (app/(app)/*/page.tsx)
export default function SomePage() {
  return (
    <>
      <PageHeader
        title="페이지 제목"
        description="부제목 (선택)"
        actions={<Button>액션</Button>}
      />
      {/* 콘텐츠 영역 */}
    </>
  );
}

// 앱 레이아웃 래퍼
// app/(app)/layout.tsx
<AppLayout usage={usage} user={user}>
  {children}
</AppLayout>
```

---

## 9. 색상 사용 기준

| 요소 | 클래스 |
|------|--------|
| 주 강조색 (CTA, 링크) | `text-primary` / `bg-primary` |
| 보조 텍스트 | `text-muted-foreground` |
| 경계선 | `border-border` |
| 카드 배경 | `bg-card` |
| 섹션 배경 | `bg-muted` |
| 성공 | `text-emerald-600` / `bg-emerald-50` |
| 경고 | `text-amber-600` / `bg-amber-50` |
| 오류 | `text-destructive` / `bg-destructive/10` |

---

## 10. 반응형 기준

```
모바일:  < 768px   (md 미만) — 사이드바 숨김, 하단 탭 바
태블릿:  768~1024px (md~lg)  — 사이드바 축소(아이콘만)
데스크톱: > 1024px (lg+)     — 전체 사이드바
```

```typescript
// 반응형 그리드 예시
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```
