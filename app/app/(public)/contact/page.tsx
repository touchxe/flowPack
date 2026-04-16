"use client";

import { useState } from "react";
import { Mail, MessageCircle, HelpCircle, ChevronDown, Send, Clock, Phone, Sparkles } from "lucide-react";

const faqs = [
  { q: "어떤 종류의 콘텐츠를 만들 수 있나요?", a: "카드뉴스, 블로그 아티클, 텍스트 SNS 콘텐츠(Threads, X, LinkedIn 최적화) 등을 지원합니다. 하나의 주제로 여러 포맷의 콘텐츠를 한번에 생성할 수도 있습니다." },
  { q: "어떤 채널을 지원하나요?", a: "현재 Instagram, Facebook, Twitter/X, LinkedIn, 네이버 블로그, WordPress 등을 지원합니다. 더 많은 채널의 지원이 곧 추가될 예정입니다." },
  { q: "크레딧은 어떻게 사용되나요?", a: "카드뉴스, 블로그, 이미지 생성 등 AI 기능을 사용할 때마다 1개 크레딧이 차감됩니다. 월 10개 크레딧은 무료로 제공되며, 더 많은 크레딧이 필요하시면 유료 플랜을 이용해주세요." },
  { q: "구독은 언제부터 시작되나요?", a: "결제 직후 바로 적용되며, 다음 달 같은 날 자동으로 갱신됩니다." },
  { q: "구독을 취소할 수 있나요?", a: "네, 언제든지 취소할 수 있습니다. 현재 구독 기간이 끝날 때까지는 기존 플랜을 계속 이용하실 수 있습니다." },
  { q: "생성된 콘텐츠의 소유권은 누구에게 있나요?", a: "생성된 콘텐츠의 소유권은 이용자에게 있습니다. FlowPack은 서비스 제공을 위해서만 콘텐츠를 이용하며, 동의 없이 제3자에게 공유하거나 판매하지 않습니다." },
  { q: "비밀번호를 잊어버렸어요", a: "로그인 페이지에서 '비밀번호 찾기'를 클릭하여 회원가입 시 사용한 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다." },
  { q: "고객 지원 응답 시간은 얼마나 걸리나요?", a: "평일 기준 24시간 이내에 답변을 드립니다. 주말이나 공휴일에는 조금 더 걸릴 수 있습니다." },
];

export default function ContactPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [inquiryType, setInquiryType] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        .ct-input { width:100%; height:44px; padding:0 14px; border:1.5px solid #E5E7EB; border-radius:10px; font-size:14px; color:#111827; background:#fff; outline:none; transition:all 0.2s; box-sizing:border-box; }
        .ct-input:focus { border-color:#6366F1; box-shadow:0 0 0 3px rgba(99,102,241,0.1); }
        .ct-textarea { width:100%; padding:12px 14px; border:1.5px solid #E5E7EB; border-radius:10px; font-size:14px; color:#111827; background:#fff; outline:none; transition:all 0.2s; box-sizing:border-box; resize:none; min-height:140px; }
        .ct-textarea:focus { border-color:#6366F1; box-shadow:0 0 0 3px rgba(99,102,241,0.1); }
        .ct-select { width:100%; height:44px; padding:0 14px; border:1.5px solid #E5E7EB; border-radius:10px; font-size:14px; color:#111827; background:#fff; outline:none; transition:all 0.2s; box-sizing:border-box; appearance:none; cursor:pointer; }
        .ct-select:focus { border-color:#6366F1; box-shadow:0 0 0 3px rgba(99,102,241,0.1); }
        .faq-item { border-bottom:1px solid #F3F4F6; }
        .faq-item:last-child { border-bottom:none; }
        .faq-btn { width:100%; display:flex; align-items:center; justify-content:space-between; padding:16px 20px; background:none; border:none; cursor:pointer; text-align:left; gap:12px; }
        .submit-btn { width:100%; height:46px; border-radius:10px; font-size:15px; font-weight:700; cursor:pointer; border:none; background:linear-gradient(135deg,#6366F1,#8B5CF6); color:#fff; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.25s; box-shadow:0 4px 14px rgba(99,102,241,0.35); }
        .submit-btn:hover { transform:translateY(-1px); box-shadow:0 8px 20px rgba(99,102,241,0.4); }
      `}</style>

      {/* Hero */}
      <section style={{ padding: "72px 24px 64px", textAlign: "center", background: "linear-gradient(180deg,#F8F7FF 0%,#fff 100%)" }}>
        <div className="mx-auto max-w-2xl">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 9999, background: "#EEF2FF", border: "1px solid #C7D2FE", fontSize: 13, fontWeight: 600, color: "#6366F1", marginBottom: 20 }}>
            <Sparkles size={13} /> 평일 24시간 내 답변
          </div>
          <h1 style={{ fontSize: "clamp(28px,4vw,40px)", fontWeight: 800, color: "#111827", marginBottom: 14, lineHeight: 1.15 }}>
            무엇이든 물어보세요
          </h1>
          <p style={{ fontSize: 16, color: "#6B7280", lineHeight: 1.6 }}>
            자주 묻는 질문을 먼저 확인해보시거나, 직접 문의를 남겨주세요.
          </p>
        </div>
      </section>

      {/* 연락 정보 카드 */}
      <section style={{ padding: "0 24px 64px" }}>
        <div className="mx-auto max-w-5xl">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 64 }}>
            {[
              { icon: <Mail size={20} color="#6366F1" />, title: "이메일", desc: "support@flowpack.dev", sub: "24시간 내 답변", bg: "#EEF2FF" },
              { icon: <Clock size={20} color="#059669" />, title: "운영 시간", desc: "평일 9:00 - 18:00", sub: "점심시간 12:00-13:00 제외", bg: "#ECFDF5" },
              { icon: <MessageCircle size={20} color="#8B5CF6" />, title: "카카오 채널", desc: "@flowpack", sub: "실시간 채팅 지원", bg: "#F5F3FF" },
            ].map((c, i) => (
              <div key={i} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "24px", display: "flex", alignItems: "flex-start", gap: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {c.icon}
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{c.title}</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 2 }}>{c.desc}</p>
                  <p style={{ fontSize: 12, color: "#9CA3AF" }}>{c.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* FAQ + 문의 폼 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
            {/* FAQ */}
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <HelpCircle size={20} color="#6366F1" /> 자주 묻는 질문
              </h2>
              <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden" }}>
                {faqs.map((f, i) => (
                  <div key={i} className="faq-item">
                    <button className="faq-btn" onClick={() => setOpenIdx(openIdx === i ? null : i)}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{f.q}</span>
                      <ChevronDown size={16} color="#9CA3AF" style={{ flexShrink: 0, transform: openIdx === i ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                    </button>
                    {openIdx === i && (
                      <div style={{ padding: "0 20px 16px", fontSize: 13, color: "#6B7280", lineHeight: 1.6 }}>{f.a}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 문의 폼 */}
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <Mail size={20} color="#6366F1" /> 1:1 문의하기
              </h2>
              <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "28px" }}>
                {submitted ? (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                      <Send size={24} color="#059669" />
                    </div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: "#111827", marginBottom: 8 }}>문의가 전송되었습니다</h3>
                    <p style={{ fontSize: 14, color: "#9CA3AF" }}>평일 24시간 내에 답변 드리겠습니다.</p>
                    <button onClick={() => setSubmitted(false)} style={{ marginTop: 20, fontSize: 13, color: "#6366F1", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
                      새 문의 작성하기 →
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>문의 유형</label>
                      <div style={{ position: "relative" }}>
                        <select className="ct-select" value={inquiryType} onChange={(e) => setInquiryType(e.target.value)} required>
                          <option value="">선택해주세요</option>
                          <option value="general">일반 문의</option>
                          <option value="billing">결제 및 크레딧</option>
                          <option value="technical">기술 지원</option>
                          <option value="feature">기능 요청</option>
                          <option value="report">신고</option>
                        </select>
                        <ChevronDown size={15} color="#9CA3AF" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>이메일</label>
                      <input className="ct-input" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>문의 내용</label>
                      <textarea className="ct-textarea" placeholder="문의 내용을 입력해주세요..." value={message} onChange={(e) => setMessage(e.target.value)} required />
                    </div>
                    <button type="submit" className="submit-btn">
                      <Send size={15} /> 문의 전송하기
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
