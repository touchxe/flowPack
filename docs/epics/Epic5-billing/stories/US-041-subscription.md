# US-041: 유료 요금제 구독

> **Story ID**: US-041
> **Epic**: Epic 5: 결제
> **优先순위**: P0
> **작성일**: 2026-03-31
> **Phase**: Phase 5

---

## 개요

사용자가 월간/연간 요금제로 업그레이드하여 더 많은 크레딧과 기능을 이용한다.

---

## 사용자 스토리

> **As a** 무료 티어 사용자
> **I want to** 더 많은 크레딧과 기능을 위해 구독
> **So that** 대량 콘텐츠 제작 가능

---

## acceptance criteria

### 요금제 보기

- [ ] `/pricing` 페이지
- [ ] FREE/STARTER/PRO/ENTERPRISE 요금제 표시
- [ ] 월간/연간 토글 (연간 할인 17%)
- [ ] 각 요금제별 크레딧/기능 표시

### 구독 시작

- [ ] 요금제 "구독하기" 버튼
- [ ] Toss Payments checkout으로 이동
- [ ] 결제 성공 시 Subscription 레코드 생성
- [ ] 플랜 업데이트 + 크레딧 한도 변경
- [ ] `/settings/billing` 페이지로 리다이렉트

### 결제 실패

- [ ] 카드 오류 시 에러 메시지
- [ ] 재시도 옵션

---

## 구현 참고사항

### Toss Payments 연동

```typescript
// app/api/payments/checkout/route.ts
import { TossPayments } from "@tosspayments/sdk";

const tossPayments = new TossPayments(process.env.TOSS_CLIENT_KEY!);

export async function POST(req: Request) {
  const session = await auth();
  const { plan, billingCycle } = await req.json();

  const amount = getPlanPrice(plan, billingCycle);

  const checkout = await tossPayments.checkout({
    amount,
    orderId: generateOrderId(),
    successUrl: `${process.env.NEXTAUTH_URL}/settings/billing?success=true`,
    failUrl: `${process.env.NEXTAUTH_URL}/settings/billing?fail=true`,
    customer: {
      id: session.user.id,
      email: session.user.email,
    },
    metadata: {
      plan,
      billingCycle,
    },
  });

  return Response.json({ checkoutUrl: checkout.url });
}
```

### Subscription 업데이트

```typescript
// app/api/payments/webhook/route.ts
export async function POST(req: Request) {
  const payload = await req.json();
  const signature = req.headers.get("x-toss-signature");

  // Toss 서명 검증
  if (!verifyTossSignature(payload, signature)) {
    return new Response("Invalid signature", { status: 400 });
  }

  if (payload.type === "SUBSCRIPTION_CONFIRMED") {
    const { customerId, plan, billingCycle, nextBillingDate } = payload.data;

    await prisma.subscription.upsert({
      where: { userId: customerId },
      create: {
        userId: customerId,
        plan,
        billingCycle,
        status: "active",
        tossBillingKey: payload.data.billingKey,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(nextBillingDate),
      },
      update: {
        plan,
        billingCycle,
        currentPeriodEnd: new Date(nextBillingDate),
      },
    });

    // 유저 플랜 업데이트
    await prisma.user.update({
      where: { id: customerId },
      data: { plan },
    });
  }

  return Response.json({ success: true });
}
```

---

## 환경 변수

```bash
# .env.local
TOSS_CLIENT_KEY=your_toss_client_key
TOSS_SECRET_KEY=your_toss_secret_key
```

---

## 의존성

- `@tosspayments/sdk` (`npm i @tosspayments/sdk`)

---

## 추정 시간

**Story Point**: 8

**세부 추정**:
- Toss SDK 연동: 3h
- Checkout API: 2h
- Webhook: 2h
- UI: 2h
- 테스트: 2h
