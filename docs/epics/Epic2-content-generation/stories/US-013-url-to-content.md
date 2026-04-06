# US-013: URL을 입력해 콘텐츠 변환

> **Story ID**: US-013
> **Epic**: Epic 2: 콘텐츠 생성
> **우선순위**: P1
> **작성일**: 2026-03-31
> **Phase**: Phase 5

---

## 개요

사용자가 URL을 입력하면 해당 페이지의 콘텐츠를 AI가 분석하여 카드뉴스나 블로그로 변환한다.

---

## 사용자 스토리

> **As a** 홍보 담당자
> **I want to** 웹페이지 URL을 입력하면 AI가 콘텐츠를 변환
> **So that** 기존 웹 콘텐츠를 쉽게 재활용

---

## acceptance criteria

### URL 입력

- [ ] `/ai/bulk-link-to-post` 페이지
- [ ] URL 입력 필드
- [ ] 유효한 URL 형식 검증
- [ ] "변환하기" 버튼

### 콘텐츠 분석 및 변환

- [ ] URL 콘텐츠 fetch (서버 사이드)
- [ ] OpenAI로 콘텐츠 추출 및 변환
- [ ] 카드뉴스 미리보기 생성
- [ ] 원본 URL 정보 표시

### 에러 처리

- [ ] 유효하지 않은 URL 입력 시 에러
- [ ] 접근 불가능한 URL 시 에러
- [ ] 변환 실패 시 안내 메시지

---

## 구현 참고사항

### URL 콘텐츠 Fetch

```typescript
// server/services/url-content-service.ts
export async function fetchUrlContent(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "FlowPack Content Analyzer/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    // HTML 파싱 및 텍스트 추출
    const { content, title, description } = await extractContent(html);

    return { content, title, description };
  } catch (error) {
    throw new Error("URL에 접근할 수 없습니다");
  }
}
```

### OpenAI로 변환

```typescript
// app/api/generate/url-to-content/route.ts
const completion = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    {
      role: "system",
      content: "당신은 콘텐츠 변환 전문가입니다. 입력된 웹페이지 내용을 분석하여 카드뉴스 형식으로 변환해주세요.",
    },
    {
      role: "user",
      content: `다음 웹페이지 내용을 카드뉴스로 변환해주세요.\n\nURL: ${url}\n제목: ${title}\n내용: ${content}`,
    },
  ],
});
```

---

## 테스트 시나리오 (BDD)

자세한 테스트 시나리오는 `docs/bdd/Epic2-content-generation.md` 참조:

- `Scenario: 사용자가 유효한 URL을 입력하여 콘텐츠를 생성한다`
- `Scenario: 유효하지 않은 URL 입력`

---

## 의존성

- `openai`
- `cheerio` (HTML 파싱)

---

## 추정 시간

**Story Point**: 3

**세부 추정**:
- URL Fetch + HTML 파싱: 1.5h
- OpenAI 변환 로직: 1.5h
- UI: 1h
- 테스트: 1h
