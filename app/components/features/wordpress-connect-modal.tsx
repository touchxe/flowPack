"use client";

import { useState } from "react";
import { X, Globe, Eye, EyeOff, Loader2, Check, AlertCircle, ExternalLink, ChevronRight } from "lucide-react";

interface WordPressConnectModalProps {
  onClose: () => void;
  onSuccess: (accountName: string) => void;
}

export function WordPressConnectModal({ onClose, onSuccess }: WordPressConnectModalProps) {
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "testing" | "success">("form");
  const [successData, setSuccessData] = useState<{ siteName?: string; version?: string } | null>(null);

  const handleSubmit = async () => {
    // 기본 유효성 검사
    if (!siteUrl || !username || !appPassword) {
      setError("모든 필드를 입력해주세요.");
      return;
    }
    if (!siteUrl.startsWith("http")) {
      setError("사이트 URL은 https://로 시작해야 합니다.");
      return;
    }

    setError(null);
    setLoading(true);
    setStep("testing");

    try {
      const res = await fetch("/api/social-accounts/connect/wordpress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl, username, appPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "연동 중 오류가 발생했습니다.");
        setStep("form");
        return;
      }

      setSuccessData({ siteName: data.siteName, version: data.wpVersion });
      setStep("success");
      setTimeout(() => {
        onSuccess(data.account.accountName);
        onClose();
      }, 2000);
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도하세요.");
      setStep("form");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}>
      {/* 배경 블러 */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} />

      {/* 모달 컨테이너 */}
      <div style={{
        position: "relative", zIndex: 1,
        background: "#fff", borderRadius: 20,
        width: "100%", maxWidth: 520,
        boxShadow: "0 24px 64px rgba(0,0,0,0.15)",
        margin: "0 16px", overflow: "hidden",
      }}>
        {/* 헤더 */}
        <div style={{ padding: "24px 28px 20px", borderBottom: "1px solid #F3F4F6", background: "#F0F7FF", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#21759B", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Globe size={22} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111827", margin: 0 }}>WordPress 연동</h2>
              <p style={{ fontSize: 12, color: "#6B7280", margin: 0 }}>Application Password 방식</p>
            </div>
          </div>
          {!loading && (
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(0,0,0,0.06)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={16} color="#6B7280" />
            </button>
          )}
        </div>

        {/* 콘텐츠 */}
        <div style={{ padding: "24px 28px" }}>
          {step === "success" ? (
            /* 성공 상태 */
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Check size={32} color="#059669" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 8 }}>연동 완료!</h3>
              <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 4 }}>
                {successData?.siteName && <strong>{successData.siteName}</strong>}
              </p>
              {successData?.version && (
                <p style={{ fontSize: 12, color: "#9CA3AF" }}>WordPress {successData.version}</p>
              )}
              <p style={{ fontSize: 13, color: "#6B7280", marginTop: 12 }}>잠시 후 페이지가 자동으로 업데이트됩니다...</p>
            </div>
          ) : step === "testing" ? (
            /* 테스트 중 */
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <Loader2 size={40} color="#21759B" className="animate-spin" style={{ margin: "0 auto 16px", display: "block" }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 8 }}>연결 테스트 중...</h3>
              <p style={{ fontSize: 13, color: "#6B7280" }}>WordPress 사이트에 연결하고 있습니다</p>
            </div>
          ) : (
            /* 입력 폼 */
            <>
              {/* 안내 배너 */}
              <div style={{ background: "#FFF7ED", border: "1px solid #FCD34D", borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
                <AlertCircle size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#92400E", margin: "0 0 4px" }}>Application Password 필요</p>
                  <p style={{ fontSize: 12, color: "#78350F", margin: 0, lineHeight: 1.5 }}>
                    WordPress 관리자 → 사용자 → 프로필 → Application Passwords에서 발급하세요.
                  </p>
                  <a href="https://wordpress.com/wp-admin/profile.php" target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: "#D97706", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, fontWeight: 600 }}>
                    <ExternalLink size={11} /> 바로가기
                  </a>
                </div>
              </div>

              {/* 에러 메시지 */}
              {error && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertCircle size={15} color="#DC2626" />
                  <span style={{ fontSize: 13, color: "#991B1B" }}>{error}</span>
                </div>
              )}

              {/* 폼 필드 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, display: "block" }}>
                    사이트 URL *
                  </label>
                  <input
                    type="url"
                    value={siteUrl}
                    onChange={e => setSiteUrl(e.target.value)}
                    placeholder="https://myblog.com"
                    style={{
                      width: "100%", height: 42, padding: "0 14px", borderRadius: 10,
                      border: "1.5px solid #E5E7EB", fontSize: 14, outline: "none",
                      boxSizing: "border-box", transition: "border-color 0.15s",
                    }}
                    onFocus={e => (e.target.style.borderColor = "#21759B")}
                    onBlur={e => (e.target.style.borderColor = "#E5E7EB")}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, display: "block" }}>
                    사용자명 (로그인 ID) *
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="admin"
                    autoComplete="username"
                    style={{
                      width: "100%", height: 42, padding: "0 14px", borderRadius: 10,
                      border: "1.5px solid #E5E7EB", fontSize: 14, outline: "none",
                      boxSizing: "border-box", transition: "border-color 0.15s",
                    }}
                    onFocus={e => (e.target.style.borderColor = "#21759B")}
                    onBlur={e => (e.target.style.borderColor = "#E5E7EB")}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, display: "block" }}>
                    Application Password *
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={appPassword}
                      onChange={e => setAppPassword(e.target.value)}
                      placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                      autoComplete="new-password"
                      style={{
                        width: "100%", height: 42, padding: "0 44px 0 14px", borderRadius: 10,
                        border: "1.5px solid #E5E7EB", fontSize: 14, outline: "none",
                        boxSizing: "border-box", fontFamily: "monospace", transition: "border-color 0.15s",
                      }}
                      onFocus={e => (e.target.style.borderColor = "#21759B")}
                      onBlur={e => (e.target.style.borderColor = "#E5E7EB")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex", alignItems: "center" }}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 5 }}>
                    공백 포함 또는 제외 모두 가능합니다. 계정 비밀번호가 아닙니다.
                  </p>
                </div>
              </div>

              {/* 단계 힌트 */}
              <div style={{ marginTop: 16, background: "#F8F7FF", borderRadius: 12, padding: "12px 16px" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#6366F1", margin: "0 0 8px" }}>Application Password 발급 방법</p>
                {[
                  "WordPress 관리자 페이지 접속",
                  "사용자 → 프로필 이동",
                  "Application Passwords 섹션 → 'FlowPack' 입력 → 추가",
                  "표시된 비밀번호 즉시 복사 (이탈 시 재확인 불가)",
                ].map((hint, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#6366F1", flexShrink: 0 }}>{i + 1}.</span>
                    <span style={{ fontSize: 11, color: "#6B7280" }}>{hint}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 푸터 버튼 */}
        {step === "form" && (
          <div style={{ padding: "0 28px 24px", display: "flex", gap: 10 }}>
            <button onClick={onClose}
              style={{ flex: 1, height: 42, borderRadius: 10, border: "1.5px solid #E5E7EB", background: "#fff", fontSize: 14, fontWeight: 600, color: "#6B7280", cursor: "pointer" }}>
              취소
            </button>
            <button onClick={handleSubmit} disabled={loading}
              style={{
                flex: 2, height: 42, borderRadius: 10, border: "none",
                background: "linear-gradient(135deg, #21759B, #2EA3D5)",
                fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                opacity: loading ? 0.7 : 1,
              }}>
              {loading ? <><Loader2 size={15} className="animate-spin" /> 연결 중...</> : "연결 테스트 및 저장"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
