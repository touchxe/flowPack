"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Instagram, Facebook, Twitter, Linkedin, Globe,
  Check, Loader2, Trash2, Plus, Link2, BookOpen, AtSign
} from "lucide-react";
import { IntegrationGuideModal } from "@/components/features/integration-guide-modal";
import { WordPressConnectModal } from "@/components/features/wordpress-connect-modal";
import { DsPageHeader } from "@/components/ds/ds-page-header";
import { DsMsgBanner } from "@/components/ds/ds-msg-banner";

interface SocialAccount {
  id: string; platform: string; accountName: string; isActive: boolean; connectedAt: string;
}

const PLATFORM_CONFIG: Record<string, {
  name: string; icon: React.ReactNode; color: string; bg: string; desc: string;
}> = {
  INSTAGRAM:  { name: "Instagram",    icon: <Instagram size={22} />,  color: "#E1306C", bg: "rgba(225,48,108,0.10)",  desc: "비주얼 콘텐츠 배포" },
  FACEBOOK:   { name: "Facebook",     icon: <Facebook size={22} />,   color: "#1877F2", bg: "rgba(24,119,242,0.10)",   desc: "페이지/그룹 포스팅" },
  TWITTER:    { name: "X (Twitter)",  icon: <Twitter size={22} />,    color: "var(--fp-heading)", bg: "var(--fp-section-bg)", desc: "실시간 트윗" },
  LINKEDIN:   { name: "LinkedIn",     icon: <Linkedin size={22} />,   color: "#0077B5", bg: "rgba(0,119,181,0.10)",   desc: "B2B 전문 네트워크" },
  THREADS:    { name: "Threads",      icon: <AtSign size={22} />,     color: "var(--fp-heading)", bg: "var(--fp-section-bg)", desc: "Meta 텍스트 피드" },
  WORDPRESS:  { name: "WordPress",    icon: <Globe size={22} />,      color: "#21759B", bg: "rgba(33,117,155,0.10)",   desc: "워드프레스 발행" },
};

// 복수 연동 허용 플랫폼 및 최대 수
const MULTI_ALLOWED_PLATFORMS = new Set(["WORDPRESS"]);
const MAX_MULTI_COUNT: Record<string, number> = { WORDPRESS: 5 };

export default function SocialAccountsPage() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [guideModal, setGuideModal] = useState<string | null>(null);
  const [wpConnectModal, setWpConnectModal] = useState(false);

  const success = searchParams.get("success");
  const error = searchParams.get("error");

  useEffect(() => {
    const errorMessages: Record<string, string> = {
      connected:             "", // success는 아래서 처리
      already_connected:     "이미 연동된 계정입니다",
      instagram_denied:      "Instagram 연동이 취소되었습니다",
      instagram_no_code:     "Instagram 인증 코드를 받지 못했습니다",
      instagram_invalid_state:"Instagram 인증 요청이 만료되었습니다. 다시 연결해 주세요",
      instagram_not_configured:"Instagram 앱 설정이 필요합니다. INSTAGRAM_APP_ID와 INSTAGRAM_APP_SECRET을 확인하세요",
      instagram_oauth_failed:"Instagram 인증 URL 생성에 실패했습니다. 앱 설정을 확인하세요",
      instagram_token_failed:"Instagram 토큰 교환에 실패했습니다. 앱 설정을 확인하세요",
      instagram_no_profile:  "Instagram 프로필 조회 실패 — 계정을 크리에이터로 전환해야 합니다",
      instagram_server_error:"서버 오류가 발생했습니다. 잠시 후 다시 시도하세요",
      threads_denied:        "Threads 연동이 취소되었습니다",
      threads_no_code:       "Threads 인증 코드를 받지 못했습니다",
      threads_invalid_state: "Threads 인증 요청이 만료되었습니다. 다시 연결해 주세요",
      threads_not_configured:"Threads 앱 설정이 필요합니다. THREADS_APP_ID와 THREADS_APP_SECRET을 확인하세요",
      threads_oauth_failed:  "Threads 인증 URL 생성에 실패했습니다. 앱 설정을 확인하세요",
      threads_token_failed:  "Threads 토큰 교환에 실패했습니다. 앱 설정을 확인하세요",
      threads_server_error:  "서버 오류가 발생했습니다. 잠시 후 다시 시도하세요",
    };

    if (success === "connected") {
      setMessage({ type: "success", text: "계정이 성공적으로 연동되었습니다 🎉" });
    } else if (error && errorMessages[error]) {
      setMessage({ type: "error", text: errorMessages[error] });
    } else if (error) {
      setMessage({ type: "error", text: `연동 오류: ${error}` });
    }
  }, [success, error]);


  useEffect(() => { fetchAccounts(); }, []);

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/social-accounts");
      if (res.ok) { const d = await res.json(); setAccounts(d.accounts); }
    } catch {}
    finally { setLoading(false); }
  };

  const handleConnect = (platform: string) => {
    // WordPress는 API Key 방식 — 전용 모달 사용
    if (platform.toUpperCase() === "WORDPRESS") {
      setWpConnectModal(true);
      return;
    }
    // fetch() 대신 window.location.href 사용:
    // fetch()는 cross-origin 리다이렉트 시 CORS 차단 발생.
    // 브라우저가 직접 이동하면 서버 → Instagram OAuth 리다이렉트를 정상 추적.
    setConnecting(platform);
    window.location.href = `/api/social-accounts/connect/${platform}`;
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm("정말 연동을 해제하시겠습니까?")) return;
    setDeleting(accountId);
    try {
      const res = await fetch(`/api/social-accounts?id=${accountId}`, { method: "DELETE" });
      if (res.ok) { setAccounts(accounts.filter(a => a.id !== accountId)); setMessage({ type: "success", text: "연동이 해제되었습니다" }); }
      else { const d = await res.json(); setMessage({ type: "error", text: d.error || "연동 해제 중 오류가 발생했습니다" }); }
    } catch { setMessage({ type: "error", text: "연동 해제 중 오류가 발생했습니다" }); }
    finally { setDeleting(null); }
  };

  // 플랫폼별 연동 수 계산
  const connectedCounts = accounts.reduce((acc, a) => {
    acc[a.platform] = (acc[a.platform] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // 연결 가능 여부 판단 (WordPress는 복수 허용)
  const canConnect = (platform: string) => {
    const count = connectedCounts[platform] || 0;
    if (MULTI_ALLOWED_PLATFORMS.has(platform)) {
      return count < (MAX_MULTI_COUNT[platform] || 5);
    }
    return count === 0;
  };

  // 플랫폼별 연동된 계정 그룹
  const accountsByPlatform = accounts.reduce((acc, a) => {
    if (!acc[a.platform]) acc[a.platform] = [];
    acc[a.platform].push(a);
    return acc;
  }, {} as Record<string, SocialAccount[]>);

  const allPlatforms = Object.keys(PLATFORM_CONFIG);

  return (
    <div style={{ padding: "24px 28px" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        .platform-card { background:var(--fp-card-bg); border:1.5px solid var(--fp-border); border-radius:16px; padding:20px; transition:all 0.2s; }
        .platform-card:hover { border-color:var(--fp-primary-border); box-shadow:var(--fp-shadow-hover); transform:translateY(-2px); }
        .connect-btn { width:100%; height:40px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:7px; transition:all 0.2s; border:none; }
        .disconnect-btn { width:32px; height:32px; border-radius:8px; background:none; border:1.5px solid var(--fp-border); cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--fp-muted); transition:all 0.15s; }
        .disconnect-btn:hover { border-color:var(--fp-error-border); color:var(--fp-error); background:var(--fp-error-bg); }
        .guide-btn { height:32px; padding:0 12px; border-radius:8px; background:none; border:1.5px solid var(--fp-border); cursor:pointer; display:flex; align-items:center; gap:5px; color:var(--fp-secondary); font-size:12px; font-weight:600; transition:all 0.15s; }
        .guide-btn:hover { border-color:var(--fp-primary-border); color:var(--brand-500); background:var(--fp-primary-subtle); }
        .wp-site-item { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-radius:10px; background:var(--fp-section-bg, #F9FAFB); border:1px solid var(--fp-border); transition:all 0.15s; }
        .wp-site-item:hover { border-color:var(--fp-primary-border); }
        .wp-add-btn { width:100%; height:36px; border-radius:10px; font-size:12px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; transition:all 0.2s; border:1.5px dashed var(--fp-border); background:none; color:var(--fp-secondary); }
        .wp-add-btn:hover { border-color:#21759B; color:#21759B; background:rgba(33,117,155,0.04); }
      `}</style>

      {/* 헤더 */}
      <DsPageHeader title="SNS 연동" desc="SNS와 블로그 계정을 연동하여 콘텐츠를 원클릭 배포하세요" />

      {/* 메시지 배너 */}
      {message && <DsMsgBanner type={message.type} text={message.text} />}

      {/* 요약 KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "연동된 채널", value: accounts.length, color: "var(--brand-500)", bg: "var(--fp-primary-subtle)", icon: <Link2 size={18} color="var(--brand-500)" /> },
          { label: "활성 채널",   value: accounts.filter(a => a.isActive).length, color: "var(--fp-success)", bg: "var(--fp-success-bg)", icon: <Check size={18} color="var(--fp-success)" /> },
          { label: "미연동 채널", value: allPlatforms.filter(p => !connectedCounts[p]).length, color: "var(--fp-muted)", bg: "var(--fp-section-bg)", icon: <Plus size={18} color="var(--fp-muted)" /> },
        ].map((k, i) => (
          <div key={i} style={{ background: "var(--fp-card-bg)", border: "1.5px solid var(--fp-border)", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, boxShadow: "var(--fp-shadow-card)" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: k.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{k.icon}</div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 800, color: k.color, margin: 0 }}>{k.value}</p>
              <p style={{ fontSize: 11, color: "var(--fp-muted)", margin: 0, fontWeight: 600 }}>{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 연동된 계정 */}
      {accounts.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--fp-heading)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <Check size={16} color="var(--fp-success)" /> 연동된 계정 <span style={{ fontSize: 13, color: "var(--fp-muted)", fontWeight: 500 }}>({accounts.length})</span>
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "32px", color: "var(--fp-muted)" }}>
                <Loader2 size={24} color="var(--brand-500)" className="animate-spin" style={{ margin: "0 auto 8px", display: "block" }} />
                불러오는 중...
              </div>
            ) : accounts.map(account => {
              const cfg = PLATFORM_CONFIG[account.platform];
              if (!cfg) return null;
              return (
                <div key={account.id} style={{ background: "var(--fp-card-bg)", border: "1.5px solid var(--fp-border)", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "var(--fp-shadow-card)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", color: cfg.color, flexShrink: 0 }}>
                      {cfg.icon}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--fp-heading)", margin: 0 }}>{cfg.name}</p>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fp-success-text)", background: "var(--fp-success-bg)", padding: "2px 8px", borderRadius: 9999, border: "1px solid var(--fp-success-border)" }}>연동됨</span>
                      </div>
                      <p style={{ fontSize: 12, color: "var(--fp-muted)", margin: 0 }}>@{account.accountName}</p>
                    </div>
                  </div>
                  <button className="disconnect-btn" onClick={() => handleDisconnect(account.id)} disabled={deleting === account.id}>
                    {deleting === account.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 채널 추가 그리드 */}
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--fp-heading)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={16} color="var(--brand-500)" /> 채널 연결하기
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          {allPlatforms.map(platform => {
            const cfg = PLATFORM_CONFIG[platform];
            if (!cfg) return null;
            const isMultiAllowed = MULTI_ALLOWED_PLATFORMS.has(platform);
            const connectedCount = connectedCounts[platform] || 0;
            const isConnected = connectedCount > 0;
            const canAdd = canConnect(platform);
            const isConnecting = connecting === platform;
            const wpAccounts = accountsByPlatform[platform] || [];

            // WordPress 카드: 복수 사이트 지원 UI
            if (isMultiAllowed) {
              return (
                <div key={platform} className="platform-card">
                  {/* 플랫폼 헤더 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", color: cfg.color, flexShrink: 0 }}>
                      {cfg.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--fp-heading)", margin: 0 }}>{cfg.name}</p>
                        {connectedCount > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 800, color: "var(--fp-info)", background: "var(--fp-info-bg)", border: "1px solid var(--fp-info-border)", padding: "2px 8px", borderRadius: 9999 }}>
                            {connectedCount}개 사이트
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: "var(--fp-muted)", margin: 0 }}>{cfg.desc}</p>
                    </div>
                    <button className="guide-btn" onClick={() => setGuideModal(platform)}>
                      <BookOpen size={12} /> 연동 방법
                    </button>
                  </div>

                  {/* 연동된 사이트 리스트 */}
                  {wpAccounts.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                      {wpAccounts.map(account => (
                        <div key={account.id} className="wp-site-item">
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: account.isActive ? "var(--fp-success)" : "var(--fp-inactive)", flexShrink: 0 }} />
                            <div>
                              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--fp-heading)", margin: 0 }}>{account.accountName}</p>
                              <p style={{ fontSize: 10, color: "var(--fp-muted)", margin: 0 }}>
                                연동: {new Date(account.connectedAt).toLocaleDateString("ko-KR")}
                              </p>
                            </div>
                          </div>
                          <button className="disconnect-btn" style={{ width: 28, height: 28 }} onClick={() => handleDisconnect(account.id)} disabled={deleting === account.id}>
                            {deleting === account.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 사이트 추가 버튼 */}
                  {canAdd ? (
                    <button className="wp-add-btn" onClick={() => handleConnect(platform)}>
                      <Plus size={14} /> 사이트 추가 {connectedCount > 0 && `(${connectedCount}/${MAX_MULTI_COUNT[platform] || 5})`}
                    </button>
                  ) : (
                    <div style={{ textAlign: "center", padding: "8px", fontSize: 11, color: "var(--fp-muted)", fontWeight: 600 }}>
                      최대 {MAX_MULTI_COUNT[platform] || 5}개 사이트 연동 완료
                    </div>
                  )}
                </div>
              );
            }

            // 일반 플랫폼 카드 (단일 연동)
            return (
              <div key={platform} className="platform-card" style={{ opacity: isConnected ? 0.7 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", color: cfg.color, flexShrink: 0 }}>
                    {cfg.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--fp-heading)", margin: 0, marginBottom: 2 }}>{cfg.name}</p>
                    <p style={{ fontSize: 11, color: "var(--fp-muted)", margin: 0 }}>{cfg.desc}</p>
                  </div>
                  <button className="guide-btn" onClick={() => setGuideModal(platform)}>
                    <BookOpen size={12} /> 연동 방법
                  </button>
                </div>
                <button
                  className="connect-btn"
                  onClick={() => !isConnected && handleConnect(platform)}
                  disabled={isConnected || isConnecting}
                  style={{
                    background: isConnected ? "var(--fp-inactive-bg)" : `linear-gradient(135deg, ${cfg.color}, ${cfg.color}CC)`,
                    color: isConnected ? "var(--fp-inactive)" : "#fff",
                    cursor: isConnected ? "default" : "pointer",
                    boxShadow: isConnected ? "none" : `0 3px 10px ${cfg.color}40`,
                  }}>
                  {isConnecting ? (
                    <><Loader2 size={14} className="animate-spin" /> 연동 중...</>
                  ) : isConnected ? (
                    <><Check size={14} /> 연동됨</>
                  ) : (
                    <><Plus size={14} /> 연결하기</>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* WordPress 연동 전용 모달 */}
      {wpConnectModal && (
        <WordPressConnectModal
          onClose={() => setWpConnectModal(false)}
          onSuccess={(accountName) => {
            setMessage({ type: "success", text: `WordPress (${accountName}) 연동 완료!` });
            fetchAccounts();
          }}
        />
      )}

      {/* 연동 가이드 모달 */}
      {guideModal && (
        <IntegrationGuideModal
          platform={guideModal}
          onClose={() => setGuideModal(null)}
        />
      )}
    </div>
  );
}
