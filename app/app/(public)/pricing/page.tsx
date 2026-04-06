"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const plans = [
  {
    id: "FREE",
    name: "Free",
    description: "서비스를 경험해보세요",
    monthlyPrice: 0,
    yearlyPrice: 0,
    credits: 10,
    features: [
      "월 10개 크레딧",
      "카드뉴스 생성",
      "블로그 작성",
      "기본 템플릿",
      "Instagram 연동",
    ],
    notIncluded: [
      "고급 AI 기능",
      "우선 지원",
      "팀 협업",
    ],
  },
  {
    id: "STARTER",
    name: "Starter",
    description: "꾸준히 콘텐츠를 만드는 분에게",
    monthlyPrice: 19900,
    yearlyPrice: 198000,
    credits: 50,
    features: [
      "월 50개 크레딧",
      "모든 콘텐츠 생성",
      "모든 SNS 연동",
      "고급 AI 기능",
      "우선 지원",
    ],
    notIncluded: [
      "팀 협업",
    ],
    popular: true,
  },
  {
    id: "PRO",
    name: "Pro",
    description: "대량 콘텐츠 제작이 필요한 분에게",
    monthlyPrice: 49900,
    yearlyPrice: 498000,
    credits: 200,
    features: [
      "월 200개 크레딧",
      "모든 콘텐츠 생성",
      "모든 SNS 연동",
      "고급 AI 기능",
      "우선 지원",
      "팀 협업 (5인)",
    ],
    notIncluded: [],
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    description: "맞춤 솔루션이 필요하시면",
    monthlyPrice: null,
    yearlyPrice: null,
    credits: null,
    features: [
      "무제한 크레딧",
      "모든 콘텐츠 생성",
      "모든 SNS 연동",
      "고급 AI 기능",
      "전담 매니저",
      "맞춤 개발",
      "팀 협업 (무제한)",
    ],
    notIncluded: [],
  },
];

export default function PublicPricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const formatPrice = (price: number | null) => {
    if (price === null) return "문의";
    if (price === 0) return "무료";
    return `₩${price.toLocaleString()}`;
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">요금제</h1>
        <p className="text-muted-foreground mt-2">
          플랜을 선택하여 더 많은 크레딧과 기능을 이용하세요
        </p>
      </div>

      {/* Billing Cycle Toggle */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <button
          onClick={() => setBillingCycle("monthly")}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
            billingCycle === "monthly"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          월간
        </button>
        <button
          onClick={() => setBillingCycle("yearly")}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-lg transition-colors relative",
            billingCycle === "yearly"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          연간
          <span className="absolute -top-2 -right-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
            17% 할인
          </span>
        </button>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={cn(
              "relative",
              plan.popular && "border-primary shadow-lg"
            )}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  인기
                </span>
              </div>
            )}

            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="mb-4">
                <span className="text-3xl font-bold">
                  {formatPrice(
                    billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice
                  )}
                </span>
                {plan.monthlyPrice && plan.monthlyPrice > 0 && (
                  <span className="text-muted-foreground text-sm">
                    {billingCycle === "yearly" ? "/년" : "/월"}
                  </span>
                )}
              </div>

              <div className="space-y-2 mb-4">
                <p className="text-sm font-medium">
                  {plan.credits ? `${plan.credits}개 크레딧/월` : "무제한 크레딧"}
                </p>
              </div>

              <div className="space-y-2">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
                {plan.notIncluded.map((feature, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="h-4 w-4 mt-0.5 shrink-0">-</span>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>

            <CardFooter>
              {plan.id === "FREE" ? (
                <Link href="/register" className="w-full">
                  <Button variant="outline" className="w-full">
                    무료로 시작
                  </Button>
                </Link>
              ) : plan.id === "ENTERPRISE" ? (
                <Button variant="outline" className="w-full">
                  문의하기
                </Button>
              ) : (
                <Link href="/register" className="w-full">
                  <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                    구독하기
                  </Button>
                </Link>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* FAQ */}
      <div className="mt-12 max-w-2xl mx-auto">
        <h2 className="text-xl font-bold text-center mb-6">자주 묻는 질문</h2>
        <div className="space-y-4">
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium mb-2">크레딧은 어떻게 사용되나요?</h3>
            <p className="text-sm text-muted-foreground">
              카드뉴스, 블로그, 이미지 생성 등 AI 기능을 사용할 때마다 1개 크레딧이 차감됩니다.
            </p>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium mb-2">구독은 언제부터 시작되나요?</h3>
            <p className="text-sm text-muted-foreground">
              결제 직후 바로 적용되며, 다음 달 같은 날 자동으로 갱신됩니다.
            </p>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium mb-2">구독을 취소할 수 있나요?</h3>
            <p className="text-sm text-muted-foreground">
              네, 언제든지 취소할 수 있습니다. 현재 구독 기간이 끝날 때까지는 기존 플랜을 계속 이용하실 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
