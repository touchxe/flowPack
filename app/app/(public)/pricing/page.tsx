"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X, Sparkles, ArrowRight, Zap, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TossPaymentWidget } from "@/components/features/payment/toss-payment-widget";

/* ─── 플랜 데이터 ─────────────────────────────────────── */
const plans = [
  {
    id: "FREE",
    name: "Free",
    desc: "서비스를 경험해보세요",
    monthlyPrice: 0,
    yearlyPrice: 0,
    credits: 10,
    color: "#6B7280",
    features: ["월 10개 크레딧", "카드뉴스 생성", "블로그 작성", "기본 템플릿", "Instagram 연동"],
    missing: ["고급 AI 기능", "우선 지원"],
    popular: false,
    cta: "무료로 시작",
    href: "/register",
  },
  {
    id: "STARTER",
    name: "Starter",
    desc: "꾸준히 콘텐츠를 만드시는 분",
    monthlyPrice: 19900,
    yearlyPrice: 198000,
    credits: 50,
    color: "var(--brand-500)",
    features: ["월 50개 크레딧", "모든 콘텐츠 생성", "모든 SNS 연동 6개", "고급 AI 기능", "우선 지원"],
    missing: [],
    popular: true,
    cta: "구독하기",
    href: null,
  },
  {
    id: "PRO",
    name: "Pro",
    desc: "대량 콘텐츠 제작이 필요하신 분",
    monthlyPrice: 49900,
    yearlyPrice: 498000,
    credits: 200,
    color: "var(--brand-500)",
    features: ["월 200개 크레딧", "모든 콘텐츠 생성", "모든 SNS 연동 6개", "고급 AI 기능", "우선 지원"],
    missing: [],
    popular: false,
    cta: "구독하기",
    href: null,
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    desc: "맞춤 솔루션이 필요하시면",
    monthlyPrice: null,
    yearlyPrice: null,
    credits: null,
    color: "#111827",
    features: ["무제한 크레딧", "모든 콘텐츠 생성", "모든 SNS 연동", "고급 AI 기능", "전담 매니저", "맞춤 개발"],
    missing: [],
    popular: false,
    cta: "문의하기",
    href: "mailto:support@flowpack.dev",
  },
];

const faqs = [
  { q: "크레딧은 어떻게 사용되나요?", a: "카드뉴스, 블로그, 이미지 생성 등 AI 기능을 사용할 때마다 1개 크레딧이 차감됩니다. 월 10개 크레딧은 무료로 제공됩니다." },
  { q: "구독은 언제부터 시작되나요?", a: "결제 직후 바로 적용되며, 다음 달 같은 날 자동으로 갱신됩니다." },
  { q: "구독을 취소할 수 있나요?", a: "네, 언제든지 취소할 수 있습니다. 현재 구독 기간이 끝날 때까지는 기존 플랜을 계속 이용하실 수 있습니다." },
  { q: "연간 결제 시 어떤 혜택이 있나요?", a: "연간 결제 시 약 17% 할인된 가격으로 이용하실 수 있습니다. 월 단위로 나눠서 청구되는 것이 아닌 1회 일괄 결제됩니다." },
];

/* ─── 컴포넌트 ───────────────────────────────────────── */
export default function PublicPricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<{ id: string; name: string; amount: number } | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const fmtPrice = (p: number | null) => {
    if (p === null) return "문의";
    if (p === 0) return "무료";
    return `₩${p.toLocaleString()}`;
  };

  const handleSubscribe = (plan: (typeof plans)[0]) => {
    if (plan.id === "FREE") { window.location.href = "/register"; return; }
    if (plan.id === "ENTERPRISE") { window.location.href = "mailto:support@flowpack.dev"; return; }
    const amount = billingCycle === "yearly" ? plan.yearlyPrice! : plan.monthlyPrice!;
    setSelectedPlan({ id: plan.id, name: plan.name, amount });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,BlinkMacSystemFont,system-ui,sans-serif; }
        :root { --brand:var(--brand-500); --brand2:var(--brand-500); --heading:#111827; --body:#374151; --muted:#9CA3AF; --border:#E5E7EB; --surface:#F9FAFB; }
        .fp-grad { background:linear-gradient(135deg,var(--brand-500),var(--brand-500)); }
        .fp-grad-text { background:linear-gradient(135deg,var(--brand-500),var(--brand-500)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .plan-card { background:#fff; border:1.5px solid #E5E7EB; border-radius:20px; padding:28px; transition:all 0.25s; position:relative; }
        .plan-card:hover { box-shadow:0 20px 40px var(--fp-primary-subtle); border-color:#C7D2FE; transform:translateY(-4px); }
        .plan-card.popular { border-color:var(--brand-500); box-shadow:0 8px 30px var(--fp-primary-subtle); }
        .toggle-btn { padding:9px 24px; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; transition:all 0.2s; border:none; }
        .faq-item { border-bottom:1px solid #F3F4F6; }
        .faq-item:last-child { border-bottom:none; }
      `}</style>

      {/* ── Hero ─────────────────── */}
      <section style={{ padding: "80px 24px 72px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)", width: 800, height: 600, borderRadius: "50%", background: "radial-gradient(ellipse, var(--fp-primary-subtle) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div className="mx-auto max-w-3xl" style={{ position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 9999, background: "#EEF2FF", border: "1px solid #C7D2FE", fontSize: 13, fontWeight: 600, color: "var(--brand-500)", marginBottom: 24 }}>
            <Sparkles size={14} /> 투명한 요금제
          </div>
          <h1 style={{ fontSize: "clamp(32px,5vw,52px)", fontWeight: 800, lineHeight: 1.12, letterSpacing: "-0.02em", color: "var(--heading)", marginBottom: 20 }}>
            필요한 만큼만,<br />
            <span className="fp-grad-text">합리적인 가격으로</span>
          </h1>
          <p style={{ fontSize: 17, color: "#6B7280", lineHeight: 1.6, maxWidth: 520, margin: "0 auto 40px" }}>
            무료로 시작하고, 필요할 때 업그레이드하세요. 연간 결제 시 최대 17% 할인됩니다.
          </p>

          {/* 토글 */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: 4, borderRadius: 14, background: "#F3F4F6", border: "1px solid #E5E7EB" }}>
            <button className="toggle-btn" onClick={() => setBillingCycle("monthly")}
              style={{ background: billingCycle === "monthly" ? "#fff" : "transparent", color: billingCycle === "monthly" ? "#111827" : "#9CA3AF", boxShadow: billingCycle === "monthly" ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
              월간
            </button>
            <button className="toggle-btn" onClick={() => setBillingCycle("yearly")} style={{ position: "relative", background: billingCycle === "yearly" ? "#fff" : "transparent", color: billingCycle === "yearly" ? "#111827" : "#9CA3AF", boxShadow: billingCycle === "yearly" ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
              연간
              <span style={{ position: "absolute", top: -10, right: -4, fontSize: 10, fontWeight: 700, color: "#059669", background: "#ECFDF5", padding: "2px 6px", borderRadius: 9999, border: "1px solid #A7F3D0" }}>-17%</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── 플랜 카드 ─────────────── */}
      <section style={{ padding: "0 24px 80px" }}>
        <div className="mx-auto max-w-6xl">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, alignItems: "start" }}>
            {plans.map((plan) => {
              const price = billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
              const isPop = plan.popular;
              return (
                <div key={plan.id} className={`plan-card${isPop ? " popular" : ""}`}
                  style={{ paddingTop: isPop ? 40 : 28 }}>

                  {/* 인기 뱃지 */}
                  {isPop && (
                    <div style={{ position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg,var(--brand-500),var(--brand-500))", color: "#fff", fontSize: 11, fontWeight: 700, padding: "5px 16px", borderRadius: "0 0 10px 10px", display: "flex", alignItems: "center", gap: 5 }}>
                      <Sparkles size={11} /> 가장 인기
                    </div>
                  )}

                  {/* 플랜 이름 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: plan.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 16, fontWeight: 800, color: "var(--heading)" }}>{plan.name}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 20 }}>{plan.desc}</p>

                  {/* 가격 */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 36, fontWeight: 900, color: isPop ? "var(--brand-500)" : "var(--heading)", lineHeight: 1.1 }}>
                      {fmtPrice(price)}
                      {price !== null && price > 0 && (
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#9CA3AF" }}>/{billingCycle === "yearly" ? "년" : "월"}</span>
                      )}
                    </div>
                    {billingCycle === "yearly" && price !== null && price > 0 && (
                      <p style={{ fontSize: 12, color: "#059669", marginTop: 4, fontWeight: 600 }}>
                        월 {fmtPrice(Math.round(price / 12))} 상당
                      </p>
                    )}
                  </div>

                  {/* 크레딧 */}
                  <div style={{ padding: "10px 14px", borderRadius: 10, background: isPop ? "#EEF2FF" : "#F9FAFB", marginBottom: 20, fontSize: 13, fontWeight: 700, color: isPop ? "var(--brand-500)" : "#374151", display: "flex", alignItems: "center", gap: 6 }}>
                    <Zap size={14} color={isPop ? "var(--brand-500)" : "#6B7280"} />
                    {plan.credits ? `월 ${plan.credits}크레딧` : "무제한 크레딧"}
                  </div>

                  {/* 기능 목록 */}
                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px" }}>
                    {plan.features.map(f => (
                      <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: 13, color: "#374151" }}>
                        <Check size={14} color="#059669" style={{ flexShrink: 0, marginTop: 1 }} /> {f}
                      </li>
                    ))}
                    {plan.missing.map(f => (
                      <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: 13, color: "#D1D5DB" }}>
                        <X size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA 버튼 */}
                  <button onClick={() => handleSubscribe(plan)} style={{ width: "100%", height: 44, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", border: "none", background: isPop ? "linear-gradient(135deg,var(--brand-500),var(--brand-500))" : plan.id === "FREE" ? "#F3F4F6" : "#111827", color: isPop ? "#fff" : plan.id === "FREE" ? "#374151" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.2s" }}>
                    {plan.cta} {plan.id !== "FREE" && <ArrowRight size={14} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────── */}
      <section style={{ padding: "80px 24px", background: "#F7F8FA" }}>
        <div className="mx-auto max-w-2xl">
          <h2 style={{ fontSize: "clamp(22px,3.5vw,28px)", fontWeight: 700, color: "var(--heading)", textAlign: "center", marginBottom: 40 }}>자주 묻는 질문</h2>
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E5E7EB", overflow: "hidden" }}>
            {faqs.map((f, i) => (
              <div key={i} className="faq-item">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--heading)", textAlign: "left", gap: 12 }}>
                  <span>{f.q}</span>
                  <ChevronDown size={16} color="#9CA3AF" style={{ flexShrink: 0, transform: openFaq === i ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                </button>
                {openFaq === i && (
                  <div style={{ padding: "0 24px 18px", fontSize: 14, color: "#6B7280", lineHeight: 1.6 }}>{f.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 하단 CTA ─────────────── */}
      <section style={{ padding: "64px 24px" }}>
        <div className="mx-auto max-w-3xl" style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(22px,3.5vw,30px)", fontWeight: 800, color: "var(--heading)", marginBottom: 12 }}>
            아직도 고민 중이신가요?
          </h2>
          <p style={{ fontSize: 16, color: "#6B7280", marginBottom: 32 }}>
            무료 플랜으로 시작해보세요. 신용카드 없이, 언제든 취소 가능합니다.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/register" style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 52, padding: "0 32px", borderRadius: 12, background: "linear-gradient(135deg,var(--brand-500),var(--brand-500))", color: "#fff", fontSize: 15, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 14px var(--fp-primary-subtle)" }}>
              무료로 시작하기 <ArrowRight size={16} />
            </Link>
            <a href="mailto:support@flowpack.dev" style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 52, padding: "0 32px", borderRadius: 12, background: "#fff", color: "#374151", fontSize: 15, fontWeight: 600, textDecoration: "none", border: "1.5px solid #E5E7EB" }}>
              문의하기
            </a>
          </div>
        </div>
      </section>

      {/* ── 결제 다이얼로그 ────────── */}
      <Dialog open={!!selectedPlan} onOpenChange={(open) => !open && setSelectedPlan(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedPlan?.name} 플랜 구독 — {billingCycle === "yearly" ? "연간" : "월간"}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#EEF2FF", borderRadius: 10, marginBottom: 16, border: "1px solid #C7D2FE" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>결제 금액</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: "var(--brand-500)" }}>
                ₩{selectedPlan?.amount.toLocaleString()}
                <span style={{ fontSize: 13, fontWeight: 400, color: "#9CA3AF" }}> / {billingCycle === "yearly" ? "년" : "월"}</span>
              </span>
            </div>
            {selectedPlan && (
              <TossPaymentWidget
                plan={selectedPlan.id as "STARTER" | "PRO" | "ENTERPRISE"}
                billingCycle={billingCycle}
                amount={selectedPlan.amount}
                onSuccess={() => setSelectedPlan(null)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
