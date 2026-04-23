"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight, Chrome, MessageCircle, Zap, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export function LoginForm() {

  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/home";

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
        setIsLoading(false);
        return;
      }
      // 하드 리다이렉트로 미들웨어 루프 우회
      window.location.href = callbackUrl;
    } catch {
      setError("로그인 중 오류가 발생했습니다.");
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: "google" | "kakao") => {
    await signIn(provider, { callbackUrl });
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#F8F7FF 0%,#EEF2FF 100%)", padding: "24px" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,BlinkMacSystemFont,system-ui,sans-serif; }
        .lf-input { width:100%; height:44px; padding:0 14px; border:1.5px solid #E5E7EB; border-radius:10px; font-size:14px; color:#111827; background:#fff; outline:none; transition:all 0.2s; box-sizing:border-box; }
        .lf-input:focus { border-color:var(--fp-primary-subtle0); box-shadow:0 0 0 3px rgba(99,102,241,0.12); }
        .lf-input:disabled { background:#F9FAFB; color:#9CA3AF; }
        .lf-social { width:100%; height:44px; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.2s; border:1.5px solid #E5E7EB; background:#fff; color:#374151; }
        .lf-social:hover { border-color:#C7D2FE; background:#F8F7FF; color:var(--fp-primary-subtle0); }
        .lf-social:disabled { opacity:0.5; cursor:not-allowed; }
        .lf-submit { width:100%; height:46px; border-radius:10px; font-size:15px; font-weight:700; cursor:pointer; border:none; background:linear-gradient(135deg,var(--fp-primary-subtle0),var(--fp-primary-subtle0)); color:#fff; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.25s; box-shadow:0 4px 14px rgba(99,102,241,0.35); }
        .lf-submit:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 8px 24px rgba(99,102,241,0.45); }
        .lf-submit:disabled { opacity:0.7; cursor:not-allowed; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* 로고 */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,var(--fp-primary-subtle0),var(--fp-primary-subtle0))", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(99,102,241,0.35)" }}>
              <Zap size={20} color="#fff" />
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>FlowPack</span>
          </Link>
        </div>

        {/* 카드 */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "36px 32px", boxShadow: "0 4px 40px rgba(99,102,241,0.10)", border: "1px solid #E5E7EB" }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginBottom: 6, textAlign: "center" }}>로그인</h1>
          <p style={{ fontSize: 14, color: "#9CA3AF", textAlign: "center", marginBottom: 28 }}>FlowPack 계정으로 로그인하세요</p>

          {/* 소셜 로그인 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            <button className="lf-social" onClick={() => handleSocialLogin("google")} disabled={isLoading}>
              <Chrome size={16} /> Google로 계속하기
            </button>
            <button className="lf-social" onClick={() => handleSocialLogin("kakao")} disabled={isLoading} style={{ background: "#FEE500", borderColor: "#FEE500", color: "#111827" }}>
              <MessageCircle size={16} /> Kakao로 계속하기
            </button>
          </div>

          {/* 구분선 */}
          <div style={{ position: "relative", marginBottom: 20 }}>
            <div style={{ height: 1, background: "#F3F4F6" }} />
            <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "#fff", padding: "0 12px", fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>또는 이메일로 로그인</span>
          </div>

          {/* 이메일 폼 */}
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", fontSize: 13, color: "#DC2626", marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>이메일</label>
              <input className="lf-input" type="email" placeholder="user@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>비밀번호</label>
                <Link href="/find-password" style={{ fontSize: 12, color: "var(--fp-primary-subtle0)", textDecoration: "none", fontWeight: 500 }}>비밀번호를 잊으셨나요?</Link>
              </div>
              <div style={{ position: "relative" }}>
                <input className="lf-input" type={showPw ? "text" : "password"} placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading}
                  style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex", alignItems: "center" }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="lf-submit" disabled={isLoading}>
              {isLoading ? "로그인 중..." : <><span>로그인</span><ArrowRight size={16} /></>}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: 13, color: "#9CA3AF", marginTop: 20 }}>
            계정이 없으신가요?{" "}
            <Link href="/register" style={{ color: "var(--fp-primary-subtle0)", fontWeight: 700, textDecoration: "none" }}>회원가입</Link>
          </p>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#C4C9D4", marginTop: 20 }}>
          로그인 시{" "}
          <Link href="/terms" style={{ color: "#9CA3AF", textDecoration: "underline" }}>이용약관</Link>
          {" "}및{" "}
          <Link href="/privacy" style={{ color: "#9CA3AF", textDecoration: "underline" }}>개인정보처리방침</Link>
          에 동의합니다.
        </p>
      </div>
    </main>
  );
}
