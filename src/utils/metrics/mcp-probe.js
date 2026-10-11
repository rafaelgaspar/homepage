import { isMetricsEnabled } from "./settings";

/** @param {string} message */
export function classifyMcpProbeFailure(message) {
  const msg = String(message ?? "").toLowerCase();
  if (msg.includes("timeout")) {
    return "timeout";
  }
  if (msg.includes("missing env") || msg.includes("unauthorized") || msg.includes("401") || msg.includes("403")) {
    return "auth";
  }
  if (msg.includes("tools/list")) {
    return "tools_error";
  }
  if (msg.includes("http")) {
    return "http_error";
  }
  return "other";
}

/**
 * @param {{ id: string, ok: boolean, latencyMs?: number | null, error?: string }} result
 */
export function recordMcpProbeResult(result) {
  if (!isMetricsEnabled() || !result?.id) {
    return;
  }

  void import("./registry").then(({ getMcpProbeCounter, getMcpProbeDurationHistogram }) => {
    const serviceId = result.id;
    if (result.ok) {
      getMcpProbeCounter().inc({ service_id: serviceId, result: "ok" });
      if (typeof result.latencyMs === "number" && Number.isFinite(result.latencyMs)) {
        getMcpProbeDurationHistogram().observe({ service_id: serviceId }, result.latencyMs / 1000);
      }
      return;
    }

    const resultLabel = classifyMcpProbeFailure(result.error);
    getMcpProbeCounter().inc({ service_id: serviceId, result: resultLabel });
  });
}
