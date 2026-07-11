# FlowPack DB 스키마

> ⚠️ **읽기 전용 — 가상 CTO 감시 대상**  
> 변경 시 `docs/change-proposals/` 에 마이그레이션 제안서 작성 → 사용자 승인 필수  
> **확정일**: 2026-03-31 | **Phase 3** | ORM: Prisma | DB: PostgreSQL 16+

---

## Prisma Schema (전체)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enum ────────────────────────────────────────────────

enum PlanTier {
  FREE
  STARTER
  PRO
  ENTERPRISE
}

enum ContentType {
  CAROUSEL      // 카드뉴스
  BLOG          // 장문 블로그
  VIDEO         // 영상
  BULK          // 대량 기획
  URL_TO_POST   // URL → 콘텐츠
}

enum ContentStatus {
  DRAFT         // 초안
  SCHEDULED     // 예약됨
  PUBLISHED     // 배포 완료
  ARCHIVED      // 보관됨
}

enum SocialPlatform {
  INSTAGRAM
  FACEBOOK
  TWITTER
  LINKEDIN
  NAVER_BLOG
  WORDPRESS
}

enum PublishStatus {
  PENDING
  SUCCESS
  FAILED
}

enum NotificationChannel {
  EMAIL
  KAKAO
}

// ─── User ─────────────────────────────────────────────────

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  emailVerified DateTime?
  name          String?
  image         String?
  passwordHash  String?  // 소셜 로그인은 null
  plan          PlanTier @default(FREE)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // 크레딧 (월간 리셋)
  creditsUsed   Int      @default(0)
  creditsTotal  Int      @default(10)  // FREE: 10, STARTER: 50, PRO: 200
  creditsResetAt DateTime?

  // 관계
  accounts      Account[]
  sessions      Session[]
  contents      Content[]
  socialAccounts SocialAccount[]
  persona       Persona?
  subscriptions Subscription[]
  notifications NotificationSetting?

  @@index([email])
  @@map("users")
}

// ─── Auth.js 테이블 ────────────────────────────────────────

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String  // google | kakao | apple | credentials
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}

// ─── Content ──────────────────────────────────────────────

model Content {
  id          String        @id @default(cuid())
  userId      String
  title       String
  type        ContentType
  status      ContentStatus @default(DRAFT)
  body        String?       @db.Text   // 블로그 본문 (마크다운)
  slides      Json?                    // 카드뉴스 슬라이드 배열
  thumbnailUrl String?
  aiPrompt    String?       @db.Text   // 생성 시 사용된 프롬프트
  tone        String?                  // 톤 (formal/casual/fun)
  style       String?                  // 스타일 (informative/promotional)
  viewCount   Int           @default(0)
  shareEnabled Boolean      @default(false)
  shareToken   String?      @unique
  shareCreatedAt DateTime?
  scheduledAt DateTime?
  publishedAt DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  user     User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  publishes PublishRecord[]
  images   ContentImage[]
  annotations ContentAnnotation[]

  @@index([userId, status])
  @@index([userId, type])
  @@index([scheduledAt])
  @@map("contents")
}

model ContentAnnotation {
  id         String   @id @default(cuid())
  contentId  String
  slideIndex Int
  number     Int
  authorName String?
  body       String   @db.Text
  createdAt  DateTime @default(now())

  content Content @relation(fields: [contentId], references: [id], onDelete: Cascade)

  @@unique([contentId, number])
  @@index([contentId])
  @@map("content_annotations")
}

model ContentImage {
  id         String   @id @default(cuid())
  contentId  String
  url        String
  altText    String?
  order      Int      @default(0)
  createdAt  DateTime @default(now())

  content Content @relation(fields: [contentId], references: [id], onDelete: Cascade)

  @@map("content_images")
}

// ─── Social Account ───────────────────────────────────────

model SocialAccount {
  id              String         @id @default(cuid())
  userId          String
  platform        SocialPlatform
  accountName     String
  accountId       String         // 플랫폼 내부 ID
  accessToken     String         @db.Text  // 암호화 저장
  refreshToken    String?        @db.Text  // 암호화 저장
  tokenExpiresAt  DateTime?
  isActive        Boolean        @default(true)
  connectedAt     DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  user     User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  publishes PublishRecord[]

  @@unique([userId, platform, accountId])
  @@index([userId])
  @@map("social_accounts")
}

// ─── Publish Record ───────────────────────────────────────

model PublishRecord {
  id              String        @id @default(cuid())
  contentId       String
  socialAccountId String
  status          PublishStatus @default(PENDING)
  platformPostId  String?       // 플랫폼 내 게시물 ID
  platformPostUrl String?
  errorMessage    String?
  publishedAt     DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  content       Content       @relation(fields: [contentId], references: [id], onDelete: Cascade)
  socialAccount SocialAccount @relation(fields: [socialAccountId], references: [id], onDelete: Cascade)

  @@index([contentId])
  @@index([socialAccountId])
  @@map("publish_records")
}

// ─── Analytics ────────────────────────────────────────────

model Analytics {
  id          String   @id @default(cuid())
  contentId   String
  platform    SocialPlatform
  viewCount   Int      @default(0)
  likeCount   Int      @default(0)
  shareCount  Int      @default(0)
  commentCount Int     @default(0)
  recordedAt  DateTime @default(now())

  @@index([contentId])
  @@index([recordedAt])
  @@map("analytics")
}

// ─── Persona ──────────────────────────────────────────────

model Persona {
  id           String   @id @default(cuid())
  userId       String   @unique
  businessName String?
  industry     String?
  targetAudience String?
  tone         String?  // formal | casual | friendly | professional
  style        String?
  keywords     String[] // 자주 쓰는 키워드
  rules        String?  @db.Text  // 자유 형식 글쓰기 규칙
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("personas")
}

// ─── Subscription (결제) ──────────────────────────────────

model Subscription {
  id                String    @id @default(cuid())
  userId            String
  plan              PlanTier
  billingCycle      String    // monthly | annual
  status            String    // active | canceled | past_due
  tossBillingKey    String?   // Toss Payments 빌링키
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  canceledAt         DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("subscriptions")
}

// ─── Notification Setting ─────────────────────────────────

model NotificationSetting {
  id              String   @id @default(cuid())
  userId          String   @unique
  emailEnabled    Boolean  @default(true)
  kakaoEnabled    Boolean  @default(false)
  publishComplete Boolean  @default(true)
  creditLow       Boolean  @default(true)
  weeklyReport    Boolean  @default(true)
  updatedAt       DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("notification_settings")
}
```

---

## 테이블 요약

| 테이블 | 설명 | 핵심 인덱스 |
|--------|------|------------|
| `users` | 사용자 계정 + 플랜 + 크레딧 | `email` |
| `accounts` | Auth.js 소셜 계정 연결 | `provider, providerAccountId` |
| `sessions` | Auth.js 세션 | `sessionToken` |
| `contents` | 생성된 콘텐츠 | `userId+status`, `userId+type` |
| `content_annotations` | 공개 검토 수정의견 | `contentId`, `contentId+number` unique |
| `content_images` | 콘텐츠 이미지 | `contentId` |
| `social_accounts` | SNS 계정 연동 (토큰 암호화) | `userId+platform+accountId` unique |
| `publish_records` | 배포 이력 + 결과 | `contentId`, `socialAccountId` |
| `analytics` | 플랫폼별 통계 집계 | `contentId`, `recordedAt` |
| `personas` | 사용자 AI 글쓰기 설정 | `userId` unique |
| `subscriptions` | 결제·구독 이력 | `userId` |
| `notification_settings` | 알림 설정 | `userId` unique |

---

## 크레딧 정책 (미확정 — 확정 후 업데이트 필요)

| 플랜 | 월 크레딧 | 상태 |
|------|---------|------|
| FREE | 10건 | ⚠️ 확인 필요 |
| STARTER | 50건 | ⚠️ 확인 필요 |
| PRO | 200건 | ⚠️ 확인 필요 |
| ENTERPRISE | 무제한 | ⚠️ 확인 필요 |
