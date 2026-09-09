import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlanCredits, getPlanPrice, parseFlowPackOrderId } from "@/lib/payment-plan";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  isPublicCallbackEnabled,
  PUBLIC_INTEGRATION_DISABLED,
} from "@/lib/deployment-boundary.mjs";

const confirmSchema = z.object({
  paymentKey: z.string().min(1).max(200),
  orderId: z.string().min(6).max(64),
});

type TossPayment = {
  orderId?: string;
  totalAmount?: number;
  status?: string;
  method?: string;
  approvedAt?: string;
};

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * POST /api/payments/confirm
 *
 * 결제 금액·플랜은 요청 본문이 아니라 주문 ID와 서버 가격표에서만 결정한다.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();
  if (!isPublicCallbackEnabled()) {
    return NextResponse.json(
      { error: "비공개 NAS 모드에서는 결제를 사용할 수 없습니다.", code: PUBLIC_INTEGRATION_DISABLED },
      { status: 503 },
    );
  }

  let orderId: string | undefined;
  try {
    const body = confirmSchema.parse(await req.json());
    orderId = body.orderId;
    const order = parseFlowPackOrderId(body.orderId);
    if (!order) {
      return NextResponse.json({ error: "유효하지 않은 주문입니다." }, { status: 400 });
    }

    const expectedAmount = getPlanPrice(order.plan, order.billingCycle);
    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey || secretKey === "test_sk_placeholder") {
      return NextResponse.json({ error: "결제 시스템이 아직 준비되지 않았습니다." }, { status: 503 });
    }

    let paymentLog = await prisma.paymentLog.findUnique({ where: { orderId: body.orderId } });
    if (paymentLog) {
      if (paymentLog.userId !== session.user.id) {
        return NextResponse.json({ error: "다른 사용자의 주문입니다." }, { status: 403 });
      }
      if (paymentLog.status === "DONE") {
        return NextResponse.json({
          success: true,
          subscriptionId: paymentLog.subscriptionId,
          plan: order.plan,
          idempotent: true,
        });
      }
      if (paymentLog.status === "PROCESSING") {
        return NextResponse.json({ error: "결제 승인 처리 중입니다." }, { status: 409 });
      }
    } else {
      try {
        paymentLog = await prisma.paymentLog.create({
          data: {
            userId: session.user.id,
            orderId: body.orderId,
            amount: expectedAmount,
            status: "PENDING",
          },
        });
      } catch {
        paymentLog = await prisma.paymentLog.findUnique({ where: { orderId: body.orderId } });
        if (!paymentLog || paymentLog.userId !== session.user.id) {
          return NextResponse.json({ error: "주문을 초기화하지 못했습니다." }, { status: 409 });
        }
      }
    }

    const lock = await prisma.paymentLog.updateMany({
      where: { orderId: body.orderId, userId: session.user.id, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "PROCESSING", failureCode: null, failureMsg: null },
    });
    if (lock.count !== 1) {
      return NextResponse.json({ error: "결제 승인 처리 중입니다." }, { status: 409 });
    }

    const tossResponse = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
        "Content-Type": "application/json",
        "Idempotency-Key": body.orderId,
      },
      body: JSON.stringify({ paymentKey: body.paymentKey, orderId: body.orderId, amount: expectedAmount }),
    });
    const tossPayment = await tossResponse.json().catch(() => null) as TossPayment | null;

    if (!tossResponse.ok || !tossPayment || tossPayment.orderId !== body.orderId || tossPayment.totalAmount !== expectedAmount || tossPayment.status !== "DONE") {
      await prisma.paymentLog.updateMany({
        where: { orderId: body.orderId, userId: session.user.id, status: "PROCESSING" },
        data: {
          status: "FAILED",
          failureCode: tossResponse.ok ? "PAYMENT_VERIFICATION_FAILED" : undefined,
          failureMsg: tossResponse.ok ? "결제 응답 검증에 실패했습니다." : "결제 승인에 실패했습니다.",
        },
      });
      return NextResponse.json({ error: "결제 승인 또는 검증에 실패했습니다." }, { status: 400 });
    }

    const now = new Date();
    const periodEnd = new Date(now);
    if (order.billingCycle === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    const subscription = await prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: { userId: session.user.id, status: "active" },
        data: { status: "canceled", canceledAt: now },
      });
      const created = await tx.subscription.create({
        data: {
          userId: session.user.id,
          plan: order.plan,
          billingCycle: order.billingCycle,
          status: "active",
          // paymentKey는 자동결제용 billingKey가 아니다.
          tossBillingKey: null,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
      await tx.user.update({
        where: { id: session.user.id },
        data: {
          plan: order.plan,
          creditsTotal: getPlanCredits(order.plan),
          creditsUsed: 0,
          creditsResetAt: now,
        },
      });
      await tx.paymentLog.update({
        where: { orderId: body.orderId },
        data: {
          subscriptionId: created.id,
          status: "DONE",
          method: tossPayment.method ?? null,
          tossPaymentKey: body.paymentKey,
          paidAt: tossPayment.approvedAt ? new Date(tossPayment.approvedAt) : now,
        },
      });
      return created;
    });

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      plan: order.plan,
      periodEnd: periodEnd.toISOString(),
    });
  } catch (error) {
    if (orderId) {
      await prisma.paymentLog.updateMany({
        where: { orderId, status: "PROCESSING" },
        data: { status: "FAILED", failureCode: "CONFIRM_ERROR", failureMsg: "결제 승인 중 내부 오류가 발생했습니다." },
      }).catch(() => undefined);
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "잘못된 요청입니다." }, { status: 400 });
    }
    console.error("[Payments] Confirm error", error);
    return NextResponse.json({ error: "결제 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
