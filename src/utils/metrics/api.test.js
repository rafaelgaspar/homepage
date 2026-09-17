import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { isMetricsEnabled, getHttpRequestDurationHistogram } = vi.hoisted(() => ({
  isMetricsEnabled: vi.fn(),
  getHttpRequestDurationHistogram: vi.fn(),
}));

vi.mock("./settings", () => ({
  isMetricsEnabled,
}));

vi.mock("utils/metrics/registry", () => ({
  getHttpRequestDurationHistogram,
}));

import { withApiMetrics } from "./api";

describe("utils/metrics/api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes through when metrics are disabled", async () => {
    isMetricsEnabled.mockReturnValue(false);
    const handler = vi.fn();
    const wrapped = withApiMetrics("/api/test", handler);

    await wrapped({ method: "GET" }, createMockRes());

    expect(handler).toHaveBeenCalled();
    expect(getHttpRequestDurationHistogram).not.toHaveBeenCalled();
  });

  it("observes duration on response finish when enabled", async () => {
    isMetricsEnabled.mockReturnValue(true);
    const observe = vi.fn();
    getHttpRequestDurationHistogram.mockReturnValue({ observe });

    const handler = vi.fn(async (_req, res) => {
      res.status(200).json({ ok: true });
    });
    const wrapped = withApiMetrics("/api/test", handler);
    const res = createMockRes();

    await wrapped({ method: "GET" }, res);
    if (typeof res._onFinish === "function") {
      res._onFinish();
    }

    expect(observe).toHaveBeenCalledWith({ method: "GET", route: "/api/test", status_code: "200" }, expect.any(Number));
  });
});
