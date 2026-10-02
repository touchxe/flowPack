import assert from "node:assert/strict";
import test from "node:test";
import { renderExternalContentHtml, sanitizeExternalRenderedHtml } from "./external-rendered-content.ts";

test("renders managed markdown images as media references", () => {
  const html = renderExternalContentHtml(
    "## 제목\n\n![대체 텍스트](flowpack-media:media_123)",
    "markdown",
  );
  assert.match(html, /<h2>제목<\/h2>/);
  assert.match(html, /data-flowpack-media-id="media_123"/);
  assert.match(html, /src="flowpack-media:media_123"/);
  assert.match(html, /alt="대체 텍스트"/);
  assert.doesNotMatch(html, /<p>\s*<figure/);
});

test("removes executable markup and unmanaged images", () => {
  const html = sanitizeExternalRenderedHtml(
    '<script>alert(1)</script><p onclick="bad()">안전</p><img src="https://example.com/a.jpg" onerror="bad()">',
  );
  assert.equal(html, "<p>안전</p>");
});

test("keeps safe http links and strips unsafe protocols", () => {
  const html = sanitizeExternalRenderedHtml(
    '<a href="https://example.com">안전</a><a href="javascript:alert(1)">위험</a>',
  );
  assert.match(html, /href="https:\/\/example.com"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /javascript:/);
});
