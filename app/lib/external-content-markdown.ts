const mediaReferencePattern = /flowpack-media:([A-Za-z0-9_-]+)/g;
const internalMediaPattern = /\/api\/media\/([A-Za-z0-9_-]+)\/content/g;

export function getExternalMediaReferences(body: string): Set<string> {
  return new Set([...body.matchAll(mediaReferencePattern)].map((match) => match[1]));
}

export function toStoredExternalMarkdown(body: string): string {
  return body.replace(mediaReferencePattern, (_match, mediaId: string) => `/api/media/${mediaId}/content`);
}

export function toExternalBody(body: string | null): { body: string; bodyFormat: "markdown" | "html" } {
  const value = body ?? "";
  return {
    body: value.replace(internalMediaPattern, (_match, mediaId: string) => `flowpack-media:${mediaId}`),
    bodyFormat: /^\s*</.test(value) ? "html" : "markdown",
  };
}
