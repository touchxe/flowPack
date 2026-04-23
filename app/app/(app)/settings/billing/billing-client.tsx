"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, Calendar, AlertCircle, Check, Loader2, ExternalLink, Shield, Zap, Crown } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { DsPageHeader } from "@/components/ds/ds-page-header";
import { DsSectionCard } from "@/components/ds/ds-section-card";
import { DsMsgBanner } from "@/components/ds/ds-msg-banner";
import { card, btnPrimary, btnSecondary } from "@/styles/tokens";

interface SubscriptionData {
  plan: string; status: string; billingCycle: string;
  currentPeriodEnd: string; canceledAt: string | null;
}
interface BillingClientProps { currentPlan: string; subscription: SubscriptionData | null; }

const PLAN_FEATURES: Record<string, string[]> = {
  FREE:       ["월 10개 크레딧", "카드뉴스/블로그 글 생성", "SNS 연동 1개"],
  STARTER:    ["월 50개 크레딧", "모든 콘텐츠 유형", "SNS 연동 3개", "우선 지원"],
  PRO:        ["월 200개 크레딧", "모든 콘텐츠 유형", "SNS 연동 무제한", "전담 지원", "API 접근"],
  ENTERPRISE: ["무제한 크레딧", "모든 기능", "전용 인프라", "SLA 보장"],
};

const PLAN_COLOR: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  FREE:       { color: "var(--fp-muted)", bg: "var(--fp-section-bg)", icon: <Zap size={20} color="var(--fp-muted)" /> },
  STARTER:    { color: "var(--fp-primary-subtle0)", bg: "var(--fp-primary-subtle)", icon: <Zap size={20} color="var(--fp-primary-subtle0)" /> },
  PRO:        { color: "var(--uv)", bg: "var(--fp-primary-subtle)", icon: <Crown size={20} color="var(--uv)" /> },
  ENTERPRISE: { color: "var(--fp-warning)", bg: "var(--fp-warning-bg)", icon: <Crown size={20} color="var(--fp-warning)" /> },
};

export default function BillingClient({ currentPlan, subscription }: BillingClientProps) {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isCanceled, setIsCanceled] = useState(
    !!subscription?.canceledAt || subscription?.status === "canceled"
  );
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [cancelErrorMsg, setCancelErrorMsg] = useState("");
  const [effectiveUntil, setEffectiveUntil] = useState<string | null>(null);

  const handleCancelSubscription = async () => {
    setIsCanceling(true); setCancelErrorMsg("");
    try {
      const res = await fetch("/api/subscriptions/cancel", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setIsCanceled(true); setShowCancelModal(false); setShowSuccessMessage(true);
        if (data.effectiveUntil) setEffectiveUntil(data.effectiveUntil);
        setTimeout(() => window.location.reload(), 3000);
      } else { setCancelErrorMsg(data.error ?? "구독 취소 중 오류가 발생했습니다."); }
    } catch { setCancelErrorMsg("네트워크 오류가 발생했습니다. 다시 시도해주세요."); }
    finally { setIsCanceling(false); }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  const planFeatures = PLAN_FEATURES[currentPlan] ?? PLAN_FEATURES["FREE"];
  const isActive = !isCanceled && subscription?.status === "active";
  const theme = PLAN_COLOR[currentPlan] ?? PLAN_COLOR["FREE"];

  /* ── 상태 배지 스타일 ── */
  const badgeBase = { fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 9999 } as const;
  const statusBadge = isCanceled
    ? { ...badgeBase, background: "var(--fp-error-bg)", color: "var(--fp-error-text)", border: "1px solid var(--fp-error-border)" }
    : isActive
    ? { ...badgeBase, background: "var(--fp-success-bg)", color: "var(--fp-success-text)", border: "1px solid var(--fp-success-border)" }
    : { ...badgeBase, background: "var(--fp-section-bg)", color: "var(--fp-muted)", border: "1px solid var(--fp-border)" };

  return (
    <div style={{ padding: "24px 28px" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
      `}</style>

      {/* 헤더 */}
      <DsPageHeader title="결제 설정" desc="구독 관리와 결제 내역을 확인하세요" />

      {/* 성공/오류 메시지 */}
      {showSuccessMessage && (
        <DsMsgBanner type="success" text={effectiveUntil ? `구독이 취소되었습니다. ${formatDate(effectiveUntil)}까지는 기존 플랜을 이용할 수 있습니다. 잠시 후 새로고침됩니다.` : "구독이 취소되었습니다. FREE 플랜으로 전환됩니다. 잠시 후 새로고침됩니다."} />
      )}
      {cancelErrorMsg && <DsMsgBanner type="error" text={cancelErrorMsg} />}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* 현재 플랜 카드 */}
        <DsSectionCard icon={theme.icon} title="현재 플랜" desc="현재 구독 상태" iconBg={theme.bg} bottomMargin={false}>
          {/* 플랜명 + 상태 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ fontSize: 26, fontWeight: 800, color: theme.color, margin: 0 }}>{currentPlan}</p>
            <span style={statusBadge}>
              {isCanceled ? "취소됨" : isActive ? "활성" : "무료"}
            </span>
          </div>

          {/* 결제 주기 */}
          {subscription && !isCanceled && (
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--fp-section-bg)", border: "1px solid var(--fp-border-soft)", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--fp-muted)", marginBottom: 4 }}>
                <Calendar size={12} />
                {subscription.billingCycle === "yearly" ? "연간" : "월간"} 구독
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--fp-body)", margin: 0 }}>
                다음 결제일: {formatDate(subscription.currentPeriodEnd)}
              </p>
            </div>
          )}

          {/* 포함 내용 */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--fp-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>플랜 포함 내용</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {planFeatures.map(f => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--fp-body)" }}>
                  <Check size={13} color={theme.color} style={{ flexShrink: 0 }} /> {f}
                </div>
              ))}
            </div>
          </div>

          {/* 액션 버튼 */}
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/pricing" style={{ flex: 1, textDecoration: "none" }}>
              <button style={{ ...btnPrimary, width: "100%", justifyContent: "center" }}>
                {isCanceled ? "플랜 업그레이드" : "플랜 변경"}
              </button>
            </Link>
            {!isCanceled && subscription && (
              <button onClick={() => setShowCancelModal(true)} style={btnSecondary}>
                구독 취소
              </button>
            )}
          </div>
        </DsSectionCard>

        {/* 결제 수단 카드 */}
        <DsSectionCard icon={<CreditCard size={18} color="var(--fp-primary-subtle0)" />} title="결제 수단" desc="등록된 결제 방법" bottomMargin={false}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 0 24px", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--fp-border-soft)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <CreditCard size={24} color="var(--fp-border-strong)" />
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--fp-body)", marginBottom: 4 }}>등록된 결제 수단이 없습니다</p>
            <p style={{ fontSize: 11, color: "var(--fp-muted)" }}>유료 플랜 업그레이드 시 등록됩니다.</p>
          </div>
          <Link href="/pricing" style={{ textDecoration: "none" }}>
            <button style={{ ...btnSecondary, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <ExternalLink size={14} /> 플랜 업그레이드
            </button>
          </Link>
        </DsSectionCard>
      </div>

      {/* 결제 내역 */}
      <DsSectionCard icon={<Calendar size={18} color="var(--fp-primary-subtle0)" />} title="결제 내역" desc="최근 결제 기록" bottomMargin={false}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--fp-border-soft)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <Calendar size={24} color="var(--fp-border-strong)" />
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--fp-body)", marginBottom: 4 }}>결제 내역이 없습니다</p>
          <p style={{ fontSize: 11, color: "var(--fp-muted)" }}>결제가 완료되면 이곳에 표시됩니다.</p>
        </div>
      </DsSectionCard>

      {/* 구독 취소 모달 */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent style={{ borderRadius: 20, padding: "28px", maxWidth: 440 }}>
          <DialogHeader>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--fp-warning-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertCircle size={20} color="var(--fp-warning)" />
              </div>
              <DialogTitle style={{ fontSize: 16, fontWeight: 800 }}>구독 취소</DialogTitle>
            </div>
            <DialogDescription style={{ fontSize: 13 }}>정말 구독을 취소하시겠습니까?</DialogDescription>
          </DialogHeader>
          <div style={{ margin: "16px 0", padding: "14px 16px", borderRadius: 12, background: "var(--fp-warning-bg)", border: "1px solid var(--fp-warning-border)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--fp-warning-text)", marginBottom: 8 }}>취소 시 유의사항</p>
            {[
              "현재 구독 기간이 끝날 때까지 기존 플랜을 이용할 수 있습니다",
              "기간 종료 후 FREE 플랜으로 자동 전환됩니다",
              "남은 크레딧은 유지됩니다",
            ].map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12, color: "var(--fp-warning-text)", marginBottom: 4 }}>
                <span style={{ marginTop: 2 }}>•</span> {t}
              </div>
            ))}
          </div>
          {cancelErrorMsg && (
            <p style={{ fontSize: 12, color: "var(--fp-error)", margin: "0 0 12px" }}>{cancelErrorMsg}</p>
          )}
          <DialogFooter style={{ gap: 8 }}>
            <button onClick={() => setShowCancelModal(false)} style={{ ...btnSecondary, flex: 1 }}>
              구독 계속하기
            </button>
            <button onClick={handleCancelSubscription} disabled={isCanceling}
              style={{ flex: 1, height: 42, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: isCanceling ? "not-allowed" : "pointer", border: "none", background: "var(--fp-error)", color: "var(--fp-white)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: isCanceling ? 0.7 : 1 }}>
              {isCanceling ? <><Loader2 size={14} className="animate-spin" /> 취소 중...</> : "구독 취소"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
