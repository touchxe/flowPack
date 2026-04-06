# FlowPack

> **버전**: v3.3 | AI 기반 홍보 콘텐츠 플랫폼

## 개요

FlowPack은 AI를 활용하여 카드뉴스, 블로그, SNS 콘텐츠를 자동 생성하고 멀티채널로 배포할 수 있는 올인원 마케팅 솔루션입니다.

## 주요 기능

- **AI 카드뉴스 생성**: 주제만 입력하면 슬라이드 구성부터 디자인까지 자동 생성
- **블로그 작성**: SEO 최적화된 장문 블로그 포스트 자동 생성
- **멀티채널 배포**: Instagram, Facebook, Twitter, LinkedIn, 네이버 블로그, WordPress 동시 배포
- **AI 페르소나**: 브랜드 스타일 학습으로 일관된 톤의 콘텐츠 생성
- **예약 발행**: 원하는 날짜와 시간에 자동으로 콘텐츠 발행
- **성과 분석**: 채널별 조회수, 반응, engagement 대시보드

## 기술 스택

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Auth**: NextAuth.js + Prisma Adapter
- **Icons**: Lucide React

## 프로젝트 구조

```
app/
├── app/                    # Next.js App Router
│   ├── (public)/          # 공개 페이지 (랜딩, 로그인, 회원가입 등)
│   ├── (app)/             # 인증 필요 페이지 (대시보드, 설정 등)
│   └── api/               # API 라우트
├── components/            # React 컴포넌트
│   ├── ui/               # shadcn/ui 기본 컴포넌트
│   └── layouts/          # 레이아웃 컴포넌트
├── lib/                   # 유틸리티 및 설정
└── prisma/               # Prisma Schema
```

## 시작하기

### 필수 조건

- Node.js 18+
- npm 또는 yarn

### 설치

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env.local
# .env.local 파일을编辑하여 필요한 환경 변수 설정

# 데이터베이스 마이그레이션
npx prisma db push

# 개발 서버 실행
npm run dev
```

### 환경 변수

```env
# Auth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# OAuth Providers (선택)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=

# Database (Supabase)
DATABASE_URL=postgresql://...
```

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 시작 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 시작 |
| `npx prisma studio` | Prisma Studio 열기 |
| `npx playwright test` | E2E 테스트 실행 |

## 페이지

### 공개 페이지

- `/` - 랜딩 페이지
- `/features` - 기능 소개
- `/pricing` - 요금제
- `/login` - 로그인
- `/register` - 회원가입
- `/find-password` - 비밀번호 찾기
- `/contact` - 문의하기
- `/terms` - 이용약관
- `/privacy` - 개인정보처리방침
- `/cookie` - 쿠키 정책

### 회원 페이지

- `/home` - 대시보드
- `/carousel-lab` - 카드뉴스 생성
- `/ai/longform` - 블로그 생성
- `/ai/bulk-generate` - 대량 생성
- `/ai/bulk-link-to-post` - URL → 콘텐츠
- `/calendar` - 콘텐츠 캘린더
- `/social-accounts` - SNS 연동
- `/analytics` - 성과 분석
- `/settings/profile` - 프로필 설정
- `/settings/notifications` - 알림 설정
- `/settings/billing` - 결제 설정

## 라이선스

© 2026 FlowPack. All rights reserved.