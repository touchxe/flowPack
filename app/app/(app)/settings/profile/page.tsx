"use client";

import { useState, useEffect } from "react";
import { User, Mail, Lock, Check, AlertCircle, Shield, Loader2, Eye, EyeOff, Palette, Sun, Moon, Monitor } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Message = { type: "success" | "error"; text: string } | null;

function MsgBanner({ msg, onClose }: { msg: Message; onClose: () => void }) {
  if (!msg) return null;
  const ok = msg.type === "success";
  return (
    <div style={{ padding: "12px 16px", borderRadius: 10, display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, marginBottom: 20, background: ok ? "#ECFDF5" : "#FEF2F2", border: `1.5px solid ${ok ? "#A7F3D0" : "#FECACA"}`, color: ok ? "#065F46" : "#991B1B" }}>
      {ok ? <Check size={15} /> : <AlertCircle size={15} />}
      {msg.text}
      <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 16 }}>×</button>
    </div>
  );
}

function SettingSection({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>{title}</p>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>{desc}</p>
        </div>
      </div>
      <div style={{ padding: "20px 24px" }}>{children}</div>
    </div>
  );
}

function FormField({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
      {children}
      {note && <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 5 }}>{note}</p>}
    </div>
  );
}

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

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 42, padding: "0 14px", border: "1.5px solid #E5E7EB", borderRadius: 10,
    fontSize: 14, color: "#111827", background: "#fff", outline: "none", boxSizing: "border-box",
    transition: "all 0.2s",
  };
  const disabledInputStyle: React.CSSProperties = { ...inputStyle, background: "#F9FAFB", color: "#9CA3AF", cursor: "not-allowed" };

  const SaveBtn = ({ loading, label }: { loading: boolean; label: string }) => (
    <button type="submit" disabled={loading}
      style={{ height: 42, padding: "0 24px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", border: "none", background: loading ? "#C7D2FE" : "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))", color: "#fff", display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s", boxShadow: loading ? "none" : "0 2px 8px rgba(99,102,241,0.3)" }}>
      {loading && <Loader2 size={14} className="animate-spin" />}
      {label}
    </button>
  );

  return (
    <div style={{ padding: "24px 28px", maxWidth: 680 }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        input:focus { border-color:var(--brand-500) !important; box-shadow:0 0 0 3px rgba(99,102,241,0.10) !important; }
      `}</style>

      {/* 헤더 */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, marginBottom: 4 }}>프로필 설정</h1>
        <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>계정 정보를 관리하세요.</p>
      </div>

      {/* 아바타 카드 */}
      <div style={{ background: "linear-gradient(135deg,#EEF2FF,#F5F3FF)", border: "1.5px solid #C7D2FE", borderRadius: 16, padding: "24px", marginBottom: 16, display: "flex", alignItems: "center", gap: 20 }}>
        <Avatar style={{ width: 64, height: 64 }}>
          <AvatarImage src={session?.user?.image || undefined} alt={name} />
          <AvatarFallback style={{ background: "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))", color: "#fff", fontSize: 22, fontWeight: 800 }}>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <p style={{ fontSize: 17, fontWeight: 800, color: "#111827", margin: 0, marginBottom: 2 }}>{name || "이름 없음"}</p>
          <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>{email}</p>
        </div>
      </div>

      {/* 외관 설정 (테마 선택) */}
      <SettingSection icon={<Palette size={18} color="var(--brand-500)" />} title="외관 설정" desc="대시보드 테마를 선택하세요.">
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
      </SettingSection>

      {/* 기본 정보 */}
      <SettingSection icon={<User size={18} color="var(--brand-500)" />} title="기본 정보" desc="이름과 이메일 주소를 관리하세요.">
        <MsgBanner msg={profileMsg} onClose={() => setProfileMsg(null)} />
        <form onSubmit={handleSaveProfile}>
          <FormField label="이름">
            <div style={{ position: "relative" }}>
              <User size={15} color="#9CA3AF" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="이름을 입력하세요" required style={{ ...inputStyle, paddingLeft: 36 }} />
            </div>
          </FormField>
          <FormField label="이메일" note="이메일은 비밀번호 찾기에 사용되며 변경할 수 없습니다.">
            <div style={{ position: "relative" }}>
              <Mail size={15} color="#C4C9D4" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input type="email" value={email} disabled style={{ ...disabledInputStyle, paddingLeft: 36 }} />
            </div>
          </FormField>
          <SaveBtn loading={isSavingProfile} label={isSavingProfile ? "저장 중..." : "변경사항 저장"} />
        </form>
      </SettingSection>

      {/* 비밀번호 변경 */}
      <SettingSection icon={<Lock size={18} color="var(--brand-500)" />} title="비밀번호 변경" desc="계정 보안을 위해 정기적으로 비밀번호를 변경하세요.">
        <MsgBanner msg={passwordMsg} onClose={() => setPasswordMsg(null)} />
        <form onSubmit={handleChangePassword}>
          <FormField label="현재 비밀번호">
            <div style={{ position: "relative" }}>
              <input type={showPw ? "text" : "password"} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="현재 비밀번호" required style={{ ...inputStyle, paddingRight: 44 }} />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </FormField>
          <FormField label="새 비밀번호">
            <div style={{ position: "relative" }}>
              <input type={showNewPw ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="8자 이상, 숫자+특수문자 포함" required style={{ ...inputStyle, paddingRight: 44 }} />
              <button type="button" onClick={() => setShowNewPw(!showNewPw)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}>
                {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </FormField>
          <FormField label="새 비밀번호 확인">
            <div style={{ position: "relative" }}>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="비밀번호를 다시 입력하세요" required
                style={{ ...inputStyle, borderColor: confirmPassword && confirmPassword !== newPassword ? "#FCA5A5" : "#E5E7EB" }} />
              {confirmPassword && confirmPassword === newPassword && (
                <Check size={16} color="#059669" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }} />
              )}
            </div>
          </FormField>
          <SaveBtn loading={isSavingPassword} label={isSavingPassword ? "변경 중..." : "비밀번호 변경"} />
        </form>
      </SettingSection>

      {/* 위험 구역 */}
      <div style={{ background: "#fff", border: "1.5px solid #FECACA", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #FEF2F2", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Shield size={18} color="#EF4444" />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#DC2626", margin: 0 }}>위험 구역</p>
            <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다.</p>
          </div>
        </div>
        <div style={{ padding: "20px 24px" }}>
          <button style={{ height: 40, padding: "0 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1.5px solid #FCA5A5", background: "#FEF2F2", color: "#DC2626", transition: "all 0.2s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#DC2626"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#FEF2F2"; (e.currentTarget as HTMLElement).style.color = "#DC2626"; }}>
            계정 삭제
          </button>
        </div>
      </div>
    </div>
  );
}
