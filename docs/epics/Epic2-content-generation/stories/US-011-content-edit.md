# US-011: 생성된 글 직접 편집

> **Story ID**: US-011
> **Epic**: Epic 2: 콘텐츠 생성
> **우선순위**: P0
> **작성일**: 2026-03-31
> **Phase**: Phase 5

---

## 개요

생성된 카드뉴스나 블로그 포스트를 사용자가 직접 편집할 수 있다.

---

## 사용자 스토리

> **As a** 홍보 담당자
> **I want to** AI가 생성한 콘텐츠를 직접 수정
> **So that** 내 브랜드에 맞게 조정할 수 있다

---

## acceptance criteria

### 카드뉴스 편집

- [ ] 카드뉴스 상세 페이지에서 "편집" 버튼
- [ ] 슬라이드 클릭 시 해당 슬라이드 편집 모드
- [ ] 제목, 본문 텍스트 수정 가능
- [ ] 이미지 변경/삭제 가능
- [ ] 슬라이드 추가/삭제/순서 변경
- [ ] 변경 사항 저장 버튼

### 블로그 편집

- [ ] 블로그 상세 페이지에서 "편집" 버튼
- [ ] 마크다운 에디터 표시
- [ ] 실시간 미리보기
- [ ] 본문, 태그 수정 가능
- [ ] 저장/취소 버튼

### 공통

- [ ] 저장 시 PUT /api/content/:id 호출
- [ ] 변경 이력 추적 (updatedAt 자동 갱신)
- [ ] 저장 완료 토스트 메시지

---

## 구현 참고사항

### 슬라이드 순서 변경 (Drag & Drop)

```typescript
// components/features/carousel/slide-editor.tsx
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

function SlideEditor({ slides, onChange }: SlideEditorProps) {
  const onDragEnd = (result: DropResult) => {
    const newSlides = Array.from(slides);
    const [removed] = newSlides.splice(result.source.index, 1);
    newSlides.splice(result.destination.index, 0, removed);
    onChange(newSlides);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="slides">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            {slides.map((slide, index) => (
              <Draggable key={slide.id} draggableId={slide.id} index={index}>
                {(provided) => <SlideItem ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} />}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
```

### 마크다운 에디터

```typescript
// components/features/blog/markdown-editor.tsx
import { useMarkdownEditor } from "@/hooks/use-markdown-editor";
import { MarkdownPreview } from "@/components/ui/markdown-preview";

function BlogEditor({ content, onChange }: BlogEditorProps) {
  const { textareaRef } = useMarkdownEditor();

  return (
    <div className="grid grid-cols-2 gap-4">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-sm"
      />
      <MarkdownPreview content={content} />
    </div>
  );
}
```

---

## 테스트 시나리오 (BDD)

자세한 테스트 시나리오는 `docs/bdd/Epic2-content-generation.md` 참조:

- `Scenario: 사용자가 생성된 카드뉴스의 슬라이드 내용을 수정한다`
- `Scenario: 사용자가 카드뉴스에 슬라이드를 추가한다`
- `Scenario: 사용자가 생성된 블로그 포스트의 본문을 수정한다`

---

## 의존성

- `@hello-pangea/dnd` (Drag and Drop)
- `react-markdown` (마크다운 렌더링)

---

## 추정 시간

**Story Point**: 5

**세부 추정**:
- 슬라이드 편집 UI: 3h
- 블로그 마크다운 에디터: 2h
- API 연결: 1h
- Drag & Drop: 1.5h
- 테스트: 1h
