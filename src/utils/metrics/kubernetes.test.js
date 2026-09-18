import { describe, expect, it } from "vitest";

import { classifyPrometheusQueryFailure } from "./kubernetes";

describe("utils/metrics/kubernetes", () => {
  it("classifies prometheus query failures", () => {
    expect(classifyPrometheusQueryFailure(new Error("Prometheus query timed out after 15000ms"))).toBe("timeout");
    expect(classifyPrometheusQueryFailure(new Error("Prometheus HTTP 503: down"))).toBe("http_error");
    expect(classifyPrometheusQueryFailure(new Error("Prometheus JSON parse failed: oops"))).toBe("parse_error");
    expect(classifyPrometheusQueryFailure(new Error("Prometheus query failed"))).toBe("query_error");
  });
});
