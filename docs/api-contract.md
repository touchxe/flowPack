# FlowPack API 계약

> ⚠️ **읽기 전용 — 가상 CTO 감시 대상**  
> 변경 시 `docs/change-proposals/` 에 제안서 작성 → 사용자 승인 필수  
> **확정일**: 2026-03-31 | **Phase 3**  
> Base URL: `/api` | 인증: Bearer JWT (Auth.js 세션 쿠키)

---

## 공통 규칙

### 응답 포맷
```typescript
// 성공
{ "success": true, "data": T }

// 실패
{ "success": false, "error": "에러 메시지", "code": "ERROR_CODE" }
```

### 공통 에러 코드
| 코드 | HTTP | 설명 |
|------|------|------|
| `UNAUTHORIZED` | 401 | 인증 필요 |
| `FORBIDDEN` | 403 | 권한 없음 |
| `NOT_FOUND` | 404 | 리소스 없음 |
| `VALIDATION_ERROR` | 422 | 입력값 오류 (Zod) |
| `CREDIT_EXHAUSTED` | 402 | 크레딧 소진 |
| `RATE_LIMIT` | 429 | 요청 한도 초과 |
| `INTERNAL_ERROR` | 500 | 서버 오류 |

---

## 1. 인증 (Auth.js 위임)

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET/POST | `/api/auth/[...nextauth]` | Auth.js 핸들러 (소셜/이메일) |

---

## 2. 콘텐츠 CRUD

### `GET /api/content`
콘텐츠 목록 조회 (본인 것만)

**Query Params**
```
type?:   ContentType
status?: ContentStatus
page?:   number (default 1)
limit?:  number (default 20, max 100)
```

**Response 200**
```typescript
{
  success: true,
  data: {
    items: ContentItem[],
    total: number,
    page: number,
    totalPages: number
  }
}
```

---

### `POST /api/content`
새 콘텐츠 저장 (초안)

**Request Body**
```typescript
{
  title:       string,        // 필수
  type:        ContentType,   // 필수
  body?:       string,        // 블로그 본문
  slides?:     SlideItem[],   // 카드뉴스 슬라이드
  thumbnailUrl?: string,
  tone?:       string,
  style?:      string
}
```

**Response 201**
```typescript
{ success: true, data: ContentItem }
```

---

### `GET /api/content/:id`
단건 조회

**Response 200**
```typescript
{ success: true, data: ContentItem }
```

---

### `PUT /api/content/:id`
콘텐츠 수정

**Request Body** — POST와 동일 (부분 업데이트 허용)

**Response 200**
```typescript
{ success: true, data: ContentItem }
```

---

### `DELETE /api/content/:id`
소프트 삭제 (status → ARCHIVED)

**Response 200**
```typescript
{ success: true, data: { id: string } }
```

---

## 3. AI 생성

### `POST /api/generate/carousel`
카드뉴스 AI 생성 (스트리밍)

**Request Body**
```typescript
{
  topic:       string,   // 주제 (필수)
  industry?:   string,   // 업종
  tone?:       string,   // formal | casual | friendly
  slideCount?: number,   // 슬라이드 수 (default 5, max 10)
  style?:      string    // 디자인 스타일
}
```

**Response 200** — SSE (Server-Sent Events)
```
data: {"type":"progress","message":"주제 분석 중..."}
data: {"type":"slide","index":0,"content":{...}}
data: {"type":"done","contentId":"cuid"}
```

**에러 시**: `CREDIT_EXHAUSTED` | `VALIDATION_ERROR`

---

### `POST /api/generate/blog`
장문 블로그 AI 생성 (스트리밍)

**Request Body**
```typescript
{
  topic:     string,   // 필수
  keywords?: string[],
  length?:   "short" | "medium" | "long",  // default medium
  tone?:     string,
  industry?: string
}
```

**Response 200** — SSE
```
data: {"type":"chunk","content":"..."}
data: {"type":"done","contentId":"cuid"}
```

---

### `POST /api/generate/image`
AI 이미지 생성

**Request Body**
```typescript
{
  contentId:   string,  // 연결할 콘텐츠 ID
  prompt:      string,  // 이미지 설명
  style?:      string,  // realistic | illustration | minimal
  aspectRatio?: "1:1" | "4:3" | "16:9"
}
```

**Response 200**
```typescript
{ success: true, data: { url: string, altText: string } }
```

---

## 4. 배포

### `POST /api/publish`
콘텐츠 배포

**Request Body**
```typescript
{
  contentId:         string,
  socialAccountIds:  string[],  // 배포할 SNS 계정 ID 목록
  scheduledAt?:      string     // ISO 8601 (없으면 즉시 배포)
}
```

**Response 200**
```typescript
{
  success: true,
  data: {
    results: Array<{
      socialAccountId: string,
      platform: SocialPlatform,
      status: "queued" | "success" | "failed",
      errorMessage?: string
    }>
  }
}
```

---

## 5. 공개 콘텐츠 검토

### `POST /api/content/:id/share`
콘텐츠 공개 보기 링크 생성 또는 기존 링크 조회

> 인증: 콘텐츠 소유자만 가능

**Response 200**
```typescript
{
  success: true,
  data: {
    shareToken: string,
    shareUrl: string
  }
}
```

---

### `DELETE /api/content/:id/share`
공개 보기 링크 비활성화

> 인증: 콘텐츠 소유자만 가능

**Response 200**
```typescript
{ success: true, data: { id: string } }
```

---

### `GET /api/public/content/:shareToken`
비회원 공개 콘텐츠 조회

**Response 200**
```typescript
{
  success: true,
  data: {
    id: string,
    title: string,
    type: ContentType,
    body?: string,
    slides?: SlideItem[],
    thumbnailUrl?: string,
    annotations: ContentAnnotation[]
  }
}
```

---

### `GET /api/public/content/:shareToken/annotations`
공개 콘텐츠 수정의견 목록 조회

**Response 200**
```typescript
{ success: true, data: ContentAnnotation[] }
```

---

### `POST /api/public/content/:shareToken/annotations`
비회원 수정의견 등록

**Request Body**
```typescript
{
  slideIndex: number,   // 0부터 시작
  authorName?: string, // 최대 40자
  body: string         // 1~1000자
}
```

**Response 201**
```typescript
{ success: true, data: ContentAnnotation }
```

---

## 6. SNS 계정 연동

### `GET /api/social`
연동된 SNS 계정 목록

**Response 200**
```typescript
{ success: true, data: SocialAccount[] }
```

---

### `POST /api/social`
SNS 계정 연동 시작 (OAuth 흐름 시작)

**Request Body**
```typescript
{ platform: SocialPlatform }
```

**Response 200**
```typescript
{ success: true, data: { authUrl: string } }
```

---

### `DELETE /api/social/:id`
SNS 계정 연동 해제

**Response 200**
```typescript
{ success: true, data: { id: string } }
```

---

## 7. 통계

### `GET /api/analytics`
통계 데이터 조회

**Query Params**
```
period?: "7d" | "30d" | "90d"  (default "30d")
type?:   ContentType
```

**Response 200**
```typescript
{
  success: true,
  data: {
    summary: {
      totalCreated: number,
      totalPublished: number,
      totalViews: number,
      totalLikes: number
    },
    byPlatform: Record<SocialPlatform, { views: number, likes: number }>,
    byDate: Array<{ date: string, created: number, published: number, views: number }>
  }
}
```

---

## 8. 결제

### `POST /api/payments/checkout`
결제 세션 생성 (Toss Payments)

**Request Body**
```typescript
{
  plan:         "STARTER" | "PRO" | "ENTERPRISE",
  billingCycle: "monthly" | "annual"
}
```

**Response 200**
```typescript
{ success: true, data: { checkoutUrl: string, orderId: string } }
```

---

### `POST /api/payments/webhook`
Toss Payments 웹훅 수신

> 인증: Toss 서명 검증 필수

**Response 200**
```typescript
{ success: true }
```

---

## 9. 사용자 정보

### `GET /api/user/me`
현재 사용자 정보 + 크레딧 조회

**Response 200**
```typescript
{
  success: true,
  data: {
    id: string,
    name: string,
    email: string,
    plan: PlanTier,
    creditsUsed: number,
    creditsTotal: number,
    creditsResetAt: string
  }
}
```

---

### `PUT /api/user/persona`
AI 글쓰기 설정 저장

**Request Body**
```typescript
{
  businessName?:   string,
  industry?:       string,
  targetAudience?: string,
  tone?:           string,
  keywords?:       string[],
  rules?:          string
}
```

**Response 200**
```typescript
{ success: true, data: Persona }
```
