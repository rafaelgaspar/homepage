import http from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSettings } = vi.hoisted(() => ({
  getSettings: vi.fn(),
}));

vi.mock("utils/config/config", () => ({
  getSettings,
}));

vi.mock("utils/logger", () => ({
  default: () => ({ info: vi.fn(), error: vi.fn() }),
}));

vi.mock("./registry", () => ({
  metricsContentType: vi.fn(() => "text/plain; version=0.0.4; charset=utf-8"),
  renderMetrics: vi.fn(async () => "# TYPE process_cpu_user_seconds_total counter\n"),
}));

import { getMetricsServer, startMetricsServer, stopMetricsServer } from "./server";

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks).toString() });
      });
    }).on("error", reject);
  });
}

describe("utils/metrics/server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettings.mockReturnValue({ metrics: { enabled: true, port: 9090, path: "/metrics" } });
  });

  afterEach(async () => {
    await stopMetricsServer();
  });

  it("does not listen when metrics are disabled", () => {
    getSettings.mockReturnValue({});
    expect(startMetricsServer()).toBeNull();
    expect(getMetricsServer()).toBeNull();
  });

  it("serves metrics on the configured path only", async () => {
    startMetricsServer({ port: 0 });
    await new Promise((resolve) => getMetricsServer().once("listening", resolve));
    const { port } = getMetricsServer().address();

    const ok = await get(`http://127.0.0.1:${port}/metrics`);
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toContain("process_cpu_user_seconds_total");

    const missing = await get(`http://127.0.0.1:${port}/api/metrics`);
    expect(missing.statusCode).toBe(404);
  });
});
