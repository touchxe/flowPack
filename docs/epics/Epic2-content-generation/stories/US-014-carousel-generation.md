# US-014: 카드뉴스(Carousel) 생성

> **Story ID**: US-014
> **Epic**: Epic 2: 콘텐츠 생성
> **우선순위**: P0
> **작성일**: 2026-03-31
> **Phase**: Phase 5 (US-010과 통합)

---

## 개요

US-010의 일부분으로, 카드뉴스 형식의 콘텐츠 생성에 특화된 기능.

---

## acceptance criteria

### 슬라이드 생성

- [ ] 슬라이드 수 指定 (3~10, 기본 5)
- [ ] 각 슬라이드: 제목, 본문, 이미지 프롬프트
- [ ] 슬라이드 순서 자동 번호 매기기

### 내보내기

- [ ] PNG 내보내기 버튼
- [ ] 모든 슬라이드 결합 후 다운로드
- [ ] 개별 슬라이드 다운로드

---

## 구현 참고사항

### PNG 결합 및 다운로드

```typescript
// lib/carousel-export.ts
import html2canvas from "html2canvas";

export async function exportCarouselAsPng(slideElements: HTMLElement[]) {
  const images: string[] = [];

  for (const slide of slideElements) {
    const canvas = await html2canvas(slide, { scale: 2 });
    images.push(canvas.toDataURL("image/png"));
  }

  // PDF로 결합 (pdf-lib 사용)
  const { PDFDocument } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.create();

  for (const imgData of images) {
    const img = await pdfDoc.embedPng(imgData);
    const page = pdfDoc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0 });
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}
```

---

## 의존성

- `html2canvas`
- `pdf-lib`

---

## 추정 시간

**Story Point**: 포함 (US-010)

참조: [US-010-ai-content-generation.md](./US-010-ai-content-generation.md)
