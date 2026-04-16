"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight, Chrome, MessageCircle, Check, Zap, Eye, EyeOff } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const reqs = [
    { id: "len",  label: "8자 이상",    ok: password.length >= 8 },
    { id: "num",  label: "숫자 포함",    ok: /\d/.test(password) },
    { id: "spc",  label: "특수문자 포함", ok: /[^a-zA-Z0-9]/.test(password) },
  ];
  const pwOk = reqs.every(r => r.ok);
  const cfOk = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    if (!pwOk) { setError("비밀번호 조건을 충족해주세요."); setIsLoading(false); return; }
    if (password !== confirmPassword) { setError("비밀번호 확인이 일치하지 않습니다."); setIsLoading(false); return; }
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "회원가입 중 오류가 발생했습니다."); setIsLoading(false); return; }
      await signIn("credentials", { email, password, redirect: false });
      router.push("/home");
    } catch {
      setError("회원가입 중 오류가 발생했습니다.");
      setIsLoading(false);
    }
  };

  const handleSocial = async (provider: "google" | "kakao") => {
    await signIn(provider, { callbackUrl: "/home" });
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#F8F7FF 0%,#EEF2FF 100%)", padding: "24px" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,BlinkMacSystemFont,system-ui,sans-serif; }
        .rf-input { width:100%; height:44px; padding:0 14px; border:1.5px solid #E5E7EB; border-radius:10px; font-size:14px; color:#111827; background:#fff; outline:none; transition:all 0.2s; box-sizing:border-box; }
        .rf-input:focus { border-color:#6366F1; box-shadow:0 0 0 3px rgba(99,102,241,0.12); }
        .rf-input:disabled { background:#F9FAFB; color:#9CA3AF; }
        .rf-input.valid { border-color:#059669; }
        .rf-input.invalid { border-color:#DC2626; }
        .rf-social { width:100%; height:44px; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.2s; border:1.5px solid #E5E7EB; background:#fff; color:#374151; }
        .rf-social:hover { border-color:#C7D2FE; background:#F8F7FF; color:#6366F1; }
        .rf-social:disabled { opacity:0.5; cursor:not-allowed; }
        .rf-submit { width:100%; height:46px; border-radius:10px; font-size:15px; font-weight:700; cursor:pointer; border:none; background:linear-gradient(135deg,#6366F1,#8B5CF6); color:#fff; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.25s; box-shadow:0 4px 14px rgba(99,102,241,0.35); }
        .rf-submit:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 8px 24px rgba(99,102,241,0.45); }
        .rf-submit:disabled { opacity:0.6; cursor:not-allowed; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* 로고 */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(99,102,241,0.35)" }}>
              <Zap size={20} color="#fff" />
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>FlowPack</span>
          </Link>
        </div>

        {/* 무료 혜택 배너 */}
        <div style={{ background: "linear-gradient(135deg,#EEF2FF,#F5F3FF)", border: "1px solid #C7D2FE", borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Zap size={15} color="#fff" />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#6366F1", marginBottom: 1 }}>무료 가입 혜택</p>
            <p style={{ fontSize: 12, color: "#8B5CF6" }}>신용카드 없이 매월 10크레딧 무료 제공</p>
          </div>
        </div>

        {/* 카드 */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "36px 32px", boxShadow: "0 4px 40px rgba(99,102,241,0.10)", border: "1px solid #E5E7EB" }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginBottom: 6, textAlign: "center" }}>회원가입</h1>
          <p style={{ fontSize: 14, color: "#9CA3AF", textAlign: "center", marginBottom: 28 }}>FlowPack을 무료로 시작하세요</p>

          {/* 소셜 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            <button className="rf-social" onClick={() => handleSocial("google")} disabled={isLoading}>
              <Chrome size={16} /> Google로 계속하기
            </button>
            <button className="rf-social" onClick={() => handleSocial("kakao")} disabled={isLoading}
              style={{ background: "#FEE500", borderColor: "#FEE500", color: "#111827" }}>
              <MessageCircle size={16} /> Kakao로 계속하기
            </button>
          </div>

          {/* 구분선 */}
          <div style={{ position: "relative", marginBottom: 20 }}>
            <div style={{ height: 1, background: "#F3F4F6" }} />
            <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "#fff", padding: "0 12px", fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>또는 이메일로 가입</span>
          </div>

          {/* 폼 */}
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", fontSize: 13, color: "#DC2626", marginBottom: 16 }}>
                {error}
              </div>
            )}

            {/* 이메일 */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>이메일</label>
              <input className="rf-input" type="email" placeholder="user@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
            </div>

            {/* 비밀번호 */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>비밀번호</label>
              <div style={{ position: "relative" }}>
                <input className="rf-input" type={showPw ? "text" : "password"} placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading}
                  style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex" }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* 비밀번호 조건 */}
              {password.length > 0 && (
                <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 10, background: "#F9FAFB", border: "1px solid #F3F4F6" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>비밀번호 조건</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {reqs.map(r => (
                      <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: r.ok ? "#059669" : "#9CA3AF" }}>
                        <div style={{ width: 16, height: 16, borderRadius: "50%", background: r.ok ? "#ECFDF5" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Check size={10} color={r.ok ? "#059669" : "#D1D5DB"} />
                        </div>
                        {r.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>비밀번호 확인</label>
              <div style={{ position: "relative" }}>
                <input
                  className={`rf-input${confirmPassword.length > 0 ? (cfOk ? " valid" : " invalid") : ""}`}
                  type={showPw2 ? "text" : "password"} placeholder="••••••••"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={isLoading}
                  style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPw2(!showPw2)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex" }}>
                  {showPw2 ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmPassword.length > 0 && !cfOk && (
                <p style={{ fontSize: 12, color: "#DC2626", marginTop: 6 }}>비밀번호가 일치하지 않습니다.</p>
              )}
            </div>

            <button type="submit" className="rf-submit" disabled={isLoading || !pwOk}>
              {isLoading ? "가입 중..." : <><span>무료로 시작하기</span><ArrowRight size={16} /></>}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: 13, color: "#9CA3AF", marginTop: 20 }}>
            이미 계정이 있으신가요?{" "}
            <Link href="/login" style={{ color: "#6366F1", fontWeight: 700, textDecoration: "none" }}>로그인</Link>
          </p>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#C4C9D4", marginTop: 20 }}>
          가입 시{" "}
          <Link href="/terms" style={{ color: "#9CA3AF", textDecoration: "underline" }}>이용약관</Link>
          {" "}및{" "}
          <Link href="/privacy" style={{ color: "#9CA3AF", textDecoration: "underline" }}>개인정보처리방침</Link>
          에 동의합니다.
        </p>
      </div>
    </div>
  );
}
