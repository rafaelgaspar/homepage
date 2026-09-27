import client from "prom-client";

let initialized = false;
const register = new client.Registry();

/** @type {Record<string, import("prom-client").Metric<string>>} */
const metrics = {};

export const HTTP_SLOW_REQUEST_THRESHOLD_SECONDS = 5;

function lazyMetric(key, factory) {
  getMetricsRegister();
  if (!metrics[key]) {
    metrics[key] = factory();
  }
  return metrics[key];
}

export function getMetricsRegister() {
  if (!initialized) {
    client.collectDefaultMetrics({ register });
    initialized = true;
  }
  return register;
}

export function getHttpRequestDurationHistogram() {
  return lazyMetric("httpRequestDuration", () =>
    new client.Histogram({
      name: "homepage_http_request_duration_seconds",
      help: "Duration of Homepage pages/api HTTP requests in seconds",
      labelNames: ["method", "route", "status_code"],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
      registers: [register],
    }),
  );
}

export function getHttpRequestsCounter() {
  return lazyMetric("httpRequestsTotal", () =>
    new client.Counter({
      name: "homepage_http_requests_total",
      help: "Total Homepage pages/api HTTP requests by status code",
      labelNames: ["method", "route", "status_code"],
      registers: [register],
    }),
  );
}

export function getHttpRequestsInFlightGauge() {
  return lazyMetric("httpRequestsInFlight", () =>
    new client.Gauge({
      name: "homepage_http_requests_in_flight",
      help: "In-flight Homepage pages/api HTTP requests",
      labelNames: ["route"],
      registers: [register],
    }),
  );
}

export function getHttpResponseBytesHistogram() {
  return lazyMetric("httpResponseBytes", () =>
    new client.Histogram({
      name: "homepage_http_response_bytes",
      help: "Size of Homepage pages/api HTTP response bodies in bytes",
      labelNames: ["method", "route", "status_code"],
      buckets: [256, 1024, 4096, 16384, 65536, 262144, 1048576, 4194304],
      registers: [register],
    }),
  );
}

export function getHttpSlowRequestsCounter() {
  return lazyMetric("httpSlowRequestsTotal", () =>
    new client.Counter({
      name: "homepage_http_slow_requests_total",
      help: "Homepage pages/api HTTP requests slower than 5 seconds",
      labelNames: ["method", "route", "status_code"],
      registers: [register],
    }),
  );
}

export function getKubernetesStatsRequestsCounter() {
  return lazyMetric("kubernetesStatsRequestsTotal", () =>
    new client.Counter({
      name: "homepage_kubernetes_stats_requests_total",
      help: "Kubernetes stats API requests by outcome",
      labelNames: ["outcome"],
      registers: [register],
    }),
  );
}

export function getPrometheusQueryDurationHistogram() {
  return lazyMetric("prometheusQueryDuration", () =>
    new client.Histogram({
      name: "homepage_prometheus_query_duration_seconds",
      help: "Duration of Prometheus instant queries for pod usage",
      labelNames: ["target"],
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 15],
      registers: [register],
    }),
  );
}

export function getPrometheusQueryFailuresCounter() {
  return lazyMetric("prometheusQueryFailuresTotal", () =>
    new client.Counter({
      name: "homepage_prometheus_query_failures_total",
      help: "Failed Prometheus instant queries for pod usage",
      labelNames: ["reason"],
      registers: [register],
    }),
  );
}

export function getMcpProbeCounter() {
  return lazyMetric("mcpProbeTotal", () =>
    new client.Counter({
      name: "homepage_mcp_probe_total",
      help: "MCP tools/list probe results",
      labelNames: ["service_id", "result"],
      registers: [register],
    }),
  );
}

export function getMcpProbeDurationHistogram() {
  return lazyMetric("mcpProbeDuration", () =>
    new client.Histogram({
      name: "homepage_mcp_probe_duration_seconds",
      help: "MCP tools/list probe duration in seconds",
      labelNames: ["service_id"],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 15, 30],
      registers: [register],
    }),
  );
}

export function getWidgetUpstreamDurationHistogram() {
  return lazyMetric("widgetUpstreamDuration", () =>
    new client.Histogram({
      name: "homepage_widget_upstream_duration_seconds",
      help: "Duration of upstream HTTP calls from service widget proxies",
      labelNames: ["widget_type"],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
      registers: [register],
    }),
  );
}

export function getWidgetUpstreamErrorsCounter() {
  return lazyMetric("widgetUpstreamErrorsTotal", () =>
    new client.Counter({
      name: "homepage_widget_upstream_errors_total",
      help: "Upstream HTTP errors from service widget proxies",
      labelNames: ["widget_type", "status_code"],
      registers: [register],
    }),
  );
}

export function getConfigReloadCounter() {
  return lazyMetric("configReloadTotal", () =>
    new client.Counter({
      name: "homepage_config_reload_total",
      help: "Config file content changes detected on disk (e.g. ConfigMap remount)",
      labelNames: ["result"],
      registers: [register],
    }),
  );
}

/** Register app metrics so /metrics exposes HELP/TYPE before first use. */
export function registerAppMetrics() {
  getHttpRequestDurationHistogram();
  getHttpRequestsCounter();
  getHttpRequestsInFlightGauge();
  getHttpResponseBytesHistogram();
  getHttpSlowRequestsCounter();
  getKubernetesStatsRequestsCounter();
  getPrometheusQueryDurationHistogram();
  getPrometheusQueryFailuresCounter();
  getMcpProbeCounter();
  getMcpProbeDurationHistogram();
  getWidgetUpstreamDurationHistogram();
  getWidgetUpstreamErrorsCounter();
  getConfigReloadCounter();
}

export async function renderMetrics() {
  return getMetricsRegister().metrics();
}

export function metricsContentType() {
  return getMetricsRegister().contentType;
}
