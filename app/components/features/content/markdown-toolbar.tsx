"use client";

import React from "react";
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, ImagePlus, Link as LinkIcon, Quote, Code, Minus } from "lucide-react";

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onInsertImage?: () => void; // 이미지 삽입 콜백
  onChange?: (value: string) => void;
}

type FormatAction = {
  icon: React.ReactNode;
  label: string;
  prefix: string;
  suffix?: string;
  block?: boolean; // 줄 단위 삽입
};

const ACTIONS: FormatAction[] = [
  { icon: <Bold size={14} />,        label: "볼드",   prefix: "**", suffix: "**" },
  { icon: <Italic size={14} />,      label: "이탤릭", prefix: "_",  suffix: "_" },
  { icon: <Heading2 size={14} />,    label: "H2",     prefix: "## ", block: true },
  { icon: <Heading3 size={14} />,    label: "H3",     prefix: "### ", block: true },
  { icon: <List size={14} />,        label: "목록",   prefix: "- ",  block: true },
  { icon: <ListOrdered size={14} />, label: "번호 목록", prefix: "1. ", block: true },
  { icon: <Quote size={14} />,       label: "인용",   prefix: "> ",  block: true },
  { icon: <Code size={14} />,        label: "코드",   prefix: "`",   suffix: "`" },
  { icon: <Minus size={14} />,       label: "구분선", prefix: "\n---\n", block: true },
];

export function MarkdownToolbar({ textareaRef, onInsertImage, onChange }: MarkdownToolbarProps) {
  const applyFormat = (action: FormatAction) => {
    const ta = textareaRef.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value;
    const selected = text.slice(start, end);

    let newText: string;
    let newCursorPos: number;

    if (action.block) {
      // 줄 단위: 줄 앞에 prefix 추가
      const lineStart = text.lastIndexOf("\n", start - 1) + 1;
      if (selected) {
        const lines = selected.split("\n").map(line => action.prefix + line);
        newText = text.slice(0, start) + lines.join("\n") + text.slice(end);
        newCursorPos = start + lines.join("\n").length;
      } else {
        newText = text.slice(0, lineStart) + action.prefix + text.slice(lineStart);
        newCursorPos = start + action.prefix.length;
      }
    } else {
      // 인라인: 선택 텍스트를 감싸기
      const suffix = action.suffix ?? "";
      if (selected) {
        newText = text.slice(0, start) + action.prefix + selected + suffix + text.slice(end);
        newCursorPos = start + action.prefix.length + selected.length + suffix.length;
      } else {
        newText = text.slice(0, start) + action.prefix + "텍스트" + suffix + text.slice(end);
        newCursorPos = start + action.prefix.length;
      }
    }

    ta.value = newText;
    onChange?.(newText);
    ta.focus();
    ta.setSelectionRange(newCursorPos, newCursorPos);
  };

  const insertLink = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value;
    const selected = text.slice(start, end) || "링크 텍스트";
    const insert = `[${selected}](url)`;
    const newText = text.slice(0, start) + insert + text.slice(end);
    ta.value = newText;
    onChange?.(newText);
    ta.focus();
    // url 부분을 선택
    const urlStart = start + selected.length + 3;
    ta.setSelectionRange(urlStart, urlStart + 3);
  };

  const btnStyle: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 7,
    border: "none", background: "none", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#6B7280", transition: "all 0.12s",
    padding: 0,
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 2,
      padding: "6px 10px", borderBottom: "1px solid #F3F4F6",
      background: "#FAFBFC", borderRadius: "12px 12px 0 0",
      flexWrap: "wrap",
    }}>
      {ACTIONS.map((action, i) => (
        <React.Fragment key={action.label}>
          {(i === 2 || i === 4 || i === 7) && (
            <div style={{ width: 1, height: 18, background: "#E5E7EB", margin: "0 4px" }} />
          )}
          <button
            type="button"
            title={action.label}
            style={btnStyle}
            onClick={() => applyFormat(action)}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#EEF2FF"; (e.currentTarget as HTMLElement).style.color = "var(--brand-500)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = "#6B7280"; }}
          >
            {action.icon}
          </button>
        </React.Fragment>
      ))}

      <div style={{ width: 1, height: 18, background: "#E5E7EB", margin: "0 4px" }} />

      {/* 링크 */}
      <button type="button" title="링크 삽입" style={btnStyle} onClick={insertLink}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#EEF2FF"; (e.currentTarget as HTMLElement).style.color = "var(--brand-500)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = "#6B7280"; }}>
        <LinkIcon size={14} />
      </button>

      {/* 이미지 삽입 */}
      {onInsertImage && (
        <button type="button" title="이미지 삽입" style={{ ...btnStyle, color: "var(--fp-cyan)" }} onClick={onInsertImage}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F5F3FF"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}>
          <ImagePlus size={14} />
        </button>
      )}
    </div>
  );
}
