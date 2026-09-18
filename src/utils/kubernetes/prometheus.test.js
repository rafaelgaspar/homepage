import { describe, expect, it } from "vitest";

import {
  PROMETHEUS_QUERY_CADVISOR,
  PROMETHEUS_QUERY_RECORDING_RULES,
  buildPodNameRegex,
  buildPodUsageQueries,
  escapePromRegexLiteral,
  escapePrometheusLabelValue,
} from "./prometheus";

describe("utils/kubernetes/prometheus", () => {
  it("escapes regex metacharacters in pod names", () => {
    expect(escapePromRegexLiteral("pod.name+1")).toBe("pod\\.name\\+1");
  });

  it("escapes double quotes in prometheus label values", () => {
    expect(escapePrometheusLabelValue('ns"test')).toBe('ns\\"test');
  });

  it("builds alternation regex for multiple pods", () => {
    expect(buildPodNameRegex(["a", "b"])).toBe("a|b");
    expect(buildPodNameRegex(["a", "a", ""])).toBe("a");
    expect(buildPodNameRegex([])).toBeNull();
  });

  it("builds kube-prometheus recording rule queries by default", () => {
    const { cpuQuery, memQuery } = buildPodUsageQueries({
      namespace: "prometheus",
      podRegex: "mcp-1|mcp-2",
    });
    expect(cpuQuery).toBe(
      'sum(node_namespace_pod_container:container_cpu_usage_seconds_total:sum_irate{namespace="prometheus",pod=~"mcp-1|mcp-2"})',
    );
    expect(memQuery).toBe(
      'sum(node_namespace_pod_container:container_memory_working_set_bytes{namespace="prometheus",pod=~"mcp-1|mcp-2"})',
    );
  });

  it("builds cAdvisor queries without container!=\"\"", () => {
    const { cpuQuery, memQuery } = buildPodUsageQueries({
      namespace: "cilium",
      podRegex: "hubble-ui-.*",
      queryMode: PROMETHEUS_QUERY_CADVISOR,
    });
    expect(cpuQuery).toContain('container!="POD"');
    expect(cpuQuery).toContain('image!=""');
    expect(cpuQuery).not.toContain('container!=""');
    expect(memQuery).toContain('container_memory_working_set_bytes');
    expect(buildPodUsageQueries({ namespace: "x", podRegex: "y" }).cpuQuery).not.toContain(
      "container_cpu_usage_seconds_total",
    );
    expect(buildPodUsageQueries({ namespace: "x", podRegex: "y", queryMode: PROMETHEUS_QUERY_RECORDING_RULES }).cpuQuery).toContain(
      "sum_irate",
    );
    expect(buildPodUsageQueries({ namespace: "x", podRegex: "y", queryMode: PROMETHEUS_QUERY_CADVISOR }).cpuQuery).toContain(
      "rate(container_cpu",
    );
  });
});
