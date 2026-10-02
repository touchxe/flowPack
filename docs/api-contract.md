# FlowPack API 계약

> ⚠️ **읽기 전용 — 가상 CTO 감시 대상**  
> 변경 시 `docs/change-proposals/` 에 제안서 작성 → 사용자 승인 필수  
> **확정일**: 2026-03-31 | **Phase 3**  
> Base URL: `/api` | 인증: Bearer JWT (Auth.js 세션 쿠키)

---

## 외부 콘텐츠 API v1

외부 자동화용 API는 `/api/v1`을 사용하며 브라우저 세션 대신 사용자별 Bearer API 키로 인증한다. WordPress 연동은 공개 HTTPS gateway가 `/api/v1/**`만 전달하며, NAS 배포에서는 `FLOWPACK_EXTERNAL_API_ENABLED=true`를 명시해야 한다.

공통 헤더:

```http
Authorization: Bearer fp_...
Idempotency-Key: 호출자가 생성한 8~128자 고유값
```

성공 응답은 `{ success: true, data }`, 실패 응답은 `{ success: false, error, code }` 형식을 사용한다. POST와 PATCH에는 Idempotency-Key가 필요하다.

### `POST /api/v1/media`

JPG·PNG·WebP 파일 한 장을 `multipart/form-data`의 `file` 필드로 업로드한다. 최대 20 MiB이다. 성공 시 201과 `id`, `name`, `mimeType`, `size`, `contentPath`를 반환한다.

### `GET /api/v1/media/:id/content`

본인 사진의 원본 바이트를 반환한다. `media:read` 권한이 필요하다.

### `POST /api/v1/contents`

Markdown BLOG 초안을 생성한다.

```typescript
{
  title: string;
  bodyFormat: "markdown";
  body: string;
  images?: Array<{ mediaId: string; altText?: string }>;
  coverMediaId?: string | null;
}
```

본문 사진은 `![대체 텍스트](flowpack-media:MEDIA_ID)`로 지정한다. 참조한 mediaId는 images에도 포함해야 한다. 성공 시 201과 콘텐츠, 사진, revision을 반환한다.

### `GET /api/v1/contents/:id`

본인 콘텐츠를 조회한다. API가 관리하는 본문 사진은 `flowpack-media:` 표기로 반환한다.

### `PATCH /api/v1/contents/:id`

BLOG 초안을 부분 수정한다. `expectedRevision`은 필수이며 최신 revision과 다르면 `REVISION_CONFLICT` 409를 반환한다. body를 전송하면 `bodyFormat: "markdown"`도 함께 전송한다. images를 전송하면 전체 목록을 교체한다.

### `POST /api/v1/generations/longform`

AI 장문 BLOG 초안을 동기 JSON으로 생성한다. 입력은 `topic`, `keywords`, `length`, `tone`, `industry`, `instructions`이다. 성공 시 201과 저장된 콘텐츠를 반환하고 기존 크레딧 정책 1회를 적용한다. 동일 멱등 요청은 다시 생성하거나 차감하지 않는다.

### `GET /api/v1/capabilities`

API 키가 유효한지 확인하고 부여된 scope, API 버전, 비동기 생성·WordPress 가져오기 지원 여부, 이미지 제한을 반환한다.

### `POST /api/v1/generation-jobs/longform`

AI 장문 BLOG 생성을 비동기 작업으로 등록한다. 기본 입력은 동기 생성 API와 같고, 선택적으로 `images: Array<{ mediaId, altText }>`와 `coverMediaId`를 받는다. 사진은 본문 끝에 순서대로 배치된다. 성공 시 202와 `id`, `status: queued`를 반환한다. 작업 등록 시 크레딧을 예약하며 실패하면 반환한다. POST에는 `Idempotency-Key`가 필요하다.

### `GET /api/v1/generation-jobs/:id`

본인의 생성 작업을 조회한다. 상태는 `queued`, `running`, `succeeded`, `failed`, `canceled`이며 성공하면 `contentId`, 실패하면 안전한 `error`를 반환한다.

worker lease가 만료되면 최대 3회까지 재처리한다. 마지막 lease도 만료된 작업은 `GENERATION_RETRIES_EXHAUSTED`로 실패 처리하며 예약한 사용자 크레딧을 한 번만 복구한다.

### `GET /api/v1/contents/:id/rendered`

WordPress 가져오기용 정제 HTML, 이미지 목록, 대표 이미지 ID, revision을 반환한다. 관리 이미지 위치는 `flowpack-media:MEDIA_ID`로 유지되며 소비자가 자기 저장소 URL로 치환한다.

필요 scope는 `content:read`, `content:write`, `content:generate`, `media:read`, `media:write`이다. 키 발급·목록·폐기는 `npm run external-api:key -- ...`을 사용한다.

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
| GET/POST | `/api/auth/[...nextauth]` | Auth.js 핸들러 (소셜/이메일·아이디) |

Credentials 로그인은 `{ identifier, password }`를 사용한다. `identifier`에는 이메일 또는 등록된 아이디를 전달하며, 기존 `{ email, password }` 요청도 호환한다. 등록된 아이디가 없으면 이메일의 `@` 앞부분도 로그인에 사용할 수 있다. 같은 앞부분의 이메일이 둘 이상이면 로그인하지 않는다.

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
    username: string | null,
    plan: PlanTier,
    creditsUsed: number,
    creditsTotal: number,
    creditsResetAt: string
  }
}
```

### `PATCH /api/user/me`
이름·비밀번호 변경 또는 최초 로그인 아이디 등록. 인증 필요.

아이디 등록 요청은 다음과 같다.

```typescript
{ username: string, currentPassword: string }
```

아이디는 영문자로 시작하는 영문·숫자·밑줄 4~20자이며, 대소문자를 구분하지 않고 한 번만 등록할 수 있다.

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
