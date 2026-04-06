# Epic 3: 배포 (Publishing)

> **작성일**: 2026-03-31
> **Phase**: Phase 4
> **상태**: ⏳ 작성 중

---

## US-020: SNS 계정 연동 (Instagram·Facebook·Twitter/X·LinkedIn)

### Feature: Instagram 연동

```gherkin
Feature: Instagram 계정 연동
  Scenario: 사용자가 Instagram Business 계정을 연동한다

    Given 로그인한 사용자가 "/social-accounts" 페이지에 접속한다
    When 사용자가 "Instagram 연결" 버튼을 클릭한다
    Then Meta OAuth consent screen이 표시된다
    When 사용자가 Instagram 계정으로 로그인하고 권한을 승인한다
    Then 연동 성공 메시지가 표시된다
    And Instagram 계정이 목록에 추가된다
    And 계정명이 "my_business_account"로 표시된다
```

```gherkin
  Scenario: Instagram Personal 계정 연동 시 Business 변환 안내

    Given 사용자가 Meta OAuth 과정에서 Personal Instagram 계정을 선택했다
    Then "Instagram Business 또는 Creator 계정이 필요합니다" 안내가 표시된다
    And 연동이 완료되지 않는다
```

### Feature: Facebook Page 연동

```gherkin
Feature: Facebook Page 연동
  Scenario: 사용자가 Facebook Page를 연동한다

    Given 로그인한 사용자가 "/social-accounts" 페이지에 접속한다
    When 사용자가 "Facebook 연결" 버튼을 클릭한다
    Then Meta OAuth consent screen이 표시된다
    When 사용자가 Facebook Page를 선택하고 권한을 승인한다
    Then 연동 성공 메시지가 표시된다
    And Facebook Page가 목록에 추가된다
```

### Feature: Twitter/X 연동

```gherkin
Feature: Twitter/X 계정 연동
  Scenario: 사용자가 Twitter/X 계정을 연동한다

    Given 로그인한 사용자가 "/social-accounts" 페이지에 접속한다
    When 사용자가 "X(Twitter) 연결" 버튼을 클릭한다
    Then Twitter OAuth screen이 표시된다
    When 사용자가 Twitter/X 계정으로授权한다
    Then 연동 성공 메시지가 표시된다
    And X 계정이 목록에 추가된다
```

### Feature: LinkedIn 연동

```gherkin
Feature: LinkedIn 계정 연동
  Scenario: 사용자가 LinkedIn Page를 연동한다

    Given 로그인한 사용자가 "/social-accounts" 페이지에 접속한다
    When 사용자가 "LinkedIn 연결" 버튼을 클릭한다
    Then LinkedIn OAuth screen이 표시된다
    When 사용자가 LinkedIn 계정으로授权한다
    Then 연동 성공 메시지가 표시된다
    And LinkedIn Page가 목록에 추가된다
```

---

## US-021: 블로그 연동 배포 (네이버 블로그, WordPress)

### Feature: 네이버 블로그 연동

```gherkin
Feature: 네이버 블로그 연동
  Scenario: 사용자가 네이버 블로그를 연동한다

    Given 로그인한 사용자가 "/social-accounts" 페이지에 접속한다
    When 사용자가 "네이버 블로그 연결" 버튼을 클릭한다
    Then 네이버 로그인 페이지로 이동한다
    When 사용자가 네이버 계정으로 로그인한다
    Then 연동 성공 메시지가 표시된다
    And 네이버 블로그가 목록에 추가된다
```

### Feature: WordPress 연동

```gherkin
Feature: WordPress 연동
  Scenario: 사용자가 WordPress.com 사이트를 연동한다

    Given 로그인한 사용자가 "/social-accounts" 페이지에 접속한다
    When 사용자가 "WordPress 연결" 버튼을 클릭한다
    Then WordPress authorization screen이 표시된다
    When 사용자가 WordPress.com 계정으로授权한다
    Then 연동 성공 메시지가 표시된다
    And WordPress 사이트가 목록에 추가된다
```

```gherkin
  Scenario: Self-hosted WordPress 연동 시 URL 입력

    Given 로그인한 사용자가 "/social-accounts" 페이지에 접속한다
    When 사용자가 "WordPress (Self-hosted) 연결" 버튼을 클릭한다
    Then WordPress REST API URL 입력 필드가 표시된다
    When 사용자가 "https://myblog.com/wp-json/"를 입력한다
    And Application Password를 입력한다
    And "연결" 버튼을 클릭한다
    Then 연결 성공 메시지가 표시된다
    And Self-hosted WordPress 사이트가 목록에 추가된다
```

---

## US-022: 여러 채널에 원클릭 동시 배포

### Feature: 다채널 동시 배포

```gherkin
Feature: 다채널 동시 배포
  Scenario: 사용자가 복수의 SNS에 동시 배포한다

    Given 로그인한 사용자가 연동된 Instagram, Facebook, Twitter 계정을 보유하고 있다
    And 배포할 카드뉴스가 초안 상태로 존재한다
    When 사용자가 해당 콘텐츠의 "배포" 버튼을 클릭한다
    Then 배포 채널 선택 모달이 표시된다
    When 사용자가 Instagram, Facebook, Twitter를 선택한다
    And "지금 배포" 버튼을 클릭한다
    Then 각 플랫폼으로 동시에 배포가 시작된다
    And 진행 상태가 실시간으로 표시된다
    When 모든 배포가 완료되면
    Then 성공/실패 결과가 채널별로 표시된다
    And 각 플랫폼의 게시물 URL이 표시된다
```

```gherkin
  Scenario: 일부 채널 배포 실패

    Given 사용자가 Instagram, Facebook, Twitter를 선택했다
    When Instagram 배포 성공
    And Facebook 배포 성공
    But Twitter 배포 실패 시
    Then Instagram, Facebook은 "배포 완료" 상태로 표시된다
    And Twitter에 "실패" 상태와 에러 메시지가 표시된다
    And 에러 메시지 "트위터 API 오류: 연결이 거부되었습니다"가 보인다
```

```gherkin
  Scenario: 모든 채널 배포 실패

    Given 사용자가 복수의 채널을 선택했다
    When 모든 플랫폼에서 배포가 실패하면
    Then 모든 채널에 "실패" 상태가 표시된다
    And 크레딧이 차감되지 않는다
    And "모든 채널에 배포에 실패했습니다. 다시 시도해주세요." 안내가 표시된다
```

### Feature: 예약 배포

```gherkin
Feature: 예약 배포
  Scenario: 사용자가 특정 시각에 배포를 예약한다

    Given 로그인한 사용자가 배포할 콘텐츠를 보유하고 있다
    When 사용자가 해당 콘텐츠의 "예약" 버튼을 클릭한다
    Then 예약 날짜/시간 선택 모달이 표시된다
    When 사용자가 "2026-04-01 14:00"을 선택한다
    And 배포 채널을 선택한다
    And "예약하기" 버튼을 클릭한다
    Then "예약이 완료되었습니다" 메시지가 표시된다
    And 예약된 콘텐츠가 캘린더에 표시된다
    And 상태가 "예약됨"으로 변경된다
```

```gherkin
  Scenario: 예약 시각이 지나면 자동으로 배포된다

    Given 사용자가 "2026-04-01 14:00"에 예약된 콘텐츠가 있다
    When 예약 시각이 되면
    Then 자동으로 배포가 시작된다
    And 배포 완료 시 알림(이메일/카카오톡)이 발송된다
    And 상태가 "배포 완료"로 변경된다
```

---

## US-023: SNS 계정 연동 해제

### Feature: SNS 계정 연동 해제

```gherkin
  Scenario: 사용자가 연동된 Instagram 계정을 해제한다

    Given 로그인한 사용자가 연동된 Instagram 계정을 보유하고 있다
    When 사용자가 Instagram 계정의 "연결 해제" 버튼을 클릭한다
    Then 확인 다이얼로그가 표시된다
    When 사용자가 "연결 해제"를 확인한다
    Then Instagram 계정이 목록에서 제거된다
    And 해당 계정으로 예약된 모든 배포가 취소된다
    And "연결이 해제되었습니다" 메시지가 표시된다
```

---

## US-024: SNS 토큰 만료 처리

### Feature: SNS 토큰 만료 자동 감지 및 재인증

```gherkin
  Scenario: Instagram 토큰이 만료되어 재인증이 필요하다

    Given 사용자의 Instagram access_token이 만료되었다
    When 사용자가 Instagram이 연동된 콘텐츠를 배포하려고 하면
    Then "Instagram 연결이 만료되었습니다. 다시 연결해주세요." 안내가 표시된다
    And 재연동 버튼이 표시된다
    When 사용자가 재연동 버튼을 클릭하면
    Then Meta OAuth screen이 표시된다
```

---

## 엣지 케이스

```gherkin
  Scenario: 배포 중 네트워크 연결이 끊어진다

    Given 사용자가 배포를 요청했다
    When 일부 플랫폼에 배포되는途中 네트워크가 끊어진다
    Then 완료된 플랫폼은 정상 처리된다
    And 실패한 플랫폼에 "네트워크 오류" 상태가 표시된다
    And 사용자에게 알림이 발송된다
```

```gherkin
  Scenario: 게시물 내용 길이가 플랫폼 제한을 초과한다

    Given 사용자가 Twitter/X에 배포하려고 한다
    When 콘텐츠 본문이 Twitter 문자 제한(280자)을 초과한다
    Then "내용이太长하여 잘라서 게시됩니다" 안내가 표시된다
    And 사용자가 확인하면 배포가 진행된다
```

```gherkin
  Scenario: 사용자가 연결된 계정 없이 배포를 시도한다

    Given 로그인한 사용자가 연결된 SNS 계정이 없다
    When 사용자가 "/social-accounts" 페이지에서 배포를 시도한다
    Then "SNS 계정을 먼저 연결해주세요" 안내가 표시된다
    And "SNS 연결하기" 버튼이 표시된다
```
