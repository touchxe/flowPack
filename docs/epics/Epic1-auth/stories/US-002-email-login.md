# US-002: 이메일·비밀번호로 가입·로그인

> **Story ID**: US-002
> **Epic**: Epic 1: 인증
> **우선순위**: P0
> **작성일**: 2026-03-31
> **Phase**: Phase 5

---

## 개요

사용자가 이메일과 비밀번호로 직접 가입하고 로그인할 수 있다.

---

## 사용자 스토리

> **As a** 잠재 사용자
> **I want to** 이메일과 비밀번호로 가입·로그인
> **So that** 소셜 계정이 없어도 서비스를 이용할 수 있다

---

## acceptance criteria

### 이메일 회원가입

- [ ] `/register` 페이지에 이메일, 비밀번호, 비밀번호 확인 입력 필드가 있다
- [ ] 유효한 이메일 형식 검증
- [ ] 비밀번호 최소 8자, 숫자/특수문자 포함 검증
- [ ] 비밀번호 확인 일치 검증
- [ ] 이미 사용 중인 이메일 체크
- [ ] 모든 검증 통과 시 User 레코드 생성 (passwordHash 저장)
- [ ] "이메일 인증을 완료해주세요" 메시지 표시
- [ ] `/login` 페이지로 리다이렉트

### 이메일 로그인

- [ ] `/login` 페이지에 이메일, 비밀번호 입력 필드가 있다
- [ ] bcrypt로 비밀번호 검증
- [ ] 검증 통과 시 JWT 세션 생성
- [ ] `/home` 페이지로 리다이렉트
- [ ] 검증 실패 시 "이메일 또는 비밀번호가 올바르지 않습니다" 에러

### 공통

- [ ] 입력 필드 Validation (Zod 스키마)
- [ ] 로딩 상태 표시
- [ ] 에러 메시지国际化対応

---

## 구현 참고사항

### Zod 스키마 (lib/validations/auth-schema.ts)

```typescript
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("유효한 이메일 주소를 입력해주세요"),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다")
    .regex(/[0-9]/, "숫자를 포함해야 합니다")
    .regex(/[^a-zA-Z0-9]/, "특수문자를 포함해야 합니다"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "비밀번호 확인이 일치하지 않습니다",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  email: z.string().email("유효한 이메일 주소를 입력해주세요"),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
```

### API Route (app/api/auth/[...nextauth]/route.ts)

```typescript
import { handlers, auth } from "@/lib/auth";
import NextAuth from "next-auth";

const { GET, POST } = auth;

export { GET, POST };
```

### Credentials Provider 설정

Auth.js 설정에 credentials provider 추가 필요

---

## 테스트 시나리오 (BDD)

자세한 테스트 시나리오는 `docs/bdd/Epic1-auth.md` 참조:

- `Scenario: 사용자가 유효한 정보로 회원가입한다`
- `Scenario: 비밀번호 확인이 일치하지 않는다`
- `Scenario: 이미 사용 중인 이메일로 회원가입 시도`
- `Scenario: 유효하지 않은 이메일 형식`
- `Scenario: 사용자가 유효한 자격증명으로 로그인한다`
- `Scenario: 잘못된 비밀번호로 로그인 시도`

---

## 환경 변수

```bash
# .env.local (기존 + 추가)
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
```

---

## 의존성

- `zod`
- `bcrypt` (`npm i bcrypt && npm i -D @types/bcrypt`)

---

## 추정 시간

**Story Point**: 5

**세부 추정**:
- Zod 스키마 + 유효성 검증: 1h
- Register API + User 생성: 1.5h
- Login API + bcrypt 검증: 1.5h
- UI 폼 구현 (React Hook Form): 2h
- 에러 처리 + 테스트: 1h
