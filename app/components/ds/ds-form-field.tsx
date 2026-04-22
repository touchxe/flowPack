/**
 * DsFormField — 라벨 + 인풋 + 도움말 래퍼
 * settings/profile의 FormField를 대체합니다.
 */
import type { ReactNode } from "react";
import { label as labelStyle, noteText } from "@/styles/tokens";

interface DsFormFieldProps {
  label: string;
  /** 라벨 아래 도움말 텍스트 */
  note?: string;
  children: ReactNode;
}

export function DsFormField({ label, note, children }: DsFormFieldProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>{label}</label>
      {children}
      {note && <p style={noteText}>{note}</p>}
    </div>
  );
}
