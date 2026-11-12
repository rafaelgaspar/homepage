import { Head, Html, Main, NextScript } from "next/document";

export default function Document({ __NEXT_DATA__ }) {
  const lang = __NEXT_DATA__?.props?.pageProps?._nextI18Next?.initialLocale ?? "en";
  return (
    <Html lang={lang}>
      <Head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/site.webmanifest?v=4" crossOrigin="use-credentials" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
