"use client";

/**
 * StyleChanger — 우측 고정 슬라이드 패널
 * - 항상 화면 우측에 토글 탭이 표시됨
 * - 탭 클릭 → 패널 슬라이드 인/아웃
 * - CSS 변수 실시간 수정 + localStorage 저장
 */

import * as React from "react";
import { RotateCcw, ChevronDown, ChevronUp, Pipette, X, ChevronRight, ChevronLeft } from "lucide-react";

/* ─────────────────────────────────────────────
   토큰 정의
───────────────────────────────────────────── */

interface ColorToken {
  label: string;
  varName: string;
  defaultValue: string;
  description?: string;
}

interface GradientToken {
  label: string;
  varName: string;
  defaultFrom: string;
  defaultTo: string;
  defaultDir: string;
  description?: string;
}

interface TokenGroup {
  title: string;
  emoji: string;
  tokens: ColorToken[];
}

const GRAD_DIR_OPTIONS = [
  { label: "→ 오른쪽", value: "90deg" },
  { label: "↘ 대각선", value: "135deg" },
  { label: "↓ 아래",   value: "180deg" },
  { label: "↑ 위",     value: "0deg" },
  { label: "← 왼쪽",  value: "270deg" },
  { label: "↗ 오른쪽위", value: "45deg" },
  { label: "↙ 왼쪽아래", value: "225deg" },
  { label: "↖ 왼쪽위", value: "315deg" },
];

const TOKEN_GROUPS: TokenGroup[] = [
  {
    title: "Brand",
    emoji: "🟢",
    tokens: [
      { label: "Primary",          varName: "--brand-500",       defaultValue: "#3cffd0", description: "버튼·링크 주 색상" },
      { label: "Hover",            varName: "--brand-600",       defaultValue: "#30d9b2", description: "호버 상태" },
      { label: "Dark",             varName: "--brand-700",       defaultValue: "#309875", description: "Pressed / Console" },
      { label: "Brand Primary",    varName: "--brand-500",   defaultValue: "#3cffd0", description: "그라디언트 from 색상" },
      { label: "Brand Secondary",  varName: "--uv", defaultValue: "#5200ff", description: "그라디언트 to 색상" },
    ],
  },
  {
    title: "Accent (Secondary)",
    emoji: "🟣",
    tokens: [
      { label: "Ultraviolet",        varName: "--uv",             defaultValue: "#5200ff",             description: "보조 액센트 (brand-second)" },
      { label: "UV Muted",           varName: "--uv",       defaultValue: "rgba(82,0,255,0.9)",   description: "UV 반투명" },
      { label: "UV Border",          varName: "--uv",      defaultValue: "#3d00bf",              description: "Purple Rule" },
      { label: "Cyan (fp-cyan)",     varName: "--brand-500",        defaultValue: "#5200ff",              description: "보조 색상 alias" },
      { label: "Violet",             varName: "--uv",      defaultValue: "#5200ff",              description: "배지·그라디언트 끝" },
      { label: "Indigo",             varName: "--uv",      defaultValue: "#3d00bf",              description: "다크 퍼플" },
      { label: "Deep Link Blue",     varName: "--link-hover",     defaultValue: "#3860be",              description: "링크 호버·info" },
    ],
  },
  {
    title: "Canvas",
    emoji: "⬛",
    tokens: [
      { label: "Page BG",    varName: "--fp-page-bg",    defaultValue: "#131313" },
      { label: "Section BG", varName: "--fp-section-bg", defaultValue: "#1a1a1a" },
      { label: "Card BG",    varName: "--fp-card-bg",    defaultValue: "#131313" },
    ],
  },
  {
    title: "Typography",
    emoji: "✏️",
    tokens: [
      { label: "Heading", varName: "--fp-heading",   defaultValue: "#ffffff" },
      { label: "Body",    varName: "--fp-body",      defaultValue: "#e9e9e9" },
      { label: "Muted",   varName: "--fp-muted",     defaultValue: "#949494" },
    ],
  },
  {
    title: "Status",
    emoji: "🔔",
    tokens: [
      { label: "Success",  varName: "--fp-success",  defaultValue: "#3cffd0" },
      { label: "Warning",  varName: "--fp-warning",  defaultValue: "#fbbf24" },
      { label: "Error",    varName: "--fp-error",    defaultValue: "#5200ff" },
      { label: "Info",     varName: "--fp-info",     defaultValue: "#3860be" },
      { label: "Inactive", varName: "--fp-inactive", defaultValue: "#949494" },
    ],
  },
  {
    title: "Tiles",
    emoji: "🎨",
    tokens: [
      { label: "Mint",   varName: "--tile-mint",   defaultValue: "#3cffd0" },
      { label: "Purple", varName: "--tile-purple", defaultValue: "#5200ff" },
      { label: "Yellow", varName: "--tile-yellow", defaultValue: "#fbbf24" },
      { label: "Pink",   varName: "--tile-pink",   defaultValue: "#ff6b9d" },
      { label: "Orange", varName: "--tile-orange", defaultValue: "#ff9f43" },
      { label: "Blue",   varName: "--tile-blue",   defaultValue: "#3860be" },
    ],
  },
];

const GRADIENT_TOKENS: GradientToken[] = [
  { label: "Primary CTA",     varName: "--brand-gradient",  defaultFrom: "#3cffd0", defaultTo: "#5200ff", defaultDir: "135deg" },
  { label: "Brand Gradient",  varName: "--brand-gradient",       defaultFrom: "#3cffd0", defaultTo: "#5200ff", defaultDir: "135deg" },
  { label: "Brand Dark",      varName: "--brand-gradient",  defaultFrom: "#309875", defaultTo: "#3d00bf", defaultDir: "135deg" },
  { label: "Persona BG",      varName: "--fp-gradient-persona",  defaultFrom: "rgba(60,255,208,0.08)", defaultTo: "rgba(82,0,255,0.08)", defaultDir: "135deg" },
  { label: "Stat BG",         varName: "--fp-gradient-stat-bg",  defaultFrom: "#131313", defaultTo: "#1a1a1a", defaultDir: "135deg" },
];

const LS_KEY = "fp_style_tokens";

/* ─── utils ─── */
function parseSaved(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}"); } catch { return {}; }
}
function saveFn(tokens: Record<string, string>) {
  localStorage.setItem(LS_KEY, JSON.stringify(tokens));
}
function applyToken(v: string, val: string) {
  document.documentElement.style.setProperty(v, val);
}
function toHex(val: string): string {
  if (!val) return "#000000";
  if (val.startsWith("#")) return val.slice(0, 7);
  const m = val.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) return "#" + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, "0")).join("");
  return "#000000";
}
function parseGrad(css: string): { from: string; to: string; dir: string } {
  const m = css.match(/linear-gradient\(([^,]+),\s*(.+),\s*(.+)\)$/);
  if (m) return { dir: m[1].trim(), from: m[2].trim(), to: m[3].trim() };
  return { dir: "135deg", from: "#3cffd0", to: "#5200ff" };
}
function buildGrad(dir: string, from: string, to: string) {
  return `linear-gradient(${dir}, ${from}, ${to})`;
}

/* ─── ColorRow ─── */
function ColorRow({ token, saved, onChange, onReset }: {
  token: ColorToken;
  saved: Record<string, string>;
  onChange: (v: string, val: string) => void;
  onReset: (v: string) => void;
}) {
  const cur = saved[token.varName] ?? token.defaultValue;
  const isRgba = cur.startsWith("rgba");
  const hex = toHex(cur);
  const modified = !!saved[token.varName];

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "7px 0",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
    }}>
      {/* Swatch + picker */}
      <label style={{ position: "relative", cursor: "pointer", flexShrink: 0 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6,
          background: cur,
          border: modified ? "2px solid #3cffd0" : "1px solid rgba(255,255,255,0.15)",
          boxSizing: "border-box",
        }} />
        <input type="color" value={hex}
          onChange={e => onChange(token.varName, e.target.value)}
          style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
        />
      </label>

      {/* Label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: modified ? "#3cffd0" : "#e9e9e9", whiteSpace: "nowrap" }}>
            {token.label}
          </span>
          {modified && <span style={{ fontSize: 8, color: "#3cffd0", fontWeight: 700 }}>●</span>}
        </div>
        {token.description && (
          <div style={{ fontSize: 9, color: "#666", marginTop: 1 }}>{token.description}</div>
        )}
        <input
          value={isRgba ? cur : hex}
          onChange={e => onChange(token.varName, e.target.value)}
          maxLength={isRgba ? 100 : 7}
          style={{
            width: "100%", marginTop: 3, height: 18,
            padding: "0 5px", fontSize: 9,
            background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 3, color: "#949494", outline: "none",
            fontFamily: "monospace", boxSizing: "border-box",
          }}
        />
      </div>

      {/* Reset btn */}
      {modified && (
        <button onClick={() => onReset(token.varName)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#5200ff", padding: 2, borderRadius: 4, display: "flex", flexShrink: 0 }}>
          <RotateCcw size={11} />
        </button>
      )}
    </div>
  );
}

/* ─── GradientRow ─── */
function GradientRow({ token, saved, onChange, onReset }: {
  token: GradientToken;
  saved: Record<string, string>;
  onChange: (v: string, val: string) => void;
  onReset: (v: string) => void;
}) {
  const cur = saved[token.varName] ?? buildGrad(token.defaultDir, token.defaultFrom, token.defaultTo);
  const parsed = parseGrad(cur);
  const modified = !!saved[token.varName];

  const update = (partial: Partial<typeof parsed>) => {
    const next = { ...parsed, ...partial };
    onChange(token.varName, buildGrad(next.dir, next.from, next.to));
  };

  return (
    <div style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      {/* Preview */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ width: 36, height: 18, borderRadius: 4, background: cur, border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: modified ? "#3cffd0" : "#e9e9e9" }}>
          {token.label} {modified && <span style={{ fontSize: 8 }}>●</span>}
        </span>
        {modified && (
          <button onClick={() => onReset(token.varName)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#5200ff", padding: 2, borderRadius: 4, display: "flex" }}>
            <RotateCcw size={11} />
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 5 }}>
        {/* From */}
        <div>
          <div style={{ fontSize: 9, color: "#666", marginBottom: 2 }}>From</div>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <label style={{ position: "relative", width: 18, height: 18, borderRadius: 3, background: parsed.from, border: "1px solid rgba(255,255,255,0.15)", flexShrink: 0, cursor: "pointer" }}>
              <input type="color" value={toHex(parsed.from)} onChange={e => update({ from: e.target.value })}
                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
            </label>
            <input value={parsed.from} onChange={e => update({ from: e.target.value })}
              style={{ flex: 1, height: 18, padding: "0 4px", fontSize: 8, background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3, color: "#949494", outline: "none", fontFamily: "monospace" }} />
          </div>
        </div>

        {/* To */}
        <div>
          <div style={{ fontSize: 9, color: "#666", marginBottom: 2 }}>To</div>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <label style={{ position: "relative", width: 18, height: 18, borderRadius: 3, background: parsed.to, border: "1px solid rgba(255,255,255,0.15)", flexShrink: 0, cursor: "pointer" }}>
              <input type="color" value={toHex(parsed.to)} onChange={e => update({ to: e.target.value })}
                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
            </label>
            <input value={parsed.to} onChange={e => update({ to: e.target.value })}
              style={{ flex: 1, height: 18, padding: "0 4px", fontSize: 8, background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3, color: "#949494", outline: "none", fontFamily: "monospace" }} />
          </div>
        </div>
      </div>

      {/* Direction */}
      <select value={parsed.dir} onChange={e => update({ dir: e.target.value })}
        style={{ width: "100%", height: 22, background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, color: "#949494", fontSize: 9, padding: "0 4px", outline: "none", cursor: "pointer" }}>
        {GRAD_DIR_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label} ({o.value})</option>
        ))}
      </select>
    </div>
  );
}

/* ─── Group Header ─── */
function GroupHeader({ title, emoji, isOpen, onToggle, count }: {
  title: string; emoji: string; isOpen: boolean;
  onToggle: () => void; count?: number;
}) {
  return (
    <button onClick={onToggle} style={{
      width: "100%", background: "none", border: "none", cursor: "pointer",
      display: "flex", alignItems: "center", gap: 6,
      padding: "8px 0 5px", fontFamily: "inherit",
    }}>
      <span style={{ fontSize: 11 }}>{emoji}</span>
      <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: "#3cffd0", textTransform: "uppercase", letterSpacing: "1.2px", textAlign: "left", fontFamily: "monospace" }}>
        {title}
      </span>
      {count ? <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 9999, background: "rgba(60,255,208,0.15)", color: "#3cffd0" }}>{count}</span> : null}
      {isOpen ? <ChevronUp size={11} color="#666" /> : <ChevronDown size={11} color="#666" />}
    </button>
  );
}

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
export function StyleChanger() {
  const [open, setOpen] = React.useState(false);
  const [saved, setSaved] = React.useState<Record<string, string>>({});
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({
    "Brand": true,
    "Accent (Secondary)": false,
    "Canvas": false,
    "Typography": false,
    "Status": false,
    "Tiles": false,
    "Gradients": false,
  });

  /* 초기 로드 */
  React.useEffect(() => {
    const loaded = parseSaved();
    setSaved(loaded);
    Object.entries(loaded).forEach(([k, v]) => applyToken(k, v));
  }, []);

  /* Esc 닫기 */
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleChange = (varName: string, value: string) => {
    applyToken(varName, value);
    setSaved(prev => {
      const next = { ...prev, [varName]: value };
      saveFn(next);
      return next;
    });
  };

  const handleReset = (varName: string) => {
    document.documentElement.style.removeProperty(varName);
    setSaved(prev => {
      const next = { ...prev };
      delete next[varName];
      saveFn(next);
      return next;
    });
  };

  const handleResetAll = () => {
    Object.keys(saved).forEach(k => document.documentElement.style.removeProperty(k));
    setSaved({});
    localStorage.removeItem(LS_KEY);
  };

  const toggleGroup = (title: string) =>
    setOpenGroups(prev => ({ ...prev, [title]: !prev[title] }));

  const changedCount = Object.keys(saved).length;

  /* 그룹별 변경 수 */
  const groupChangedCount = (tokens: ColorToken[]) =>
    tokens.filter(t => saved[t.varName]).length;
  const gradChangedCount = GRADIENT_TOKENS.filter(t => saved[t.varName]).length;

  const PANEL_WIDTH = 272;

  return (
    <>
      {/* ── 토글 탭 (항상 표시) ── */}
      <button
        onClick={() => setOpen(v => !v)}
        title={open ? "스타일 체인저 닫기" : "스타일 체인저 열기"}
        style={{
          position: "fixed",
          top: "50%",
          right: open ? PANEL_WIDTH : 0,
          transform: "translateY(-50%)",
          zIndex: 99998,
          /* 탭 모양 — 왼쪽으로 튀어나온 형태 */
          background: "#131313",
          border: "1px solid rgba(60,255,208,0.30)",
          borderRight: "none",
          borderRadius: "12px 0 0 12px",
          padding: "14px 6px",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          transition: "right 0.28s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: "-4px 0 20px rgba(0,0,0,0.4)",
        }}
      >
        <Pipette size={13} color="#3cffd0" />
        {/* 세로 텍스트 */}
        <span style={{
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          fontSize: 9,
          fontWeight: 700,
          color: "#3cffd0",
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          fontFamily: "monospace",
          lineHeight: 1,
        }}>
          Style
        </span>
        {changedCount > 0 && (
          <span style={{
            width: 16, height: 16, borderRadius: "50%",
            background: "#3cffd0", color: "#000",
            fontSize: 9, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {changedCount}
          </span>
        )}
        {open ? <ChevronRight size={11} color="#949494" /> : <ChevronLeft size={11} color="#949494" />}
      </button>

      {/* ── 슬라이드 패널 ── */}
      <div style={{
        position: "fixed",
        top: 0,
        right: open ? 0 : -PANEL_WIDTH,
        width: PANEL_WIDTH,
        height: "100vh",
        zIndex: 99997,
        display: "flex",
        flexDirection: "column",
        background: "#131313",
        borderLeft: "1px solid rgba(60,255,208,0.20)",
        boxShadow: open ? "-8px 0 32px rgba(0,0,0,0.6)" : "none",
        transition: "right 0.28s cubic-bezier(0.4,0,0.2,1)",
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
        overflow: "hidden",
      }}>
        {/* 패널 헤더 */}
        <div style={{
          padding: "14px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", gap: 8,
          flexShrink: 0,
          background: "rgba(60,255,208,0.04)",
        }}>
          <Pipette size={14} color="#3cffd0" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Style Changer</div>
            <div style={{ fontSize: 9, color: "#666", marginTop: 1 }}>
              {changedCount > 0 ? `${changedCount}개 토큰 변경됨` : "CSS 변수 실시간 편집"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {changedCount > 0 && (
              <button onClick={handleResetAll}
                style={{
                  padding: "3px 8px", borderRadius: 8, cursor: "pointer",
                  border: "1px solid rgba(82,0,255,0.4)",
                  background: "rgba(82,0,255,0.10)",
                  color: "#a78bfa", fontSize: 9, fontWeight: 700,
                  display: "flex", alignItems: "center", gap: 3,
                }}>
                <RotateCcw size={9} /> 전체 리셋
              </button>
            )}
            <button onClick={() => setOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#666", padding: 4, borderRadius: 6, display: "flex" }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* 스크롤 영역 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 14px 16px" }}>
          {/* 단색 그룹들 */}
          {TOKEN_GROUPS.map(group => {
            const cnt = groupChangedCount(group.tokens);
            return (
              <div key={group.title}>
                <GroupHeader
                  title={group.title}
                  emoji={group.emoji}
                  isOpen={openGroups[group.title] ?? false}
                  onToggle={() => toggleGroup(group.title)}
                  count={cnt || undefined}
                />
                {(openGroups[group.title] ?? false) && group.tokens.map(token => (
                  <ColorRow key={token.varName} token={token} saved={saved} onChange={handleChange} onReset={handleReset} />
                ))}
              </div>
            );
          })}

          {/* 그라디언트 그룹 */}
          <div>
            <GroupHeader
              title="Gradients"
              emoji="🌈"
              isOpen={openGroups["Gradients"] ?? false}
              onToggle={() => toggleGroup("Gradients")}
              count={gradChangedCount || undefined}
            />
            {(openGroups["Gradients"] ?? false) && GRADIENT_TOKENS.map(token => (
              <GradientRow key={token.varName} token={token} saved={saved} onChange={handleChange} onReset={handleReset} />
            ))}
          </div>
        </div>

        {/* 푸터 */}
        <div style={{
          padding: "8px 14px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
          background: "rgba(0,0,0,0.2)",
        }}>
          <span style={{ fontSize: 8, color: "#444", fontFamily: "monospace" }}>
            :root CSS Variables · localStorage
          </span>
          <span style={{ fontSize: 9, color: "#666" }}>Esc 닫기</span>
        </div>
      </div>
    </>
  );
}
