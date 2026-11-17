import { describe, expect, it } from "vitest";

import { markdownToHtml } from "./markdown";

describe("k3s-home markdown", () => {
  it("renders bold, lists, and code without leaving raw markdown or injecting html", () => {
    const html = markdownToHtml("✅ **provision**: Succeeded\n\n- **mele2q**: `ok`\n- <script>alert(1)</script>\n");

    expect(html).toContain("<strong>provision</strong>");
    expect(html).toContain("<li><strong>mele2q</strong>: <code>ok</code></li>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("**");
  });
});
