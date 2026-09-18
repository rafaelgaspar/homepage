import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const mocks = vi.hoisted(() => ({
  isMetricsEnabled: vi.fn(),
  getHttpRequestDurationHistogram: vi.fn(),
  getHttpRequestsCounter: vi.fn(),
  getHttpRequestsInFlightGauge: vi.fn(),
  getHttpResponseBytesHistogram: vi.fn(),
  getHttpSlowRequestsCounter: vi.fn(),
}));

vi.mock("./settings", () => ({
  isMetricsEnabled: mocks.isMetricsEnabled,
}));

vi.mock("./registry", () => ({
  HTTP_SLOW_REQUEST_THRESHOLD_SECONDS: 5,
  getHttpRequestDurationHistogram: mocks.getHttpRequestDurationHistogram,
  getHttpRequestsCounter: mocks.getHttpRequestsCounter,
  getHttpRequestsInFlightGauge: mocks.getHttpRequestsInFlightGauge,
  getHttpResponseBytesHistogram: mocks.getHttpResponseBytesHistogram,
  getHttpSlowRequestsCounter: mocks.getHttpSlowRequestsCounter,
}));

import { withApiMetrics } from "./api";

describe("utils/metrics/api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isMetricsEnabled.mockReturnValue(true);
    mocks.getHttpRequestDurationHistogram.mockReturnValue({ observe: vi.fn() });
    mocks.getHttpRequestsCounter.mockReturnValue({ inc: vi.fn() });
    mocks.getHttpRequestsInFlightGauge.mockReturnValue({ inc: vi.fn(), dec: vi.fn() });
    mocks.getHttpResponseBytesHistogram.mockReturnValue({ observe: vi.fn() });
    mocks.getHttpSlowRequestsCounter.mockReturnValue({ inc: vi.fn() });
  });

  it("passes through when metrics are disabled", async () => {
    mocks.isMetricsEnabled.mockReturnValue(false);
    const handler = vi.fn();
    const wrapped = withApiMetrics("/api/test", handler);

    await wrapped({ method: "GET" }, createMockRes());

    expect(handler).toHaveBeenCalled();
    expect(mocks.getHttpRequestsCounter).not.toHaveBeenCalled();
  });

  it("skips metrics for the healthcheck route even when enabled", async () => {
    const handler = vi.fn();
    const wrapped = withApiMetrics("/api/healthcheck", handler);

    await wrapped({ method: "GET" }, createMockRes());

    expect(handler).toHaveBeenCalled();
    expect(mocks.getHttpRequestsCounter).not.toHaveBeenCalled();
  });

  it("records request count, duration, bytes, and in-flight on finish", async () => {
    const observe = vi.fn();
    const requestInc = vi.fn();
    const inFlightInc = vi.fn();
    const inFlightDec = vi.fn();
    const bytesObserve = vi.fn();
    mocks.getHttpRequestDurationHistogram.mockReturnValue({ observe });
    mocks.getHttpRequestsCounter.mockReturnValue({ inc: requestInc });
    mocks.getHttpRequestsInFlightGauge.mockReturnValue({ inc: inFlightInc, dec: inFlightDec });
    mocks.getHttpResponseBytesHistogram.mockReturnValue({ observe: bytesObserve });

    const handler = vi.fn(async (_req, res) => {
      res.status(503).end("error");
    });
    const wrapped = withApiMetrics("/api/test", handler);
    const res = createMockRes();

    await wrapped({ method: "POST" }, res);
    if (typeof res._onFinish === "function") {
      res._onFinish();
    }

    const labels = { method: "POST", route: "/api/test", status_code: "503" };
    expect(inFlightInc).toHaveBeenCalledWith({ route: "/api/test" });
    expect(inFlightDec).toHaveBeenCalledWith({ route: "/api/test" });
    expect(requestInc).toHaveBeenCalledWith(labels);
    expect(observe).toHaveBeenCalledWith(labels, expect.any(Number));
    expect(bytesObserve).toHaveBeenCalledWith(labels, expect.any(Number));
  });
});
