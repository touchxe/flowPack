/**
 * TiptapEditor — WYSIWYG 블로그 에디터
 * Tiptap 기반, FlowPack 디자인 시스템과 일관된 툴바 포함
 */
"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { useEffect, useState, useCallback } from "react";
import {
  Bold, Italic, UnderlineIcon, Strikethrough,
  Heading2, Heading3, Heading4,
  List, ListOrdered, Quote, Code, Code2,
  Minus, Link as LinkIcon, ImagePlus,
  AlignLeft, AlignCenter, AlignRight,
  Undo, Redo,
} from "lucide-react";

/* ── Markdown → HTML 자동 감지 변환 ─────────────────────────── */
async function normalizeToHtml(body: string): Promise<string> {
  if (!body) return "";
  const trimmed = body.trim();
  // Markdown 특징: # 헤더, ** 볼드, - 리스트, > 인용
  const isMarkdown = /^#{1,6}\s|^\*\*|\*[^*]|\*$|^- |^[0-9]+\. |^> /.test(trimmed);
  if (isMarkdown) {
    const { marked } = await import("marked");
    return await marked.parse(body);
  }
  // HTML 태그가 있으면 그대로
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return body;
  // 순수 텍스트면 p 태그로 감싸기
  return `<p>${body.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>`;
}

/* ── Props ───────────────────────────────────────────────────── */
interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  onInsertImage?: () => void;
  placeholder?: string;
  minHeight?: number;
  editorRef?: React.MutableRefObject<ReturnType<typeof useEditor> | null>;
}

/* ── 툴바 버튼 스타일 ─────────────────────────────────────────── */
function ToolBtn({
  onClick, active, title, children, disabled,
}: {
  onClick: () => void; active?: boolean; title: string;
  children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 30, height: 30, borderRadius: 6,
        border: "none", cursor: disabled ? "not-allowed" : "pointer",
        background: active ? "#EEF2FF" : "transparent",
        color: active ? "var(--brand-500)" : "#6B7280",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 0, transition: "all 0.12s", opacity: disabled ? 0.4 : 1,
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        if (!disabled && !active) {
          (e.currentTarget as HTMLButtonElement).style.background = "#F3F4F6";
          (e.currentTarget as HTMLButtonElement).style.color = "#374151";
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          (e.currentTarget as HTMLButtonElement).style.color = "#6B7280";
        }
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 18, background: "#E5E7EB", margin: "0 2px", flexShrink: 0 }} />;
}

/* ── 링크 팝업 ───────────────────────────────────────────────── */
function LinkPopup({ onConfirm, onCancel }: { onConfirm: (url: string) => void; onCancel: () => void }) {
  const [url, setUrl] = useState("https://");
  return (
    <div style={{
      position: "absolute", top: 44, left: 0, zIndex: 50,
      background: "#fff", border: "1.5px solid #C7D2FE",
      borderRadius: 10, padding: 12, boxShadow: "0 8px 24px rgba(99,102,241,0.15)",
      display: "flex", gap: 8, alignItems: "center", minWidth: 320,
    }}>
      <input
        autoFocus
        value={url}
        onChange={e => setUrl(e.target.value)}
        onKeyDown={e => e.key === "Enter" && onConfirm(url)}
        style={{
          flex: 1, height: 32, padding: "0 10px",
          border: "1.5px solid #E5E7EB", borderRadius: 7,
          fontSize: 13, outline: "none",
        }}
        placeholder="https://example.com"
      />
      <button type="button" onClick={() => onConfirm(url)}
        style={{ height: 32, padding: "0 12px", borderRadius: 7, background: "linear-gradient(135deg,var(--brand-500),var(--brand-500))", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
        확인
      </button>
      <button type="button" onClick={onCancel}
        style={{ height: 32, padding: "0 10px", borderRadius: 7, background: "#F3F4F6", border: "none", color: "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
        취소
      </button>
    </div>
  );
}

/* ── 메인 컴포넌트 ───────────────────────────────────────────── */
export function TiptapEditor({
  content, onChange, onInsertImage, placeholder, minHeight = 520, editorRef,
}: TiptapEditorProps) {
  const [isReady, setIsReady] = useState(false);
  const [showLinkPopup, setShowLinkPopup] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        codeBlock: { HTMLAttributes: { class: "tiptap-code-block" } },
      }),
      Underline,
      TextStyle,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ inline: false, allowBase64: false, HTMLAttributes: { class: "tiptap-img" } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "tiptap-link" } }),
      Placeholder.configure({ placeholder: placeholder || "블로그 본문을 작성하세요..." }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "tiptap-prosemirror",
        style: `min-height:${minHeight}px; outline:none; padding:24px 28px; font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; font-size:15px; line-height:1.85; color:#1F2937;`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // editorRef 연결
  useEffect(() => {
    if (editorRef) editorRef.current = editor;
  }, [editor, editorRef]);

  // 초기 콘텐츠 로드 (Markdown 자동 변환)
  useEffect(() => {
    if (!editor || isReady) return;
    normalizeToHtml(content).then(html => {
      editor.commands.setContent(html, { emitUpdate: false });
      setIsReady(true);
    });
  }, [editor, content, isReady]);

  // 외부에서 content 변경 시 (contentId 변경 등)
  useEffect(() => {
    if (!editor || !isReady) return;
    setIsReady(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.slice(0, 20)]); // content 앞부분이 바뀌면 재로드

  const handleLinkConfirm = useCallback((url: string) => {
    if (!editor) return;
    if (url && url !== "https://") {
      editor.chain().focus().setLink({ href: url }).run();
    }
    setShowLinkPopup(false);
  }, [editor]);

  if (!editor) return (
    <div style={{ minHeight, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 14 }}>
      에디터 로딩 중...
    </div>
  );

  const isActive = (name: string, attrs?: Record<string, unknown>) =>
    editor.isActive(name, attrs);

  return (
    <div className="tiptap-editor-wrap" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <style>{`
        /* ── 툴바 (sticky 고정) ── */
        .tiptap-toolbar { position:sticky; top:0; z-index:10; display:flex; align-items:center; gap:2px; padding:6px 10px; background:#FAFBFC; border-bottom:1px solid #F3F4F6; flex-wrap:wrap; }
        /* ── 에디터 영역 ── */
        .tiptap-prosemirror { cursor:text; }
        .tiptap-prosemirror p.is-editor-empty:first-child::before { content:attr(data-placeholder); color:#9CA3AF; pointer-events:none; float:left; height:0; }
        /* ── 인라인 서식 ── */
        .tiptap-prosemirror strong { font-weight:700; color:#111827; }
        .tiptap-prosemirror em { font-style:italic; }
        .tiptap-prosemirror u { text-decoration:underline; }
        .tiptap-prosemirror s { text-decoration:line-through; }
        /* ── 헤딩 ── */
        .tiptap-prosemirror h1 { font-size:28px; font-weight:800; margin:32px 0 16px; color:#111827; border-bottom:2px solid #EEF2FF; padding-bottom:10px; }
        .tiptap-prosemirror h2 { font-size:22px; font-weight:700; margin:28px 0 12px; color:#111827; }
        .tiptap-prosemirror h3 { font-size:18px; font-weight:700; margin:24px 0 10px; color:#374151; }
        .tiptap-prosemirror h4 { font-size:15px; font-weight:700; margin:20px 0 8px; color:#374151; }
        /* ── 리스트 ── */
        .tiptap-prosemirror ul,.tiptap-prosemirror ol { margin:0 0 16px; padding-left:24px; }
        .tiptap-prosemirror li { margin-bottom:6px; }
        /* ── 인용/코드 ── */
        .tiptap-prosemirror blockquote { border-left:4px solid var(--brand-500); background:#F8F7FF; padding:14px 18px; margin:16px 0; border-radius:0 8px 8px 0; color:var(--brand-600); font-weight:500; }
        .tiptap-prosemirror code { background:#F3F4F6; padding:2px 7px; border-radius:5px; font-size:13px; font-family:'Fira Code','Menlo',monospace; color:var(--brand-500); }
        .tiptap-code-block { background:#1F2937!important; color:#E5E7EB!important; padding:16px 20px!important; border-radius:10px!important; overflow-x:auto!important; margin:16px 0!important; }
        .tiptap-code-block code { background:none!important; color:inherit!important; padding:0!important; font-size:13px!important; }
        /* ── 링크/이미지/구분선 ── */
        .tiptap-link { color:var(--brand-500); text-decoration:underline; text-underline-offset:3px; cursor:pointer; }
        .tiptap-img { max-width:100%; border-radius:12px; margin:16px 0; display:block; box-shadow:0 2px 12px rgba(0,0,0,0.08); }
        .tiptap-prosemirror hr { border:none; border-top:2px solid #F3F4F6; margin:28px 0; }
        /* ── 선택 ── */
        .tiptap-prosemirror ::selection { background:#C7D2FE; }
        /* ── 뷰어 (동일 스타일) ── */
        .tiptap-view { font-family:'Pretendard Variable','Pretendard',-apple-system,sans-serif; font-size:15px; line-height:1.85; color:#1F2937; }
        .tiptap-view strong { font-weight:700; color:#111827; }
        .tiptap-view em { font-style:italic; }
        .tiptap-view h1 { font-size:28px; font-weight:800; margin:32px 0 16px; color:#111827; border-bottom:2px solid #EEF2FF; padding-bottom:10px; }
        .tiptap-view h2 { font-size:22px; font-weight:700; margin:28px 0 12px; color:#111827; }
        .tiptap-view h3 { font-size:18px; font-weight:700; margin:24px 0 10px; color:#374151; }
        .tiptap-view h4 { font-size:15px; font-weight:700; margin:20px 0 8px; color:#374151; }
        .tiptap-view ul,.tiptap-view ol { margin:0 0 16px; padding-left:24px; }
        .tiptap-view li { margin-bottom:6px; }
        .tiptap-view blockquote { border-left:4px solid var(--brand-500); background:#F8F7FF; padding:14px 18px; margin:16px 0; border-radius:0 8px 8px 0; color:var(--brand-600); font-weight:500; }
        .tiptap-view code { background:#F3F4F6; padding:2px 7px; border-radius:5px; font-size:13px; font-family:'Fira Code','Menlo',monospace; color:var(--brand-500); }
        .tiptap-view pre { background:#1F2937; color:#E5E7EB; padding:16px 20px; border-radius:10px; overflow-x:auto; margin:16px 0; }
        .tiptap-view pre code { background:none; color:inherit; padding:0; font-size:13px; }
        .tiptap-view a { color:var(--brand-500); text-decoration:underline; text-underline-offset:3px; }
        .tiptap-view img { max-width:100%; border-radius:12px; margin:16px 0; box-shadow:0 2px 12px rgba(0,0,0,0.08); }
        .tiptap-view hr { border:none; border-top:2px solid #F3F4F6; margin:28px 0; }
        .tiptap-view p { margin:0 0 16px; }
        .tiptap-view table { width:100%; border-collapse:collapse; margin:16px 0; }
        .tiptap-view th,.tiptap-view td { border:1px solid #E5E7EB; padding:10px 14px; font-size:14px; }
        .tiptap-view th { background:#F9FAFB; font-weight:700; }
      `}</style>

      {/* ── 툴바 ── */}
      <div className="tiptap-toolbar">

        {/* 실행취소/다시실기 */}
        <ToolBtn title="실행 취소" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
          <Undo size={14} />
        </ToolBtn>
        <ToolBtn title="다시 실행" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
          <Redo size={14} />
        </ToolBtn>
        <Divider />

        {/* 인라인 서식 */}
        <ToolBtn title="볼드 (Ctrl+B)" onClick={() => editor.chain().focus().toggleBold().run()} active={isActive("bold")}>
          <Bold size={14} />
        </ToolBtn>
        <ToolBtn title="이탤릭 (Ctrl+I)" onClick={() => editor.chain().focus().toggleItalic().run()} active={isActive("italic")}>
          <Italic size={14} />
        </ToolBtn>
        <ToolBtn title="밑줄 (Ctrl+U)" onClick={() => editor.chain().focus().toggleUnderline().run()} active={isActive("underline")}>
          <UnderlineIcon size={14} />
        </ToolBtn>
        <ToolBtn title="취소선" onClick={() => editor.chain().focus().toggleStrike().run()} active={isActive("strike")}>
          <Strikethrough size={14} />
        </ToolBtn>
        <Divider />

        {/* 헤딩 */}
        <ToolBtn title="제목 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={isActive("heading", { level: 2 })}>
          <Heading2 size={14} />
        </ToolBtn>
        <ToolBtn title="제목 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={isActive("heading", { level: 3 })}>
          <Heading3 size={14} />
        </ToolBtn>
        <ToolBtn title="제목 4" onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} active={isActive("heading", { level: 4 })}>
          <Heading4 size={14} />
        </ToolBtn>
        <Divider />

        {/* 리스트 */}
        <ToolBtn title="글머리 기호" onClick={() => editor.chain().focus().toggleBulletList().run()} active={isActive("bulletList")}>
          <List size={14} />
        </ToolBtn>
        <ToolBtn title="번호 목록" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={isActive("orderedList")}>
          <ListOrdered size={14} />
        </ToolBtn>
        <Divider />

        {/* 블록 */}
        <ToolBtn title="인용구" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={isActive("blockquote")}>
          <Quote size={14} />
        </ToolBtn>
        <ToolBtn title="인라인 코드" onClick={() => editor.chain().focus().toggleCode().run()} active={isActive("code")}>
          <Code size={14} />
        </ToolBtn>
        <ToolBtn title="코드 블록" onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={isActive("codeBlock")}>
          <Code2 size={14} />
        </ToolBtn>
        <ToolBtn title="구분선" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus size={14} />
        </ToolBtn>
        <Divider />

        {/* 정렬 */}
        <ToolBtn title="왼쪽 정렬" onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })}>
          <AlignLeft size={14} />
        </ToolBtn>
        <ToolBtn title="가운데 정렬" onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })}>
          <AlignCenter size={14} />
        </ToolBtn>
        <ToolBtn title="오른쪽 정렬" onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })}>
          <AlignRight size={14} />
        </ToolBtn>
        <Divider />

        {/* 링크 */}
        <div style={{ position: "relative" }}>
          <ToolBtn title="링크 삽입" onClick={() => setShowLinkPopup(v => !v)} active={isActive("link") || showLinkPopup}>
            <LinkIcon size={14} />
          </ToolBtn>
          {showLinkPopup && (
            <LinkPopup
              onConfirm={handleLinkConfirm}
              onCancel={() => setShowLinkPopup(false)}
            />
          )}
        </div>

        {/* 이미지 삽입 */}
        {onInsertImage && (
          <ToolBtn title="이미지 삽입" onClick={onInsertImage}>
            <ImagePlus size={14} />
          </ToolBtn>
        )}
      </div>

      {/* ── 에디터 본문 ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }} onClick={() => editor.commands.focus()}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

/**
 * 에디터에 이미지 삽입 (insertImageToEditor 대체)
 */
export function insertImageToTiptap(
  editor: ReturnType<typeof useEditor> | null,
  src: string,
  alt?: string,
) {
  if (!editor) return;
  editor.chain().focus().setImage({ src, alt: alt || "image" }).run();
}
