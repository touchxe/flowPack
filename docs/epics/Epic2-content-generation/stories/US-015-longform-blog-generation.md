# US-015: 장문 블로그 생성

> **Story ID**: US-015
> **Epic**: Epic 2: 콘텐츠 생성
> **우선순위**: P0
> **작성일**: 2026-03-31
> **Phase**: Phase 5

---

## 개요

사용자가 주제, 키워드, 길이를指定하여 SEO에 최적화된 장문 블로그 포스트를 생성한다.

---

## 사용자 스토리

> **As a** 홍보 담당자
> **I want to** 블로그 포스트를 자동으로 생성
> **So that** SEO에 최적화된 긴 글을 빠르게 작성

---

## acceptance criteria

### 파라미터 입력

- [ ] `/ai/longform` 페이지
- [ ] 주제 입력 (필수)
- [ ] 키워드 입력 (복수,쉼표分隔)
- [ ] 길이 선택 (short/medium/long)
- [ ] 톤 선택
- [ ] 업종 선택

### 생성 및 표시

- [ ] SSE 스트리밍으로 텍스트 실시간 표시
- [ ] 마크다운 형식으로 렌더링
- [ ] 생성 완료 시 글자 수 표시
- [ ] Content 레코드 저장 (type: BLOG)

### 취소 처리

- [ ] 생성 중 "취소" 버튼
- [ ] SSE 연결 중단
- [ ] 부분 생성 콘텐츠 초안 저장

---

## 구현 참고사항

### 블로그 생성 프롬프트

```typescript
const systemPrompt = `당신은 전문 블로그 콘텐츠 작가입니다.
다음 지침에 따라 SEO에 최적화된 블로그 포스트를 작성해주세요:

1. 도입부: 독자의 문제를 지적하고 해결책 제시
2. 본론: 3~5개의 소제목으로 구성
3. 결론: 행동 유도 (CTA)
4. 각 소제목에 키워드 자연스럽게 포함
5. 마크다운 형식으로 작성`;

const userPrompt = `
주제: ${topic}
키워드: ${keywords.join(", ")}
길이: ${length} (short=500단어, medium=1000단어, long=1500단어)
톤: ${tone}
업종: ${industry || "일반"}
`;
```

---

## 테스트 시나리오 (BDD)

자세한 테스트 시나리오는 `docs/bdd/Epic2-content-generation.md` 참조:

- `Scenario: 사용자가 긴 형식의 블로그 포스트를 생성한다`
- `Scenario: 생성 중 사용자가 취소를 클릭한다`

---

## 추정 시간

**Story Point**: 5 (US-010과 구조 유사)

참조: [US-010-ai-content-generation.md](./US-010-ai-content-generation.md)
