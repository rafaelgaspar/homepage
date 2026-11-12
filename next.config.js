const { i18n } = require("./next-i18next.config");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Native/Node addons are not applied to every webpack pass (instrumentation).
  // Server-side externals keep require() at runtime. dockerode is pulled in
  // because instrumentation imports MCP cache → service-helpers.
  serverExternalPackages: ["prom-client", "dockerode", "cpu-features", "ssh2"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(config.externals ?? []),
        "prom-client",
        "dockerode",
        "cpu-features",
        "ssh2",
      ];
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
