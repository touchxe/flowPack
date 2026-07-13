"use client";

/**
 * TossPaymentWidget
 *
 * Toss Payments 결제 위젯 컴포넌트
 * 사용법: <TossPaymentWidget plan="PRO" billingCycle="monthly" amount={499000} />
 *
 * 실제 작동 조건:
 * - TOSS_CLIENT_KEY 환경 변수에 실제 클라이언트 키 필요
 * - Toss 대시보드에서 허용 도메인 등록 필요
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TossPaymentWidgetProps {
  plan: "STARTER" | "PRO" | "ENTERPRISE";
  billingCycle: "monthly" | "yearly";
  amount: number;
  onSuccess?: () => void;
}

const PLAN_NAMES: Record<string, string> = {
  STARTER: "스타터 플랜",
  PRO: "프로 플랜",
  ENTERPRISE: "엔터프라이즈 플랜",
};

export function TossPaymentWidget({
  plan,
  billingCycle,
  amount,
  onSuccess,
}: TossPaymentWidgetProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const widgetRef = useRef<any>(null);
  const paymentWidgetTargetRef = useRef<HTMLDivElement>(null);
  const agreementTargetRef = useRef<HTMLDivElement>(null);

  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  const isConfigured =
    clientKey && clientKey !== "test_ck_placeholder";

  // 오더 ID 생성 (유니크)
  const orderId = `flowpack_${plan}_${billingCycle}_${Date.now()}`;
  const orderName = `FlowPack ${PLAN_NAMES[plan]} (${billingCycle === "yearly" ? "연간" : "월간"})`;

  useEffect(() => {
    if (!isConfigured || !paymentWidgetTargetRef.current) return;

    // Toss Payments 위젯 SDK 로드
    const loadWidget = async () => {
      try {
        const { loadPaymentWidget } = await import(
          "@tosspayments/payment-widget-sdk"
        );
        widgetRef.current = await loadPaymentWidget(clientKey!, "ANONYMOUS");

        await widgetRef.current.renderPaymentMethods(
          "#payment-widget",
          { value: amount },
          { variantKey: "DEFAULT" }
        );

        await widgetRef.current.renderAgreement("#agreement", {
          variantKey: "AGREEMENT",
        });
      } catch (err) {
        console.error("[Toss] Widget load error:", err);
        setError("결제 위젯 로드에 실패했습니다.");
      }
    };

    loadWidget();
  }, [amount, clientKey, isConfigured]);

  const handlePayment = async () => {
    if (!isConfigured) {
      setError("결제 시스템이 아직 준비 중입니다. 관리자에게 문의하세요.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { paymentKey } = await widgetRef.current.requestPayment({
        orderId,
        orderName,
        successUrl: `${window.location.origin}/api/payments/success?plan=${plan}&billingCycle=${billingCycle}`,
        failUrl: `${window.location.origin}/pricing?error=payment_failed`,
        customerName: "FlowPack User",
      });

      // 결제 승인 API 호출
      const res = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentKey,
          orderId,
          amount,
          plan,
          billingCycle,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess?.();
        router.push("/settings/billing?success=true");
      } else {
        setError(data.error ?? "결제에 실패했습니다.");
      }
    } catch (err: any) {
      if (err.code !== "USER_CANCEL") {
        setError(err.message ?? "결제 중 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Toss 키 미설정 시: 준비 중 안내
  if (!isConfigured) {
    return (
      <div className="p-4 border border-dashed rounded-lg text-center text-sm text-muted-foreground">
        <p className="font-medium mb-1">결제 시스템 준비 중</p>
        <p>Toss Payments 연동 후 이용 가능합니다.</p>
        <p className="mt-2 text-xs">
          문의: support@flowpack.dev
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toss 결제 위젯이 마운트될 영역 */}
      <div id="payment-widget" ref={paymentWidgetTargetRef} />
      <div id="agreement" ref={agreementTargetRef} />

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <Button
        className="w-full"
        onClick={handlePayment}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            결제 처리 중...
          </>
        ) : (
          `₩${amount.toLocaleString()} 결제하기`
        )}
      </Button>
    </div>
  );
}
