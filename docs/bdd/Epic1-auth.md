# Epic 1: 인증 (Authentication)

> **작성일**: 2026-03-31
> **Phase**: Phase 4
> **상태**: ⏳ 작성 중

---

## US-001: 소셜 계정으로 가입·로그인

### Feature: Google 소셜 로그인

```gherkin
Feature: Google 소셜 로그인
  scenario: 사용자가 Google 계정으로 최초 가입한다

    Given 사용자가 "/login" 페이지에 접속한다
    And 기존 계정이 없다
    When 사용자가 "Google로 계속하기" 버튼을 클릭한다
    Then Google OAuth consent screen이 표시된다
    When 사용자가 Google 계정을 승인한다
    Then 새 계정이 생성된다
    And "/home" 페이지로 리다이렉트된다
    And 세션이 생성된다
    And 화면에 "안녕하세요, {사용자명}님"이 표시된다
```

```gherkin
  Scenario: 사용자가 Google 계정으로 재로그인한다

    Given 기존 사용자가 Google OAuth로 가입済み이다
    And 세션이 만료되었다
    When 사용자가 "/login" 페이지에 접속한다
    And 사용자가 "Google로 계속하기" 버튼을 클릭한다
    Then Google OAuth consent screen이 표시된다
    When 사용자가 Google 계정을 승인한다
    Then 기존 계정으로 로그인된다
    And "/home" 페이지로 리다이렉트된다
```

### Feature: Kakao 소셜 로그인

```gherkin
Feature: Kakao 소셜 로그인
  Scenario: 사용자가 Kakao 계정으로 최초 가입한다

    Given 사용자가 "/login" 페이지에 접속한다
    When 사용자가 "Kakao로 계속하기" 버튼을 클릭한다
    Then Kakao 로그인 페이지로 리다이렉트된다
    When 사용자가 Kakao 계정으로 로그인하고 동의한다
    Then 새 계정이 생성된다
    And "/home" 페이지로 리다이렉트된다
```

### Feature: Apple 소셜 로그인

```gherkin
Feature: Apple 소셜 로그인
  Scenario: 사용자가 Apple 계정으로 최초 가입한다

    Given 사용자가 "/login" 페이지에 접속한다
    When 사용자가 "Apple로 계속하기" 버튼을 클릭한다
    Then Apple Sign-In consent screen이 표시된다
    When 사용자가 Apple 계정으로 승인한다
    Then 새 계정이 생성된다
    And "/home" 페이지로 리다이렉트된다
```

---

## US-002: 이메일·비밀번호로 가입·로그인

### Feature: 이메일 회원가입

```gherkin
Feature: 이메일 회원가입
  Scenario: 사용자가 유효한 정보로 회원가입한다

    Given 사용자가 "/register" 페이지에 접속한다
    When 사용자가 이메일 "user@example.com"을 입력한다
    And 비밀번호 "SecurePass123!"을 입력한다
    And 비밀번호 확인 "SecurePass123!"을 입력한다
    And "회원가입" 버튼을 클릭한다
    Then 새 계정이 생성된다
    And "이메일 인증을 완료해주세요" 메시지가 표시된다
    And 로그인 페이지로 리다이렉트된다
```

```gherkin
  Scenario: 비밀번호 확인이 일치하지 않는다

    Given 사용자가 "/register" 페이지에 접속한다
    When 사용자가 이메일 "user@example.com"을 입력한다
    And 비밀번호 "SecurePass123!"을 입력한다
    And 비밀번호 확인 "DifferentPass123!"을 입력한다
    And "회원가입" 버튼을 클릭한다
    Then 에러 메시지 "비밀번호 확인이 일치하지 않습니다"가 표시된다
    And 계정이 생성되지 않는다
```

```gherkin
  Scenario: 이미 사용 중인 이메일로 회원가입 시도

    Given "user@example.com"으로 가입된 계정이 존재한다
    When 사용자가 "/register" 페이지에 접속한다
    And 이메일 "user@example.com"을 입력한다
    And 비밀번호 "SecurePass123!"을 입력한다
    And 비밀번호 확인 "SecurePass123!"을 입력한다
    And "회원가입" 버튼을 클릭한다
    Then 에러 메시지 "이미 사용 중인 이메일입니다"가 표시된다
```

```gherkin
  Scenario: 유효하지 않은 이메일 형식

    Given 사용자가 "/register" 페이지에 접속한다
    When 사용자가 이메일 "invalid-email"을 입력한다
    And 비밀번호 "SecurePass123!"을 입력한다
    And 비밀번호 확인 "SecurePass123!"을 입력한다
    And "회원가입" 버튼을 클릭한다
    Then 에러 메시지 "유효한 이메일 주소를 입력해주세요"가 표시된다
```

### Feature: 이메일 로그인

```gherkin
Feature: 이메일 로그인
  Scenario: 사용자가 유효한 자격증명으로 로그인한다

    Given 기존 사용자이메일 "user@example.com"과 비밀번호 "SecurePass123!"으로 가입済み이다
    And 세션이 없다
    When 사용자가 "/login" 페이지에 접속한다
    And 이메일 "user@example.com"을 입력한다
    And 비밀번호 "SecurePass123!"을 입력한다
    And "로그인" 버튼을 클릭한다
    Then "/home" 페이지로 리다이렉트된다
    And 세션이 생성된다
```

```gherkin
  Scenario: 잘못된 비밀번호로 로그인 시도

    Given 기존 사용자이메일 "user@example.com"과 비밀번호 "SecurePass123!"으로 가입済み이다
    When 사용자가 "/login" 페이지에 접속한다
    And 이메일 "user@example.com"을 입력한다
    And 잘못된 비밀번호 "WrongPass123!"을 입력한다
    And "로그인" 버튼을 클릭한다
    Then 에러 메시지 "이메일 또는 비밀번호가 올바르지 않습니다"가 표시된다
    And 세션이 생성되지 않는다
```

---

## US-003: 비밀번호 재설정

### Feature: 비밀번호 재설정 요청

```gherkin
Feature: 비밀번호 재설정
  Scenario: 사용자가 비밀번호 재설정을 요청한다

    Given 사용자 이메일 "user@example.com"으로 가입済み이다
    When 사용자가 "/login" 페이지에서 "비밀번호를 잊으셨나요?" 링크를 클릭한다
    Then "/find-password" 페이지로 이동한다
    When 사용자가 이메일 "user@example.com"을 입력한다
    And "재설정 링크 전송" 버튼을 클릭한다
    Then "비밀번호 재설정 링크를 이메일로 전송했습니다" 메시지가 표시된다
    And 재설정 이메일이 발송된다
```

```gherkin
  Scenario: 존재하지 않는 이메일로 재설정 요청

    Given "nonexistent@example.com"으로 가입된 계정이 없다
    When 사용자가 "/find-password" 페이지에 접속한다
    And 이메일 "nonexistent@example.com"을 입력한다
    And "재설정 링크 전송" 버튼을 클릭한다
    Then "해당 이메일로 가입된 계정이 없습니다" 메시지가 표시된다
```

### Feature: 비밀번호 재설정 완료

```gherkin
  Scenario: 사용자가 유효한 토큰으로 비밀번호를 재설정한다

    Given 사용자가 비밀번호 재설정 요청을 완료했다
    And 유효한 재설정 토큰을 이메일로 수신했다
    When 사용자가 이메일의 링크를 클릭한다
    Then "/find-password/reset?token={token}" 페이지로 이동한다
    When 사용자가 새 비밀번호 "NewSecurePass123!"을 입력한다
    And 비밀번호 확인 "NewSecurePass123!"을 입력한다
    And "비밀번호 변경" 버튼을 클릭한다
    Then "비밀번호가 변경되었습니다" 메시지가 표시된다
    And "/login" 페이지로 리다이렉트된다
```

```gherkin
  Scenario: 만료된 토큰으로 비밀번호 재설정 시도

    Given 비밀번호 재설정 토큰이 만료되었다
    When 사용자가 이메일의 링크를 클릭한다
    Then "/find-password" 페이지로 이동한다
    And "재설정 링크가 만료되었습니다. 다시 요청해주세요." 메시지가 표시된다
```

---

## US-004: 중복 로그인 방지

### Feature: 동일 계정 중복 로그인 방지

```gherkin
Feature: 동일 계정 중복 로그인 방지
  Scenario: 이미 로그인된 계정으로 다른 기기에서 로그인 시도

    Given 사용자 "user@example.com"이 기기 A에서 로그인 중이다
    When 사용자 "user@example.com"이 기기 B에서 로그인한다
    Then 기기 A의 세션이 무효화된다
    And 기기 A에 "다른 곳에서 로그인되었습니다" 알림이 표시된다
    And 기기 B에서는 정상적으로 "/home" 페이지가 표시된다
```

---

## 엣지 케이스

```gherkin
  Scenario: OAuth 과정에서 사용자가 취소 버튼을 클릭

    Given 사용자가 "/login" 페이지에 접속한다
    When 사용자가 "Google로 계속하기" 버튼을 클릭한다
    And Google consent screen에서 "취소"를 클릭한다
    Then "/login" 페이지로 리다이렉트된다
    And 에러 메시지가 표시되지 않는다
    And 세션이 생성되지 않는다
```

```gherkin
  Scenario: 소셜 로그인 중 네트워크 오류 발생

    Given 사용자가 OAuth 인증 중이다
    When 네트워크 연결이 끊어진다
    Then "/login" 페이지로 리다이렉트된다
    And 에러 메시지 "인증 중 오류가 발생했습니다. 다시 시도해주세요."가 표시된다
```
