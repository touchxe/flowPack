import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const paymentWebhookSchema = z.object({
  eventType: z.string(),
  data: z.object({
    paymentKey: z.string().optional(),
    orderId: z.string().optional(),
  }).passthrough(),
}).passthrough();

type TossPayment = {
  orderId?: string;
  totalAmount?: number;
  status?: string;
  method?: string;
  approvedAt?: string;
};

/**
 * POST /api/webhooks/toss
 *
 * 일반 결제 웹훅에는 검증용 서명이 제공되지 않는다. 받은 body를 신뢰하지 않고
 * 서버 시크릿으로 Toss Payment Query API를 다시 호출해 주문 로그와 대조한다.
 */
export async function POST(req: NextRequest) {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey || secretKey === "test_sk_placeholder") {
    return NextResponse.json({ error: "결제 웹훅이 준비되지 않았습니다." }, { status: 503 });
  }

  try {
    const event = paymentWebhookSchema.parse(await req.json());
    if (event.eventType !== "PAYMENT_STATUS_CHANGED") {
      return NextResponse.json({ received: true, ignored: true });
    }

    const { paymentKey, orderId } = event.data;
    if (!paymentKey || !orderId) {
      return NextResponse.json({ error: "결제 식별자가 없습니다." }, { status: 400 });
    }

    const paymentLog = await prisma.paymentLog.findUnique({ where: { orderId } });
    if (!paymentLog) {
      // 이 서비스에서 시작하지 않은 결제 이벤트는 상태 변경 없이 수신만 확인한다.
      return NextResponse.json({ received: true, ignored: true });
    }

    const paymentResponse = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      },
    });
    const payment = await paymentResponse.json().catch(() => null) as TossPayment | null;
    if (!paymentResponse.ok || !payment || payment.orderId !== paymentLog.orderId || payment.totalAmount !== paymentLog.amount) {
      return NextResponse.json({ error: "결제 웹훅을 검증하지 못했습니다." }, { status: 502 });
    }

    await prisma.paymentLog.update({
      where: { orderId },
      data: {
        // 승인 API만 구독·플랜을 변경한다. 웹훅은 감사 상태를 동기화한다.
        status: payment.status ?? paymentLog.status,
        method: payment.method ?? paymentLog.method,
        tossPaymentKey: paymentKey,
        paidAt: payment.approvedAt ? new Date(payment.approvedAt) : paymentLog.paidAt,
      },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "잘못된 웹훅 형식입니다." }, { status: 400 });
    }
    console.error("[Toss Webhook] Processing failed", error);
    // Toss가 재시도할 수 있도록 5xx를 돌려준다.
    return NextResponse.json({ error: "웹훅 처리에 실패했습니다." }, { status: 500 });
  }
}
