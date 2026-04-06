# API 계약 — 변경 금지 (가상 CTO 관할)

> ⚠️ 이 파일은 읽기 전용입니다.
> 새 API 추가/변경 시 `docs/change-proposals/`에 제안서를 먼저 작성하세요.

---

## 공통 규칙

### 응답 형식
```typescript
// 성공
{ success: true, data: T }

// 에러
{ success: false, error: { code: string, message: string } }
```

### 에러 코드 체계
| 접두사 | 도메인 | 예시 |
|--------|--------|------|
| AUTH_ | 인증/인가 | AUTH_INVALID_CREDENTIALS |
| USER_ | 사용자 | USER_NOT_FOUND |
| VAL_ | 유효성 검사 | VAL_INVALID_EMAIL |
| SRV_ | 서버 오류 | SRV_INTERNAL_ERROR |

### 페이지네이션
```typescript
// 요청: ?page=1&limit=20
// 응답:
{
  data: T[],
  meta: { page: number, limit: number, total: number, totalPages: number }
}
```

---

## API 목록

> tRPC를 사용하므로 HTTP 메서드 대신 query/mutation으로 구분

### Auth (인증)

| 프로시저 | 타입 | 입력 | 출력 | 인증 필요 |
|----------|------|------|------|----------|
| auth.signUp | mutation | { email, password, name } | { user } | ❌ |
| auth.signIn | mutation | { email, password } | { session } | ❌ |
| auth.signOut | mutation | - | { success } | ✅ |
| auth.me | query | - | { user } | ✅ |
| auth.resetPassword | mutation | { email } | { success } | ❌ |

### User (사용자)

| 프로시저 | 타입 | 입력 | 출력 | 인증 필요 |
|----------|------|------|------|----------|
| user.getProfile | query | - | { profile } | ✅ |
| user.updateProfile | mutation | { name?, avatar? } | { profile } | ✅ |

### [Feature] (프로젝트별 추가)

| 프로시저 | 타입 | 입력 | 출력 | 인증 필요 |
|----------|------|------|------|----------|
| (프로젝트 기획 후 추가) | - | - | - | - |

---

## 변경 이력

| 날짜 | 변경 내용 | 승인자 | 제안서 |
|------|----------|--------|--------|
| YYYY-MM-DD | 최초 작성 | YoungBin | - |
