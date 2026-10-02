# 스프린트 계약: TASK-EXT-001 외부 글·사진 REST API

## 구현 범위

- [ ] 사용자별 Bearer API 키 발급·폐기·권한 확인
- [ ] JPG·PNG·WebP 업로드와 인증된 원본 조회
- [ ] Markdown BLOG 초안 등록·조회·revision 기반 수정
- [ ] 사진 순서·대체 텍스트·본문 참조·대표 이미지 연결
- [ ] 멱등 키로 등록·업로드·AI 생성 중복 방지
- [ ] 동기 JSON AI 장문 생성과 크레딧 정합성
- [ ] 기존 콘텐츠 화면과 미디어 삭제 흐름 호환
- [ ] 외부 호출 가이드와 핵심 통합 검증

## 테스트 가능한 완료 기준

| # | 기준 | 검증 방법 |
|---|---|---|
| 1 | 쿠키 없이 유효한 API 키로 호출 가능 | API 통합 테스트 |
| 2 | 사진 2장과 Markdown 글이 한 초안으로 저장 | DB/API/UI 확인 |
| 3 | 타인 자원·위장 파일·과대 파일 거부 | 부정 테스트 |
| 4 | 같은 멱등 요청은 같은 ID 반환 | 병렬 요청 테스트 |
| 5 | revision 충돌은 기존 글을 덮어쓰지 않음 | 409 테스트 |
| 6 | AI 재시도에도 글·크레딧 중복 없음 | AI stub 및 DB 검증 |
| 7 | 기존 글 목록·보기·편집 흐름 회귀 없음 | Playwright 및 build |

## 영향받는 파일

- `app/prisma/schema.prisma`, 승인된 PostgreSQL migration
- `app/server/services/**`
- `app/lib/validations/**`
- `app/app/api/v1/**`
- 기존 content/media/generate 라우트 중 공통 정합성 보강 대상
- 관련 테스트·운영 가이드·작업 로그

## 제약 확인

- 기존 패키지로 구현하며 신규 의존성 없음
- API·DB 변경은 CP-008 승인 범위에 한정
- 운영 DB에 `prisma db push`를 실행하지 않음
- NAS 공개 포트·공개 callback을 추가하지 않음

## 상태: ✅ 로컬 구현·검증 완료

운영 DB migration과 실환경 smoke는 NAS 배포 gate에 귀속한다.
