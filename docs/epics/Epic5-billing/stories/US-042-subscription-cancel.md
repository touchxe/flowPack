# US-042: 구독 취소

> **Story ID**: US-042
> **Epic**: Epic 5: 결제
> **优先순위**: P1
> **작성일**: 2026-03-31
> **Phase**: Phase 5

---

## 개요

사용자가 구독을 취소할 수 있다. 취소해도 현재 구독 기간까진 이용 가능.

---

## acceptance criteria

- [ ] `/settings/billing` 페이지에 "구독 취소" 버튼
- [ ] 확인 모달 + 안내 메시지
- [ ] 취소 시 Subscription.status = "canceled"
- [ ] 현재 구독 종료일까지 기존 플랜 유지
- [ ] 종료일 이후 FREE로 자동 변경

---

## 추정 시간

**Story Point**: 2
