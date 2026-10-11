const { i18n } = require("./next-i18next.config");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // prom-client pulls Node builtins; serverExternalPackages is not applied to every
  // webpack pass (instrumentation). Server-side externals keeps require() at runtime.
  serverExternalPackages: ["prom-client"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals ?? []), "prom-client"];
    }
    return config;
  },
  // for serverSideTranslations
  outputFileTracingIncludes: {
    "/**": ["./next-i18next.config.js"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
      },
    ],
    unoptimized: true,
  },
  i18n,
};

module.exports = nextConfig;
