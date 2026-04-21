"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Zap, Layers, FileText, Layout, MousePointer, AlignLeft,
  FormInput, Navigation, ArrowRight, ChevronRight,
  ExternalLink, Sparkles, Grid2X2, BookOpen,
  LayoutDashboard, Settings, CreditCard, Image as ImageIcon,
  Users, Home, PenLine, BarChart2, Check, Eye,
  Monitor, Columns, StretchHorizontal, Maximize2,
  RefreshCw, ZoomIn, List, Sidebar, Hash,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   디자인 패턴 데이터
══════════════════════════════════════════════════════════ */

// 패턴 카테고리 목록
const PATTERN_CATEGORIES = [
  {
    id: "layout",
    label: "Layout Patterns",
    icon: <Layout size={16} />,
    desc: "섹션·그리드·컨테이너 배치 규칙",
  },
  {
    id: "interaction",
    label: "Interaction Patterns",
    icon: <MousePointer size={16} />,
    desc: "Hover·Focus·Transition 인터랙션",
  },
  {
    id: "content",
    label: "Content Patterns",
    icon: <AlignLeft size={16} />,
    desc: "카드·리스트·피드 콘텐츠 배열",
  },
  {
    id: "form",
    label: "Form Patterns",
    icon: <FormInput size={16} />,
    desc: "다단계 폼·인라인 편집·유효성 검사",
  },
  {
    id: "navigation",
    label: "Navigation Patterns",
    icon: <Navigation size={16} />,
    desc: "사이드바·탭·브레드크럼 네비게이션",
  },
];

/* ═══════════════════════════════════════════════════════════
   Layout Patterns 미리보기 컴포넌트들
══════════════════════════════════════════════════════════ */

function HeroSplitPreview() {
  return (
    <div style={{ display: "flex", gap: 12, height: "100%", alignItems: "center", padding: "0 8px" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ height: 8, background: "var(--brand-500)", borderRadius: 4, width: "80%" }} />
        <div style={{ height: 6, background: "#C7D2FE", borderRadius: 4, width: "60%" }} />
        <div style={{ height: 5, background: "#E0E7FF", borderRadius: 4, width: "90%" }} />
        <div style={{ height: 5, background: "#E0E7FF", borderRadius: 4, width: "70%" }} />
        <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
          <div style={{ height: 22, width: 60, background: "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))", borderRadius: 5 }} />
          <div style={{ height: 22, width: 50, background: "#F3F4F6", borderRadius: 5, border: "1px solid #E5E7EB" }} />
        </div>
      </div>
      <div style={{ flex: 1, background: "linear-gradient(135deg,#EEF2FF,#F5F3FF)", borderRadius: 10, height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 40, height: 40, background: "white", borderRadius: 8, boxShadow: "0 4px 12px rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Zap size={18} color="var(--brand-500)" />
        </div>
      </div>
    </div>
  );
}

function GridThreeColPreview() {
  const cols = [
    { color: "#EFF6FF", icon: "var(--brand-500)" },
    { color: "#F5F3FF", icon: "var(--fp-cyan)" },
    { color: "#ECFDF5", icon: "#059669" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "0 8px" }}>
      {cols.map((c, i) => (
        <div key={i} style={{ background: c.color, borderRadius: 8, padding: "12px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ width: 24, height: 24, background: c.icon, borderRadius: 6, opacity: 0.8 }} />
          <div style={{ height: 5, background: "#111827", opacity: 0.15, borderRadius: 3, width: "70%" }} />
          <div style={{ height: 4, background: "#111827", opacity: 0.1, borderRadius: 3, width: "90%" }} />
          <div style={{ height: 4, background: "#111827", opacity: 0.1, borderRadius: 3, width: "60%" }} />
        </div>
      ))}
    </div>
  );
}

function SidebarLayoutPreview() {
  return (
    <div style={{ display: "flex", gap: 8, height: "100%", padding: "0 4px", alignItems: "stretch" }}>
      <div style={{ width: 44, background: "#F8F7FF", borderRadius: 8, padding: "8px 6px", display: "flex", flexDirection: "column", gap: 4 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ height: 16, background: i === 2 ? "var(--brand-500)" : "#E0E7FF", borderRadius: 5 }} />
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ height: 16, background: "#F3F4F6", borderRadius: 5 }} />
        <div style={{ flex: 1, background: "#FAFAFA", borderRadius: 8, border: "1px solid #F3F4F6", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: 4 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ background: "#fff", borderRadius: 4, border: "1px solid #E5E7EB" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FullWidthSectionPreview() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 4px" }}>
      <div style={{ height: 32, background: "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ height: 5, width: 40, background: "rgba(255,255,255,0.8)", borderRadius: 3 }} />
          <div style={{ height: 5, width: 20, background: "rgba(255,255,255,0.5)", borderRadius: 3 }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 6 }}>
        <div style={{ background: "#EEF2FF", borderRadius: 6, height: 40 }} />
        <div style={{ background: "#F5F3FF", borderRadius: 6, height: 40 }} />
      </div>
      <div style={{ height: 8, background: "#F3F4F6", borderRadius: 4 }} />
    </div>
  );
}

function CardGridPreview() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, padding: "0 4px" }}>
      {[0,1,2,3].map(i => (
        <div key={i} style={{ borderRadius: 6, border: "1px solid #E5E7EB", background: "#fff", overflow: "hidden" }}>
          <div style={{ height: 30, background: `linear-gradient(135deg, ${["#EEF2FF","#F5F3FF","#ECFDF5","#FFFBEB"][i]}, ${["#E0E7FF","#EDE9FE","#D1FAE5","#FDE68A"][i]})` }} />
          <div style={{ padding: "4px 5px", display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ height: 4, background: "#111827", opacity: 0.2, borderRadius: 2 }} />
            <div style={{ height: 3, background: "#111827", opacity: 0.1, borderRadius: 2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StickyHeaderPreview() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, padding: "0 4px", borderRadius: 8, overflow: "hidden", border: "1px solid #E5E7EB" }}>
      <div style={{ height: 20, background: "rgba(255,255,255,0.95)", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px" }}>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <div style={{ width: 10, height: 10, background: "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))", borderRadius: 3 }} />
          <div style={{ height: 4, width: 24, background: "#111827", opacity: 0.5, borderRadius: 2 }} />
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 4, width: 16, background: "#9CA3AF", opacity: 0.5, borderRadius: 2 }} />)}
        </div>
      </div>
      <div style={{ flex: 1, background: "#F8F7FF", minHeight: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
          <div style={{ height: 8, width: 80, background: "var(--brand-500)", opacity: 0.6, borderRadius: 4 }} />
          <div style={{ height: 5, width: 60, background: "#9CA3AF", opacity: 0.5, borderRadius: 3 }} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Interaction Patterns 미리보기
══════════════════════════════════════════════════════════ */

function HoverCardPreview() {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div style={{ display: "flex", gap: 8, padding: "0 4px", justifyContent: "center" }}>
      {[0, 1, 2].map(i => (
        <div key={i}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{
            flex: 1, background: "#fff", borderRadius: 10, border: "1.5px solid",
            borderColor: hovered === i ? "var(--brand-500)" : "#E5E7EB",
            padding: "12px 8px",
            transform: hovered === i ? "translateY(-4px)" : "none",
            boxShadow: hovered === i ? "0 12px 24px rgba(99,102,241,0.15)" : "0 1px 3px rgba(0,0,0,0.04)",
            transition: "all 0.2s ease",
            cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: hovered === i ? "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))" : "#EEF2FF" }} />
          <div style={{ height: 4, width: "70%", background: hovered === i ? "var(--brand-500)" : "#E5E7EB", borderRadius: 2, transition: "all 0.2s" }} />
          <div style={{ height: 3, width: "90%", background: "#F3F4F6", borderRadius: 2 }} />
        </div>
      ))}
    </div>
  );
}

function TransitionPreview() {
  const [active, setActive] = useState(0);
  const tabs = ["전체", "활성", "완료"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 4px" }}>
      <div style={{ display: "inline-flex", background: "#F3F4F6", borderRadius: 8, padding: 3, gap: 2 }}>
        {tabs.map((t, i) => (
          <button key={t} onClick={() => setActive(i)} style={{
            padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: i === active ? 600 : 400,
            color: i === active ? "#111827" : "#6B7280",
            background: i === active ? "#fff" : "transparent",
            border: "none", cursor: "pointer",
            boxShadow: i === active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            transition: "all 0.15s ease",
          }}>{t}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            height: 20, background: active === 0 || active === (i % 2 === 0 ? 2 : 1) ? "#EEF2FF" : "#F3F4F6",
            borderRadius: 5, border: `1px solid ${active === 0 || active === (i % 2 === 0 ? 2 : 1) ? "#C7D2FE" : "#E5E7EB"}`,
            transition: "all 0.2s ease",
            display: "flex", alignItems: "center", paddingLeft: 8, gap: 6,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: active === 0 || active === (i % 2 === 0 ? 2 : 1) ? "var(--brand-500)" : "#9CA3AF", transition: "all 0.2s" }} />
            <div style={{ height: 4, width: "50%", background: "#D1D5DB", borderRadius: 2 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressPreview() {
  const [val, setVal] = useState(65);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 4px" }}>
      {[
        { label: "카드뉴스", pct: val, color: "var(--brand-500)" },
        { label: "블로그", pct: Math.max(val - 25, 0), color: "var(--fp-cyan)" },
        { label: "SNS", pct: Math.min(val + 20, 100), color: "#059669" },
      ].map(p => (
        <div key={p.label}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: "#374151", fontWeight: 500 }}>{p.label}</span>
            <span style={{ fontSize: 10, color: p.color, fontWeight: 700 }}>{p.pct}%</span>
          </div>
          <div style={{ height: 6, background: "#F3F4F6", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${p.pct}%`, background: p.color, borderRadius: 3, transition: "width 0.4s ease" }} />
          </div>
        </div>
      ))}
      <input type="range" min={0} max={100} value={val} onChange={e => setVal(+e.target.value)}
        style={{ width: "100%", accentColor: "var(--brand-500)", margin: 0 }} />
    </div>
  );
}

function SkeletonToLoadedPreview() {
  const [loaded, setLoaded] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 4px" }}>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes shimmer2{0%{background-position:-300px 0}100%{background-position:300px 0}}` }} />
      {[1, 2].map(i => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {loaded ? (
            <>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 6, background: "#111827", opacity: 0.2, borderRadius: 3, marginBottom: 4, width: "60%" }} />
                <div style={{ height: 4, background: "#9CA3AF", opacity: 0.3, borderRadius: 2, width: "80%" }} />
              </div>
            </>
          ) : (
            <>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(90deg,#F3F4F6 25%,#E9ECEF 50%,#F3F4F6 75%)", backgroundSize: "300px 100%", animation: "shimmer2 1.5s infinite", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 6, borderRadius: 3, marginBottom: 4, width: "60%", background: "linear-gradient(90deg,#F3F4F6 25%,#E9ECEF 50%,#F3F4F6 75%)", backgroundSize: "300px 100%", animation: "shimmer2 1.5s infinite" }} />
                <div style={{ height: 4, borderRadius: 2, width: "80%", background: "linear-gradient(90deg,#F3F4F6 25%,#E9ECEF 50%,#F3F4F6 75%)", backgroundSize: "300px 100%", animation: "shimmer2 1.5s infinite" }} />
              </div>
            </>
          )}
        </div>
      ))}
      <button onClick={() => setLoaded(l => !l)} style={{
        height: 24, borderRadius: 6, border: "1px solid #C7D2FE", background: loaded ? "#EEF2FF" : "#fff",
        color: "var(--brand-500)", fontSize: 10, fontWeight: 600, cursor: "pointer",
      }}>{loaded ? "스켈레톤 보기" : "로드 완료"}</button>
    </div>
  );
}

function TooltipPreview() {
  const [tip, setTip] = useState<string | null>(null);
  const btns = [
    { label: "저장", tip: "Ctrl+S로 저장", color: "var(--brand-500)" },
    { label: "공유", tip: "링크를 복사합니다", color: "#059669" },
    { label: "삭제", tip: "복구 불가", color: "#DC2626" },
  ];
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center", position: "relative", padding: "16px 4px 4px" }}>
      {btns.map(b => (
        <div key={b.label} style={{ position: "relative" }}>
          {tip === b.label && (
            <div style={{
              position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
              background: "#111827", color: "#fff", fontSize: 9, fontWeight: 500, padding: "3px 8px",
              borderRadius: 4, whiteSpace: "nowrap", pointerEvents: "none",
            }}>
              {b.tip}
              <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", borderWidth: "4px 4px 0", borderStyle: "solid", borderColor: "#111827 transparent transparent" }} />
            </div>
          )}
          <button onMouseEnter={() => setTip(b.label)} onMouseLeave={() => setTip(null)}
            style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: b.color, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            {b.label}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Content Patterns 미리보기
══════════════════════════════════════════════════════════ */

function MasonryPreview() {
  const items = [
    { h: 60, color: "#EEF2FF", b: "#C7D2FE" },
    { h: 40, color: "#ECFDF5", b: "#A7F3D0" },
    { h: 80, color: "#F5F3FF", b: "#DDD6FE" },
    { h: 50, color: "#FFFBEB", b: "#FDE68A" },
    { h: 70, color: "#FFF5F5", b: "#FECDD3" },
    { h: 45, color: "#F0F9FF", b: "#BAE6FD" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, padding: "0 4px", alignItems: "start" }}>
      {items.map((it, i) => (
        <div key={i} style={{ height: it.h, background: it.color, borderRadius: 7, border: `1px solid ${it.b}` }} />
      ))}
    </div>
  );
}

function FeedPreview() {
  const items = ["카드뉴스 AI 생성 완료", "블로그 포스트 예약 발행", "Instagram 동기화됨"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 4px" }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#fff", borderRadius: 8, border: "1px solid #F3F4F6" }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: ["#EEF2FF", "#ECFDF5", "#FFF5F5"][i], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: ["var(--brand-500)", "#059669", "#E11D48"][i] }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ height: 5, background: "#111827", opacity: 0.25, borderRadius: 2, width: "80%", marginBottom: 3 }} />
            <div style={{ height: 3, background: "#9CA3AF", opacity: 0.3, borderRadius: 2, width: "50%" }} />
          </div>
          <div style={{ height: 14, width: 14, borderRadius: 4, background: "#EEF2FF" }} />
        </div>
      ))}
    </div>
  );
}

function KanbanPreview() {
  const cols = [
    { label: "예정", color: "#EEF2FF", bc: "#C7D2FE", items: 2 },
    { label: "진행", color: "#FFFBEB", bc: "#FDE68A", items: 3 },
    { label: "완료", color: "#ECFDF5", bc: "#A7F3D0", items: 1 },
  ];
  return (
    <div style={{ display: "flex", gap: 6, padding: "0 4px" }}>
      {cols.map(col => (
        <div key={col.label} style={{ flex: 1, background: col.color, borderRadius: 8, border: `1px solid ${col.bc}`, padding: "6px 5px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#374151", marginBottom: 5, paddingLeft: 2 }}>{col.label} · {col.items}</div>
          {Array.from({ length: col.items }).map((_, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 5, border: "1px solid #F3F4F6", padding: "5px 6px", marginBottom: 4 }}>
              <div style={{ height: 4, background: "#E5E7EB", borderRadius: 2, marginBottom: 3 }} />
              <div style={{ height: 3, background: "#F3F4F6", borderRadius: 2, width: "60%" }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TimelinePreview() {
  const events = [
    { active: true, color: "var(--brand-500)" },
    { active: true, color: "var(--fp-cyan)" },
    { active: false, color: "#9CA3AF" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, padding: "0 8px", position: "relative" }}>
      {events.map((ev, i) => (
        <div key={i} style={{ display: "flex", gap: 10, paddingBottom: i < events.length - 1 ? 14 : 0, position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: ev.active ? ev.color : "#E5E7EB", border: `2px solid ${ev.active ? `${ev.color}30` : "#F3F4F6"}`, flexShrink: 0, zIndex: 1 }} />
            {i < events.length - 1 && <div style={{ width: 2, flex: 1, background: "#E5E7EB", marginTop: 2 }} />}
          </div>
          <div style={{ flex: 1, paddingTop: 1 }}>
            <div style={{ height: 5, background: ev.active ? "#111827" : "#E5E7EB", opacity: ev.active ? 0.3 : 1, borderRadius: 2, width: "70%", marginBottom: 3 }} />
            <div style={{ height: 4, background: "#9CA3AF", opacity: 0.2, borderRadius: 2, width: "50%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TablePreview() {
  const rows = [
    { name: "카드뉴스 A", status: "#ECFDF5", statusBorder: "#A7F3D0", statusDot: "#059669" },
    { name: "블로그 포스트", status: "#FFFBEB", statusBorder: "#FDE68A", statusDot: "#D97706" },
    { name: "SNS 캡션 B", status: "#EFF6FF", statusBorder: "#BFDBFE", statusDot: "#2563EB" },
  ];
  return (
    <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid #E5E7EB", padding: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", background: "#F8F9FA", padding: "4px 8px", borderBottom: "1px solid #E5E7EB" }}>
        {["이름", "상태", "채널"].map(h => (
          <div key={h} style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" }}>{h}</div>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "5px 8px", borderBottom: i < rows.length - 1 ? "1px solid #F3F4F6" : "none", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
          <div style={{ height: 5, background: "#374151", opacity: 0.3, borderRadius: 2, width: "80%", alignSelf: "center" }} />
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: row.statusDot, marginRight: 3 }} />
          </div>
          <div style={{ height: 5, background: "#9CA3AF", opacity: 0.3, borderRadius: 2, width: "60%", alignSelf: "center" }} />
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Form Patterns 미리보기
══════════════════════════════════════════════════════════ */

function MultiStepFormPreview() {
  const [step, setStep] = useState(0);
  const steps = ["기본 정보", "채널 설정", "확인"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {steps.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div onClick={() => setStep(i)} style={{
                width: 20, height: 20, borderRadius: "50%", cursor: "pointer",
                background: i < step ? "#059669" : i === step ? "var(--brand-500)" : "#E5E7EB",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 700, color: i <= step ? "#fff" : "#9CA3AF",
              }}>{i < step ? "✓" : i + 1}</div>
              <span style={{ fontSize: 8, color: i === step ? "var(--brand-500)" : "#9CA3AF", fontWeight: i === step ? 700 : 400, whiteSpace: "nowrap" }}>{s}</span>
            </div>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: i < step ? "#059669" : "#E5E7EB", marginBottom: 12, margin: "0 4px 14px" }} />}
          </div>
        ))}
      </div>
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E5E7EB", padding: "10px 8px" }}>
        {step === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ height: 20, borderRadius: 5, border: "1.5px solid #C7D2FE", background: "#F8F7FF", paddingLeft: 8, display: "flex", alignItems: "center" }}>
              <div style={{ height: 4, width: "60%", background: "#D1D5DB", borderRadius: 2 }} />
            </div>
            <div style={{ height: 20, borderRadius: 5, border: "1.5px solid #E5E7EB", background: "#fff" }} />
          </div>
        )}
        {step === 1 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {["Instagram", "블로그", "LinkedIn", "X"].map((c, i) => (
              <div key={c} style={{ padding: "2px 8px", borderRadius: 9999, fontSize: 9, fontWeight: 600, background: i < 2 ? "#EEF2FF" : "#F3F4F6", color: i < 2 ? "var(--brand-500)" : "#9CA3AF", border: `1px solid ${i < 2 ? "#C7D2FE" : "#E5E7EB"}` }}>{c}</div>
            ))}
          </div>
        )}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 0" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Check size={14} color="#059669" />
            </div>
            <div style={{ height: 5, width: "60%", background: "#059669", opacity: 0.3, borderRadius: 2 }} />
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} style={{ flex: 1, height: 22, borderRadius: 5, border: "1px solid #E5E7EB", background: "#fff", fontSize: 9, color: "#6B7280", cursor: "pointer", fontWeight: 600 }}>이전</button>
        )}
        <button onClick={() => setStep(s => Math.min(s + 1, 2))} style={{ flex: 1, height: 22, borderRadius: 5, border: "none", background: step === 2 ? "#059669" : "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))", color: "#fff", fontSize: 9, cursor: "pointer", fontWeight: 600 }}>
          {step === 2 ? "완료" : "다음"}
        </button>
      </div>
    </div>
  );
}

function InlineEditPreview() {
  const [editing, setEditing] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 4px" }}>
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E5E7EB", padding: 10 }}>
        <div style={{ fontSize: 9, color: "#9CA3AF", marginBottom: 6 }}>브랜드 이름</div>
        {editing ? (
          <div style={{ display: "flex", gap: 4 }}>
            <div style={{ flex: 1, height: 22, borderRadius: 5, border: "1.5px solid var(--brand-500)", boxShadow: "0 0 0 3px rgba(99,102,241,0.1)", background: "#F8F7FF" }} />
            <button onClick={() => setEditing(false)} style={{ padding: "0 8px", height: 22, borderRadius: 5, border: "none", background: "var(--brand-500)", color: "#fff", fontSize: 9, cursor: "pointer", fontWeight: 600 }}>저장</button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ height: 5, width: "50%", background: "#111827", opacity: 0.3, borderRadius: 2 }} />
            <button onClick={() => setEditing(true)} style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid #E5E7EB", background: "#fff", fontSize: 9, color: "#6B7280", cursor: "pointer" }}>수정</button>
          </div>
        )}
      </div>
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E5E7EB", padding: 10 }}>
        <div style={{ fontSize: 9, color: "#9CA3AF", marginBottom: 6 }}>채널 URL</div>
        <div style={{ height: 5, width: "70%", background: "#111827", opacity: 0.2, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function ValidationPreview() {
  const [val, setVal] = useState("");
  const isError = val.length > 0 && !val.includes("@");
  const isOk = val.includes("@") && val.includes(".");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 4px" }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 500, color: "#374151", marginBottom: 4 }}>이메일</div>
        <input value={val} onChange={e => setVal(e.target.value)}
          placeholder="hello@example.com"
          style={{
            width: "100%", height: 28, padding: "0 10px", borderRadius: 6,
            border: `1.5px solid ${isError ? "#DC2626" : isOk ? "#059669" : "#E5E7EB"}`,
            boxShadow: isError ? "0 0 0 3px rgba(220,38,38,0.1)" : isOk ? "0 0 0 3px rgba(5,150,105,0.1)" : "none",
            outline: "none", fontSize: 11, boxSizing: "border-box",
            transition: "all 0.2s",
          }}
        />
        {isError && <p style={{ fontSize: 9, color: "#DC2626", marginTop: 3 }}>올바른 이메일을 입력해주세요.</p>}
        {isOk && <p style={{ fontSize: 9, color: "#059669", marginTop: 3 }}>✓ 유효한 이메일입니다.</p>}
      </div>
      <button style={{ height: 24, borderRadius: 6, border: "none", background: isOk ? "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))" : "#E5E7EB", color: isOk ? "#fff" : "#9CA3AF", fontSize: 10, fontWeight: 600, cursor: isOk ? "pointer" : "default", transition: "all 0.2s" }}>
        시작하기
      </button>
    </div>
  );
}

function SearchFilterPreview() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("전체");
  const items = ["카드뉴스 마케팅", "블로그 SEO 가이드", "SNS 캡션 모음", "뉴스레터 템플릿"];
  const filtered = items.filter(it => (filter === "전체" || it.includes(filter.slice(0, 2))) && it.includes(query));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 4px" }}>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="검색..."
        style={{ height: 24, padding: "0 8px", borderRadius: 6, border: "1.5px solid #E5E7EB", fontSize: 10, outline: "none", boxSizing: "border-box" }} />
      <div style={{ display: "flex", gap: 4 }}>
        {["전체", "카드뉴스", "블로그"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "2px 8px", borderRadius: 9999, fontSize: 9, fontWeight: filter === f ? 700 : 400, background: filter === f ? "var(--brand-500)" : "#F3F4F6", color: filter === f ? "#fff" : "#9CA3AF", border: "none", cursor: "pointer" }}>{f}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {filtered.length > 0 ? filtered.map(it => (
          <div key={it} style={{ height: 18, background: "#fff", borderRadius: 5, border: "1px solid #F3F4F6", display: "flex", alignItems: "center", paddingLeft: 8 }}>
            <div style={{ height: 4, width: "60%", background: "#374151", opacity: 0.25, borderRadius: 2 }} />
          </div>
        )) : (
          <div style={{ textAlign: "center", fontSize: 9, color: "#9CA3AF", padding: "8px 0" }}>검색 결과 없음</div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Navigation Patterns 미리보기
══════════════════════════════════════════════════════════ */

function CollapsibleSidebarPreview() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div style={{ display: "flex", gap: 8, height: "100%", alignItems: "stretch" }}>
      <div style={{ width: collapsed ? 28 : 70, background: "#F8F7FF", borderRadius: 8, padding: "8px 6px", transition: "width 0.2s ease", display: "flex", flexDirection: "column", gap: 4, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: collapsed ? "center" : "flex-end", marginBottom: 4 }}>
          <button onClick={() => setCollapsed(c => !c)} style={{ width: 16, height: 16, borderRadius: 4, border: "1px solid #E5E7EB", background: "#fff", fontSize: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {collapsed ? "›" : "‹"}
          </button>
        </div>
        {["홈", "콘텐츠", "AI", "분석", "설정"].map((item, i) => (
          <div key={item} style={{ height: 22, borderRadius: 5, background: i === 1 ? "#EEF2FF" : "transparent", display: "flex", alignItems: "center", gap: 5, padding: "0 6px" }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: i === 1 ? "var(--brand-500)" : "#C7D2FE", flexShrink: 0 }} />
            {!collapsed && <div style={{ height: 4, width: "60%", background: i === 1 ? "var(--brand-500)" : "#D1D5DB", borderRadius: 2 }} />}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, background: "#FAFAFA", borderRadius: 8, border: "1px solid #F3F4F6" }} />
    </div>
  );
}

function BottomNavPreview() {
  const [active, setActive] = useState(0);
  const items = [
    { icon: <Home size={12} />, label: "홈" },
    { icon: <FileText size={12} />, label: "콘텐츠" },
    { icon: <Sparkles size={12} />, label: "AI" },
    { icon: <BarChart2 size={12} />, label: "분석" },
    { icon: <Settings size={12} />, label: "설정" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ background: "#F8F7FF", borderRadius: 8, height: 60, border: "1px solid #E5E7EB" }} />
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E5E7EB", padding: "6px 8px", display: "flex", justifyContent: "space-around", boxShadow: "0 -2px 12px rgba(0,0,0,0.06)" }}>
        {items.map((item, i) => (
          <button key={i} onClick={() => setActive(i)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer",
            color: i === active ? "var(--brand-500)" : "#9CA3AF", transition: "color 0.15s",
          }}>
            {item.icon}
            <span style={{ fontSize: 8, fontWeight: i === active ? 700 : 400 }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BreadcrumbNavPreview() {
  const [current, setCurrent] = useState(2);
  const crumbs = ["홈", "콘텐츠", "카드뉴스", "AI 생성"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        {crumbs.slice(0, current + 1).map((c, i) => (
          <div key={c} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span onClick={() => setCurrent(i)} style={{
              fontSize: 10, fontWeight: i === current ? 700 : 400,
              color: i === current ? "#111827" : "#9CA3AF",
              cursor: i < current ? "pointer" : "default",
              textDecoration: i < current ? "underline" : "none",
            }}>{c}</span>
            {i < current && <ChevronRight size={10} color="#D1D5DB" />}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {current < crumbs.length - 1 && (
          <button onClick={() => setCurrent(c => c + 1)} style={{ padding: "2px 8px", borderRadius: 5, border: "1px solid #E5E7EB", background: "#fff", fontSize: 9, cursor: "pointer", color: "#374151" }}>
            {crumbs[current + 1]} →
          </button>
        )}
        {current > 0 && (
          <button onClick={() => setCurrent(c => c - 1)} style={{ padding: "2px 8px", borderRadius: 5, border: "1px solid #E5E7EB", background: "#fff", fontSize: 9, cursor: "pointer", color: "#6B7280" }}>
            ← 뒤로
          </button>
        )}
      </div>
    </div>
  );
}

function TabNavPreview() {
  const [active, setActive] = useState(0);
  const tabs = ["전체", "카드뉴스", "블로그", "SNS"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 4px" }}>
      {/* Pill tabs */}
      <div style={{ display: "flex", background: "#F3F4F6", borderRadius: 8, padding: 3, gap: 2 }}>
        {tabs.slice(0, 3).map((t, i) => (
          <button key={t} onClick={() => setActive(i)} style={{
            flex: 1, padding: "4px 0", borderRadius: 6, fontSize: 9, fontWeight: i === active ? 700 : 400,
            color: i === active ? "#111827" : "#6B7280", background: i === active ? "#fff" : "transparent",
            border: "none", cursor: "pointer", boxShadow: i === active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            transition: "all 0.15s",
          }}>{t}</button>
        ))}
      </div>
      {/* Underline tabs */}
      <div style={{ display: "flex", borderBottom: "1.5px solid #E5E7EB" }}>
        {tabs.map((t, i) => (
          <button key={t} onClick={() => setActive(i === active ? 0 : i)} style={{
            padding: "4px 10px", fontSize: 9, fontWeight: active === i ? 700 : 400,
            color: active === i ? "var(--brand-500)" : "#6B7280",
            borderBottom: active === i ? "2px solid var(--brand-500)" : "none",
            background: "none", border: "none", cursor: "pointer", marginBottom: -1.5,
            transition: "all 0.15s",
          }}>{t}</button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   패턴 데이터 정의
══════════════════════════════════════════════════════════ */

const PATTERNS: Record<string, Array<{
  name: string;
  desc: string;
  when: string;
  token: string;
  preview: React.ReactNode;
}>> = {
  layout: [
    { name: "Hero Split", desc: "좌텍스트 + 우비주얼 2단 히어로", when: "랜딩, 기능 소개", token: "flex / gap-12", preview: <HeroSplitPreview /> },
    { name: "3-Column Feature Grid", desc: "기능 카드 3열 균등 그리드", when: "Features, 서비스 소개", token: "grid-cols-3 / gap-6", preview: <GridThreeColPreview /> },
    { name: "Sidebar Layout", desc: "좌 사이드바 + 우 메인 콘텐츠", when: "앱 대시보드, 설정", token: "w-[220px] + flex-1", preview: <SidebarLayoutPreview /> },
    { name: "Full-Width Section", desc: "전체 너비 그라디언트 히어로 배너", when: "CTA, 프로모션", token: "w-full / gradient", preview: <FullWidthSectionPreview /> },
    { name: "4-Column Card Grid", desc: "카드 4열 자동 래핑 그리드", when: "갤러리, 상품 목록", token: "grid-cols-4 / auto-fill", preview: <CardGridPreview /> },
    { name: "Sticky Header", desc: "상단 고정 GNB + 스크롤 블러", when: "모든 페이지 최상단", token: "position:sticky / backdrop-blur", preview: <StickyHeaderPreview /> },
  ],
  interaction: [
    { name: "Card Hover Lift", desc: "카드 호버 시 떠오르는 elevation 효과", when: "모든 클릭 가능 카드", token: "translateY(-4px) + shadow", preview: <HoverCardPreview /> },
    { name: "Tab Transition", desc: "탭 전환 시 콘텐츠 페이드 + 언더라인 슬라이드", when: "필터 탭, 카테고리", token: "transition: all 0.15s ease", preview: <TransitionPreview /> },
    { name: "Progress Animation", desc: "막대 채움 애니메이션 (스크롤 트리거 가능)", when: "사용량, 달성률 표시", token: "transition: width 0.4s ease", preview: <ProgressPreview /> },
    { name: "Skeleton → Content", desc: "로딩 스켈레톤에서 실제 콘텐츠로 전환", when: "비동기 데이터 로딩", token: "shimmer animation + opacity", preview: <SkeletonToLoadedPreview /> },
    { name: "Tooltip on Hover", desc: "버튼/아이콘 호버 시 맥락 정보 툴팁", when: "아이콘 전용 버튼, 약어", token: "position:absolute / z-50", preview: <TooltipPreview /> },
  ],
  content: [
    { name: "Masonry Grid", desc: "높이 가변 카드의 핀터레스트형 배열", when: "갤러리, 포트폴리오", token: "columns-3 / break-inside-avoid", preview: <MasonryPreview /> },
    { name: "Activity Feed", desc: "시간순 이벤트/알림 스트림", when: "알림, 활동 로그", token: "flex col / gap-2", preview: <FeedPreview /> },
    { name: "Kanban Board", desc: "드래그 가능한 칸반 상태별 컬럼", when: "콘텐츠 관리, 프로젝트", token: "flex / column-per-status", preview: <KanbanPreview /> },
    { name: "Vertical Timeline", desc: "날짜/밀스톤 수직 타임라인", when: "이력, 업데이트 노트", token: "relative / before:border-l", preview: <TimelinePreview /> },
    { name: "Data Table", desc: "정렬/필터 가능한 인터랙티브 테이블", when: "목록 관리, 어드민", token: "grid / sticky thead", preview: <TablePreview /> },
  ],
  form: [
    { name: "Multi-Step Form", desc: "단계 인디케이터 + 단계별 폼 (3step)", when: "온보딩, 회원가입", token: "step state + conditional render", preview: <MultiStepFormPreview /> },
    { name: "Inline Edit", desc: "뷰 모드 ↔ 편집 모드 전환 인라인 편집", when: "상세 페이지, 설정", token: "isEditing state toggle", preview: <InlineEditPreview /> },
    { name: "Live Validation", desc: "실시간 입력값 유효성 검사 + 피드백", when: "이메일, 비밀번호 입력", token: "onChange + regex check", preview: <ValidationPreview /> },
    { name: "Search + Filter", desc: "텍스트 검색과 카테고리 필터 조합", when: "콘텐츠 목록, 갤러리", token: "useState filter + includes()", preview: <SearchFilterPreview /> },
  ],
  navigation: [
    { name: "Collapsible Sidebar", desc: "접힘/펼침 토글 가능한 사이드 네비", when: "앱 레이아웃", token: "w-[220px→48px] transition", preview: <CollapsibleSidebarPreview /> },
    { name: "Bottom Nav Bar", desc: "모바일 하단 고정 네비게이션", when: "모바일 앱 뷰", token: "position:fixed / bottom:0", preview: <BottomNavPreview /> },
    { name: "Breadcrumb Nav", desc: "계층 구조 경로 표시 브레드크럼", when: "깊은 경로의 모든 페이지", token: "flex + ChevronRight", preview: <BreadcrumbNavPreview /> },
    { name: "Tab Navigation", desc: "Pill 탭 + Underline 탭 두 패턴", when: "카테고리 전환, 뷰 모드", token: "active state + border-bottom", preview: <TabNavPreview /> },
  ],
};

/* ═══════════════════════════════════════════════════════════
   페이지 라이브러리 데이터 + 미니어처
══════════════════════════════════════════════════════════ */

// ── 랜딩 홈 미니어처 ──
function LandingMiniature() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* GNB */}
      <div style={{ height: "5%", background: "rgba(255,255,255,0.95)", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))" }} />
          <div style={{ height: 3, width: 20, background: "#111827", opacity: 0.5, borderRadius: 2 }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[1,2,3,4].map(i => <div key={i} style={{ height: 3, width: 10, background: "#9CA3AF", borderRadius: 2 }} />)}
        </div>
        <div style={{ height: 10, width: 24, borderRadius: 3, background: "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))" }} />
      </div>
      {/* Hero */}
      <div style={{ flex: "0 0 22%", background: "linear-gradient(180deg,#F8F7FF,#fff)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: "70%" }}>
          <div style={{ height: 6, width: 40, background: "#EEF2FF", borderRadius: 9999, border: "1px solid #C7D2FE" }} />
          <div style={{ height: 8, width: "80%", background: "#111827", opacity: 0.7, borderRadius: 3 }} />
          <div style={{ height: 5, width: "60%", background: "#9CA3AF", opacity: 0.5, borderRadius: 2 }} />
          <div style={{ height: 5, width: "70%", background: "#9CA3AF", opacity: 0.4, borderRadius: 2 }} />
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            <div style={{ height: 12, width: 32, borderRadius: 3, background: "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))" }} />
            <div style={{ height: 12, width: 28, borderRadius: 3, border: "1px solid #E5E7EB", background: "#fff" }} />
          </div>
        </div>
      </div>
      {/* Stats */}
      <div style={{ flex: "0 0 10%", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: "1px solid #E5E7EB", borderBottom: "1px solid #E5E7EB" }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRight: i < 3 ? "1px solid #E5E7EB" : "none", gap: 2 }}>
            <div style={{ height: 6, width: 16, background: "var(--brand-500)", opacity: 0.5, borderRadius: 2 }} />
            <div style={{ height: 3, width: 12, background: "#9CA3AF", opacity: 0.4, borderRadius: 2 }} />
          </div>
        ))}
      </div>
      {/* Features */}
      <div style={{ flex: "0 0 20%", padding: "2% 4%", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "2%" }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ background: ["#EFF6FF","#ECFDF5","#FFF5F5","#F5F3FF"][i], borderRadius: 4, padding: "4% 3%", display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: ["var(--brand-500)","#059669","#E11D48","var(--fp-cyan)"][i], opacity: 0.6 }} />
            <div style={{ height: 3, width: "70%", background: "#111827", opacity: 0.25, borderRadius: 1 }} />
            <div style={{ height: 2, width: "90%", background: "#9CA3AF", opacity: 0.3, borderRadius: 1 }} />
            <div style={{ height: 2, width: "60%", background: "#9CA3AF", opacity: 0.2, borderRadius: 1 }} />
          </div>
        ))}
      </div>
      {/* CTA */}
      <div style={{ flex: 1, background: "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
        <div style={{ height: 6, width: "50%", background: "rgba(255,255,255,0.8)", borderRadius: 3 }} />
        <div style={{ height: 4, width: "40%", background: "rgba(255,255,255,0.5)", borderRadius: 2 }} />
        <div style={{ height: 12, width: 36, borderRadius: 3, background: "#fff", marginTop: 4 }} />
      </div>
    </div>
  );
}

function FeaturesPageMiniature() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ height: "5%", background: "#fff", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", padding: "0 4%" }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))" }} />
      </div>
      <div style={{ flex: "0 0 14%", background: "linear-gradient(180deg,#F8F7FF,#fff)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
        <div style={{ height: 8, width: "50%", background: "#111827", opacity: 0.6, borderRadius: 3 }} />
        <div style={{ height: 4, width: "40%", background: "#9CA3AF", opacity: 0.4, borderRadius: 2 }} />
      </div>
      {/* Feature rows */}
      {[0,1,2].map(i => (
        <div key={i} style={{ flex: "0 0 16%", display: "flex", gap: "3%", padding: "2% 4%", background: i % 2 === 0 ? "#fff" : "#F8F7FF", alignItems: "center" }}>
          <div style={{ flex: i % 2 === 0 ? "0 0 40%" : 1, background: `linear-gradient(135deg,${["#EEF2FF","#ECFDF5","#F5F3FF"][i]},${["#E0E7FF","#D1FAE5","#EDE9FE"][i]})`, borderRadius: 6, height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, background: ["var(--brand-500)","#059669","var(--fp-cyan)"][i], opacity: 0.4 }} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ height: 5, width: "60%", background: "#111827", opacity: 0.25, borderRadius: 2 }} />
            <div style={{ height: 3, width: "90%", background: "#9CA3AF", opacity: 0.3, borderRadius: 1 }} />
            <div style={{ height: 3, width: "70%", background: "#9CA3AF", opacity: 0.2, borderRadius: 1 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PricingPageMiniature() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ height: "5%", background: "#fff", borderBottom: "1px solid #F3F4F6" }} />
      <div style={{ flex: "0 0 12%", background: "#F8F7FF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
        <div style={{ height: 7, width: "40%", background: "#111827", opacity: 0.6, borderRadius: 3 }} />
        <div style={{ height: 14, width: 48, background: "#F3F4F6", borderRadius: 6 }} />
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2%", padding: "2% 4%" }}>
        {[
          { bg: "#fff", border: "#E5E7EB", highlight: false },
          { bg: "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))", border: "transparent", highlight: true },
          { bg: "#fff", border: "#E5E7EB", highlight: false },
        ].map((plan, i) => (
          <div key={i} style={{ background: plan.bg, borderRadius: 8, border: `1px solid ${plan.border}`, padding: "6% 5%", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ height: 4, width: "40%", background: plan.highlight ? "rgba(255,255,255,0.7)" : "#9CA3AF", opacity: 0.5, borderRadius: 2 }} />
            <div style={{ height: 8, width: "60%", background: plan.highlight ? "rgba(255,255,255,0.9)" : "#111827", opacity: 0.4, borderRadius: 3 }} />
            {[1,2,3,4].map(j => (
              <div key={j} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: plan.highlight ? "rgba(255,255,255,0.6)" : "#059669", opacity: 0.6 }} />
                <div style={{ height: 3, flex: 1, background: plan.highlight ? "rgba(255,255,255,0.4)" : "#E5E7EB", borderRadius: 1 }} />
              </div>
            ))}
            <div style={{ height: 12, width: "100%", borderRadius: 4, marginTop: 4, background: plan.highlight ? "#fff" : "#F3F4F6" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function GalleryPageMiniature() {
  const cards = [0,1,2,3,4,5,6,7,8];
  const colors = ["#EEF2FF","#ECFDF5","#FFF5F5","#F5F3FF","#FFFBEB","#F0F9FF","#EEF2FF","#ECFDF5","#F5F3FF"];
  return (
    <div style={{ width: "100%", height: "100%", background: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ height: "5%", background: "#fff", borderBottom: "1px solid #F3F4F6" }} />
      <div style={{ flex: "0 0 12%", background: "#F8F7FF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
        <div style={{ height: 6, width: "50%", background: "#111827", opacity: 0.5, borderRadius: 3 }} />
        <div style={{ height: 4, width: "35%", background: "#9CA3AF", opacity: 0.3, borderRadius: 2 }} />
      </div>
      <div style={{ flex: "0 0 8%", padding: "1% 4%", display: "flex", alignItems: "center", gap: 4, borderBottom: "1px solid #F3F4F6" }}>
        {["전체","카드뉴스","블로그","SNS"].map((f,i) => (
          <div key={f} style={{ height: 10, padding: "0 8px", borderRadius: 9999, background: i===0?"var(--brand-500)":"#F3F4F6", minWidth: 24, display: "flex", alignItems: "center" }}>
            <div style={{ height: 3, width: 12, background: i===0?"rgba(255,255,255,0.8)":"#9CA3AF", borderRadius: 1 }} />
          </div>
        ))}
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2%", padding: "2% 4%" }}>
        {cards.map(i => (
          <div key={i} style={{ borderRadius: 5, border: "1px solid #E5E7EB", overflow: "hidden" }}>
            <div style={{ height: "45%", background: colors[i] }} />
            <div style={{ height: "55%", background: "#fff", padding: "4% 5%", display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ height: 3, width: "45%", background: "var(--brand-500)", opacity: 0.4, borderRadius: 1 }} />
              <div style={{ height: 3, width: "90%", background: "#E5E7EB", borderRadius: 1 }} />
              <div style={{ height: 2, width: "65%", background: "#E5E7EB", borderRadius: 1 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuthPageMiniature() {
  return (
    <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#F8F7FF,#EEF2FF)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ width: "60%", background: "#fff", borderRadius: 8, padding: "6% 8%", boxShadow: "0 20px 40px rgba(99,102,241,0.1)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ width: 20, height: 20, borderRadius: 6, background: "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))" }} />
        <div style={{ height: 5, width: "50%", background: "#111827", opacity: 0.5, borderRadius: 2 }} />
        <div style={{ height: 3, width: "60%", background: "#9CA3AF", opacity: 0.4, borderRadius: 2 }} />
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
          {[1,2].map(i => (
            <div key={i} style={{ height: 14, borderRadius: 4, border: "1.5px solid #E5E7EB", background: "#fff" }} />
          ))}
        </div>
        <div style={{ width: "100%", height: 16, borderRadius: 5, background: "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))" }} />
        <div style={{ height: 3, width: "50%", background: "#9CA3AF", opacity: 0.3, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function DashboardMiniature() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#F7F8FA", display: "flex", overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{ width: "18%", height: "100%", background: "#fff", borderRight: "1px solid #F3F4F6", padding: "4% 3%", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))" }} />
          <div style={{ height: 3, width: 20, background: "#111827", opacity: 0.4, borderRadius: 2 }} />
        </div>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} style={{ height: 14, borderRadius: 4, background: i===1?"#EEF2FF":"transparent", border: i===1?"1px solid #C7D2FE":"none", display: "flex", alignItems: "center", padding: "0 4px", gap: 3 }}>
            <div style={{ width: 5, height: 5, borderRadius: 1, background: i===1?"var(--brand-500)":"#D1D5DB" }} />
            <div style={{ height: 3, width: "60%", background: i===1?"var(--brand-500)":"#D1D5DB", opacity: i===1?0.7:0.5, borderRadius: 1 }} />
          </div>
        ))}
      </div>
      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ height: "8%", background: "#fff", borderBottom: "1px solid #F3F4F6" }} />
        <div style={{ flex: 1, padding: "3%" }}>
          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "2%", marginBottom: "4%" }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ background: "#fff", borderRadius: 6, border: "1px solid #E5E7EB", padding: "6% 5%", display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ height: 3, width: "50%", background: "#9CA3AF", opacity: 0.5, borderRadius: 1 }} />
                <div style={{ height: 6, width: "60%", background: "#111827", opacity: 0.3, borderRadius: 2 }} />
              </div>
            ))}
          </div>
          {/* Content area */}
          <div style={{ background: "#fff", borderRadius: 6, border: "1px solid #E5E7EB", height: "55%", padding: "3% 4%", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ height: 5, width: "25%", background: "#111827", opacity: 0.3, borderRadius: 2 }} />
            {[1,2,3,4].map(i => (
              <div key={i} style={{ height: 14, borderRadius: 4, background: "#F8F9FA", border: "1px solid #F3F4F6", display: "flex", alignItems: "center", padding: "0 6px", gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: 2, background: ["var(--brand-500)","var(--fp-cyan)","#059669","#D97706"][i-1], opacity: 0.5 }} />
                <div style={{ height: 3, width: "55%", background: "#374151", opacity: 0.2, borderRadius: 1 }} />
                <div style={{ marginLeft: "auto", height: 10, width: 18, borderRadius: 3, background: ["#EEF2FF","#F5F3FF","#ECFDF5","#FFFBEB"][i-1] }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditorPageMiniature() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#F4F4F5", display: "flex", overflow: "hidden" }}>
      {/* Left panel */}
      <div style={{ width: "20%", background: "#18181B", display: "flex", flexDirection: "column", gap: 4, padding: "3% 3%" }}>
        <div style={{ height: 4, width: "60%", background: "rgba(255,255,255,0.3)", borderRadius: 2, marginBottom: 6 }} />
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{ height: 24, borderRadius: 4, background: "rgba(255,255,255,0.05)", border: "1px dashed rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ height: 3, width: "50%", background: "rgba(255,255,255,0.2)", borderRadius: 1 }} />
          </div>
        ))}
      </div>
      {/* Canvas */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "4%", background: "#E4E4E7" }}>
        <div style={{ width: "100%", maxHeight: "90%", background: "#fff", borderRadius: 6, boxShadow: "0 4px 24px rgba(0,0,0,0.12)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ height: "15%", background: "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ height: 6, width: "50%", background: "rgba(255,255,255,0.7)", borderRadius: 3 }} />
          </div>
          <div style={{ flex: 1, padding: "4%", display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ height: 6, width: "70%", background: "#111827", opacity: 0.2, borderRadius: 2 }} />
            <div style={{ height: 4, width: "90%", background: "#9CA3AF", opacity: 0.3, borderRadius: 2 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "3%", marginTop: "3%" }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ height: 20, background: ["#EEF2FF","#ECFDF5","#F5F3FF"][i], borderRadius: 4 }} />
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Right panel */}
      <div style={{ width: "22%", background: "#fff", borderLeft: "1px solid #E4E4E7", padding: "3% 3%", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ height: 4, width: "40%", background: "#111827", opacity: 0.3, borderRadius: 2, marginBottom: 4 }} />
        {[1,2,3,4,5].map(i => (
          <div key={i}>
            <div style={{ height: 3, width: "30%", background: "#9CA3AF", opacity: 0.4, borderRadius: 1, marginBottom: 3 }} />
            <div style={{ height: 14, borderRadius: 4, border: "1px solid #E5E7EB", background: "#F9FAFB" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPageMiniature() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#F7F8FA", display: "flex", overflow: "hidden" }}>
      <div style={{ width: "18%", background: "#fff", borderRight: "1px solid #F3F4F6", padding: "4% 3%" }}>
        <div style={{ height: 3, width: "60%", background: "#9CA3AF", opacity: 0.4, borderRadius: 2, marginBottom: 8 }} />
        {["일반","브랜드","SNS","알림","요금제"].map((item, i) => (
          <div key={item} style={{ height: 16, borderRadius: 4, background: i===0?"#EEF2FF":"transparent", marginBottom: 3, display: "flex", alignItems: "center", padding: "0 5px" }}>
            <div style={{ height: 3, width: "70%", background: i===0?"var(--brand-500)":"#D1D5DB", opacity: 0.6, borderRadius: 1 }} />
          </div>
        ))}
      </div>
      <div style={{ flex: 1, padding: "4% 5%", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ height: 6, width: "30%", background: "#111827", opacity: 0.4, borderRadius: 2 }} />
        <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E5E7EB", padding: "4% 5%", display: "flex", flexDirection: "column", gap: 6 }}>
          {[1,2,3].map(i => (
            <div key={i}>
              <div style={{ height: 3, width: "25%", background: "#374151", opacity: 0.3, borderRadius: 1, marginBottom: 4 }} />
              <div style={{ height: 14, borderRadius: 5, border: "1.5px solid #E5E7EB", background: "#fff" }} />
            </div>
          ))}
        </div>
        <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E5E7EB", padding: "4% 5%", display: "flex", flexDirection: "column", gap: 4 }}>
          {[1,2].map(i => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ height: 3, width: "40%", background: "#374151", opacity: 0.25, borderRadius: 1 }} />
              <div style={{ width: 20, height: 10, borderRadius: 9999, background: i===1?"var(--brand-500)":"#D1D5DB" }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ height: 14, width: 32, borderRadius: 4, background: "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))" }} />
        </div>
      </div>
    </div>
  );
}

const PAGE_LIBRARY = [
  {
    id: "landing",
    name: "랜딩 홈",
    desc: "메인 마케팅 허브. Hero, Stats, Features, Testimonial, CTA 섹션 구성.",
    href: "/",
    patterns: ["Hero Split", "Full-Width Section", "3-Column Feature Grid"],
    components: ["PublicHeader", "HeroSection", "StatBar", "FeatureCards", "CTABanner"],
    color: "var(--brand-500)",
    miniature: <LandingMiniature />,
  },
  {
    id: "features",
    name: "기능 소개",
    desc: "AI 기능 상세 설명. 교차 레이아웃 Feature Rows + 채널 연동 섹션.",
    href: "/features",
    patterns: ["Hero Split", "Sidebar Layout", "Timeline"],
    components: ["FeatureRow", "ChannelPills", "StepIndicator"],
    color: "#059669",
    miniature: <FeaturesPageMiniature />,
  },
  {
    id: "pricing",
    name: "요금제",
    desc: "플랜 비교 카드. Billing Toggle, Feature Checklist, FAQ 포함.",
    href: "/pricing",
    patterns: ["3-Column Card Grid", "Comparison Table"],
    components: ["PricingCard", "BillingToggle", "FeatureList", "FAQ"],
    color: "#D97706",
    miniature: <PricingPageMiniature />,
  },
  {
    id: "gallery",
    name: "AI 콘텐츠 갤러리",
    desc: "AI 생성 콘텐츠 쇼케이스. 필터 탭 + 그리드/리스트 뷰 전환.",
    href: "/gallery",
    patterns: ["4-Column Card Grid", "Tab Navigation", "Search + Filter"],
    components: ["GalleryCard", "TypeFilter", "ViewToggle"],
    color: "#E11D48",
    miniature: <GalleryPageMiniature />,
  },
  {
    id: "auth",
    name: "로그인 / 회원가입",
    desc: "인증 플로우. 중앙 정렬 카드 + 소셜 로그인 + 폼 유효성 검사.",
    href: "/login",
    patterns: ["Live Validation", "Multi-Step Form"],
    components: ["AuthCard", "SocialLogin", "InputField", "SubmitButton"],
    color: "var(--fp-cyan)",
    miniature: <AuthPageMiniature />,
  },
  {
    id: "dashboard",
    name: "대시보드 홈",
    desc: "앱 메인 화면. 사이드바 레이아웃 + KPI 카드 + 콘텐츠 목록.",
    href: "/home",
    patterns: ["Sidebar Layout", "Activity Feed", "Data Table"],
    components: ["AppSidebar", "StatCard", "ContentList", "QuickActions"],
    color: "#0EA5E9",
    miniature: <DashboardMiniature />,
  },
  {
    id: "editor",
    name: "Puck 에디터",
    desc: "드래그-앤-드롭 페이지 빌더. 컴포넌트 패널 + 캔버스 + 설정 패널.",
    href: "/home",
    patterns: ["Sidebar Layout", "Inline Edit", "Collapsible Sidebar"],
    components: ["PuckEditor", "ComponentPanel", "SettingsPanel", "PreviewToggle"],
    color: "#18181B",
    miniature: <EditorPageMiniature />,
  },
  {
    id: "settings",
    name: "사이트 설정",
    desc: "SEO, 브랜드, SNS 연동, 알림 설정. 탭 사이드바 + 폼 그룹.",
    href: "/settings",
    patterns: ["Sidebar Layout", "Inline Edit", "Live Validation"],
    components: ["SettingsSidebar", "FormGroup", "ToggleSwitch", "SaveButton"],
    color: "#374151",
    miniature: <SettingsPageMiniature />,
  },
];

/* ═══════════════════════════════════════════════════════════
   메인 페이지 컴포넌트
══════════════════════════════════════════════════════════ */

export default function DesignLibraryPage() {
  // 메인 탭: patterns | pages
  const [mainTab, setMainTab] = useState<"patterns" | "pages">("patterns");
  // 패턴 카테고리
  const [activeCategory, setActiveCategory] = useState("layout");
  // 페이지 라이브러리 호버
  const [hoveredPage, setHoveredPage] = useState<string | null>(null);

  const currentPatterns = PATTERNS[activeCategory] ?? [];
  const currentCategory = PATTERN_CATEGORIES.find(c => c.id === activeCategory);

  return (
    <div style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", minHeight: "100vh", background: "#F7F8FA" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { font-family: 'Pretendard Variable', 'Pretendard', sans-serif; box-sizing: border-box; }
        .dl-nav-item { cursor: pointer; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; color: #6B7280; transition: all 0.2s; }
        .dl-nav-item:hover { background: #EEF2FF; color: var(--brand-500); }
        .dl-nav-item.active { background: var(--brand-500); color: #fff; }
        .pattern-card { background: #fff; border: 1.5px solid #E5E7EB; border-radius: 16px; overflow: hidden; transition: all 0.25s; }
        .pattern-card:hover { box-shadow: 0 12px 32px rgba(99,102,241,0.12); border-color: #C7D2FE; transform: translateY(-2px); }
        .page-card { background: #fff; border: 1.5px solid #E5E7EB; border-radius: 16px; overflow: hidden; transition: all 0.25s; cursor: pointer; }
        .page-card:hover { box-shadow: 0 16px 40px rgba(0,0,0,0.10); border-color: #C7D2FE; transform: translateY(-3px); }
        code { background: #F3F4F6; border: 1px solid #E5E7EB; border-radius: 4px; padding: 1px 6px; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #374151; }
      ` }} />

      {/* ── 헤더 ─────────────────────────────────────── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid #F3F4F6", height: 56 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: "100%", display: "flex", alignItems: "center", gap: 0 }}>
          {/* 브레드크럼 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Zap size={14} color="#fff" />
              </div>
              <span style={{ fontSize: 14, color: "#6B7280" }}>FlowPack</span>
            </Link>
            <span style={{ color: "#E5E7EB" }}>/</span>
          </div>

          {/* 라이브러리 탭 스위처 */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, background: "#F3F4F6", borderRadius: 8, padding: 3, marginLeft: 4 }}>
            <Link href="/design-system" style={{ padding: "4px 12px", borderRadius: 6, fontSize: 13, fontWeight: 500, color: "#6B7280", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s" }}>
              <Layers size={13} />
              컴포넌트 라이브러리
            </Link>
            <div style={{ padding: "4px 12px", borderRadius: 6, fontSize: 13, fontWeight: 700, color: "#111827", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", display: "flex", alignItems: "center", gap: 6 }}>
              <BookOpen size={13} color="var(--brand-500)" />
              디자인 라이브러리
              <span style={{ fontSize: 10, fontWeight: 700, background: "#EEF2FF", color: "var(--brand-500)", padding: "1px 6px", borderRadius: 9999, border: "1px solid #C7D2FE" }}>NEW</span>
            </div>
          </div>

          <div style={{ marginLeft: "auto", fontSize: 12, color: "#9CA3AF", background: "#F3F4F6", padding: "3px 8px", borderRadius: 6 }}>
            v1.0 · Pattern & Page Library
          </div>
        </div>
      </header>

      {/* ── 메인 탭 ───────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 0, borderBottom: "2px solid #E5E7EB" }}>
          {[
            { id: "patterns" as const, label: "디자인 패턴 라이브러리", icon: <Grid2X2 size={15} />, count: Object.values(PATTERNS).flat().length },
            { id: "pages" as const, label: "페이지 라이브러리", icon: <Monitor size={15} />, count: PAGE_LIBRARY.length },
          ].map(tab => (
            <button key={tab.id} onClick={() => setMainTab(tab.id)} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "12px 24px", background: "none", border: "none",
              borderBottom: mainTab === tab.id ? "2px solid var(--brand-500)" : "2px solid transparent",
              marginBottom: -2, cursor: "pointer",
              color: mainTab === tab.id ? "var(--brand-500)" : "#6B7280",
              fontWeight: mainTab === tab.id ? 700 : 500,
              fontSize: 15, transition: "all 0.15s",
            }}>
              {tab.icon}
              {tab.label}
              <span style={{ fontSize: 11, fontWeight: 700, background: mainTab === tab.id ? "#EEF2FF" : "#F3F4F6", color: mainTab === tab.id ? "var(--brand-500)" : "#9CA3AF", padding: "1px 7px", borderRadius: 9999, transition: "all 0.15s" }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          탭 1: 디자인 패턴 라이브러리
      ══════════════════════════════════════════ */}
      {mainTab === "patterns" && (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px", display: "flex", gap: 32 }}>
          {/* 사이드 네비 */}
          <aside style={{ width: 220, flexShrink: 0 }}>
            <div style={{ position: "sticky", top: 72, background: "#fff", borderRadius: 12, border: "1px solid #F3F4F6", padding: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 8, padding: "0 4px" }}>
                Pattern Categories
              </p>
              {PATTERN_CATEGORIES.map(cat => (
                <div key={cat.id} className={`dl-nav-item${activeCategory === cat.id ? " active" : ""}`} onClick={() => setActiveCategory(cat.id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ opacity: 0.7 }}>{cat.icon}</span>
                    {cat.label}
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 16, padding: "12px 12px", background: "#F8F7FF", borderRadius: 8, border: "1px solid #EEF2FF" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-500)", marginBottom: 4 }}>총 패턴 수</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>{Object.values(PATTERNS).flat().length}<span style={{ fontSize: 13, color: "#9CA3AF", fontWeight: 400 }}>종</span></p>
              </div>
            </div>
          </aside>

          {/* 메인 콘텐츠 */}
          <main style={{ flex: 1, minWidth: 0 }}>
            {/* 카테고리 헤더 */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-500)" }}>
                  {currentCategory?.icon}
                </div>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>{currentCategory?.label}</h1>
                  <p style={{ fontSize: 13, color: "#6B7280" }}>{currentCategory?.desc}</p>
                </div>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "#9CA3AF", background: "#F3F4F6", padding: "3px 10px", borderRadius: 6 }}>
                  {currentPatterns.length}개 패턴
                </span>
              </div>
            </div>

            {/* 패턴 카드 그리드 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
              {currentPatterns.map(pattern => (
                <div key={pattern.name} className="pattern-card">
                  {/* 미리보기 영역 */}
                  <div style={{ height: 168, background: "#F8F7FF", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: "16px 20px" }}>
                    {pattern.preview}
                  </div>
                  {/* 정보 영역 */}
                  <div style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{pattern.name}</h3>
                      <code style={{ fontSize: 10, whiteSpace: "nowrap" as const, flexShrink: 0 }}>{pattern.token}</code>
                    </div>
                    <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5, marginBottom: 10 }}>{pattern.desc}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 10, borderTop: "1px solid #F3F4F6" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>사용처</span>
                      <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{pattern.when}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>
      )}

      {/* ══════════════════════════════════════════
          탭 2: 페이지 라이브러리
      ══════════════════════════════════════════ */}
      {mainTab === "pages" && (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
          {/* 섹션 헤더 */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 6 }}>페이지 라이브러리</h1>
            <p style={{ fontSize: 14, color: "#6B7280" }}>FlowPack의 모든 페이지 레이아웃 레퍼런스. 각 페이지에서 사용된 패턴과 컴포넌트를 확인하세요.</p>
          </div>

          {/* 페이지 카드 그리드 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 24 }}>
            {PAGE_LIBRARY.map(page => (
              <div key={page.id} className="page-card"
                onMouseEnter={() => setHoveredPage(page.id)}
                onMouseLeave={() => setHoveredPage(null)}>
                {/* 미니어처 */}
                <div style={{ height: 220, position: "relative", overflow: "hidden", background: "#F0F0F0", borderBottom: "1px solid #E5E7EB" }}>
                  <div style={{ position: "absolute", inset: 0, transform: hoveredPage === page.id ? "scale(1.03)" : "scale(1)", transition: "transform 0.3s ease" }}>
                    {page.miniature}
                  </div>
                  {/* 오버레이 */}
                  <div style={{
                    position: "absolute", inset: 0, background: "rgba(0,0,0,0)",
                    opacity: hoveredPage === page.id ? 1 : 0, transition: "opacity 0.2s",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Link href={page.href} target="_blank" style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
                      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
                      color: "#fff", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 600,
                    }}>
                      <ExternalLink size={13} /> 페이지 열기
                    </Link>
                  </div>
                </div>

                {/* 정보 영역 */}
                <div style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: page.color }} />
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{page.name}</h3>
                    <Link href={page.href} style={{ marginLeft: "auto", color: "var(--brand-500)", display: "flex", alignItems: "center", opacity: 0.6 }} target="_blank">
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                  <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5, marginBottom: 12 }}>{page.desc}</p>

                  {/* 사용 패턴 */}
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>사용 패턴</span>
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                      {page.patterns.map(p => (
                        <span key={p} style={{ fontSize: 11, fontWeight: 600, color: "var(--brand-500)", background: "#EEF2FF", padding: "2px 8px", borderRadius: 9999, border: "1px solid #C7D2FE" }}>
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 주요 컴포넌트 */}
                  <div style={{ paddingTop: 10, borderTop: "1px solid #F3F4F6" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>컴포넌트</span>
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                      {page.components.map(c => (
                        <code key={c} style={{ fontSize: 10 }}>{c}</code>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 하단 안내 */}
          <div style={{ marginTop: 48, background: "linear-gradient(135deg,#EEF2FF,#F5F3FF)", borderRadius: 16, padding: "28px 32px", border: "1px solid #C7D2FE", display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,var(--brand-500),var(--fp-cyan))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Sparkles size={22} color="#fff" />
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>새 페이지 추가 예정</p>
              <p style={{ fontSize: 13, color: "#6B7280" }}>케이스 스터디, 블로그, 온보딩 플로우 등 추가 페이지 라이브러리가 업데이트될 예정입니다.</p>
            </div>
            <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, background: "#fff", color: "var(--brand-500)", padding: "4px 12px", borderRadius: 9999, border: "1px solid #C7D2FE", whiteSpace: "nowrap" as const, flexShrink: 0 }}>
              Coming Soon
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
