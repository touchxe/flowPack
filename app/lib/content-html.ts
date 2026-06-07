export interface ContentHtmlImage {
  id: string;
  url: string;
  altText?: string | null;
}

const VIDEO_ALT_PREFIX = "flowpack-video:";

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
