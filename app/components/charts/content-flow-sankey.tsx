"use client";

import { Sankey, Tooltip, ResponsiveContainer } from "recharts";
import type { SankeyData } from "recharts";

/* ─── 타입 ──────────────────────────────────────────────── */
export interface FlowNode { name: string }
export interface FlowLink { source: number; target: number; value: number }
export interface ContentFlowData { nodes: FlowNode[]; links: FlowLink[] }

/* ─── 노드 컬러 맵 ──────────────────────────────────────── */
const NODE_COLORS: Record<string, string> = {
  // 콘텐츠 타입
  "카드뉴스":    "var(--brand-500)",
  "블로그":      "#059669",
  "URL변환":     "var(--brand-500)",
  "영상":        "#DC2626",
  "대량":        "#D97706",
  // SNS 채널
  "Instagram":   "#E1306C",
  "Facebook":    "#1877F2",
  "X (Twitter)": "#111827",
  "LinkedIn":    "#0077B5",
  "네이버블로그": "#03C75A",
  "WordPress":   "#21759B",
  // 성과 지표
  "총 조회수":   "#D97706",
  "유입 추정":   "#059669",
};

function getNodeColor(name: string): string {
  for (const [key, color] of Object.entries(NODE_COLORS)) {
    if (name.includes(key)) return color;
  }
  return "var(--brand-500)";
}

/* ─── 커스텀 노드 ───────────────────────────────────────── */
function CustomNode(props: any) {
  const { x, y, width, height, payload } = props;
  const color = getNodeColor(payload.name);
  const displayName = payload.name;

  return (
    <g>
      {/* 노드 바 */}
      <rect x={x} y={y} width={width} height={height} fill={color} rx={4} ry={4} opacity={0.9} />
      {/* 라벨 (노드 크기가 충분하면 표시) */}
      <text
        x={x + width + 8}
        y={y + height / 2}
        dy={4}
        fill="#374151"
        fontSize={11}
        fontWeight={600}
        textAnchor="start"
      >
        {displayName}
      </text>
    </g>
  );
}

/* ─── 커스텀 링크 ───────────────────────────────────────── */
function CustomLink(props: any) {
  const { sourceX, sourceY, sourceControlX, targetX, targetY, targetControlX, linkWidth, payload } = props;
  const sourceColor = getNodeColor(payload.source?.name ?? "");
  const targetColor = getNodeColor(payload.target?.name ?? "");
  const gradientId = `grad-${payload.source?.name}-${payload.target?.name}`.replace(/\s/g, "_");

  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={sourceColor} stopOpacity={0.3} />
          <stop offset="100%" stopColor={targetColor} stopOpacity={0.3} />
        </linearGradient>
      </defs>
      <path
        d={`
          M${sourceX},${sourceY}
          C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
        `}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={linkWidth}
        strokeOpacity={0.5}
      />
    </g>
  );
}

/* ─── 툴팁 ─────────────────────────────────────────────── */
function SankeyTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload?.payload;
  if (!data) return null;

  if (data.source && data.target) {
    // 링크 툴팁
    return (
      <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 12 }}>
        <p style={{ fontWeight: 700, color: "#111827", marginBottom: 4 }}>
          {data.source.name} → {data.target.name}
        </p>
        <p style={{ color: "var(--brand-500)", fontWeight: 600 }}>값: {data.value?.toLocaleString()}</p>
      </div>
    );
  }

  // 노드 툴팁
  return (
    <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 12 }}>
      <p style={{ fontWeight: 700, color: "#111827" }}>{data.name}</p>
      {data.value != null && <p style={{ color: "var(--brand-500)", fontWeight: 600 }}>합계: {data.value?.toLocaleString()}</p>}
    </div>
  );
}

/* ─── 더미 데이터 ───────────────────────────────────────── */
const DUMMY_DATA: ContentFlowData = {
  nodes: [
    { name: "카드뉴스 (7)" },
    { name: "블로그 (3)" },
    { name: "URL변환 (2)" },
    { name: "Instagram (340)" },
    { name: "네이버블로그 (620)" },
    { name: "Facebook (880)" },
    { name: "총 조회수 (1,840)" },
    { name: "유입 추정 (184)" },
  ],
  links: [
    { source: 0, target: 3, value: 5 },
    { source: 0, target: 4, value: 2 },
    { source: 1, target: 4, value: 3 },
    { source: 1, target: 5, value: 1 },
    { source: 2, target: 5, value: 2 },
    { source: 3, target: 6, value: 340 },
    { source: 4, target: 6, value: 620 },
    { source: 5, target: 6, value: 880 },
    { source: 6, target: 7, value: 184 },
  ],
};

/* ─── 메인 컴포넌트 ─────────────────────────────────────── */
interface ContentFlowSankeyProps {
  data: ContentFlowData;
  /** true면 데이터 없을 때 더미 데이터로 표시 (기본 true) */
  showDummyIfEmpty?: boolean;
}

export default function ContentFlowSankey({ data, showDummyIfEmpty = true }: ContentFlowSankeyProps) {
  const isEmpty = !data?.nodes?.length || !data?.links?.length;
  const displayData = isEmpty && showDummyIfEmpty ? DUMMY_DATA : data;
  const isDummy = isEmpty && showDummyIfEmpty;

  // 더미도 아니고 실 데이터도 없으면 빈 상태
  if (!displayData?.nodes?.length || !displayData?.links?.length) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, color: "#9CA3AF" }}>
        <p style={{ fontSize: 14, fontWeight: 600 }}>아직 발행된 콘텐츠가 없습니다</p>
        <p style={{ fontSize: 12, marginTop: 4 }}>콘텐츠를 발행하면 퍼포먼스 플로우가 여기에 표시됩니다</p>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {/* 더미 데이터 배지 */}
      {isDummy && (
        <div style={{
          position: "absolute", top: 8, right: 0, zIndex: 10,
          display: "inline-flex", alignItems: "center", gap: 4,
          background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8,
          padding: "3px 10px", fontSize: 11, fontWeight: 700, color: "#D97706",
        }}>
          📊 샘플 데이터 — 콘텐츠를 발행하면 실제 데이터로 업데이트됩니다
        </div>
      )}
      <ResponsiveContainer width="100%" height={320}>
        <Sankey
          data={displayData as SankeyData}
          nodeWidth={14}
          nodePadding={24}
          margin={{ top: 20, right: 160, bottom: 20, left: 20 }}
          link={<CustomLink />}
          node={<CustomNode />}
        >
          <Tooltip content={<SankeyTooltip />} />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}
