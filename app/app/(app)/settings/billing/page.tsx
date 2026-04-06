"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, CreditCard, Calendar, AlertCircle, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Subscription {
  plan: string;
  status: string;
  currentPeriodEnd: string;
  billingCycle: string;
}

interface PaymentRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string;
}

interface PaymentMethod {
  id: string;
  type: string;
  last4: string;
  expiry: string;
  isDefault: boolean;
}

export default function BillingSettingsPage() {
  const [subscription, setSubscription] = useState<Subscription | null>({
    plan: "FREE",
    status: "active",
    currentPeriodEnd: "2026-04-01",
    billingCycle: "monthly",
  });
  const [paymentHistory] = useState<PaymentRecord[]>([
    { id: "1", date: "2026-03-01", description: "STARTER 월간 구독", amount: 19900, status: "paid" },
    { id: "2", date: "2026-02-01", description: "STARTER 월간 구독", amount: 19900, status: "paid" },
    { id: "3", date: "2026-01-01", description: "STARTER 월간 구독", amount: 19900, status: "paid" },
  ]);
  const [paymentMethods] = useState<PaymentMethod[]>([
    { id: "1", type: "card", last4: "4242", expiry: "12/28", isDefault: true },
  ]);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const handleCancelSubscription = async () => {
    setIsCanceling(true);
    // Mock: simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSubscription((prev) =>
      prev ? { ...prev, status: "canceled" } : null
    );
    setIsCanceling(false);
    setShowCancelModal(false);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <Link
          href="/home"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          홈으로
        </Link>
        <h1 className="text-3xl font-bold">결제 설정</h1>
        <p className="text-muted-foreground mt-2">
          구독 관리와 결제 내역을 확인하세요
        </p>
      </div>

      {showSuccessMessage && (
        <div className="mb-6 flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700">
          <Check className="h-4 w-4" />
          구독이 취소되었습니다. 현재 구독 기간이 끝날 때까지는 기존 플랜을 계속 이용하실 수 있습니다.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Current Plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              <CardTitle>현재 플랜</CardTitle>
            </div>
            <CardDescription>현재 구독 상태</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{subscription?.plan || "FREE"}</p>
                <p className="text-sm text-muted-foreground">
                  {subscription?.status === "canceled"
                    ? "구독 취소됨"
                    : subscription?.status === "active"
                    ? "활성"
                    : "무료"}
                </p>
              </div>
              {subscription?.status === "canceled" && (
                <Badge variant="destructive">취소됨</Badge>
              )}
            </div>

            {subscription?.status !== "canceled" && (
              <>
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {subscription?.billingCycle === "yearly" ? "연간" : "월간"} 구독
                  </div>
                  {subscription?.currentPeriodEnd && (
                    <p className="text-sm mt-1">
                      다음 결제일: {formatDate(subscription.currentPeriodEnd)}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t space-y-2">
                  <p className="text-sm font-medium">구독 포함 내용</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 월 10개 크레딧</li>
                    <li>• 카드뉴스/블로그 생성</li>
                    <li>• SNS 연동</li>
                  </ul>
                </div>
              </>
            )}

            <div className="pt-4 border-t flex gap-2">
              <Link href="/pricing" className="flex-1">
                <Button className="w-full">
                  {subscription?.status === "canceled" ? "플랜 업그레이드" : "플랜 변경"}
                </Button>
              </Link>
              {subscription?.status !== "canceled" && (
                <Button
                  variant="outline"
                  onClick={() => setShowCancelModal(true)}
                >
                  구독 취소
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              <CardTitle>결제 수단</CardTitle>
            </div>
            <CardDescription>등록된 결제 방법</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {paymentMethods.length > 0 ? (
              <div className="space-y-3">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded">
                        <CreditCard className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {method.type === "card" ? "신용/체크카드" : method.type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {method.last4 ? `•••• ${method.last4}` : ""}
                          {method.expiry ? ` (${method.expiry})` : ""}
                        </p>
                      </div>
                    </div>
                    {method.isDefault && (
                      <Badge variant="secondary">기본</Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">등록된 결제 수단이 없습니다</p>
              </div>
            )}

            <Button variant="outline" className="w-full">
              결제 수단 추가
            </Button>
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <CardTitle>결제 내역</CardTitle>
            </div>
            <CardDescription>최근 결제 기록</CardDescription>
          </CardHeader>
          <CardContent>
            {paymentHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">날짜</th>
                      <th className="text-left py-3 px-2 font-medium">항목</th>
                      <th className="text-right py-3 px-2 font-medium">금액</th>
                      <th className="text-right py-3 px-2 font-medium">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentHistory.map((record) => (
                      <tr key={record.id} className="border-b">
                        <td className="py-3 px-2">{formatDate(record.date)}</td>
                        <td className="py-3 px-2">{record.description}</td>
                        <td className="text-right py-3 px-2">
                          ₩{record.amount.toLocaleString()}
                        </td>
                        <td className="text-right py-3 px-2">
                          <Badge variant="success" className="bg-green-100 text-green-700">
                            완료
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">결제 내역이 없습니다</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cancel Subscription Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <DialogTitle>구독 취소</DialogTitle>
            </div>
            <DialogDescription>
              정말 구독을 취소하시겠습니까?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-3 bg-yellow-50 rounded-lg mb-4">
              <p className="text-sm text-yellow-800">
                구독을 취소하시면:
              </p>
              <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                <li>• 현재 구독 기간이 끝날 때까지 기존 플랜을 계속 이용하실 수 있습니다</li>
                <li>• 기간 종료 후 FREE 플랜으로 자동 전환됩니다</li>
                <li>• 남은 크레딧은 유지됩니다</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCancelModal(false)}
              className="w-full sm:w-auto"
            >
              구독 계속하기
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={isCanceling}
              className="w-full sm:w-auto"
            >
              {isCanceling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  취소 중...
                </>
              ) : (
                "구독 취소"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
