# Epic 5: 결제 (Billing)

> **작성일**: 2026-03-31
> **Phase**: Phase 5
> **상태**: ⏳ 스프린트 대기
> **Epic ID**: EPIC-5

---

## 개요

사용자가 무료 티어를 사용하거나 유료 요금제로 업그레이드하고, 결제 내역을 확인할 수 있다.

---

## 사용자 스토리 목록

| Story ID | 제목 |优先순위 | 상태 |
|----------|------|----------|------|
| [US-040](./stories/US-040-free-tier.md) | 무료 티어 사용 | P0 | ⏳ 대기 |
| [US-041](./stories/US-041-subscription.md) | 유료 요금제 구독 | P0 | ⏳ 대기 |
| [US-042](./stories/US-042-subscription-cancel.md) | 구독 취소 | P1 | ⏳ 대기 |
| [US-043](./stories/US-043-payment-history.md) | 결제 내역 확인 | P1 | ⏳ 대기 |
| [US-044](./stories/US-044-payment-methods.md) | 결제 수단 관리 | P2 | ⏳ 대기 |
| [US-045](./stories/US-045-credit-low-alert.md) | 크레딧 부족 알림 | P1 | ⏳ 대기 |

---

## 기술 요구사항

- **Payment Provider**: Toss Payments
- **Billing**: 구독 관리 (Billing Key)

---

## API 계약

- `POST /api/payments/checkout` — 결제 세션 생성
- `POST /api/payments/webhook` — Toss 웹훅 수신

---

## 테스트 시나리오

전체 테스트 시나리오는 `docs/bdd/Epic5-billing.md` 참조

---

## 진행 로드맵

1. **Sprint 7**: US-040 무료 티어 + US-045 알림
2. **Sprint 8**: US-041/042/043/044 결제
