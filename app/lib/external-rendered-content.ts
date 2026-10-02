import { load } from "cheerio";
import { marked } from "marked";

const allowedTags = new Set([
  "a", "blockquote", "br", "code", "del", "em", "figcaption", "figure",
  "h1", "h2", "h3", "h4", "h5", "h6", "hr", "img", "li", "ol", "p",
  "pre", "s", "strong", "table", "tbody", "td", "th", "thead", "tr", "u", "ul",
]);

const removableTags = new Set([
  "base", "button", "embed", "form", "iframe", "input", "link", "math", "meta",
  "object", "script", "style", "svg", "textarea",
]);

const globalAttributes = new Set(["title"]);
const attributesByTag = new Map<string, Set<string>>([
  ["a", new Set(["href", "title"])],
  ["figure", new Set(["data-flowpack-media-id"])],
  ["img", new Set(["alt", "height", "src", "title", "width"])],
  ["td", new Set(["colspan", "rowspan"])],
  ["th", new Set(["colspan", "rowspan", "scope"])],
]);

function isSafeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function isMediaReference(value: string): boolean {
  return /^flowpack-media:[A-Za-z0-9_-]+$/.test(value);
}

export function sanitizeExternalRenderedHtml(html: string): string {
  const $ = load(html, null, false);

  $("*").each((_index, element) => {
    if (element.type === "script" || element.type === "style") {
      $(element).remove();
      return;
    }
    if (element.type !== "tag") return;
    const tagName = element.tagName.toLowerCase();
    const current = $(element);

    if (!allowedTags.has(tagName)) {
      if (removableTags.has(tagName)) current.remove();
      else current.replaceWith(current.contents());
      return;
    }

    for (const attribute of Object.keys(element.attribs)) {
      const allowed = globalAttributes.has(attribute) || attributesByTag.get(tagName)?.has(attribute);
      if (!allowed || attribute.toLowerCase().startsWith("on")) current.removeAttr(attribute);
    }

    if (tagName === "a") {
      const href = current.attr("href");
      if (!href || !isSafeHttpUrl(href)) current.removeAttr("href");
      else current.attr("rel", "noopener noreferrer");
    }

    if (tagName === "img") {
      const src = current.attr("src");
      if (!src || !isMediaReference(src)) {
        current.remove();
        return;
      }
      const mediaId = src.slice("flowpack-media:".length);
      const parent = current.parent("figure");
      if (parent.length > 0) {
        parent.attr("data-flowpack-media-id", mediaId);
      } else {
        const paragraph = current.parent("p");
        current.wrap(`<figure data-flowpack-media-id="${mediaId}"></figure>`);
        if (paragraph.length > 0 && paragraph.text().trim() === "" && paragraph.children().length === 1) {
          paragraph.replaceWith(paragraph.children().first());
        }
      }
    }
  });

  return $.root().html()?.trim() ?? "";
}

export function renderExternalContentHtml(body: string, bodyFormat: "markdown" | "html"): string {
  const rendered = bodyFormat === "markdown"
    ? marked.parse(body, { async: false }) as string
    : body;
  return sanitizeExternalRenderedHtml(rendered);
}
