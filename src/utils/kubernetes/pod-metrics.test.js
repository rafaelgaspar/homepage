import { beforeEach, describe, expect, it, vi } from "vitest";

const { getKubernetes, fetchPodUsageFromMetricsServer, fetchPodUsageFromPrometheus, logger } = vi.hoisted(() => ({
  getKubernetes: vi.fn(),
  fetchPodUsageFromMetricsServer: vi.fn(),
  fetchPodUsageFromPrometheus: vi.fn(),
  logger: { error: vi.fn() },
}));

vi.mock("utils/config/kubernetes", () => ({
  getKubernetes,
}));

vi.mock("utils/kubernetes/metrics-server", () => ({
  fetchPodUsageFromMetricsServer,
}));

vi.mock("utils/kubernetes/prometheus", () => ({
  fetchPodUsageFromPrometheus,
}));

import { fetchPodUsage, POD_METRICS_PROMETHEUS } from "./pod-metrics";

describe("utils/kubernetes/pod-metrics", () => {
  const kc = {};
  const namespace = "default";
  const podNames = ["pod-a"];

  beforeEach(() => {
    vi.clearAllMocks();
    getKubernetes.mockReturnValue({ mode: "cluster" });
    fetchPodUsageFromMetricsServer.mockResolvedValue({ cpu: 0.1, mem: 100 });
    fetchPodUsageFromPrometheus.mockResolvedValue({ cpu: 0.2, mem: 200 });
  });

  it("uses metrics-server by default", async () => {
    const usage = await fetchPodUsage({ kc, namespace, podNames, logger });

    expect(fetchPodUsageFromMetricsServer).toHaveBeenCalledWith({ kc, namespace, podNames, logger });
    expect(fetchPodUsageFromPrometheus).not.toHaveBeenCalled();
    expect(usage).toEqual({ cpu: 0.1, mem: 100 });
  });

  it("uses Prometheus when podMetrics is prometheus and url is set", async () => {
    getKubernetes.mockReturnValue({
      podMetrics: POD_METRICS_PROMETHEUS,
      prometheus: { url: "http://prom.example:9090", queryTimeoutMs: 5000 },
    });

    const usage = await fetchPodUsage({ kc, namespace, podNames, logger });

    expect(fetchPodUsageFromPrometheus).toHaveBeenCalledWith({
      namespace,
      podNames,
      url: "http://prom.example:9090",
      queryTimeoutMs: 5000,
    });
    expect(fetchPodUsageFromMetricsServer).not.toHaveBeenCalled();
    expect(usage).toEqual({ cpu: 0.2, mem: 200 });
  });

  it("returns zero usage when prometheus is selected without url", async () => {
    getKubernetes.mockReturnValue({ podMetrics: POD_METRICS_PROMETHEUS });

    const usage = await fetchPodUsage({ kc, namespace, podNames, logger });

    expect(logger.error).toHaveBeenCalled();
    expect(usage).toEqual({ cpu: 0, mem: 0 });
  });

  it("returns zero usage when prometheus query fails", async () => {
    getKubernetes.mockReturnValue({
      podMetrics: POD_METRICS_PROMETHEUS,
      prometheus: { url: "http://prom.example:9090" },
    });
    fetchPodUsageFromPrometheus.mockRejectedValue(new Error("down"));

    const usage = await fetchPodUsage({ kc, namespace, podNames, logger });

    expect(logger.error).toHaveBeenCalled();
    expect(usage).toEqual({ cpu: 0, mem: 0 });
  });
});
