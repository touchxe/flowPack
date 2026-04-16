import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/payments/success
 * Toss Payments 결제 성공 후 리다이렉트 핸들러
 * Toss는 successUrl로 paymentKey, orderId, amount를 쿼리 파라미터로 전달
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { searchParams } = req.nextUrl;
  const paymentKey = searchParams.get("paymentKey");
  const orderId = searchParams.get("orderId");
  const amount = searchParams.get("amount");
  const plan = searchParams.get("plan") as
    | "STARTER"
    | "PRO"
    | "ENTERPRISE"
    | null;
  const billingCycle = searchParams.get("billingCycle") as
    | "monthly"
    | "yearly"
    | null;

  if (!paymentKey || !orderId || !amount || !plan || !billingCycle) {
    return NextResponse.redirect(
      new URL("/pricing?error=invalid_params", req.url)
    );
  }

  try {
    // 결제 승인 API 호출 (서버 사이드)
    const confirmRes = await fetch(
      new URL("/api/payments/confirm", req.url).toString(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: req.headers.get("cookie") ?? "",
        },
        body: JSON.stringify({
          paymentKey,
          orderId,
          amount: parseInt(amount),
          plan,
          billingCycle,
        }),
      }
    );

    if (confirmRes.ok) {
      return NextResponse.redirect(
        new URL("/settings/billing?success=true", req.url)
      );
    } else {
      return NextResponse.redirect(
        new URL("/pricing?error=payment_failed", req.url)
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL("/pricing?error=server_error", req.url)
    );
  }
}
