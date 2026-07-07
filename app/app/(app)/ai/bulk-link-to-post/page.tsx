"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Check,
  FileText,
  Globe,
  Image as ImageIcon,
  Layers,
  Link2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SchedulePicker } from "@/components/features/content/schedule-picker";

const TYPE_OPTIONS = [
  {
    value: "CAROUSEL",
    label: "카드뉴스",
    icon: <Layers size={15} color="var(--brand-500)" />,
    desc: "슬라이드형 카드 콘텐츠",
    color: "var(--brand-500)",
    bg: "var(--fp-primary-subtle)",
  },
  {
    value: "BLOG",
    label: "블로그 포스트",
    icon: <FileText size={15} color="var(--fp-success)" />,
    desc: "긴 본문 중심의 글",
    color: "var(--fp-success)",
    bg: "var(--fp-success-bg)",
  },
];

const TONE_OPTIONS = [
  { value: "formal", label: "격식체", desc: "전문적이고 공식적인 톤" },
  { value: "casual", label: "캐주얼", desc: "가볍고 자연스러운 톤" },
  { value: "friendly", label: "친근한 톤", desc: "따뜻하고 편안한 톤" },
];

export default function UrlToPostPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [contentType, setContentType] = useState("CAROUSEL");
  const [tone, setTone] = useState("friendly");
  const [sourceMode, setSourceMode] = useState<"AI" | "ORIGINAL">("AI");
  const [includeSourceUrl, setIncludeSourceUrl] = useState(true);
  const [importImages, setImportImages] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [scheduledAt, setScheduledAt] = useState<string | undefined>(undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      try {
        new URL(url);
      } catch {
        setError("유효한 URL을 입력해주세요");
        setIsLoading(false);
        return;
      }

      const res = await fetch("/api/generate/url-to-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          contentType,
          tone,
          sourceMode,
          includeSourceUrl,
          importImages,
          ...(scheduledAt ? { scheduledAt } : {}),
        }),
      });

      if (res.status === 401) {
        setError("로그인이 필요합니다");
        return;
      }
      if (res.status === 402) {
        setError("크레딧이 부족합니다");
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "변환 중 오류가 발생했습니다");
        return;
      }

      const data = await res.json();
      const imageMessage = data.importedImages ? ` 이미지 ${data.importedImages}개를 함께 가져왔습니다.` : "";
      setSuccess(`변환이 완료되었습니다.${imageMessage}`);
      setTimeout(() => {
        router.push(`/content/${data.contentId}/edit`);
      }, 1500);
    } catch {
      setError("요청 중 오류가 발생했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedType = TYPE_OPTIONS.find((type) => type.value === contentType);
  const selectedTone = TONE_OPTIONS.find((option) => option.value === tone);

  return (
    <div style={{ padding: "32px 40px" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        .url-input { width:100%; height:52px; padding:0 52px 0 18px; border:1.5px solid var(--fp-border); border-radius:14px; font-size:15px; color:var(--fp-heading); background:var(--fp-card-bg); outline:none; transition:all 0.2s; box-sizing:border-box; }
        .url-input:focus { border-color:var(--brand-500); box-shadow:0 0 0 4px var(--fp-primary-subtle); }
        .url-input:disabled { background:var(--fp-section-bg); color:var(--fp-muted); }
        .type-card { padding:18px; border-radius:14px; border:2px solid var(--fp-border); cursor:pointer; transition:all 0.15s; flex:1; background:var(--fp-card-bg); }
        .type-card.selected { border-color:var(--brand-500); background:var(--fp-primary-subtle); }
        .type-card:not(.selected):hover { border-color:var(--fp-primary-border); }
        .tone-chip { height:42px; padding:0 18px; border-radius:11px; border:1.5px solid var(--fp-border); background:var(--fp-card-bg); font-size:14px; font-weight:700; cursor:pointer; transition:all 0.15s; color:var(--fp-body); }
        .tone-chip.selected { background:var(--brand-gradient); border-color:transparent; color:#fff; }
        .tone-chip:not(.selected):hover { border-color:var(--fp-primary-border); color:var(--brand-500); }
        .submit-btn { width:100%; height:58px; border-radius:16px; font-size:16px; font-weight:800; border:none; display:flex; align-items:center; justify-content:center; gap:10px; cursor:pointer; transition:all 0.2s; }
        .option-row { display:flex; align-items:flex-start; gap:12px; padding:15px 0; border-top:1px solid var(--fp-border-soft); }
        .option-row:first-of-type { border-top:0; padding-top:0; }
        .option-row input { margin-top:3px; width:16px; height:16px; accent-color:var(--brand-500); }
      `}</style>

      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, background: "var(--brand-gradient)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Link2 size={24} color="#fff" />
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: "var(--fp-heading)", margin: 0 }}>URL 콘텐츠 변환</h1>
        </div>
        <p style={{ fontSize: 16, color: "var(--fp-muted)", margin: 0, paddingLeft: 66 }}>웹페이지 URL을 입력하면 AI 글이나 원문 기반 콘텐츠로 변환합니다</p>
      </div>

      <div style={{ maxWidth: 760 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ background: "var(--fp-card-bg)", border: "1.5px solid var(--fp-border)", borderRadius: 18, padding: "24px 26px", marginBottom: 18 }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: "var(--fp-body)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <Globe size={17} color="var(--brand-500)" /> 웹페이지 URL
            </p>
            <div style={{ position: "relative" }}>
              <input
                className="url-input"
                type="url"
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
                required
              />
              <Link2 size={16} color="#9CA3AF" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            </div>
          </div>

          <div style={{ background: "var(--fp-card-bg)", border: "1.5px solid var(--fp-border)", borderRadius: 18, padding: "24px 26px", marginBottom: 18 }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: "var(--fp-body)", marginBottom: 14 }}>변환 형식</p>
            <div style={{ display: "flex", gap: 10 }}>
              {TYPE_OPTIONS.map((type) => (
                <div
                  key={type.value}
                  className={`type-card${contentType === type.value ? " selected" : ""}`}
                  onClick={() => !isLoading && setContentType(type.value)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: type.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{type.icon}</div>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "var(--fp-heading)" }}>{type.label}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--fp-muted)", margin: 0 }}>{type.desc}</p>
                </div>
              ))}
            </div>
            {selectedType && (
              <p style={{ fontSize: 11, color: selectedType.color, marginTop: 10, fontWeight: 700 }}>
                선택됨: {selectedType.label}
              </p>
            )}
          </div>

          <div style={{ background: "var(--fp-card-bg)", border: "1.5px solid var(--fp-border)", borderRadius: 18, padding: "24px 26px", marginBottom: 18 }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: "var(--fp-body)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={15} color="var(--brand-500)" /> 글 작성 방식
            </p>
            <Select value={sourceMode} onValueChange={(value) => setSourceMode(value as "AI" | "ORIGINAL")} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AI">AI로 새 글 작성</SelectItem>
                <SelectItem value="ORIGINAL">원본 내용 가져오기</SelectItem>
              </SelectContent>
            </Select>
            <p style={{ fontSize: 11, color: "var(--fp-muted)", marginTop: 8 }}>
              {sourceMode === "AI" ? "원문을 참고해 새 글을 작성합니다." : "웹페이지에서 추출한 원문을 최대한 유지합니다."}
            </p>
          </div>

          <div style={{ background: "var(--fp-card-bg)", border: "1.5px solid var(--fp-border)", borderRadius: 18, padding: "24px 26px", marginBottom: 18 }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: "var(--fp-body)", marginBottom: 14 }}>문체 스타일</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {TONE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`tone-chip${tone === option.value ? " selected" : ""}`}
                  onClick={() => !isLoading && setTone(option.value)}
                  disabled={isLoading}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {selectedTone && (
              <p style={{ fontSize: 11, color: "var(--fp-muted)", marginTop: 8 }}>{selectedTone.desc}</p>
            )}
          </div>

          <div style={{ background: "var(--fp-card-bg)", border: "1.5px solid var(--fp-border)", borderRadius: 16, padding: "18px 22px", marginBottom: 14 }}>
            <label className="option-row">
              <input
                type="checkbox"
                checked={includeSourceUrl}
                disabled={isLoading}
                onChange={(e) => setIncludeSourceUrl(e.target.checked)}
              />
              <span>
                <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--fp-heading)" }}>본문 하단에 원본 주소 삽입</span>
                <span style={{ display: "block", fontSize: 11, color: "var(--fp-muted)", marginTop: 3 }}>생성된 글이나 원문 끝에 출처 URL을 남깁니다.</span>
              </span>
            </label>
            <label className="option-row">
              <input
                type="checkbox"
                checked={importImages}
                disabled={isLoading}
                onChange={(e) => setImportImages(e.target.checked)}
              />
              <span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--fp-heading)" }}>
                  <ImageIcon size={14} color="var(--brand-500)" /> 웹페이지 이미지 가져오기
                </span>
                <span style={{ display: "block", fontSize: 11, color: "var(--fp-muted)", marginTop: 3 }}>대표 이미지와 본문 이미지를 추출해 콘텐츠 이미지로 저장합니다.</span>
              </span>
            </label>
          </div>

          {error && (
            <div style={{ marginBottom: 14, padding: "12px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, background: "var(--fp-error-bg)", border: "1.5px solid var(--fp-error-border)", color: "var(--fp-error-text)", fontSize: 13, fontWeight: 600 }}>
              <AlertCircle size={15} /> {error}
            </div>
          )}
          {success && (
            <div style={{ marginBottom: 14, padding: "12px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, background: "var(--fp-success-bg)", border: "1.5px solid var(--fp-success-border)", color: "var(--fp-success-text)", fontSize: 13, fontWeight: 700 }}>
              <Check size={15} /> {success} 편집 페이지로 이동 중입니다.
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <SchedulePicker value={scheduledAt} onChange={setScheduledAt} disabled={isLoading} />
          </div>

          <button
            type="submit"
            className="submit-btn"
            disabled={isLoading || !url}
            style={{ background: isLoading || !url ? "var(--fp-border)" : "var(--brand-gradient)", color: isLoading || !url ? "var(--fp-muted)" : "#fff", boxShadow: isLoading || !url ? "none" : "0 4px 16px var(--fp-primary-subtle)", cursor: isLoading || !url ? "not-allowed" : "pointer" }}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> 변환 중
              </>
            ) : (
              <>
                <Link2 size={18} /> 변환 시작 <ArrowRight size={16} />
              </>
            )}
          </button>

          <p style={{ fontSize: 12, color: "var(--fp-muted)", textAlign: "center", marginTop: 12 }}>
            변환에는 1 크레딧이 사용됩니다.
          </p>
        </form>
      </div>
    </div>
  );
}
