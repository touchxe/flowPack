export const BLOG_SEMANTIC_MARKDOWN_GUIDELINES = `
[의미적 마크다운/HTML 구조 규칙]
- 본문은 최종적으로 HTML로 변환됩니다. 태그의 의미에 맞는 마크다운만 사용하세요.
- unordered list(-)와 ordered list(1.)는 체크리스트, 단계, 병렬 항목, 장단점, 준비물처럼 실제 목록 의미가 있을 때만 사용하세요.
- 설명형 문장이나 후기 흐름은 목록으로 쪼개지 말고 자연스러운 문단(<p>)으로 작성하세요.
- 한 문장을 문단 중간에서 끊지 마세요. 특히 한국어 조사(은/는/이/가/을/를/께/에게/에서 등)가 다음 문단으로 분리되지 않게 하세요.
- 빈 문단, 의미 없는 구분선, 장식용 목록을 만들지 마세요.
- H1은 글 제목에만 사용하고, 본문 섹션은 H2/H3 위주로 구성하세요.
- 응답은 마크다운 본문만 반환하고 코드블록이나 설명 문구를 덧붙이지 마세요.
`.trim();

function isMarkdownBlockBoundary(line: string): boolean {
  return /^(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|---+$)/.test(line.trim());
}

function endsSentence(line: string): boolean {
  return /[.!?。！？…)"'”’\]]$/.test(line.trim());
}

function startsWithKoreanParticle(line: string): boolean {
  return /^(은|는|이|가|을|를|께|께는|에게|에서|으로|로|와|과|도|만|부터|까지)/.test(line.trim());
}

export function normalizeGeneratedBlogMarkdown(markdown: string): string {
  const normalized = markdown
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const blocks = normalized.split(/\n\n/);
  const merged: string[] = [];

  for (const block of blocks) {
    const current = block.trim();
    if (!current) continue;

    const previous = merged[merged.length - 1];
    if (
      previous &&
      !isMarkdownBlockBoundary(previous) &&
      !isMarkdownBlockBoundary(current) &&
      !endsSentence(previous) &&
      startsWithKoreanParticle(current)
    ) {
      merged[merged.length - 1] = `${previous}${current}`;
      continue;
    }

    merged.push(current);
  }

  return merged.join("\n\n");
}
