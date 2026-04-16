"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, Calendar, AlertCircle, Check, Loader2, ExternalLink, Shield, Zap, Crown } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface SubscriptionData {
  plan: string; status: string; billingCycle: string;
  currentPeriodEnd: string; canceledAt: string | null;
}
interface BillingClientProps { currentPlan: string; subscription: SubscriptionData | null; }

const PLAN_FEATURES: Record<string, string[]> = {
  FREE:       ["월 10개 크레딧", "카드뉴스/블로그 생성", "SNS 연동 1개"],
  STARTER:    ["월 50개 크레딧", "모든 콘텐츠 유형", "SNS 연동 3개", "우선 지원"],
  PRO:        ["월 200개 크레딧", "모든 콘텐츠 유형", "SNS 연동 무제한", "전담 지원", "API 접근"],
  ENTERPRISE: ["무제한 크레딧", "모든 기능", "전용 인프라", "SLA 보장"],
};

const PLAN_COLOR: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  FREE:       { color: "#9CA3AF", bg: "#F9FAFB", icon: <Zap size={20} color="#9CA3AF" /> },
  STARTER:    { color: "#6366F1", bg: "#EEF2FF", icon: <Zap size={20} color="#6366F1" /> },
  PRO:        { color: "#8B5CF6", bg: "#F5F3FF", icon: <Crown size={20} color="#8B5CF6" /> },
  ENTERPRISE: { color: "#D97706", bg: "#FFF7ED", icon: <Crown size={20} color="#D97706" /> },
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

  return (
    <div style={{ padding: "24px 28px" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        .section-card { background:#fff; border:1.5px solid #E5E7EB; border-radius:16px; overflow:hidden; }
        .section-header { padding:18px 22px; borderBottom:1px solid #F3F4F6; display:flex; alignItems:center; gap:10px; }
        .upgrade-btn { display:inline-flex; alignItems:center; gap:7px; height:42px; padding:0 22px; borderRadius:10px; fontSize:13px; fontWeight:700; cursor:pointer; border:none; background:linear-gradient(135deg,#6366F1,#8B5CF6); color:#fff; textDecoration:none; boxShadow:0 2px 8px rgba(99,102,241,0.3); transition:all 0.2s; }
      `}</style>

      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, marginBottom: 4 }}>결제 설정</h1>
        <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>구독 관리와 결제 내역을 확인하세요</p>
      </div>

      {/* 성공/오류 메시지 */}
      {showSuccessMessage && (
        <div style={{ marginBottom: 20, padding: "12px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, background: "#ECFDF5", border: "1.5px solid #A7F3D0", color: "#065F46", fontSize: 13, fontWeight: 600 }}>
          <Check size={15} />
          구독이 취소되었습니다. {effectiveUntil ? `${formatDate(effectiveUntil)}까지는 기존 플랜을 이용할 수 있습니다.` : "FREE 플랜으로 전환됩니다."} 잠시 후 새로고침됩니다.
        </div>
      )}
      {cancelErrorMsg && (
        <div style={{ marginBottom: 20, padding: "12px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#991B1B", fontSize: 13, fontWeight: 600 }}>
          <AlertCircle size={15} /> {cancelErrorMsg}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* 현재 플랜 카드 */}
        <div className="section-card">
          <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{theme.icon}</div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0 }}>현재 플랜</p>
              <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>현재 구독 상태</p>
            </div>
          </div>
          <div style={{ padding: "20px 22px" }}>
            {/* 플랜명 + 상태 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <p style={{ fontSize: 26, fontWeight: 800, color: theme.color, margin: 0 }}>{currentPlan}</p>
              {isCanceled ? (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 9999, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>취소됨</span>
              ) : isActive ? (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 9999, background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0" }}>활성</span>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 9999, background: "#F9FAFB", color: "#9CA3AF", border: "1px solid #E5E7EB" }}>무료</span>
              )}
            </div>

            {/* 결제 주기 */}
            {subscription && !isCanceled && (
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "#F9FAFB", border: "1px solid #F3F4F6", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9CA3AF", marginBottom: 4 }}>
                  <Calendar size={12} />
                  {subscription.billingCycle === "yearly" ? "연간" : "월간"} 구독
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: 0 }}>
                  다음 결제일: {formatDate(subscription.currentPeriodEnd)}
                </p>
              </div>
            )}

            {/* 포함 내용 */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>플랜 포함 내용</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {planFeatures.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151" }}>
                    <Check size={13} color={theme.color} style={{ flexShrink: 0 }} /> {f}
                  </div>
                ))}
              </div>
            </div>

            {/* 액션 버튼 */}
            <div style={{ display: "flex", gap: 8 }}>
              <Link href="/pricing" style={{ flex: 1, textDecoration: "none" }}>
                <button style={{ width: "100%", height: 42, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}>
                  {isCanceled ? "플랜 업그레이드" : "플랜 변경"}
                </button>
              </Link>
              {!isCanceled && subscription && (
                <button onClick={() => setShowCancelModal(true)}
                  style={{ height: 42, padding: "0 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151", transition: "all 0.15s", whiteSpace: "nowrap" }}>
                  구독 취소
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 결제 수단 카드 */}
        <div className="section-card">
          <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CreditCard size={18} color="#6366F1" />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0 }}>결제 수단</p>
              <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>등록된 결제 방법</p>
            </div>
          </div>
          <div style={{ padding: "20px 22px" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 0 24px", textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <CreditCard size={24} color="#D1D5DB" />
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>등록된 결제 수단이 없습니다</p>
              <p style={{ fontSize: 11, color: "#9CA3AF" }}>유료 플랜 업그레이드 시 등록됩니다.</p>
            </div>
            <Link href="/pricing" style={{ textDecoration: "none" }}>
              <button style={{ width: "100%", height: 42, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <ExternalLink size={14} /> 플랜 업그레이드
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* 결제 내역 */}
      <div className="section-card">
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Calendar size={18} color="#6366F1" />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0 }}>결제 내역</p>
            <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>최근 결제 기록</p>
          </div>
        </div>
        <div style={{ padding: "20px 22px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <Calendar size={24} color="#D1D5DB" />
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>결제 내역이 없습니다</p>
            <p style={{ fontSize: 11, color: "#9CA3AF" }}>결제가 완료되면 이곳에 표시됩니다.</p>
          </div>
        </div>
      </div>

      {/* 구독 취소 모달 */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent style={{ borderRadius: 20, padding: "28px", maxWidth: 440 }}>
          <DialogHeader>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "#FFF7ED", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertCircle size={20} color="#D97706" />
              </div>
              <DialogTitle style={{ fontSize: 16, fontWeight: 800 }}>구독 취소</DialogTitle>
            </div>
            <DialogDescription style={{ fontSize: 13 }}>정말 구독을 취소하시겠습니까?</DialogDescription>
          </DialogHeader>
          <div style={{ margin: "16px 0", padding: "14px 16px", borderRadius: 12, background: "#FFF7ED", border: "1px solid #FED7AA" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#92400E", marginBottom: 8 }}>취소 시 유의사항</p>
            {[
              "현재 구독 기간이 끝날 때까지 기존 플랜을 이용할 수 있습니다",
              "기간 종료 후 FREE 플랜으로 자동 전환됩니다",
              "남은 크레딧은 유지됩니다",
            ].map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12, color: "#92400E", marginBottom: 4 }}>
                <span style={{ marginTop: 2 }}>•</span> {t}
              </div>
            ))}
          </div>
          {cancelErrorMsg && (
            <p style={{ fontSize: 12, color: "#DC2626", margin: "0 0 12px" }}>{cancelErrorMsg}</p>
          )}
          <DialogFooter style={{ gap: 8 }}>
            <button onClick={() => setShowCancelModal(false)}
              style={{ flex: 1, height: 42, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151" }}>
              구독 계속하기
            </button>
            <button onClick={handleCancelSubscription} disabled={isCanceling}
              style={{ flex: 1, height: 42, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: isCanceling ? "not-allowed" : "pointer", border: "none", background: "#EF4444", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: isCanceling ? 0.7 : 1 }}>
              {isCanceling ? <><Loader2 size={14} className="animate-spin" /> 취소 중...</> : "구독 취소"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
