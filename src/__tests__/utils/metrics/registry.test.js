import { beforeEach, describe, expect, it } from "vitest";

import {
  getHttpRequestsCounter,
  getMetricsRegister,
  registerAppMetrics,
  renderMetrics,
} from "utils/metrics/registry";

const GLOBAL_STATE_KEY = "__homepagePrometheusMetricsState";

describe("metrics registry", () => {
  beforeEach(() => {
    delete globalThis[GLOBAL_STATE_KEY];
  });

  it("getMetricsRegister returns a process-wide singleton", () => {
    const first = getMetricsRegister();
    const second = getMetricsRegister();
    expect(first).toBe(second);
  });

  it("API increments and metrics server scrape share the same registry", async () => {
    registerAppMetrics();
    getHttpRequestsCounter().inc({
      method: "GET",
      route: "/api/example",
      status_code: "200",
    });

    const body = await renderMetrics();
    expect(body).toContain(
      'homepage_http_requests_total{method="GET",route="/api/example",status_code="200"} 1',
    );
  });
});
