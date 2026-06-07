/**
 * TiptapEditor — WYSIWYG 블로그 에디터
 * Tiptap 기반, FlowPack 디자인 시스템과 일관된 툴바 포함
 */
"use client";

import { Node } from "@tiptap/core";
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
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
  Minus, Link as LinkIcon, ImagePlus, Video,
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
  onInsertVideo?: () => void;
  placeholder?: string;
  minHeight?: number;
  stickyToolbarTop?: string;
  editorRef?: React.MutableRefObject<ReturnType<typeof useEditor> | null>;
}

export interface ImageGridItem {
  src: string;
  alt?: string;
  href?: string;
}

const IMAGE_GRID_COLUMNS = [2, 3, 4] as const;

function normalizeImageGridColumns(value: unknown): 2 | 3 | 4 {
  const numeric = typeof value === "number" ? value : Number(value);
  return IMAGE_GRID_COLUMNS.includes(numeric as 2 | 3 | 4) ? numeric as 2 | 3 | 4 : 2;
}

function parseImageGridItems(value: unknown): ImageGridItem[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => ({
        src: typeof item.src === "string" ? item.src : "",
        alt: typeof item.alt === "string" ? item.alt : "",
        href: typeof item.href === "string" ? item.href : "",
      }))
      .filter((item) => item.src);
  }

  if (typeof value !== "string" || !value.trim()) return [];

  try {
    return parseImageGridItems(JSON.parse(value));
  } catch {
    return [];
  }
}

function readImageGridItems(element: HTMLElement): ImageGridItem[] {
  const serialized = element.getAttribute("data-images");
  const parsed = parseImageGridItems(serialized);
  if (parsed.length > 0) return parsed;

  return Array.from(element.querySelectorAll("img"))
    .map((image) => ({
      src: image.getAttribute("src") ?? "",
      alt: image.getAttribute("alt") ?? "",
      href: image.closest("a")?.getAttribute("href") ?? "",
    }))
    .filter((item) => item.src);
}

function imageGridStyle(columns: number): string {
  return `display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:12px;margin:20px 0;`;
}

function imageGridFigureNode(item: ImageGridItem) {
  const imageNode = [
    "img",
    {
      src: item.src,
      alt: item.alt ?? "",
      style: "width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;display:block;box-shadow:0 2px 12px rgba(0,0,0,0.08);margin:0;",
    },
  ];

  return [
    "figure",
    { style: "margin:0;min-width:0;" },
    item.href
      ? ["a", { href: item.href, target: "_blank", rel: "noopener noreferrer", style: "display:block;text-decoration:none;" }, imageNode]
      : imageNode,
  ];
}

function NumberedImageView({ node }: NodeViewProps) {
  const imageNumber = typeof node.attrs.imageNumber === "number" ? node.attrs.imageNumber : null;
  const linkHref = typeof node.attrs.linkHref === "string" ? node.attrs.linkHref : "";

  const openLink = (event: React.MouseEvent | React.KeyboardEvent) => {
    if (!linkHref) return;
    event.preventDefault();
    event.stopPropagation();
    window.open(linkHref, "_blank", "noopener,noreferrer");
  };
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      openLink(event);
    }
  };

  return (
    <NodeViewWrapper
      as={linkHref ? "a" : "span"}
      className={`tiptap-image-wrap${linkHref ? " tiptap-video-image-wrap" : ""}`}
      data-link-href={linkHref || undefined}
      href={linkHref || undefined}
      target={linkHref ? "_blank" : undefined}
      rel={linkHref ? "noopener noreferrer" : undefined}
      onClick={openLink}
      onKeyDown={handleKeyDown}
      role={linkHref ? "link" : undefined}
      tabIndex={linkHref ? 0 : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={node.attrs.src}
        alt={node.attrs.alt || ""}
        title={node.attrs.title || ""}
        className="tiptap-img"
      />
      {linkHref && <span className="tiptap-video-play" aria-hidden="true" />}
      {imageNumber && <span className="tiptap-image-number">{imageNumber}</span>}
    </NodeViewWrapper>
  );
}

const NumberedImage = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      imageNumber: {
        default: null,
        parseHTML: (element: HTMLElement) => Number(element.getAttribute("data-image-number")) || null,
        renderHTML: () => ({}),
      },
      linkHref: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-link-href") || element.closest("a")?.getAttribute("href") || null,
        renderHTML: (attributes: { linkHref?: unknown }) => (
          typeof attributes.linkHref === "string" && attributes.linkHref
            ? { "data-link-href": attributes.linkHref }
            : {}
        ),
      },
    };
  },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    const {
      imageNumber,
      linkHref,
      "data-link-href": dataLinkHref,
      ...attrs
    } = HTMLAttributes;
    const videoHref =
      typeof linkHref === "string" && linkHref
        ? linkHref
        : typeof dataLinkHref === "string" && dataLinkHref
          ? dataLinkHref
          : "";
    const className = typeof attrs.class === "string" ? attrs.class : "";
    const imgAttrs = {
      ...attrs,
      ...(videoHref ? { "data-link-href": videoHref } : {}),
      class: [className, "tiptap-img"].filter(Boolean).join(" "),
    };

    if (videoHref) {
      return [
        "a",
        {
          href: videoHref,
          target: "_blank",
          rel: "noopener noreferrer",
          class: "tiptap-video-link",
          "data-link-href": videoHref,
        },
        ["span", { class: "tiptap-video-thumb" }, ["img", imgAttrs], ["span", { class: "tiptap-video-play" }]],
      ];
    }

    return ["img", imgAttrs];
  },
  addNodeView() {
    return ReactNodeViewRenderer(NumberedImageView);
  },
});

function ImageGridView({ node, selected, updateAttributes }: NodeViewProps) {
  const columns = normalizeImageGridColumns(node.attrs.columns);
  const items = parseImageGridItems(node.attrs.items);

  const setColumns = (nextColumns: 2 | 3 | 4) => {
    updateAttributes({ columns: nextColumns });
  };

  const removeItem = (index: number) => {
    const nextItems = items.filter((_, itemIndex) => itemIndex !== index);
    updateAttributes({ items: nextItems });
  };

  return (
    <NodeViewWrapper
      className={`fp-image-grid-node${selected ? " is-selected" : ""}`}
      data-type="image-grid"
      data-columns={columns}
    >
      <div className="fp-image-grid-toolbar" contentEditable={false}>
        <span className="fp-image-grid-label">이미지 블록</span>
        <div className="fp-image-grid-controls">
          {IMAGE_GRID_COLUMNS.map((option) => (
            <button
              key={option}
              type="button"
              className={columns === option ? "active" : ""}
              onClick={() => setColumns(option)}
            >
              {option}열
            </button>
          ))}
        </div>
      </div>
      <div className="fp-image-grid" data-columns={columns} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {items.map((item, index) => (
          <figure className="fp-image-grid-item" key={`${item.src}-${index}`}>
            {item.href ? (
              <a href={item.href} target="_blank" rel="noopener noreferrer" contentEditable={false}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt={item.alt ?? ""} />
              </a>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.src} alt={item.alt ?? ""} />
            )}
            <button type="button" className="fp-image-grid-remove" contentEditable={false} onClick={() => removeItem(index)}>
              삭제
            </button>
          </figure>
        ))}
      </div>
    </NodeViewWrapper>
  );
}

const ImageGrid = Node.create({
  name: "imageGrid",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      columns: {
        default: 2,
        parseHTML: (element: HTMLElement) => normalizeImageGridColumns(element.getAttribute("data-columns")),
        renderHTML: (attributes: { columns?: unknown }) => ({
          "data-columns": String(normalizeImageGridColumns(attributes.columns)),
        }),
      },
      items: {
        default: [],
        parseHTML: (element: HTMLElement) => readImageGridItems(element),
        renderHTML: (attributes: { items?: unknown }) => ({
          "data-images": JSON.stringify(parseImageGridItems(attributes.items)),
        }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'div[data-type="image-grid"]' },
      { tag: "div.fp-image-grid" },
    ];
  },

  renderHTML({ node }) {
    const columns = normalizeImageGridColumns(node.attrs.columns);
    const items = parseImageGridItems(node.attrs.items);

    return [
      "div",
      {
        class: "fp-image-grid",
        "data-type": "image-grid",
        "data-columns": String(columns),
        "data-images": JSON.stringify(items),
        style: imageGridStyle(columns),
      },
      ...items.map(imageGridFigureNode),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageGridView);
  },
});

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
      borderRadius: 10, padding: 12, boxShadow: "0 8px 24px var(--fp-primary-subtle)",
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
  content, onChange, onInsertImage, onInsertVideo, placeholder, minHeight = 520, stickyToolbarTop = "0px", editorRef,
}: TiptapEditorProps) {
  const [isReady, setIsReady] = useState(false);
  const [showLinkPopup, setShowLinkPopup] = useState(false);

  const renumberImages = useCallback((editorInstance: NonNullable<ReturnType<typeof useEditor>>) => {
    let imageNumber = 0;
    let changed = false;
    const transaction = editorInstance.state.tr;

    editorInstance.state.doc.descendants((node: { type: { name: string }; attrs: Record<string, unknown> }, pos: number) => {
      if (node.type.name !== "image") return;

      imageNumber += 1;
      if (node.attrs.imageNumber !== imageNumber) {
        transaction.setNodeMarkup(pos, undefined, { ...node.attrs, imageNumber });
        changed = true;
      }
    });

    if (changed) {
      transaction.setMeta("addToHistory", false);
      editorInstance.view.dispatch(transaction);
    }
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        codeBlock: { HTMLAttributes: { class: "tiptap-code-block" } },
      }),
      Underline,
      TextStyle,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ImageGrid,
      NumberedImage.configure({ inline: false, allowBase64: false, HTMLAttributes: { class: "tiptap-img" } }),
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
    onUpdate: ({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) => {
      onChange(editor.getHTML());
      queueMicrotask(() => renumberImages(editor));
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
      renumberImages(editor);
      setIsReady(true);
    });
  }, [editor, content, isReady, renumberImages]);

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
  const wrapperStyle = {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    "--tiptap-toolbar-top": stickyToolbarTop,
  } as React.CSSProperties & { "--tiptap-toolbar-top": string };

  return (
    <div className="tiptap-editor-wrap" style={wrapperStyle}>
      <style>{`
        /* ── 툴바 (sticky 고정) ── */
        .tiptap-toolbar { position:sticky; top:var(--tiptap-toolbar-top, 0px); z-index:40; display:flex; align-items:center; gap:2px; padding:6px 10px; background:#FAFBFC; border-bottom:1px solid #F3F4F6; flex-wrap:wrap; }
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
        .tiptap-image-wrap { position:relative; display:inline-block; max-width:100%; margin:16px 0; line-height:0; }
        .tiptap-img { max-width:100%; border-radius:12px; display:block; box-shadow:0 2px 12px rgba(0,0,0,0.08); }
        .tiptap-image-number { position:absolute; top:10px; right:10px; min-width:30px; height:30px; padding:0 9px; border-radius:999px; background:rgba(17,24,39,0.48); color:#fff; backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:900; line-height:1; box-shadow:0 8px 24px rgba(17,24,39,0.18); pointer-events:none; }
        .tiptap-video-image-wrap,.tiptap-video-link,.tiptap-video-thumb { position:relative; display:inline-block; max-width:100%; line-height:0; text-decoration:none!important; cursor:pointer; }
        .tiptap-video-link { margin:16px 0; color:inherit; }
        .tiptap-video-link .tiptap-img { margin:0; }
        .tiptap-video-play { position:absolute; left:50%; top:50%; width:54px; height:54px; border-radius:999px; background:rgba(17,24,39,0.72); transform:translate(-50%,-50%); box-shadow:0 12px 30px rgba(17,24,39,0.26); pointer-events:none; }
        .tiptap-video-play::before { content:""; position:absolute; left:22px; top:17px; width:0; height:0; border-top:10px solid transparent; border-bottom:10px solid transparent; border-left:16px solid #fff; }
        .fp-image-grid-node { position:relative; border:1.5px solid #E5E7EB; border-radius:12px; padding:12px; margin:20px 0; background:#fff; }
        .fp-image-grid-node.is-selected { border-color:var(--brand-500); box-shadow:0 0 0 3px rgba(79,70,229,0.12); }
        .fp-image-grid-toolbar { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
        .fp-image-grid-label { font-size:11px; font-weight:850; color:#6B7280; }
        .fp-image-grid-controls { display:flex; gap:4px; padding:2px; background:#F3F4F6; border-radius:8px; }
        .fp-image-grid-controls button { height:24px; padding:0 8px; border:0; border-radius:6px; background:transparent; color:#6B7280; font-size:11px; font-weight:800; cursor:pointer; }
        .fp-image-grid-controls button.active { background:#fff; color:var(--brand-500); box-shadow:0 1px 3px rgba(17,24,39,0.10); }
        .fp-image-grid { display:grid; gap:12px; margin:20px 0; }
        .fp-image-grid-node .fp-image-grid { margin:0; }
        .fp-image-grid-item { position:relative; min-width:0; margin:0; }
        .fp-image-grid-item a { display:block; text-decoration:none!important; color:inherit; }
        .fp-image-grid img,.fp-image-grid-item img { width:100%; aspect-ratio:4/3; object-fit:cover; border-radius:10px; display:block; margin:0!important; box-shadow:0 2px 12px rgba(0,0,0,0.08); }
        .fp-image-grid-remove { position:absolute; top:6px; right:6px; height:24px; padding:0 8px; border:0; border-radius:999px; background:rgba(17,24,39,0.68); color:#fff; font-size:11px; font-weight:800; cursor:pointer; opacity:0; transition:opacity 0.12s; }
        .fp-image-grid-item:hover .fp-image-grid-remove { opacity:1; }
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
        .tiptap-view .tiptap-video-link,.tiptap-view .tiptap-video-thumb { position:relative; display:inline-block; max-width:100%; line-height:0; text-decoration:none!important; }
        .tiptap-view .tiptap-video-link { margin:16px 0; }
        .tiptap-view .tiptap-video-link img { margin:0; }
        .tiptap-view .fp-image-grid { display:grid; gap:12px; margin:20px 0; }
        .tiptap-view .fp-image-grid[data-columns="2"] { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .tiptap-view .fp-image-grid[data-columns="3"] { grid-template-columns:repeat(3,minmax(0,1fr)); }
        .tiptap-view .fp-image-grid[data-columns="4"] { grid-template-columns:repeat(4,minmax(0,1fr)); }
        .tiptap-view .fp-image-grid figure { margin:0; min-width:0; }
        .tiptap-view .fp-image-grid img { width:100%; aspect-ratio:4/3; object-fit:cover; display:block; margin:0!important; }
        .tiptap-view .fp-image-grid-toolbar,
        .tiptap-view .fp-image-grid-controls,
        .tiptap-view .fp-image-grid-label,
        .tiptap-view .fp-image-grid-remove { display:none!important; }
        @media (max-width:640px) {
          .fp-image-grid,.tiptap-view .fp-image-grid { grid-template-columns:repeat(2,minmax(0,1fr))!important; }
        }
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
        {onInsertVideo && (
          <ToolBtn title="영상 삽입" onClick={onInsertVideo}>
            <Video size={14} />
          </ToolBtn>
        )}
      </div>

      {/* ── 에디터 본문 ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "#fff" }} onClick={() => editor.commands.focus()}>
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

export function insertLinkedImageToTiptap(
  editor: ReturnType<typeof useEditor> | null,
  src: string,
  href: string,
  alt?: string,
) {
  if (!editor) return;
  editor
    .chain()
    .focus()
    .insertContent({
      type: "image",
      attrs: {
        src,
        alt: alt || "video thumbnail",
        title: alt || href,
        linkHref: href,
      },
    })
    .run();
}

export function insertImageGridToTiptap(
  editor: ReturnType<typeof useEditor> | null,
  items: ImageGridItem[],
  columns: 2 | 3 | 4,
) {
  if (!editor || items.length === 0) return;
  editor
    .chain()
    .focus()
    .insertContent({
      type: "imageGrid",
      attrs: {
        columns,
        items,
      },
    })
    .run();
}
