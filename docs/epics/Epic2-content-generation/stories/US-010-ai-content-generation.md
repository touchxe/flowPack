# US-010: AI 홍보글 생성

> **Story ID**: US-010
> **Epic**: Epic 2: 콘텐츠 생성
> **우선순위**: P0
> **작성일**: 2026-03-31
> **Phase**: Phase 5

---

## 개요

사용자가 업종, 톤, 스타일, 길이를 선택하여 AI 홍보글을 생성한다.

---

## 사용자 스토리

> **As a** 홍보 담당자
> **I want to** 주제와 원하는 스타일을 입력하여 AI가 홍보글을 생성
> **So that** 빠르게 다양한 홍보 콘텐츠를 만들 수 있다

---

## acceptance criteria

### 파라미터 선택

- [ ] `/carousel-lab` 페이지에 업종 선택 드롭다운
- [ ] 톤 선택 (formal/casual/friendly)
- [ ] 스타일 선택 (informative/promotional)
- [ ] 길이 선택 (슬라이드 수: 3~10)
- [ ] 주제 입력 텍스트 필드 (필수)
- [ ] 모든 필수 필드 Validation

### AI 생성 요청

- [ ] "생성하기" 버튼 클릭 시 로딩 상태 표시
- [ ] SSE 스트리밍으로 진행 메시지 표시
- [ ] 크레딧 잔액 확인 후 차감
- [ ] 크레딧 부족 시 게이팅 모달 표시

### 생성 완료

- [ ] 생성된 카드뉴스 미리보기 표시
- [ ] Content 레코드 생성 (status: DRAFT)
- [ ] slides JSON 필드에 슬라이드 데이터 저장
- [ ] "임시 저장" 메시지 표시
- [ ] /carousel-lab 페이지에 결과 표시

### 엣지 케이스

- [ ] API 타임아웃 시 재시도 (3회)
- [ ] 실패 시 크레딧 미차감
- [ ] 빈 슬라이드 생성 시 재생성 안내

---

## 구현 참고사항

### API Route (app/api/generate/carousel/route.ts)

```typescript
import { auth } from "@/lib/auth";
import { z } from "zod";
import { openai } from "@/lib/openai";

const schema = z.object({
  topic: z.string().min(1, "주제를 입력해주세요"),
  industry: z.string().optional(),
  tone: z.enum(["formal", "casual", "friendly"]).optional(),
  style: z.string().optional(),
  slideCount: z.number().min(3).max(10).default(5),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const { topic, industry, tone, style, slideCount } = schema.parse(body);

  // 크레딧 확인
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if ((user.creditsTotal - user.creditsUsed) < 1) {
    return Response.json({ error: "CREDIT_EXHAUSTED" }, { status: 402 });
  }

  // SSE 스트리밍으로 OpenAI 호출
  const stream = new ReadableStream();
  const writer = stream.getWriter();
  const encoder = new TextEncoder();

  // OpenAI API 호출 및 SSE 응답
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `당신은 전문 홍보 콘텐츠 작성자입니다. 
주제: ${topic}
업종: ${industry || "일반"}
톤: ${tone || "친근한"}
스타일: ${style || "홍보성"}
슬라이드 수: ${slideCount}`,
      },
      {
        role: "user",
        content: `위 정보로 카드뉴스 슬라이드를 JSON으로 생성해주세요.
        
응답 형식:
{
  "slides": [
    { "index": 0, "title": "제목", "body": "내용", "imagePrompt": "DALL-E용 이미지 프롬프트" },
    ...
  ]
}`,
      },
    ],
    stream: true,
  });

  // SSE 응답 처리
  for await (const chunk of completion) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: "chunk", content })}\n\n`));
    }
  }

  // 최종 결과 DB 저장
  const content = await prisma.content.create({
    data: {
      userId: session.user.id,
      title: topic,
      type: "CAROUSEL",
      slides: slidesData,
      status: "DRAFT",
    },
  });

  // 크레딧 차감
  await prisma.user.update({
    where: { id: session.user.id },
    data: { creditsUsed: { increment: 1 } },
  });

  await writer.write(encoder.encode(`data: ${JSON.stringify({ type: "done", contentId: content.id })}\n\n`));
  await writer.close();

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}
```

### OpenAI 클라이언트 (lib/openai.ts)

```typescript
import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});
```

---

## 테스트 시나리오 (BDD)

자세한 테스트 시나리오는 `docs/bdd/Epic2-content-generation.md` 참조:

- `Scenario: 사용자가 모든 필수 파라미터를 선택하여 콘텐츠를 생성한다`
- `Scenario: 필수 파라미터가 누락된 상태로 생성 시도`
- `Scenario: 크레딧이 모두 소진된 경우`
- `Scenario: AI 생성 API 타임아웃`

---

## 환경 변수

```bash
# .env.local
OPENAI_API_KEY=your_openai_api_key
```

---

## 의존성

- `openai` (`npm i openai`)

---

## 추정 시간

**Story Point**: 8

**세부 추정**:
- API Route + Zod 스키마: 2h
- SSE 스트리밍 구현: 2h
- OpenAI 프롬프트 설계 + 최적화: 2h
- 크레딧 로직: 1h
- 프론트엔드 UI: 2h
- 테스트 + 디버깅: 3h
