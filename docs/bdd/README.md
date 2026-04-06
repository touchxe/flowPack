# BDD 테스트 시나리오

> **작성일**: 2026-03-31
> **Phase**: Phase 4
> **형식**: Gherkin (Cucumber)

---

## 개요

FlowPack 프로젝트의 모든 사용자 스토리에 대한 BDD(Behavior-Driven Development) 테스트 시나리오를 포함합니다.

**원칙**: 테스트 없는 코드는 없다. 모든 기능은 BDD 시나리오가 선행되어야 합니다.

---

## 파일 목록

| 파일 | Epic | 설명 |
|------|------|------|
| `Epic1-auth.md` | Epic 1: 인증 | 소셜/이메일 로그인, 비밀번호 재설정, 중복 로그인 방지 |
| `Epic2-content-generation.md` | Epic 2: 콘텐츠 생성 | AI 카드뉴스/블로그/이미지 생성, 편집, 대량 기획 |
| `Epic3-publishing.md` | Epic 3: 배포 | SNS/블로그 연동, 다채널 배포, 예약 배포 |
| `Epic4-analytics-calendar.md` | Epic 4: 통계 & 관리 | 대시보드, 조회수, 캘린더, 콘텐츠 관리 |
| `Epic5-billing.md` | Epic 5: 결제 | 무료 티어, 유료 구독, 결제 내역, 크레딧 관리 |

---

## 시나리오 통계

| Epic | 시나리오 수 | 핵심 Feature |
|------|------------|--------------|
| Epic 1 | 15개 | Google/Kakao/Apple OAuth, 이메일 로그인, 비밀번호 재설정 |
| Epic 2 | 14개 | AI 생성, 편집, 이미지, URL 변환, 대량 기획 |
| Epic 3 | 13개 | SNS 연동, 다채널 배포, 예약, 토큰 만료 |
| Epic 4 | 10개 | 통계, 캘린더, 검색, 아카이브 |
| Epic 5 | 13개 | 무료 티어, 구독, 취소, 결제 수단 |
| **총계** | **65개** | |

---

## 사용 방법

### 개발 전
1. 구현할 Epic의 시나리오를 검토
2. 시나리오를 기반으로 테스트 코드 작성
3. 시나리오가 실패하도록 테스트 실행

### 개발 후
1. 모든 시나리오가 통과하도록 구현
2. 새 기능 추가 시 해당 Epic 시나리오 문서 업데이트

---

## 실행 방법 (예정)

```bash
# 전체 시나리오 실행
npm test

# 특정 Epic만 실행
npm test -- --tags @epic1

# Tagged 시나리오 실행
npm test -- --tags @auth
```

---

## 태그 체계

| 태그 | 설명 |
|------|------|
| `@epic1` ~ `@epic5` | Epic 분류 |
| `@auth` | 인증 관련 |
| `@content` | 콘텐츠 생성 관련 |
| `@publish` | 배포 관련 |
| `@analytics` | 통계 관련 |
| `@billing` | 결제 관련 |
| `@happy-path` | 정상 플로우 |
| `@edge-case` | 엣지 케이스 |
| `@api` | API 테스트 |
| `@ui` | UI 테스트 |
