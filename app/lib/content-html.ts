export interface ContentHtmlImage {
  id: string;
  url: string;
  altText?: string | null;
}

const VIDEO_ALT_PREFIX = "flowpack-video:";
const WORDPRESS_LAYOUT_MARKER = 'data-flowpack-layout="wordpress-post"';

function getReadableAltText(altText?: string | null): string {
  if (!altText || altText.startsWith(VIDEO_ALT_PREFIX)) return "image";
  return altText;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function removeImageGridEditorChrome(html: string): string {
  if (!html) return html;

  return html
    .replace(
      /<div\b(?=[^>]*\bfp-image-grid-toolbar\b)[^>]*>[\s\S]*?<div\b(?=[^>]*\bfp-image-grid-controls\b)[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi,
      "",
    )
    .replace(
      /<button\b(?=[^>]*\bfp-image-grid-remove\b)[^>]*>[\s\S]*?<\/button>/gi,
      "",
    );
}

export function normalizeSemanticContentHtml(html: string): string {
  if (!html) return html;

  return removeImageGridEditorChrome(html)
    .replace(/<p(?:\s[^>]*)?>\s*(?:&nbsp;|\s|<br\s*\/?>)*<\/p>/gi, "")
    .replace(/<li([^>]*)>\s*<p(?:\s[^>]*)?>\s*([\s\S]*?)\s*<\/p>\s*<\/li>/gi, "<li$1>$2</li>")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function appendInlineStyle(openingTag: string, style: string): string {
  if (/\sstyle\s*=/.test(openingTag)) {
    return openingTag.replace(
      /\sstyle=(["'])([\s\S]*?)\1/i,
      (_match: string, quote: string, currentStyle: string) => {
        const separator = currentStyle.trim().endsWith(";") || currentStyle.trim() === "" ? "" : ";";
        return ` style=${quote}${currentStyle}${separator}${style}${quote}`;
      },
    );
  }

  return openingTag.replace(/>$/, ` style="${style}">`);
}

function styleOpeningTags(html: string, tagName: string, style: string): string {
  const openingTagPattern = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
  return html.replace(openingTagPattern, (openingTag) => appendInlineStyle(openingTag, style));
}

export function applyWordPressPostLayoutHtml(html: string): string {
  if (!html) return html;

  const normalizedHtml = normalizeSemanticContentHtml(html);
  if (normalizedHtml.includes(WORDPRESS_LAYOUT_MARKER)) {
    return normalizedHtml;
  }

  let formattedHtml = normalizedHtml;
  formattedHtml = styleOpeningTags(
    formattedHtml,
    "h1",
    "font-size:30px;line-height:1.32;margin:0 0 30px;font-weight:800;color:#111827;",
  );
  formattedHtml = styleOpeningTags(
    formattedHtml,
    "h2",
    "font-size:24px;line-height:1.42;margin:46px 0 16px;font-weight:800;color:#111827;",
  );
  formattedHtml = styleOpeningTags(
    formattedHtml,
    "h3",
    "font-size:20px;line-height:1.48;margin:38px 0 14px;font-weight:750;color:#111827;",
  );
  formattedHtml = styleOpeningTags(
    formattedHtml,
    "h4",
    "font-size:18px;line-height:1.5;margin:30px 0 12px;font-weight:750;color:#111827;",
  );
  formattedHtml = styleOpeningTags(formattedHtml, "p", "margin:0 0 20px;");
  formattedHtml = styleOpeningTags(formattedHtml, "ul", "margin:0 0 26px 1.25em;padding:0;");
  formattedHtml = styleOpeningTags(formattedHtml, "ol", "margin:0 0 26px 1.25em;padding:0;");
  formattedHtml = styleOpeningTags(formattedHtml, "li", "margin:0 0 10px;padding-left:2px;");
  formattedHtml = styleOpeningTags(
    formattedHtml,
    "blockquote",
    "margin:30px 0;padding:2px 0 2px 18px;border-left:4px solid #D1D5DB;color:#4B5563;",
  );
  formattedHtml = styleOpeningTags(formattedHtml, "figure", "margin:32px 0;");
  formattedHtml = styleOpeningTags(
    formattedHtml,
    "img",
    "max-width:100%;height:auto;display:block;margin:0 auto;",
  );

  return `<div ${WORDPRESS_LAYOUT_MARKER} style="max-width:720px;margin:0 auto;padding:8px 18px 34px;box-sizing:border-box;font-size:16px;line-height:1.78;color:#1F2937;word-break:keep-all;overflow-wrap:break-word;">${formattedHtml}</div>`;
}

export function hydrateEmptyImageGridsInHtml(
  html: string,
  images: ContentHtmlImage[],
  getImageSrc: (image: ContentHtmlImage) => string = (image) => image.url,
): string {
  if (!html || images.length === 0) return html;

  const figures = images
    .map((image) => {
      const src = escapeHtmlAttribute(getImageSrc(image));
      const alt = escapeHtmlAttribute(getReadableAltText(image.altText));

      return `<figure style="margin:0;min-width:0;"><img src="${src}" alt="${alt}" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;display:block;box-shadow:0 2px 12px rgba(0,0,0,0.08);margin:0;" /></figure>`;
    })
    .join("");

  return html.replace(
    /(<div\b(?=[^>]*\bfp-image-grid\b)[^>]*>)\s*<\/div>/gi,
    `$1${figures}</div>`,
  );
}

export function removeImageGridEditorChromeFromElement(root: Element): void {
  root
    .querySelectorAll(".fp-image-grid-toolbar, .fp-image-grid-remove")
    .forEach((element) => element.remove());
}

export function hydrateEmptyImageGridsFromElement(
  root: Element,
  images: ContentHtmlImage[],
  getImageSrc: (image: ContentHtmlImage) => string = (image) => image.url,
): void {
  if (images.length === 0) return;

  root.querySelectorAll<HTMLElement>(".fp-image-grid").forEach((grid) => {
    if (grid.querySelector("img")) return;

    images.forEach((image) => {
      const figure = root.ownerDocument.createElement("figure");
      const img = root.ownerDocument.createElement("img");

      figure.style.margin = "0";
      figure.style.minWidth = "0";
      img.src = getImageSrc(image);
      img.alt = getReadableAltText(image.altText);
      img.style.width = "100%";
      img.style.aspectRatio = "4/3";
      img.style.objectFit = "cover";
      img.style.borderRadius = "10px";
      img.style.display = "block";
      img.style.margin = "0";

      figure.appendChild(img);
      grid.appendChild(figure);
    });
  });
}
