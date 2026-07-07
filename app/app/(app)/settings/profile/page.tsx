"use client";

import { useState, useEffect } from "react";
import { User, Mail, Lock, Check, Shield, Loader2, Eye, EyeOff, Palette, Sun, Moon, Monitor } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DsPageHeader } from "@/components/ds/ds-page-header";
import { DsSectionCard } from "@/components/ds/ds-section-card";
import { DsMsgBanner } from "@/components/ds/ds-msg-banner";
import { DsFormField } from "@/components/ds/ds-form-field";
import { inputBase, inputDisabled, btnPrimary, btnDestructive } from "@/styles/tokens";

type Message = { type: "success" | "error"; text: string } | null;

export default function ProfileSettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [profileMsg, setProfileMsg] = useState<Message>(null);
  const [passwordMsg, setPasswordMsg] = useState<Message>(null);
  const [showPw, setShowPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const themeOptions = [
    { value: "light",  label: "라이트", icon: <Sun size={20} />,     desc: "밝은 배경" },
    { value: "dark",   label: "다크",   icon: <Moon size={20} />,    desc: "어두운 배경" },
    { value: "system", label: "시스템", icon: <Monitor size={20} />, desc: "OS 설정 따름" },
  ] as const;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (session?.user) { setName(session.user.name ?? ""); setEmail(session.user.email ?? ""); }
  }, [session]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true); setProfileMsg(null);
    try {
      const res = await fetch("/api/user/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const d = await res.json();
      if (!res.ok) setProfileMsg({ type: "error", text: d.error });
      else { setProfileMsg({ type: "success", text: d.message }); await updateSession({ name }); }
    } catch { setProfileMsg({ type: "error", text: "저장 중 오류가 발생했습니다." }); }
    finally { setIsSavingProfile(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setPasswordMsg({ type: "error", text: "새 비밀번호가 일치하지 않습니다." }); return; }
    setIsSavingPassword(true); setPasswordMsg(null);
    try {
      const res = await fetch("/api/user/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
      const d = await res.json();
      if (!res.ok) setPasswordMsg({ type: "error", text: d.error });
      else { setPasswordMsg({ type: "success", text: d.message }); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }
    } catch { setPasswordMsg({ type: "error", text: "변경 중 오류가 발생했습니다." }); }
    finally { setIsSavingPassword(false); }
  };

  const initials = session?.user?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || session?.user?.email?.[0]?.toUpperCase() || "U";

  const SaveBtn = ({ loading, label }: { loading: boolean; label: string }) => (
    <button type="submit" disabled={loading}
      style={{ ...btnPrimary, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
      {loading && <Loader2 size={14} className="animate-spin" />}
      {label}
    </button>
  );

  return (
    <div style={{ padding: "32px 40px", maxWidth: 800 }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        input:focus { border-color:var(--brand-500) !important; box-shadow:0 0 0 3px var(--fp-primary-subtle) !important; }
      `}</style>

      {/* 헤더 */}
      <DsPageHeader title="프로필 설정" desc="계정 정보를 관리하세요." />

      {/* 아바타 카드 */}
      <div style={{ background: "var(--fp-gradient-persona)", border: "1.5px solid var(--fp-border)", borderRadius: 18, padding: "30px", marginBottom: 20, display: "flex", alignItems: "center", gap: 24, boxShadow: "var(--fp-shadow-card)" }}>
        <Avatar style={{ width: 76, height: 76 }}>
          <AvatarImage src={session?.user?.image || undefined} alt={name} />
          <AvatarFallback style={{ background: "var(--brand-gradient)", color: "var(--fp-white)", fontSize: 26, fontWeight: 800 }}>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <p style={{ fontSize: 22, fontWeight: 800, color: "var(--fp-heading)", margin: 0, marginBottom: 4 }}>{name || "이름 없음"}</p>
          <p style={{ fontSize: 15, color: "var(--fp-secondary)", margin: 0 }}>{email}</p>
        </div>
      </div>

      {/* 외관 설정 (테마 선택) */}
      <DsSectionCard icon={<Palette size={18} color="var(--brand-500)" />} title="외관 설정" desc="대시보드 테마를 선택하세요.">
        {mounted && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {themeOptions.map(opt => {
              const isSelected = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  style={{
                    padding: "20px 16px",
                    borderRadius: 12,
                    border: isSelected ? "2px solid var(--brand-500)" : "1.5px solid var(--fp-border)",
                    background: isSelected ? "var(--fp-primary-subtle)" : "var(--fp-card-bg)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    transition: "all 0.2s",
                    outline: "none",
                    position: "relative",
                  }}
                >
                  {isSelected && (
                    <div style={{
                      position: "absolute", top: 8, right: 8,
                      width: 18, height: 18, borderRadius: "50%",
                      background: "var(--brand-500)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Check size={11} color="#000" strokeWidth={3} />
                    </div>
                  )}
                  <div style={{
                    color: isSelected ? "var(--brand-500)" : "var(--fp-muted)",
                    transition: "color 0.2s",
                  }}>
                    {opt.icon}
                  </div>
                  <span style={{
                    fontSize: 14, fontWeight: 700,
                    color: isSelected ? "var(--fp-heading)" : "var(--fp-secondary)",
                  }}>
                    {opt.label}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--fp-muted)" }}>
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </DsSectionCard>

      {/* 기본 정보 */}
      <DsSectionCard icon={<User size={18} color="var(--brand-500)" />} title="기본 정보" desc="이름과 이메일 주소를 관리하세요.">
        {profileMsg && <DsMsgBanner type={profileMsg.type} text={profileMsg.text} />}
        <form onSubmit={handleSaveProfile}>
          <DsFormField label="이름">
            <div style={{ position: "relative" }}>
              <User size={15} color="var(--fp-muted)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="이름을 입력하세요" required style={{ ...inputBase, paddingLeft: 36 }} />
            </div>
          </DsFormField>
          <DsFormField label="이메일" note="이메일은 비밀번호 찾기에 사용되며 변경할 수 없습니다.">
            <div style={{ position: "relative" }}>
              <Mail size={15} color="var(--fp-muted)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input type="email" value={email} disabled style={{ ...inputDisabled, paddingLeft: 36 }} />
            </div>
          </DsFormField>
          <SaveBtn loading={isSavingProfile} label={isSavingProfile ? "저장 중..." : "변경사항 저장"} />
        </form>
      </DsSectionCard>

      {/* 비밀번호 변경 */}
      <DsSectionCard icon={<Lock size={18} color="var(--brand-500)" />} title="비밀번호 변경" desc="계정 보안을 위해 정기적으로 비밀번호를 변경하세요.">
        {passwordMsg && <DsMsgBanner type={passwordMsg.type} text={passwordMsg.text} />}
        <form onSubmit={handleChangePassword}>
          <DsFormField label="현재 비밀번호">
            <div style={{ position: "relative" }}>
              <input type={showPw ? "text" : "password"} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="현재 비밀번호" required style={{ ...inputBase, paddingRight: 44 }} />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--fp-muted)" }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </DsFormField>
          <DsFormField label="새 비밀번호">
            <div style={{ position: "relative" }}>
              <input type={showNewPw ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="8자 이상, 숫자+특수문자 포함" required style={{ ...inputBase, paddingRight: 44 }} />
              <button type="button" onClick={() => setShowNewPw(!showNewPw)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--fp-muted)" }}>
                {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </DsFormField>
          <DsFormField label="새 비밀번호 확인">
            <div style={{ position: "relative" }}>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="비밀번호를 다시 입력하세요" required
                style={{ ...inputBase, borderColor: confirmPassword && confirmPassword !== newPassword ? "var(--fp-error-border)" : "var(--fp-border)" }} />
              {confirmPassword && confirmPassword === newPassword && (
                <Check size={16} color="var(--fp-success)" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }} />
              )}
            </div>
          </DsFormField>
          <SaveBtn loading={isSavingPassword} label={isSavingPassword ? "변경 중..." : "비밀번호 변경"} />
        </form>
      </DsSectionCard>

      {/* 위험 구역 */}
      <DsSectionCard
        icon={<Shield size={18} color="var(--fp-error)" />}
        title="위험 구역"
        desc="계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다."
        iconBg="var(--fp-error-bg)"
        style={{ border: "1.5px solid var(--fp-error-border)" }}
        bottomMargin={false}
      >
        <button
          style={btnDestructive}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--fp-error)"; (e.currentTarget as HTMLElement).style.color = "var(--fp-white)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--fp-error-bg)"; (e.currentTarget as HTMLElement).style.color = "var(--fp-error-text)"; }}
        >
          계정 삭제
        </button>
      </DsSectionCard>
    </div>
  );
}
