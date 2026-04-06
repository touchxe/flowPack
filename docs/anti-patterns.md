# FlowPack 금지 패턴 목록

> ⚠️ **읽기 전용 — 가상 CTO 감시 대상**  
> 아래 패턴 감지 시 즉시 코드 작성 중단, 사용자에게 보고  
> **확정일**: 2026-03-31 | **Phase 3**

---

## 1. TypeScript 금지 패턴

```typescript
// ❌ any 타입 사용
const data: any = response;

// ✅ unknown + 타입 가드
const data: unknown = response;
if (isContentItem(data)) { ... }

// ❌ as 단언 남용
const user = getUser() as User;

// ✅ 타입 가드 또는 Zod parse
const user = UserSchema.parse(getUser());

// ❌ non-null 단언 (!.)
const name = user!.name;

// ✅ 옵셔널 체이닝 + 기본값
const name = user?.name ?? "익명";

// ❌ 함수 반환 타입 생략
function getUser() { return fetch(...); }

// ✅ 반환 타입 명시
async function getUser(): Promise<User> { ... }
```

---

## 2. React / Next.js 금지 패턴

```typescript
// ❌ useEffect 내 데이터 페칭
useEffect(() => {
  fetch('/api/content').then(r => r.json()).then(setContent);
}, []);

// ✅ TanStack Query 사용
const { data } = useQuery({ queryKey: ['content'], queryFn: fetchContent });

// ❌ default export (page.tsx/layout.tsx 제외)
export default function StatCard() { ... }

// ✅ named export
export function StatCard() { ... }

// ❌ prop drilling 3단계 이상
<A user={user}>
  <B user={user}>
    <C user={user} />
  </B>
</A>

// ✅ Zustand 또는 Context
const user = useAppStore(s => s.user);

// ❌ 인라인 스타일
<div style={{ color: 'red', marginTop: 8 }}>

// ✅ Tailwind 클래스
<div className="text-destructive mt-2">

// ❌ 클라이언트에서 서버 전용 코드 import
import { prisma } from '@/lib/prisma';  // 클라이언트 컴포넌트에서

// ✅ server/db/* 경유 또는 API Route
```

---

## 3. 스타일링 금지 패턴

```typescript
// ❌ CSS 파일 별도 생성
import styles from './component.module.css';

// ✅ Tailwind utility class만 사용

// ❌ styled-components / emotion
const StyledButton = styled.button`color: blue;`;

// ✅ shadcn Button + variant

// ❌ Lucide 외 아이콘 라이브러리
import { FaUser } from 'react-icons/fa';
import { UserIcon } from '@heroicons/react/24/solid';

// ✅ Lucide만 사용
import { User } from 'lucide-react';

// ❌ 하드코딩된 색상값
<div style={{ background: '#7C3AED' }}>    // Mirra 보라색 금지
<div className="bg-[#7C3AED]">

// ✅ CSS 변수 사용
<div className="bg-primary">
```

---

## 4. API / 데이터 금지 패턴

```typescript
// ❌ API 계약에 없는 엔드포인트 생성
// app/api/custom-endpoint/route.ts  ← docs/api-contract.md에 없음

// ✅ api-contract.md에 먼저 추가 후 구현

// ❌ DB 스키마에 없는 테이블/컬럼 직접 생성
await prisma.$executeRaw`ALTER TABLE users ADD COLUMN score INT`;

// ✅ Prisma 마이그레이션 제안서 작성 → 승인 → npx prisma migrate

// ❌ 클라이언트에서 직접 DB 접근
import { prisma } from '@/lib/prisma';  // 'use client' 컴포넌트에서

// ✅ API Route 또는 Server Action 경유

// ❌ SNS 토큰 평문 저장
socialAccount.accessToken = "plain-text-token";

// ✅ 암호화 후 저장 (AES-256)

// ❌ 에러 무시
try { ... } catch (e) {}

// ✅ 에러 로깅 + 사용자 친화적 메시지
try { ... } catch (e) {
  logger.error(e);
  return { success: false, error: '처리 중 오류가 발생했습니다.' };
}
```

---

## 5. 보안 금지 패턴

```typescript
// ❌ 환경변수 클라이언트 노출
// NEXT_PUBLIC_OPENAI_API_KEY ← 절대 금지

// ✅ 서버 전용 환경변수
// OPENAI_API_KEY (NEXT_PUBLIC_ 접두사 없음)

// ❌ SQL 인젝션 가능 코드
await prisma.$queryRaw`SELECT * FROM users WHERE id = ${userId}`;
// (Prisma 템플릿 리터럴은 자동 이스케이프이지만 문자열 연결은 금지)

// ❌ XSS 취약 코드
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ DOMPurify sanitize 후 사용 (또는 마크다운 렌더러)

// ❌ 인증 없는 API Route
export async function POST(req: Request) {
  // 세션 검사 없이 바로 처리
  const data = await req.json();
  ...
}

// ✅ 세션 검사 필수
const session = await auth();
if (!session?.user) return new Response('Unauthorized', { status: 401 });
```

---

## 6. 성능 금지 패턴

```typescript
// ❌ 모든 컴포넌트 클라이언트화
'use client'
export function StaticHeader() { ... }  // 상태 없는 컴포넌트

// ✅ 서버 컴포넌트 우선, 상태 필요한 곳만 'use client'

// ❌ 거대 번들 import
import _ from 'lodash';  // 전체 lodash

// ✅ 필요한 함수만 import 또는 네이티브 대체
import { debounce } from 'lodash-es';

// ❌ 배럴 파일 (index.ts)
export { StatCard } from './stat-card';
export { EmptyState } from './empty-state';
// (번들 사이즈 증가, 트리 쉐이킹 방해)

// ✅ 직접 import
import { StatCard } from '@/components/common/stat-card';

// ❌ Image 태그 직접 사용 (Next.js 프로젝트에서)
<img src="/logo.png" />

// ✅ Next.js Image 컴포넌트
import Image from 'next/image';
<Image src="/logo.png" width={40} height={40} alt="로고" />
```

---

## 7. 파일 구조 금지 패턴

```
❌ 임의 폴더 생성
app/utils/         ← architecture.md에 없음
app/helpers/       ← architecture.md에 없음
app/shared/        ← architecture.md에 없음

✅ 정의된 위치 사용
app/lib/           ← 공통 유틸리티
app/features/      ← 기능별 로직
app/components/common/ ← 공통 컴포넌트

❌ 페이지 파일에 비즈니스 로직 혼입
// app/(app)/home/page.tsx에 200줄 이상의 로직

✅ features/ 분리 후 page.tsx는 최대 50줄

❌ 하드코딩된 UX 텍스트 (한국어 문자열)
// 컴포넌트 내부에 직접 작성
<p>콘텐츠가 없습니다. 첫 번째 콘텐츠를 만들어보세요!</p>

✅ docs/ux-copy.md 참조 후 사용
```

---

## 8. 커밋 금지 패턴

```
❌ 비밀 키 커밋
.env 파일 커밋
OPENAI_API_KEY=sk-...

✅ .gitignore에 .env 포함, 예시는 .env.example로

❌ 의미없는 커밋 메시지
git commit -m "fix"
git commit -m "update"

✅ 규칙 준수
[기능] 카드뉴스 생성 API 구현
관련: US-014
```
