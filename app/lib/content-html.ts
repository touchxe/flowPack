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

export function removeImageGridEditorChromeFromElement(root: ParentNode): void {
  root
    .querySelectorAll(".fp-image-grid-toolbar, .fp-image-grid-remove")
    .forEach((element) => element.remove());
}
