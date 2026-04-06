# US-012: AI 이미지 생성

> **Story ID**: US-012
> **Epic**: Epic 2: 콘텐츠 생성
> **우선순위**: P1
> **작성일**: 2026-03-31
> **Phase**: Phase 5

---

## 개요

사용자가 콘텐츠에 사용할 이미지를 AI(DALL-E 3)로 생성한다.

---

## 사용자 스토리

> **As a** 홍보 담당자
> **I want to** 원하는 이미지를 AI로 생성
> **So that**版权 문제 없이 콘텐츠에 사용할 이미지를 확보

---

## acceptance criteria

### 이미지 생성

- [ ] 슬라이드 편집 시 "AI 이미지 생성" 버튼
- [ ] 클릭 시 이미지 생성 팝업/모달 표시
- [ ] 프롬프트 입력 필드
- [ ] 스타일 선택 (realistic/illustration/minimal)
- [ ] 화면 비율 선택 (1:1/4:3/16:9)
- [ ] "생성" 버튼 클릭

### 이미지 처리

- [ ] 로딩 상태 표시 (생성까지 최대 30초)
- [ ] DALL-E 3 API 호출
- [ ] 생성된 이미지 미리보기
- [ ] "적용" / "다시 생성" / "취소" 버튼
- [ ] 적용 시 ContentImage 레코드 생성
- [ ] Supabase Storage에 이미지 저장

### 에러 처리

- [ ] API 실패 시 에러 메시지
- [ ] 크레딧 미차감 처리
- [ ] 재시도 옵션

---

## 구현 참고사항

### DALL-E API 호출 (lib/openai.ts)

```typescript
export async function generateImage(params: {
  prompt: string;
  style?: "natural" | "vivid";
  size?: "1024x1024" | "1792x1024" | "1024x1792";
}) {
  const { prompt, style = "natural", size = "1024x1024" } = params;

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    style,
    size,
    quality: "standard",
    n: 1,
  });

  return {
    url: response.data[0].url!,
    revisedPrompt: response.data[0].revised_prompt,
  };
}
```

### Supabase Storage 업로드

```typescript
// server/services/storage-service.ts
import { supabaseAdmin } from "@/lib/supabase";

export async function uploadImage(contentId: string, imageUrl: string) {
  // DALL-E URL에서 이미지 다운로드
  const response = await fetch(imageUrl);
  const buffer = await response.arrayBuffer();

  // Supabase Storage에 업로드
  const fileName = `${contentId}/${Date.now()}.png`;
  const { data, error } = await supabaseAdmin.storage
    .from("content-images")
    .upload(fileName, buffer, { contentType: "image/png" });

  // Public URL 획득
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from("content-images")
    .getPublicUrl(fileName);

  return publicUrl;
}
```

---

## 테스트 시나리오 (BDD)

자세한 테스트 시나리오는 `docs/bdd/Epic2-content-generation.md` 참조:

- `Scenario: 사용자가 카드뉴스에 사용할 이미지를 생성한다`
- `Scenario: 이미지 생성 중 오류 발생`

---

## 환경 변수

```bash
# .env.local
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## 의존성

- `openai` (DALL-E 3)
- `@supabase/supabase-js`

---

## 추정 시간

**Story Point**: 3

**세부 추정**:
- DALL-E API 연동: 1h
- Supabase Storage 업로드: 1.5h
- UI (팝업/미리보기): 1.5h
- 테스트: 1h
