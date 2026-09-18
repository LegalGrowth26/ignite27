// Body handling for scheduled event emails: plain paragraphs separated
// by blank lines, with bare http(s) URLs auto-linked at render time.
// No HTML is stored or accepted; react-email escapes the text nodes,
// so admin input cannot inject markup.

export interface BodyToken {
  type: "text" | "link";
  value: string;
}

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/g;

export function bodyToParagraphs(body: string): string[] {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

// Split one paragraph into text and link tokens. Trailing punctuation
// that is almost never part of a URL (full stop, comma) is kept as
// text so "see https://example.com." links cleanly.
export function tokeniseParagraph(paragraph: string): BodyToken[] {
  const tokens: BodyToken[] = [];
  let last = 0;
  for (const match of paragraph.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    let url = match[0];
    while (/[.,;:!?]$/.test(url)) url = url.slice(0, -1);
    if (start > last) tokens.push({ type: "text", value: paragraph.slice(last, start) });
    tokens.push({ type: "link", value: url });
    last = start + url.length;
  }
  if (last < paragraph.length) {
    tokens.push({ type: "text", value: paragraph.slice(last) });
  }
  return tokens;
}
