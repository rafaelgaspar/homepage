import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { mockGetCustomAssetsManifest } = vi.hoisted(() => ({
  mockGetCustomAssetsManifest: vi.fn(() => ({
    css: null,
    js: null,
    backgrounds: [],
  })),
}));

vi.mock("utils/custom-assets", () => ({
  getCustomAssetsManifest: mockGetCustomAssetsManifest,
}));

vi.mock("next/document", async () => {
  const { Component } = await import("react");

  class BaseDocument extends Component {
    static async getInitialProps() {
      return {};
    }
  }

  return {
    default: BaseDocument,
    Html: ({ children, lang }) => (
      <div data-testid="html" lang={lang}>
        {children}
      </div>
    ),
    Head: ({ children }) => <div data-testid="head">{children}</div>,
    Main: () => <main data-testid="main" />,
    NextScript: () => <script data-testid="nextscript" />,
  };
});

import Document from "pages/_document.jsx";

describe("pages/_document", () => {
  it("renders the PWA meta tags", () => {
    const html = renderToStaticMarkup(<Document customAssets={{ css: null, js: null, backgrounds: [] }} />);

    expect(html).toContain('meta name="mobile-web-app-capable" content="yes"');
    expect(html).toContain('link rel="manifest" href="/site.webmanifest?v=4"');
    expect(html).not.toContain("/api/config/custom.css");
    expect(html).toContain('data-testid="main"');
    expect(html).toContain('data-testid="nextscript"');
    expect(html).toContain('lang="en"');
  });

  it("sets lang from the server-side i18n locale", () => {
    const nextData = { props: { pageProps: { _nextI18Next: { initialLocale: "zh-Hans" } } } };
    const html = renderToStaticMarkup(
      <Document customAssets={{ css: null, js: null, backgrounds: [] }} __NEXT_DATA__={nextData} />,
    );

    expect(html).toContain('lang="zh-Hans"');
  });

  it("injects fingerprinted custom asset URLs from getInitialProps", async () => {
    mockGetCustomAssetsManifest.mockReturnValueOnce({
      css: { hash: "0123456789abcdef", url: "/api/custom/0123456789abcdef/css/custom.css" },
      js: { hash: "fedcba9876543210", url: "/api/custom/fedcba9876543210/js/custom.js" },
      backgrounds: [{ name: "background-0.png", hash: "abc", url: "/api/custom/abc/background/background-0.png" }],
    });

    const props = await Document.getInitialProps({});
    const html = renderToStaticMarkup(<Document {...props} />);

    expect(html).toContain('href="/api/custom/0123456789abcdef/css/custom.css"');
    expect(html).toContain('src="/api/custom/fedcba9876543210/js/custom.js"');
    expect(html).toContain('window.__HOMEPAGE_CUSTOM_BG__=["/api/custom/abc/background/background-0.png"]');
  });
});
