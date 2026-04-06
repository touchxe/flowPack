# US-003: 비밀번호 재설정

> **Story ID**: US-003
> **Epic**: Epic 1: 인증
> **우선순위**: P1
> **작성일**: 2026-03-31
> **Phase**: Phase 5

---

## 개요

사용자가 비밀번호를 잊었을 때 이메일로 재설정 링크를 받고 새로운 비밀번호로 변경할 수 있다.

---

## 사용자 스토리

> **As a** 로그인할 수 없는 사용자
> **I want to** 이메일로 비밀번호 재설정 링크를 받고 새 비밀번호로 변경
> **So that** 계정을 회복할 수 있다

---

## acceptance criteria

### 비밀번호 재설정 요청

- [ ] `/login` 페이지에 "비밀번호를 잊으셨나요?" 링크가 있다
- [ ] 링크 클릭 시 `/find-password` 페이지로 이동
- [ ] 이메일 입력 필드가 있다
- [ ] 유효한 이메일 형식 검증
- [ ] 존재하지 않는 이메일 입력 시 "해당 이메일로 가입된 계정이 없습니다" 표시
- [ ] 존재하는 이메일 입력 시 재설정 토큰 생성 + 이메일 발송
- [ ] "비밀번호 재설정 링크를 이메일로 전송했습니다" 메시지 표시

### 비밀번호 재설정 완료

- [ ] 이메일 내 링크 클릭 시 `/find-password/reset?token={token}` 이동
- [ ] 유효한 토큰: 새 비밀번호 입력 필드 표시
- [ ] 토큰 검증: 만료 여부, 사용 여부
- [ ] 만료/무효 토큰 시 "재설정 링크가 만료되었습니다" 메시지
- [ ] 새 비밀번호 입력 + 비밀번호 확인 입력
- [ ] Validation 후 User.passwordHash 업데이트
- [ ] 토큰 사용 처리 (Invalidation)
- [ ] "비밀번호가 변경되었습니다" 메시지 + `/login` 리다이렉트

### 이메일 템플릿

- [ ] 제목: "[FlowPack] 비밀번호 재설정 요청"
- [ ] 본문: 재설정 링크 (1시간内有効)
- [ ] 링크 클릭 시 token 검증

---

## 구현 참고사항

### DB 테이블 추가

`db-schema.md`의 VerificationToken 테이블 사용

```typescript
// server/db/verification-token.ts
export async function createVerificationToken(email: string) {
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1시간

  await prisma.verificationToken.create({
    data: { identifier: email, token, expires },
  });

  return token;
}

export async function getVerificationToken(token: string) {
  return prisma.verificationToken.findUnique({ where: { token } });
}

export async function deleteVerificationToken(token: string) {
  await prisma.verificationToken.delete({ where: { token } });
}
```

### 이메일 발송 (Resend)

```typescript
// server/services/email-service.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${process.env.NEXTAUTH_URL}/find-password/reset?token=${token}`;

  await resend.emails.send({
    from: "FlowPack <noreply@flowpack.com>",
    to: email,
    subject: "[FlowPack] 비밀번호 재설정 요청",
    html: `
      <p>비밀번호 재설정을 요청하셨습니다.</p>
      <p>아래 링크를 클릭하여 새 비밀번호를 설정해주세요.</p>
      <a href="${resetUrl}">비밀번호 재설정</a>
      <p>이 링크는 1시간内有효합니다.</p>
    `,
  });
}
```

### API Routes

```
app/api/auth/
├── [...nextauth]/route.ts        # POST /api/auth/callback/email (재설정)
├── find-password/
│   ├── route.ts                  # POST /api/auth/find-password (요청)
│   └── reset/
│       └── route.ts              # POST /api/auth/find-password/reset (완료)
```

---

## 테스트 시나리오 (BDD)

자세한 테스트 시나리오는 `docs/bdd/Epic1-auth.md` 참조:

- `Scenario: 사용자가 비밀번호 재설정을 요청한다`
- `Scenario: 존재하지 않는 이메일로 재설정 요청`
- `Scenario: 사용자가 유효한 토큰으로 비밀번호를 재설정한다`
- `Scenario: 만료된 토큰으로 비밀번호 재설정 시도`

---

## 환경 변수

```bash
# .env.local (추가)
RESEND_API_KEY=your_resend_api_key
```

---

## 의존성

- `resend` (`npm i resend`)
- `crypto` (Node.js 내장, 토큰 생성용)

---

## 추정 시간

**Story Point**: 3

**세부 추정**:
- DB 토큰 함수: 1h
- 이메일 서비스: 1h
- API Routes: 1.5h
- UI 페이지 (요청/재설정): 2h
- 테스트: 1h
