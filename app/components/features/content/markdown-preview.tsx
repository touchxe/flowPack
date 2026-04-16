"use client";

import React from "react";
import ReactMarkdown from "react-markdown";

interface MarkdownPreviewProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

export function MarkdownPreview({ content, className, style }: MarkdownPreviewProps) {
  if (!content.trim()) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9CA3AF", fontSize: 14, ...style }}>
        미리보기할 내용이 없습니다
      </div>
    );
  }

  return (
    <div className={className} style={{ padding: "24px 28px", ...style }}>
      <style>{`
        .md-preview { font-family: 'Pretendard Variable','Pretendard',-apple-system,sans-serif; color: #1F2937; line-height: 1.85; font-size: 15px; }
        .md-preview h1 { font-size: 28px; font-weight: 800; margin: 32px 0 16px; color: #111827; border-bottom: 2px solid #EEF2FF; padding-bottom: 10px; }
        .md-preview h2 { font-size: 22px; font-weight: 700; margin: 28px 0 12px; color: #111827; }
        .md-preview h3 { font-size: 18px; font-weight: 700; margin: 24px 0 10px; color: #374151; }
        .md-preview p { margin: 0 0 16px; }
        .md-preview ul, .md-preview ol { margin: 0 0 16px; padding-left: 24px; }
        .md-preview li { margin-bottom: 6px; }
        .md-preview strong { font-weight: 700; color: #111827; }
        .md-preview em { font-style: italic; }
        .md-preview blockquote { border-left: 4px solid #6366F1; background: #F8F7FF; padding: 14px 18px; margin: 16px 0; border-radius: 0 8px 8px 0; color: #4F46E5; font-weight: 500; }
        .md-preview code { background: #F3F4F6; padding: 2px 7px; border-radius: 5px; font-size: 13px; font-family: 'Fira Code','Menlo',monospace; color: #6366F1; }
        .md-preview pre { background: #1F2937; color: #E5E7EB; padding: 16px 20px; border-radius: 10px; overflow-x: auto; margin: 16px 0; }
        .md-preview pre code { background: none; padding: 0; color: inherit; font-size: 13px; }
        .md-preview hr { border: none; border-top: 2px solid #F3F4F6; margin: 28px 0; }
        .md-preview a { color: #6366F1; text-decoration: underline; text-underline-offset: 3px; }
        .md-preview img { max-width: 100%; border-radius: 12px; margin: 16px 0; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .md-preview table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        .md-preview th, .md-preview td { border: 1px solid #E5E7EB; padding: 10px 14px; text-align: left; font-size: 14px; }
        .md-preview th { background: #F9FAFB; font-weight: 700; }
      `}</style>
      <div className="md-preview">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
