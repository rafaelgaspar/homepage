import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPodMetricsSettings, queryPrometheusInstant } = vi.hoisted(() => ({
  getPodMetricsSettings: vi.fn(),
  queryPrometheusInstant: vi.fn(),
}));

vi.mock("utils/kubernetes/pod-metrics", () => ({
  getPodMetricsSettings,
}));

vi.mock("utils/kubernetes/prometheus", () => ({
  getPodMetricsSettings,
  escapePrometheusLabelValue: (value) => String(value),
  queryPrometheusInstant,
}));

vi.mock("utils/logger", () => ({
  default: () => ({ error: vi.fn() }),
}));

import { fetchNodeSample, nodeUsageQueries } from "./metrics";

describe("k3s-home node metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries node-exporter cpu, memory, and up for the node ip", () => {
    const queries = nodeUsageQueries("192.168.2.44");
    expect(queries.cpu).toContain('instance="192.168.2.44:9100"');
    expect(queries.cpu).toContain('mode!="idle"');
    expect(queries.cpu).toContain("sum(rate(");
    expect(queries.memory).toContain("node_memory_MemTotal_bytes");
    expect(queries.memory).toContain("node_memory_MemAvailable_bytes");
    expect(queries.memory).not.toContain("100 *");
    expect(queries.up).toContain('job="node-exporter"');
  });

  it("returns cpu cores and memory bytes", async () => {
    getPodMetricsSettings.mockReturnValue({ prometheus: { url: "http://prometheus:9090" } });
    queryPrometheusInstant.mockImplementation(async (_url, query) => {
      if (query.includes("node_cpu")) return 1.25;
      if (query.includes("MemTotal")) return 8 * 1024 ** 3;
      return 1;
    });

    await expect(fetchNodeSample("192.168.2.44")).resolves.toEqual({
      usage: { cpu: 1.25, memory: 8 * 1024 ** 3 },
      up: 1,
    });
  });

  it("returns nulls when prometheus is not configured", async () => {
    getPodMetricsSettings.mockReturnValue({ prometheus: {} });
    await expect(fetchNodeSample("192.168.2.44")).resolves.toEqual({
      usage: { cpu: null, memory: null },
      up: null,
    });
    expect(queryPrometheusInstant).not.toHaveBeenCalled();
  });
});
