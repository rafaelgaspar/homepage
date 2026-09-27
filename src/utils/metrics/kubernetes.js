import { isMetricsEnabled } from "./settings";

export function recordKubernetesStatsRequest(outcome) {
  if (!isMetricsEnabled()) {
    return;
  }
  void import("./registry").then(({ getKubernetesStatsRequestsCounter }) => {
    getKubernetesStatsRequestsCounter().inc({ outcome });
  });
}

export function observePrometheusQueryDuration(seconds, target = "prometheus") {
  if (!isMetricsEnabled()) {
    return;
  }
  void import("./registry").then(({ getPrometheusQueryDurationHistogram }) => {
    getPrometheusQueryDurationHistogram().observe({ target }, seconds);
  });
}

export function recordPrometheusQueryFailure(reason) {
  if (!isMetricsEnabled()) {
    return;
  }
  void import("./registry").then(({ getPrometheusQueryFailuresCounter }) => {
    getPrometheusQueryFailuresCounter().inc({ reason });
  });
}

/** @param {Error | string} err */
export function classifyPrometheusQueryFailure(err) {
  const message = String(err?.message ?? err ?? "unknown").toLowerCase();
  if (message.includes("timed out") || message.includes("timeout")) {
    return "timeout";
  }
  if (message.includes("http")) {
    return "http_error";
  }
  if (message.includes("json") || message.includes("parse")) {
    return "parse_error";
  }
  if (message.includes("prometheus query failed") || message.includes("query failed")) {
    return "query_error";
  }
  return "other";
}
