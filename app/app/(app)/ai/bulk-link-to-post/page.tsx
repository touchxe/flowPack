"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, Zap, AlertCircle, Check, Globe, Layers, FileText, ArrowRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SchedulePicker } from "@/components/features/content/schedule-picker";

const TYPE_OPTIONS = [
  { value: "CAROUSEL", label: "카드뉴스", icon: <Layers size={15} color="#6366F1" />, desc: "슬라이드형 카드 콘텐츠", color: "#6366F1", bg: "#EEF2FF" },
  { value: "BLOG",     label: "블로그 포스트", icon: <FileText size={15} color="#059669" />, desc: "길이가 있는 블로그 글", color: "#059669", bg: "#ECFDF5" },
];

const TONE_OPTIONS = [
  { value: "formal",   label: "격식체",   desc: "전문적이고 공식적인 톤" },
  { value: "casual",   label: "캐주얼",   desc: "편안하고 자연스러운 톤" },
  { value: "friendly", label: "친근한",   desc: "따뜻하고 다정한 톤" },
];

export default function UrlToPostPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [contentType, setContentType] = useState("CAROUSEL");
  const [tone, setTone] = useState("friendly");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [scheduledAt, setScheduledAt] = useState<string | undefined>(undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true); setError(""); setSuccess("");
    try {
      try { new URL(url); } catch { setError("유효한 URL을 입력해주세요"); setIsLoading(false); return; }
      const res = await fetch("/api/generate/url-to-content", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, contentType, tone: tone as "formal" | "casual" | "friendly", ...(scheduledAt ? { scheduledAt } : {}) }),
      });
      if (res.status === 401) { setError("로그인이 필요합니다"); setIsLoading(false); return; }
      if (res.status === 402) { setError("크레딧이 부족합니다"); setIsLoading(false); return; }
      if (!res.ok) { const d = await res.json(); setError(d.error || "변환 중 오류가 발생했습니다"); setIsLoading(false); return; }
      const data = await res.json();
      setSuccess("변환이 완료되었습니다!");
      setTimeout(() => { router.push(`/content/${data.contentId}/edit`); }, 1500);
    } catch { setError("요청 중 오류가 발생했습니다"); }
    finally { setIsLoading(false); }
  };

  const selectedType = TYPE_OPTIONS.find(t => t.value === contentType);

  return (
    <div style={{ padding: "24px 28px" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        .url-input { width:100%; height:48px; padding:0 48px 0 16px; border:1.5px solid #E5E7EB; border-radius:12px; font-size:14px; color:#111827; background:#fff; outline:none; transition:all 0.2s; box-sizing:border-box; }
        .url-input:focus { border-color:#6366F1; box-shadow:0 0 0 4px rgba(99,102,241,0.08); }
        .url-input:disabled { background:#F9FAFB; color:#9CA3AF; }
        .type-card { padding:14px; border-radius:12px; border:2px solid #E5E7EB; cursor:pointer; transition:all 0.15s; flex:1; }
        .type-card.selected { border-color:#6366F1; background:#FAFAFE; }
        .type-card:not(.selected):hover { border-color:#C7D2FE; }
        .tone-chip { height:36px; padding:0 14px; border-radius:9px; border:1.5px solid #E5E7EB; background:#fff; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.15s; color:#374151; }
        .tone-chip.selected { background:linear-gradient(135deg,#6366F1,#8B5CF6); border-color:transparent; color:#fff; }
        .tone-chip:not(.selected):hover { border-color:#C7D2FE; color:#6366F1; }
        .submit-btn { width:100%; height:52px; border-radius:14px; font-size:15px; font-weight:800; border:none; display:flex; align-items:center; justify-content:center; gap:10px; cursor:pointer; transition:all 0.2s; }
      `}</style>

      {/* 헤더 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Link2 size={20} color="#fff" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>URL → 콘텐츠</h1>
        </div>
        <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0, paddingLeft: 54 }}>웹페이지 URL을 입력하면 AI가 카드뉴스나 블로그로 변환합니다</p>
      </div>

      <div style={{ maxWidth: 640 }}>
        <form onSubmit={handleSubmit}>
          {/* URL 입력 */}
          <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16, padding: "20px 22px", marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
              <Globe size={15} color="#6366F1" /> 웹페이지 URL
            </p>
            <div style={{ position: "relative" }}>
              <input className="url-input" type="url" placeholder="https://example.com/article"
                value={url} onChange={e => setUrl(e.target.value)} disabled={isLoading} required />
              <Link2 size={16} color="#9CA3AF" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            </div>
          </div>

          {/* 변환 타입 */}
          <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16, padding: "20px 22px", marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12 }}>변환 타입</p>
            <div style={{ display: "flex", gap: 10 }}>
              {TYPE_OPTIONS.map(t => (
                <div key={t.value} className={`type-card${contentType === t.value ? " selected" : ""}`}
                  onClick={() => !isLoading && setContentType(t.value)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: t.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{t.icon}</div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{t.label}</span>
                  </div>
                  <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>{t.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 톤 선택 */}
          <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16, padding: "20px 22px", marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12 }}>문체 스타일</p>
            <div style={{ display: "flex", gap: 8 }}>
              {TONE_OPTIONS.map(t => (
                <button key={t.value} type="button" className={`tone-chip${tone === t.value ? " selected" : ""}`}
                  onClick={() => !isLoading && setTone(t.value)} disabled={isLoading}>
                  {t.label}
                </button>
              ))}
            </div>
            {TONE_OPTIONS.find(t => t.value === tone) && (
              <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>
                {TONE_OPTIONS.find(t => t.value === tone)?.desc}
              </p>
            )}
          </div>

          {/* 에러 / 성공 */}
          {error && (
            <div style={{ marginBottom: 14, padding: "12px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#991B1B", fontSize: 13, fontWeight: 600 }}>
              <AlertCircle size={15} /> {error}
            </div>
          )}
          {success && (
            <div style={{ marginBottom: 14, padding: "12px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, background: "#ECFDF5", border: "1.5px solid #A7F3D0", color: "#065F46", fontSize: 13, fontWeight: 700 }}>
              <Check size={15} /> {success} 편집 페이지로 이동 중...
            </div>
          )}

          {/* 발행 일정 */}
          <div style={{ marginBottom: 14 }}>
            <SchedulePicker value={scheduledAt} onChange={setScheduledAt} disabled={isLoading} />
          </div>

          {/* 제출 버튼 */}
          <button type="submit" className="submit-btn" disabled={isLoading || !url}
            style={{ background: isLoading || !url ? "#E5E7EB" : "linear-gradient(135deg,#6366F1,#8B5CF6)", color: isLoading || !url ? "#9CA3AF" : "#fff", boxShadow: isLoading || !url ? "none" : "0 4px 16px rgba(99,102,241,0.35)", cursor: isLoading || !url ? "not-allowed" : "pointer" }}>
            {isLoading ? (
              <><Loader2 size={18} className="animate-spin" /> 변환 중...</>
            ) : (
              <><Link2 size={18} /> 변환 시작 <ArrowRight size={16} /></>
            )}
          </button>

          <p style={{ fontSize: 12, color: "#C4C9D4", textAlign: "center", marginTop: 12 }}>
            변환 시 1 크레딧이 소모됩니다
          </p>
        </form>
      </div>
    </div>
  );
}
