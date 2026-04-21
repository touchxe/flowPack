"use client";

import { useState, useEffect } from "react";
import { Bell, Mail, MessageSquare, Check, AlertCircle, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

type Prefs = {
  emailMarketing: boolean; emailNewsletter: boolean; emailComments: boolean;
  emailPublish: boolean; emailBilling: boolean;
  pushEnabled: boolean; pushComments: boolean; pushPublish: boolean;
};
type Message = { type: "success" | "error"; text: string } | null;

const DEFAULT_PREFS: Prefs = {
  emailMarketing: false, emailNewsletter: true, emailComments: true,
  emailPublish: true, emailBilling: true,
  pushEnabled: false, pushComments: true, pushPublish: true,
};

const EMAIL_ITEMS: { key: keyof Prefs; label: string; desc: string }[] = [
  { key: "emailMarketing",  label: "마케팅 이메일",  desc: "새 기능, 프로모션, 할인 코드 등의 내용을 받아보세요." },
  { key: "emailNewsletter", label: "뉴스레터",       desc: "주간 뉴스레터를 받아보세요." },
  { key: "emailComments",   label: "댓글 알림",      desc: "내 콘텐츠에 댓글이 달릴 때 알림을 받아보세요." },
  { key: "emailPublish",    label: "발행 알림",      desc: "예약된 콘텐츠가 발행될 때 알림을 받아보세요." },
  { key: "emailBilling",    label: "결제 알림",      desc: "결제 완료, 구독 갱신 등 결제 관련 알림을 받아보세요." },
];

const PUSH_ITEMS: { key: keyof Prefs; label: string; desc: string }[] = [
  { key: "pushComments", label: "댓글 알림", desc: "새 댓글이 달릴 때 즉시 알림을 받아보세요." },
  { key: "pushPublish",  label: "발행 알림", desc: "예약된 콘텐츠가 발행될 때 알림을 받아보세요." },
];

function NotifSection({ icon, title, desc, children }: {
  icon: React.ReactNode; title: string; desc: string; children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16, overflow: "hidden", marginBottom: 14 }}>
      <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0 }}>{title}</p>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>{desc}</p>
        </div>
      </div>
      <div style={{ padding: "8px 22px 16px" }}>{children}</div>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: {
  label: string; desc: string; checked: boolean; onChange: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid #F9FAFB" }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0, marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function NotificationsSettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [msg, setMsg] = useState<Message>(null);

  useEffect(() => {
    fetch("/api/user/notifications")
      .then(r => r.json())
      .then(d => { if (d.preferences) setPrefs(d.preferences); })
      .finally(() => setIsLoading(false));
  }, []);

  const toggle = (key: keyof Prefs) => setPrefs(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/user/notifications", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(prefs),
      });
      const d = await res.json();
      if (!res.ok) setMsg({ type: "error", text: d.error });
      else { setMsg({ type: "success", text: d.message }); setTimeout(() => setMsg(null), 3000); }
    } catch { setMsg({ type: "error", text: "저장 중 오류가 발생했습니다." }); }
    finally { setIsSaving(false); }
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, gap: 12, flexDirection: "column" }}>
        <Loader2 size={24} color="var(--brand-500)" className="animate-spin" />
        <p style={{ fontSize: 13, color: "#9CA3AF" }}>설정을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: 640 }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
      `}</style>

      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, marginBottom: 4 }}>알림 설정</h1>
        <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>이메일과 푸시 알림을 관리하세요.</p>
      </div>

      {/* 메시지 배너 */}
      {msg && (
        <div style={{ padding: "12px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, marginBottom: 20, background: msg.type === "success" ? "#ECFDF5" : "#FEF2F2", border: `1.5px solid ${msg.type === "success" ? "#A7F3D0" : "#FECACA"}`, color: msg.type === "success" ? "#065F46" : "#991B1B" }}>
          {msg.type === "success" ? <Check size={15} /> : <AlertCircle size={15} />}
          {msg.text}
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* 이메일 알림 */}
        <NotifSection icon={<Mail size={18} color="var(--brand-500)" />} title="이메일 알림" desc="FlowPack에서 보내는 이메일 알림을 설정하세요.">
          {EMAIL_ITEMS.map(item => (
            <ToggleRow key={item.key} label={item.label} desc={item.desc} checked={prefs[item.key]} onChange={() => toggle(item.key)} />
          ))}
        </NotifSection>

        {/* 푸시 알림 */}
        <NotifSection icon={<Bell size={18} color="var(--brand-500)" />} title="푸시 알림" desc="브라우저 푸시 알림을 설정하세요. 브라우저에서 권한을 허용해야 합니다.">
          <ToggleRow label="푸시 알림 활성화" desc="푸시 알림을 받으려면 브라우저 권한이 필요합니다." checked={prefs.pushEnabled} onChange={() => toggle("pushEnabled")} />
          {prefs.pushEnabled && PUSH_ITEMS.map(item => (
            <ToggleRow key={item.key} label={item.label} desc={item.desc} checked={prefs[item.key]} onChange={() => toggle(item.key)} />
          ))}
        </NotifSection>

        {/* SMS */}
        <NotifSection icon={<MessageSquare size={18} color="#9CA3AF" />} title="SMS 알림" desc="SMS로 중요한 알림을 받아보세요.">
          <div style={{ padding: "16px 0", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", background: "#F3F4F6", padding: "4px 10px", borderRadius: 9999, textTransform: "uppercase", letterSpacing: "0.06em" }}>준비 중</span>
            <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>SMS 알림은 현재 준비 중입니다. 이메일 알림을 이용해주세요.</p>
          </div>
        </NotifSection>

        {/* 저장 버튼 */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button type="submit" disabled={isSaving}
            style={{ height: 42, padding: "0 28px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: isSaving ? "not-allowed" : "pointer", border: "none", background: isSaving ? "#C7D2FE" : "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))", color: "#fff", display: "flex", alignItems: "center", gap: 8, boxShadow: isSaving ? "none" : "0 2px 8px rgba(99,102,241,0.3)" }}>
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            {isSaving ? "저장 중..." : "알림 설정 저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
