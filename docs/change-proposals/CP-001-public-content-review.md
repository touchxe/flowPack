# 변경 제안서: CP-001 공개 콘텐츠 검토 링크와 수정의견

## 현재 상태

- 콘텐츠 상세 조회 API `GET /api/content/:id`는 로그인 사용자 본인만 접근할 수 있다.
- 콘텐츠 공유 링크, 공개 보기 모드, 비회원 수정의견 저장 모델이 없다.
- 카드뉴스 슬라이드별 피드백을 화면에 표시하거나 관리하는 계약이 없다.

## 변경 제안

- `Content`에 공개 공유 상태와 고유 공유 토큰을 추가한다.
- 비회원이 공유 토큰으로 접근할 수 있는 공개 콘텐츠 조회 API를 추가한다.
- 비회원이 공개 보기 화면에서 슬라이드별 수정의견을 남길 수 있도록 `ContentAnnotation` 모델과 공개 API를 추가한다.
- 소유자는 콘텐츠 편집 화면에서 공개 링크를 생성하고 복사할 수 있다.
- 공개 보기 화면은 왼쪽 콘텐츠 미리보기, 오른쪽 수정의견 목록으로 구성한다.

## 변경 사유

- 콘텐츠 제작자가 고객, 팀원, 외부 협업자에게 로그인 없이 검토 링크를 전달해야 한다.
- 카드뉴스 이미지/슬라이드 단위로 수정의견 번호를 연결하면 피드백 반영 위치가 명확해진다.
- 공개 접근을 `contentId`가 아닌 `shareToken`으로 제한해 임의 접근 위험을 낮춘다.

## 영향 범위

- 영향받는 문서:
  - `docs/api-contract.md`
  - `docs/db-schema.md`
- 영향받는 코드:
  - `app/prisma/schema.prisma`
  - `app/app/api/content/[id]/share/route.ts`
  - `app/app/api/public/content/[shareToken]/route.ts`
  - `app/app/api/public/content/[shareToken]/annotations/route.ts`
  - `app/app/(public)/content/[shareToken]/view/page.tsx`
  - `app/components/features/content/public-content-review.tsx`
  - `app/app/(app)/content/[id]/edit/page.tsx`
- 마이그레이션 필요 여부: 예

## 대안 비교

| 기준 | contentId 공개 | shareToken 공개 | 별도 초대 계정 |
|------|----------------|-----------------|----------------|
| 접근성 | 높음 | 높음 | 낮음 |
| 보안 | 낮음 | 중간 | 높음 |
| 구현 복잡도 | 낮음 | 중간 | 높음 |
| 링크 회수 | 어려움 | 가능 | 가능 |
| 비회원 검토 | 가능 | 가능 | 불가 또는 복잡 |

## 리스크

- 공개 링크가 외부로 재전달될 수 있으므로 소유자용 공유 비활성화가 필요하다.
- 비회원 코멘트 등록은 스팸 가능성이 있어 길이 제한과 서버 검증이 필요하다.
- 공개 API는 콘텐츠 소유자 정보, AI 프롬프트, 내부 상태 등 민감 필드를 노출하지 않아야 한다.

## 상태

승인됨 — 사용자 요청에 따라 구현 진행.

