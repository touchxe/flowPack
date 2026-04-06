# 금지 패턴 — 변경 금지 (가상 CTO 관할)

> ⚠️ 이 파일에 나열된 패턴은 절대 사용하지 마세요.
> 예외가 필요하면 `docs/change-proposals/`에 제안서를 먼저 작성하세요.

---

## 코드 패턴

### 1. any 타입 사용
```typescript
// ❌ 금지
const data: any = await fetchData();

// ✅ 대안
const data: unknown = await fetchData();
if (isUserData(data)) { /* 타입 안전 */ }
```

### 2. useEffect 내 데이터 페칭
```typescript
// ❌ 금지
useEffect(() => {
  fetch('/api/users').then(r => r.json()).then(setUsers);
}, []);

// ✅ 대안: Server Component 또는 TanStack Query
const { data } = useQuery({ queryKey: ['users'], queryFn: getUsers });
```

### 3. God Component (300줄 이상 컴포넌트)
```
❌ 금지: 하나의 컴포넌트에 모든 로직 + UI
✅ 대안: 기능별 분리, Custom Hook 추출, 컴포넌트 합성
```

### 4. 직접 DOM 조작
```typescript
// ❌ 금지
document.getElementById('modal').style.display = 'block';

// ✅ 대안: React 상태로 제어
const [isOpen, setIsOpen] = useState(false);
```

### 5. 환경변수 하드코딩
```typescript
// ❌ 금지
const API_URL = 'https://api.production.com';

// ✅ 대안
const API_URL = process.env.NEXT_PUBLIC_API_URL;
```

### 6. try-catch 없는 async 함수
```typescript
// ❌ 금지
async function save() { await db.insert(data); }

// ✅ 대안: Result 패턴 또는 에러 바운더리
async function save(): Promise<Result<void>> {
  try { await db.insert(data); return { success: true, data: undefined }; }
  catch (e) { return { success: false, error: '저장 실패' }; }
}
```

### 7. 매직 넘버/스트링
```typescript
// ❌ 금지
if (user.role === 'admin') { ... }
if (retryCount > 3) { ... }

// ✅ 대안
const ROLES = { ADMIN: 'admin', USER: 'user' } as const;
const MAX_RETRY = 3;
```

---

## 아키텍처 패턴

### 1. 순환 의존
```
❌ 금지: A → B → C → A
✅ 대안: 의존성 방향을 단방향으로 유지 (features → lib, 역방향 금지)
```

### 2. 비즈니스 로직의 UI 침투
```
❌ 금지: 컴포넌트 내부에서 가격 계산, 권한 확인 등
✅ 대안: features/[feature]/에 분리, 컴포넌트는 표시만
```

### 3. DB 직접 접근 (클라이언트)
```
❌ 금지: 클라이언트 컴포넌트에서 DB 직접 쿼리
✅ 대안: 반드시 tRPC를 통해 접근
```

### 4. 전역 상태 남용
```
❌ 금지: 로컬 상태면 충분한 것을 Zustand에 넣기
✅ 대안: 가능한 한 로컬 상태(useState) 우선, 컴포넌트 간 공유 필요 시만 Zustand
```

---

## 변경 이력

| 날짜 | 변경 내용 | 승인자 |
|------|----------|--------|
| YYYY-MM-DD | 최초 작성 | YoungBin |
