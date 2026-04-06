# FlowPack E2E 테스트 기획서

> **작성일**: 2026-03-31
> **프로젝트**: FlowPack
> **목적**: 모든 주요 페이지 및 사용자 시나리오 자동화 테스트

---

## 1. 테스트 대상 페이지

### 1.1 공개 페이지 (인증 불필요)

| 페이지 | URL | 주요 기능 |
|-------|-----|----------|
| 로그인 | `/login` | 이메일/소셜 로그인 |
| 회원가입 | `/register` | 이메일 회원가입 |
| 비밀번호 찾기 | `/find-password` | 비밀번호 재설정 요청 |
| 비밀번호 재설정 | `/find-password/reset` | 새 비밀번호 설정 |

### 1.2 인증 페이지 (로그인 필요)

| 페이지 | URL | 주요 기능 |
|-------|-----|----------|
| 홈 대시보드 | `/home` | 사용자 인삿말, 통계, 최근 콘텐츠 |
| 카드뉴스 생성 | `/carousel-lab` | AI 카드뉴스 생성 |
| 블로그 생성 | `/ai/longform` | AI 블로그 포스트 생성 |
| URL→콘텐츠 | `/ai/bulk-link-to-post` | URL에서 콘텐츠 추출 |
| 대량 생성 | `/ai/bulk-generate` | 일괄 콘텐츠 생성 |
| 콘텐츠 편집 | `/content/[id]/edit` | 카드뉴스 편집/이미지 생성 |
| 콘텐츠 캘린더 | `/calendar` | 예약 콘텐츠 관리 |
| SNS 연동 | `/social-accounts` | SNS 계정 관리 |
| 통계 | `/analytics` | 콘텐츠 성과 분석 |
| 요금제 | `/pricing` | 플랜 비교 및 구독 |
| 결제 설정 | `/settings/billing` | 구독/결제 관리 |

---

## 2. 테스트 시나리오

### 2.1 인증 (Authentication)

#### 시나리오 A: 이메일 로그인
```
 precondition: 테스트 계정 존재 (test@example.com / password123)
 
 1. /login 페이지 접속
 2. 이메일 입력: test@example.com
 3. 비밀번호 입력: password123
 4. "로그인" 버튼 클릭
 5. /home 페이지로 리다이렉트 확인
 6. 상단 네비게이션에 사용자 이름 표시 확인
```

#### 시나리오 B: 이메일 회원가입
```
 1. /register 페이지 접속
 2. 이메일 입력: newuser@example.com
 3. 비밀번호 입력: SecurePass123!
 4. 비밀번호 확인: SecurePass123!
 5. "회원가입" 버튼 클릭
 6. 성공 시 /home 으로 리다이렉트 확인
 7. 크레딧 10개 부여 확인 (요금제 페이지에서)
```

#### 시나리오 C: 소셜 로그인 (Mock)
```
 precondition: OAuth 연동 완료 시 (현재 Mock)
 
 1. /login 페이지 접속
 2. Google 로그인 버튼 클릭
 3. OAuth consent screen에서 승인
 4. /home 페이지로 리다이렉트 확인
```

#### 시나리오 D: 비밀번호 재설정
```
 1. /find-password 페이지 접속
 2. 이메일 입력: test@example.com
 3. "비밀번호 재설정 링크 보내기" 클릭
 4. 성공 메시지 확인
 5. 이메일의 링크 클릭 ( 수동 )
 6. /find-password/reset 페이지 접속 확인
 7. 새 비밀번호 입력
 8. "비밀번호 변경" 버튼 클릭
 9. 성공 시 /login 으로 리다이렉트
```

### 2.2 콘텐츠 생성 (Content Generation)

#### 시나리오 E: 카드뉴스 생성
```
 precondition: 로그인 상태, 크레딧 있음
 
 1. /carousel-lab 페이지 접속
 2. 주제 입력: "봄 신메뉴 출시"
 3. 업종 선택: 음식점
 4. 톤 선택: 친근하게
 5. 슬라이드 수: 5
 6. "생성하기" 버튼 클릭
 7. AI 생성 스피너 확인
 8. 생성 완료 후 슬라이드 목록 표시 확인
 9. "저장" 버튼 클릭
 10. 성공 메시지 확인
```

#### 시나리오 F: 블로그 생성
```
 precondition: 로그인 상태, 크레딧 있음
 
 1. /ai/longform 페이지 접속
 2. 주제 입력: "봄철 건강 습관 만들기"
 3. 키워드 입력: 건강, 봄, 습관
 4. 길이 선택: 보통 (1000단어)
 5. 톤 선택: 격식체
 6. "생성하기" 버튼 클릭
 7. AI 생성 스피너 확인
 8. 생성 완료 후 마크다운 미리보기 표시 확인
 9. 단어 수 표시 확인
```

#### 시나리오 G: URL에서 콘텐츠 추출
```
 precondition: 로그인 상태, 크레딧 있음
 
 1. /ai/bulk-link-to-post 페이지 접속
 2. URL 입력: https://example.com/article
 3. 콘텐츠 유형: 카드뉴스
 4. 톤 선택: 친근하게
 5. "변환하기" 버튼 클릭
 6. 로딩 상태 확인
 7. 생성 완료 후 /content/[id]/edit 로 리다이렉트
```

#### 시나리오 H: 대량 생성
```
 precondition: 로그인 상태, 크레딧 3개 이상
 
 1. /ai/bulk-generate 페이지 접속
 2. "행 추가" 버튼 클릭 (2번)
 3. 첫 번째 행: 주제="맛집 추천", 유형="카드뉴스"
 4. 두 번째 행: 주제="봄 축제", 유형="블로그"
 5. 세 번째 행: 주제="신제품 출시", 유형="카드뉴스"
 6. "일괄 생성" 버튼 클릭
 7. 각 항목별 상태 표시 (대기중→처리중→완료)
 8. 완료 후 성공 메시지 확인
```

#### 시나리오 I: 콘텐츠 편집
```
 precondition: 생성된 카드뉴스 존재
 
 1. /home 에서 최근 콘텐츠 클릭
 2. /content/[id]/edit 페이지 접속
 3. 슬라이드 드래그하여 순서 변경
 4. 슬라이드 제목 수정
 5. 슬라이드 본문 수정
 6. "AI 이미지" 버튼 클릭
 7. 이미지 생성 모달에서 프롬프트 입력
 8. "생성" 버튼 클릭
 9. 생성된 이미지 표시 확인
 10. "변경 사항 저장" 버튼 클릭
 11. 성공 메시지 확인
```

### 2.3 SNS 연동 및 배포 (Publishing)

#### 시나리오 J: SNS 계정 연동
```
 precondition: 로그인 상태 (현재 Mock)
 
 1. /social-accounts 페이지 접속
 2. Instagram "연결하기" 버튼 클릭
 3. 로딩 상태 확인
 4. 성공 시 "계정이 성공적으로 연동되었습니다" 메시지
 5. 연동된 계정 목록에 Instagram 표시 확인
```

#### 시나리오 K: 다채널 배포
```
 precondition: 계정 연동됨, 생성된 콘텐츠 존재
 
 1. /content/[id]/edit 페이지 접속
 2. "배포하기" 버튼 클릭
 3. 배포 모달에서 Instagram 체크
 4. "지금 배포" 버튼 클릭
 5. 로딩 상태 확인
 6. 성공 시 "완료" 상태 표시 확인
```

### 2.4 분석 및 캘린더 (Analytics & Calendar)

#### 시나리오 L: 통계 대시보드
```
 precondition: 로그인 상태
 
 1. /analytics 페이지 접속
 2. 기간 선택: 30일
 3. 통계 카드 표시 확인 (생성, 조회수, 배포)
 4. 막대그래프 렌더링 확인
 5. 선그래프 렌더링 확인
 6. 채널별 테이블 표시 확인
```

#### 시나리오 M: 캘린더 관리
```
 precondition: 로그인 상태, 예약된 콘텐츠 존재
 
 1. /calendar 페이지 접속
 2. 월간 달력 표시 확인
 3. 화살표로 월 이동 확인
 4. 날짜 클릭 시 우측 패널에 콘텐츠 목록 표시
 5. 예약된 콘텐츠 클릭 시 상세 다이얼로그 표시
 6. "편집" 버튼 클릭 시 /content/[id]/edit 이동
```

### 2.5 결제 (Billing)

#### 시나리오 N: 요금제 확인
```
 1. /pricing 페이지 접속
 2. 4개 요금제 카드 표시 확인
 3. 월간/연간 토글 동작 확인
 4. 연간 할인율 17% 적용 확인
 5. 각 플랜별 기능 목록 표시 확인
```

#### 시나리오 O: 구독 취소
```
 precondition: 유료 플랜 구독 중 (현재 Mock)
 
 1. /settings/billing 페이지 접속
 2. 현재 플랜 정보 표시 확인
 3. "구독 취소" 버튼 클릭
 4. 확인 모달 표시 확인
 5. "구독 취소" 버튼 클릭
 6. 성공 메시지 확인
 7. 플랜 상태 "취소됨" 표시 확인
```

---

## 3. 테스트 데이터

### 3.1 테스트 계정

| 용도 | 이메일 | 비밀번호 | 크레딧 | 플랜 |
|------|--------|---------|--------|------|
| 메인 | test@flowpack.com | TestPass123! | 10 | FREE |
| 유료 | premium@flowpack.com | PremiumPass123! | 50 | STARTER |

### 3.2 테스트 URL

| 용도 | URL |
|------|-----|
| 유효한 웹페이지 | https://example.com/article |
| 유효한 블로그 | https://medium.com/example |

### 3.3 테스트 콘텐츠

| 유형 | 주제 | 업종 | 톤 |
|------|------|------|-----|
| 카드뉴스 | 봄 신메뉴 출시 | 음식점 | 친근하게 |
| 블로그 | 봄철 건강 습관 | 건강 | 격식체 |
| 대량 | 맛집 추천, 봄 축제 | 복합 | 캐주얼 |

---

## 4. 테스트 실행 계획

### 4.1 설치

```bash
npm install -D @playwright/test
npx playwright install chromium
```

### 4.2 실행 명령

| 명령 | 설명 |
|------|------|
| `npx playwright test` | 전체 테스트 실행 |
| `npx playwright test --grep "login"` | 로그인 관련만 |
| `npx playwright test --grep "carousel"` | 카드뉴스 관련만 |
| `npx playwright test --ui` | UI 모드로 실행 |

### 4.3 환경 변수

```bash
# .env.test
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL=postgresql://...
```

---

## 5. 예상 결과

### 5.1 성공 기준

- [ ] 모든 시나리오 통과
- [ ] 404 오류 없음
- [ ] 콘솔 에러 없음 (Error level)
- [ ] UI 렌더링 정상

### 5.2 주의 사항

- OAuth (Google, Kakao 등) 실제 연동 전까지 Mock 테스트
- 실제 DB 연동 필요 (현재 Prisma mock 가능)
- 외부 API (OpenAI) 미설정 시_skip_

---

## 6. 테스트 코드 구조

```
tests/
├── e2e/
│   ├── TEST-PLAN.md          # 본 문서
│   ├── pages/
│   │   ├── login.spec.ts
│   │   ├── home.spec.ts
│   │   ├── carousel.spec.ts
│   │   └── ...
│   ├── fixtures/
│   │   └── test-data.ts
│   └── playwright.config.ts
```

---

## 7. 다음 단계

1. Playwright 설치 및 설정
2. 테스트 코드 작성
3. CI/CD 파이프라인 통합 (선택)
4. 정기적 테스트 실행
