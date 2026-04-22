/**
 * DsToggleRow — 라벨 + 설명 + Switch 토글 행
 * settings/notifications의 ToggleRow를 대체합니다.
 */
import { Switch } from "@/components/ui/switch";

interface DsToggleRowProps {
  label: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
}

export function DsToggleRow({ label, desc, checked, onChange }: DsToggleRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 0",
        borderBottom: "1px solid var(--fp-border-soft)",
      }}
    >
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--fp-heading)", margin: 0, marginBottom: 2 }}>
          {label}
        </p>
        <p style={{ fontSize: 11, color: "var(--fp-muted)", margin: 0 }}>{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
