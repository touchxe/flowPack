"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Loader2, Check, X, AlertCircle, Layers, Zap, FileText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SchedulePicker } from "@/components/features/content/schedule-picker";

interface BulkItem {
  id: string; topic: string; contentType: "CAROUSEL" | "BLOG";
  slideCount: number; tone: string;
  status?: "pending" | "processing" | "completed" | "failed";
  contentId?: string; error?: string;
}

const TONE_LABELS: Record<string, string> = { formal: "격식체", casual: "캐주얼", friendly: "친근한" };
const TYPE_ICONS: Record<string, React.ReactNode> = {
  CAROUSEL: <Layers size={13} color="#6366F1" />,
  BLOG: <FileText size={13} color="#059669" />,
};

const StatusIcon = ({ status }: { status?: string }) => {
  if (!status) return <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid #E5E7EB" }} />;
  if (status === "processing") return <Loader2 size={18} color="#6366F1" className="animate-spin" />;
  if (status === "completed") return <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={13} color="#059669" /></div>;
  if (status === "failed")    return <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13} color="#EF4444" /></div>;
  return <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid #E5E7EB" }} />;
};

export default function BulkGeneratePage() {
  const [items, setItems] = useState<BulkItem[]>([
    { id: "1", topic: "", contentType: "CAROUSEL", slideCount: 5, tone: "friendly" },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [completedCount, setCompletedCount] = useState(0);
  const [scheduledAt, setScheduledAt] = useState<string | undefined>(undefined);

  const addItem = () => {
    if (items.length >= 10) return;
    setItems([...items, { id: String(Date.now()), topic: "", contentType: "CAROUSEL", slideCount: 5, tone: "friendly" }]);
  };
  const removeItem = (id: string) => { if (items.length <= 1) return; setItems(items.filter(i => i.id !== id)); };
  const updateItem = (id: string, field: keyof BulkItem, value: string | number) =>
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));

  const handleGenerate = async () => {
    const valid = items.filter(i => i.topic.trim().length > 0);
    if (valid.length === 0) { setError("최소 1개 이상의 주제를 입력해주세요"); return; }
    setIsGenerating(true); setError("");
    setItems(items.map(i => ({ ...i, status: "processing" as const })));
    try {
      const res = await fetch("/api/generate/bulk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items.map(({ id, topic, contentType, slideCount, tone }) => ({ id, topic, contentType, slideCount, tone })), ...(scheduledAt ? { scheduledAt } : {}) }),
      });
      if (res.status === 401) { setError("로그인이 필요합니다"); setItems(items.map(i => ({ ...i, status: "pending" as const }))); return; }
      if (res.status === 402) { const d = await res.json(); setError(d.error || "크레딧이 부족합니다"); setItems(items.map(i => ({ ...i, status: "pending" as const }))); return; }
      if (!res.ok) { const d = await res.json(); setError(d.error || "일괄 생성 중 오류가 발생했습니다"); setItems(items.map(i => ({ ...i, status: "pending" as const }))); return; }
      const data = await res.json();
      setItems(items.map(item => { const r = data.results.find((r: { id: string }) => r.id === item.id); return r ? { ...item, status: r.status, contentId: r.contentId, error: r.error } : item; }));
      setCompletedCount(data.totalCreditsUsed || 0);
    } catch { setError("요청 중 오류가 발생했습니다"); setItems(items.map(i => ({ ...i, status: "pending" as const }))); }
    finally { setIsGenerating(false); }
  };

  const validCount = items.filter(i => i.topic.trim()).length;

  return (
    <div style={{ padding: "24px 28px" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; }
        .bulk-input { width:100%; height:38px; padding:0 12px; border:1.5px solid #E5E7EB; border-radius:9px; font-size:13px; color:#111827; background:#fff; outline:none; transition:all 0.2s; box-sizing:border-box; }
        .bulk-input:focus { border-color:#6366F1; box-shadow:0 0 0 3px rgba(99,102,241,0.10); }
        .bulk-input:disabled { background:#F9FAFB; color:#9CA3AF; }
        .add-row-btn { height:36px; padding:0 16px; border-radius:9px; background:#fff; border:1.5px solid #E5E7EB; font-size:13px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; color:#374151; transition:all 0.15s; }
        .add-row-btn:hover:not(:disabled) { border-color:#C7D2FE; color:#6366F1; }
        .generate-btn { height:42px; padding:0 28px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; border:none; display:inline-flex; align-items:center; gap:8px; transition:all 0.2s; }
        .item-row { display:grid; grid-template-columns:28px 1fr 130px 90px 32px; gap:10px; align-items:center; padding:10px 14px; border-radius:12px; background:#fff; border:1.5px solid #F3F4F6; transition:all 0.15s; }
        .item-row:hover { border-color:#E5E7EB; }
      `}</style>

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Layers size={19} color="#fff" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>대량 기획</h1>
          </div>
          <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>여러 주제의 콘텐츠를 한 번에 생성합니다 · 최대 10개</p>
        </div>
        {/* 진행 요약 */}
        <div style={{ display: "flex", gap: 12 }}>
          {[
            { label: "전체", value: items.length, color: "#6366F1", bg: "#EEF2FF" },
            { label: "유효", value: validCount, color: "#059669", bg: "#ECFDF5" },
            { label: "크레딧", value: validCount, color: "#D97706", bg: "#FFF7ED" },
          ].map((k, i) => (
            <div key={i} style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 10, padding: "8px 14px", textAlign: "center" }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: k.color, margin: 0 }}>{k.value}</p>
              <p style={{ fontSize: 10, color: "#9CA3AF", margin: 0, fontWeight: 600 }}>{k.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 에러 배너 */}
      {error && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#991B1B", fontSize: 13, fontWeight: 600 }}>
          <AlertCircle size={15} /> {error}
          <button onClick={() => setError("")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }}>×</button>
        </div>
      )}

      {/* 생성 목록 카드 */}
      <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
        {/* 카드 헤더 */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>생성 목록</p>
            <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>최대 10개까지 한 번에 생성 가능</p>
          </div>
          <button className="add-row-btn" onClick={addItem} disabled={items.length >= 10 || isGenerating}>
            <Plus size={14} /> 행 추가
          </button>
        </div>

        {/* 컬럼 헤더 */}
        <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 130px 90px 32px", gap: 10, padding: "8px 14px", background: "#F9FAFB", borderBottom: "1px solid #F3F4F6" }}>
          {["", "주제", "유형", "슬라이드 수", ""].map((h, i) => (
            <div key={i} style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</div>
          ))}
        </div>

        {/* 아이템 목록 */}
        <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((item, index) => (
            <div key={item.id}>
              <div className="item-row" style={{
                background: item.status === "completed" ? "#F0FFF6" : item.status === "failed" ? "#FEF9F9" : "#fff",
                borderColor: item.status === "completed" ? "#A7F3D0" : item.status === "failed" ? "#FECACA" : "#F3F4F6",
              }}>
                {/* 상태 아이콘 */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <StatusIcon status={item.status} />
                </div>

                {/* 주제 입력 */}
                <input className="bulk-input" placeholder={`주제 ${index + 1}`} value={item.topic}
                  onChange={e => updateItem(item.id, "topic", e.target.value)} disabled={isGenerating} />

                {/* 유형 */}
                <Select value={item.contentType} onValueChange={v => updateItem(item.id, "contentType", v)} disabled={isGenerating}>
                  <SelectTrigger style={{ height: 38, borderRadius: 9, fontSize: 13, border: "1.5px solid #E5E7EB" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CAROUSEL">카드뉴스</SelectItem>
                    <SelectItem value="BLOG">블로그</SelectItem>
                  </SelectContent>
                </Select>

                {/* 슬라이드 수 */}
                <input className="bulk-input" type="number" min={3} max={10} value={item.slideCount}
                  onChange={e => updateItem(item.id, "slideCount", parseInt(e.target.value) || 5)}
                  disabled={isGenerating || item.contentType === "BLOG"}
                  style={{ textAlign: "center" }} />

                {/* 삭제 */}
                <button onClick={() => removeItem(item.id)} disabled={items.length <= 1 || isGenerating}
                  style={{ width: 32, height: 32, borderRadius: 8, background: "none", border: "none", cursor: items.length <= 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", transition: "all 0.15s" }}
                  onMouseEnter={e => { if (items.length > 1) (e.currentTarget as HTMLElement).style.color = "#EF4444"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#9CA3AF"; }}>
                  <Trash2 size={14} />
                </button>
              </div>
              {item.error && (
                <p style={{ fontSize: 11, color: "#EF4444", padding: "3px 42px", margin: 0 }}>{item.error}</p>
              )}
            </div>
          ))}
        </div>

        {/* 하단 액션 바 */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FAFAFA" }}>
          <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>
            {items.length}개 항목 · <span style={{ color: "#059669", fontWeight: 700 }}>{validCount}개 유효</span> · 크레딧 {validCount}개 소모
          </p>
          <button className="generate-btn" onClick={handleGenerate}
            disabled={isGenerating || validCount === 0}
            style={{ background: isGenerating || validCount === 0 ? "#E5E7EB" : "linear-gradient(135deg,#6366F1,#8B5CF6)", color: isGenerating || validCount === 0 ? "#9CA3AF" : "#fff", boxShadow: isGenerating || validCount === 0 ? "none" : "0 2px 10px rgba(99,102,241,0.3)", cursor: isGenerating || validCount === 0 ? "not-allowed" : "pointer" }}>
            {isGenerating ? <><Loader2 size={14} className="animate-spin" /> 생성 중...</> : <><Zap size={14} /> 일괄 생성</>}
          </button>
        </div>
      </div>

      {/* 예약 발행 */}
      <SchedulePicker value={scheduledAt} onChange={setScheduledAt} disabled={isGenerating} />

      {/* 완료 배너 */}
      {completedCount > 0 && (
        <div style={{ marginTop: 16, padding: "16px 20px", borderRadius: 14, background: "#ECFDF5", border: "1.5px solid #A7F3D0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Check size={18} color="#059669" />
            <p style={{ fontSize: 14, fontWeight: 700, color: "#065F46", margin: 0 }}>
              {completedCount}개 콘텐츠가 성공적으로 생성되었습니다
            </p>
          </div>
          <Link href="/contents" style={{ height: 38, padding: "0 18px", borderRadius: 9, background: "#059669", color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", textDecoration: "none" }}>
            목록 보기
          </Link>
        </div>
      )}
    </div>
  );
}
