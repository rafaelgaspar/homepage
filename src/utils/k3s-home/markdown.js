function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(text) {
  const parts = [];
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    parts.push(escapeHtml(text.slice(last, match.index)));
    if (match[1] !== undefined) {
      parts.push(`<code>${escapeHtml(match[1])}</code>`);
    } else {
      parts.push(`<strong>${escapeHtml(match[2] ?? match[3])}</strong>`);
    }
    last = match.index + match[0].length;
  }
  parts.push(escapeHtml(text.slice(last)));
  return parts.join("");
}

/** Discord-style Markdown to HTML. The source is escaped before tags are added. */
export function markdownToHtml(source) {
  const lines = String(source ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let list = [];
  let paragraph = [];

  function flushParagraph() {
    if (!paragraph.length) {
      return;
    }
    blocks.push(`<p>${paragraph.map((line) => inline(line)).join("<br>")}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!list.length) {
      return;
    }
    blocks.push(`<ul>${list.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
    list = [];
  }

  for (const line of lines) {
    const item = /^\s*[-*]\s+(.*)$/.exec(line);
    if (item) {
      flushParagraph();
      list.push(item[1]);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    flushList();
    paragraph.push(line.trimEnd());
  }
  flushParagraph();
  flushList();
  return blocks.join("");
}
