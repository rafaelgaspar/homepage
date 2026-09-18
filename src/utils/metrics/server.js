import http from "node:http";

import { registerAppMetrics } from "./registry";
import { getMetricsSettings, isMetricsEnabled } from "./settings";

/** @type {import("node:http").Server | null} */
let server = null;

export function getMetricsServer() {
  return server;
}

/**
 * Start a dedicated HTTP listener for Prometheus scrapes (not the Next.js app port).
 */
export function startMetricsServer({ port: portOverride, host = "0.0.0.0" } = {}) {
  if (server) {
    return server;
  }
  if (!isMetricsEnabled()) {
    return null;
  }

  const { port: configPort, path: metricsPath } = getMetricsSettings();
  const port = portOverride ?? configPort;

  // Expose HELP/TYPE on /metrics before any pages/api traffic.
  registerAppMetrics();

  server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      if (url.pathname !== metricsPath) {
        res.statusCode = 404;
        res.end("Not Found");
        return;
      }

      if (req.method !== "GET" && req.method !== "HEAD") {
        res.statusCode = 405;
        res.setHeader("Allow", "GET, HEAD");
        res.end("Method Not Allowed");
        return;
      }

      res.statusCode = 200;
      const { metricsContentType, renderMetrics } = await import("./registry");
      res.setHeader("Content-Type", metricsContentType());
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      res.end(await renderMetrics());
    } catch (err) {
      console.error("[homepage metricsServer] request failed:", err.message || err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    }
  });

  server.listen(port, host, () => {
    console.info(`[homepage metricsServer] listening on ${host}:${port}${metricsPath}`);
  });

  server.on("error", (err) => {
    console.error("[homepage metricsServer] server error:", err.message || err);
  });

  return server;
}

export function stopMetricsServer() {
  if (!server) {
    return Promise.resolve();
  }
  const closing = server;
  server = null;
  return new Promise((resolve, reject) => {
    closing.close((err) => (err ? reject(err) : resolve()));
  });
}
