import Document, { Head, Html, Main, NextScript } from "next/document";

import { getCustomAssetsManifest } from "utils/custom-assets";

class HomepageDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);
    return {
      ...initialProps,
      customAssets: getCustomAssetsManifest(),
    };
  }

  render() {
    const { customAssets } = this.props;
    const backgroundUrls = customAssets?.backgrounds?.map((entry) => entry.url) ?? [];

    return (
      <Html>
        <Head>
          <meta name="mobile-web-app-capable" content="yes" />
          <link rel="manifest" href="/site.webmanifest?v=4" crossOrigin="use-credentials" />
          {customAssets?.css ? (
            <>
              <link rel="preload" href={customAssets.css.url} as="style" />
              <link rel="stylesheet" href={customAssets.css.url} />
            </>
          ) : null}
        </Head>
        <body>
          {backgroundUrls.length ? (
            <script
              dangerouslySetInnerHTML={{
                __html: `window.__HOMEPAGE_CUSTOM_BG__=${JSON.stringify(backgroundUrls)};`,
              }}
            />
          ) : null}
          {customAssets?.js ? <script src={customAssets.js.url} defer /> : null}
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default HomepageDocument;
