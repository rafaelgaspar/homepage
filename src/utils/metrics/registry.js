import client from "prom-client";

const GLOBAL_STATE_KEY = "__homepagePrometheusMetricsState";

/** @returns {{ initialized: boolean, register: client.Registry, metrics: Record<string, import("prom-client").Metric<string>> }} */
function getGlobalMetricsState() {
  if (!globalThis[GLOBAL_STATE_KEY]) {
    globalThis[GLOBAL_STATE_KEY] = {
      initialized: false,
      register: new client.Registry(),
      metrics: {},
    };
  }
  return globalThis[GLOBAL_STATE_KEY];
}

export const HTTP_SLOW_REQUEST_THRESHOLD_SECONDS = 5;

function lazyMetric(key, factory) {
  const state = getGlobalMetricsState();
  getMetricsRegister();
  if (!state.metrics[key]) {
    state.metrics[key] = factory(state.register);
  }
  return state.metrics[key];
}

export function getMetricsRegister() {
  const state = getGlobalMetricsState();
  if (!state.initialized) {
    client.collectDefaultMetrics({ register: state.register });
    state.initialized = true;
  }
  return state.register;
}

export function getHttpRequestDurationHistogram() {
  return lazyMetric(
    "httpRequestDuration",
    (register) =>
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
  return lazyMetric(
    "httpRequestsTotal",
    (register) =>
      new client.Counter({
        name: "homepage_http_requests_total",
        help: "Total Homepage pages/api HTTP requests by status code",
        labelNames: ["method", "route", "status_code"],
        registers: [register],
      }),
  );
}

export function getHttpRequestsInFlightGauge() {
  return lazyMetric(
    "httpRequestsInFlight",
    (register) =>
      new client.Gauge({
        name: "homepage_http_requests_in_flight",
        help: "In-flight Homepage pages/api HTTP requests",
        labelNames: ["route"],
        registers: [register],
      }),
  );
}

export function getHttpResponseBytesHistogram() {
  return lazyMetric(
    "httpResponseBytes",
    (register) =>
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
  return lazyMetric(
    "httpSlowRequestsTotal",
    (register) =>
      new client.Counter({
        name: "homepage_http_slow_requests_total",
        help: "Homepage pages/api HTTP requests slower than 5 seconds",
        labelNames: ["method", "route", "status_code"],
        registers: [register],
      }),
  );
}

export function getKubernetesStatsRequestsCounter() {
  return lazyMetric(
    "kubernetesStatsRequestsTotal",
    (register) =>
      new client.Counter({
        name: "homepage_kubernetes_stats_requests_total",
        help: "Kubernetes stats API requests by outcome",
        labelNames: ["outcome"],
        registers: [register],
      }),
  );
}

export function getPrometheusQueryDurationHistogram() {
  return lazyMetric(
    "prometheusQueryDuration",
    (register) =>
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
  return lazyMetric(
    "prometheusQueryFailuresTotal",
    (register) =>
      new client.Counter({
        name: "homepage_prometheus_query_failures_total",
        help: "Failed Prometheus instant queries for pod usage",
        labelNames: ["reason"],
        registers: [register],
      }),
  );
}

export function getWidgetUpstreamDurationHistogram() {
  return lazyMetric(
    "widgetUpstreamDuration",
    (register) =>
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
  return lazyMetric(
    "widgetUpstreamErrorsTotal",
    (register) =>
      new client.Counter({
        name: "homepage_widget_upstream_errors_total",
        help: "Upstream HTTP errors from service widget proxies",
        labelNames: ["widget_type", "status_code"],
        registers: [register],
      }),
  );
}

export function getConfigReloadCounter() {
  return lazyMetric(
    "configReloadTotal",
    (register) =>
      new client.Counter({
        name: "homepage_config_reload_total",
        help: "Config file content changes detected on disk (e.g. ConfigMap remount)",
        labelNames: ["result"],
        registers: [register],
      }),
  );
}

export function getLiveStatusCacheEntriesGauge() {
  return lazyMetric(
    "liveStatusCacheEntries",
    (register) =>
      new client.Gauge({
        name: "homepage_live_status_cache_entries",
        help: "Fresh live-status cache entries by key prefix",
        labelNames: ["prefix"],
        registers: [register],
      }),
  );
}

export function getLiveStatusCacheEventsCounter() {
  return lazyMetric(
    "liveStatusCacheEventsTotal",
    (register) =>
      new client.Counter({
        name: "homepage_live_status_cache_events_total",
        help: "Live-status cache mutation events",
        labelNames: ["type", "prefix"],
        registers: [register],
      }),
  );
}

export function getLiveStatusSseConnectionsGauge() {
  return lazyMetric(
    "liveStatusSseConnections",
    (register) =>
      new client.Gauge({
        name: "homepage_live_status_sse_connections",
        help: "Open live-status SSE clients",
        registers: [register],
      }),
  );
}

export function getLiveStatusSseConnectsCounter() {
  return lazyMetric(
    "liveStatusSseConnectsTotal",
    (register) =>
      new client.Counter({
        name: "homepage_live_status_sse_connects_total",
        help: "Live-status SSE client connections",
        registers: [register],
      }),
  );
}

export function getLiveStatusSseDisconnectsCounter() {
  return lazyMetric(
    "liveStatusSseDisconnectsTotal",
    (register) =>
      new client.Counter({
        name: "homepage_live_status_sse_disconnects_total",
        help: "Live-status SSE client disconnects",
        registers: [register],
      }),
  );
}

export function getLiveStatusWatchesGauge() {
  return lazyMetric(
    "liveStatusWatches",
    (register) =>
      new client.Gauge({
        name: "homepage_live_status_watches",
        help: "Active live-status Kubernetes watches",
        labelNames: ["resource"],
        registers: [register],
      }),
  );
}

export function getLiveStatusWatchReconnectsCounter() {
  return lazyMetric(
    "liveStatusWatchReconnectsTotal",
    (register) =>
      new client.Counter({
        name: "homepage_live_status_watch_reconnects_total",
        help: "Live-status Kubernetes watch reconnects",
        labelNames: ["resource"],
        registers: [register],
      }),
  );
}

export function getLiveStatusK8sListDurationHistogram() {
  return lazyMetric(
    "liveStatusK8sListDuration",
    (register) =>
      new client.Histogram({
        name: "homepage_live_status_k8s_list_duration_seconds",
        help: "Duration of Kubernetes pod list calls for live status",
        buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 15],
        registers: [register],
      }),
  );
}

export function getLiveStatusK8sLookupsCounter() {
  return lazyMetric(
    "liveStatusK8sLookupsTotal",
    (register) =>
      new client.Counter({
        name: "homepage_live_status_k8s_lookups_total",
        help: "Kubernetes live-status lookups by cache outcome",
        labelNames: ["outcome"],
        registers: [register],
      }),
  );
}

export function getMcpProbeCounter() {
  return lazyMetric(
    "mcpProbeTotal",
    (register) =>
      new client.Counter({
        name: "homepage_mcp_probe_total",
        help: "MCP tools/list probe results",
        labelNames: ["service_id", "result"],
        registers: [register],
      }),
  );
}

export function getMcpProbeDurationHistogram() {
  return lazyMetric(
    "mcpProbeDuration",
    (register) =>
      new client.Histogram({
        name: "homepage_mcp_probe_duration_seconds",
        help: "MCP tools/list probe duration in seconds",
        labelNames: ["service_id"],
        buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 15, 30],
        registers: [register],
      }),
  );
}

export function getMcpOidcTokenCounter() {
  return lazyMetric(
    "mcpOidcTokenTotal",
    (register) =>
      new client.Counter({
        name: "homepage_mcp_oidc_token_total",
        help: "OIDC access-token fetches for MCP gateway probes",
        labelNames: ["result"],
        registers: [register],
      }),
  );
}

export function getMcpOidcTokenDurationHistogram() {
  return lazyMetric(
    "mcpOidcTokenDuration",
    (register) =>
      new client.Histogram({
        name: "homepage_mcp_oidc_token_duration_seconds",
        help: "Duration of OIDC access-token fetches for MCP gateway probes",
        buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 15],
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
  getWidgetUpstreamDurationHistogram();
  getWidgetUpstreamErrorsCounter();
  getConfigReloadCounter();
  getLiveStatusCacheEntriesGauge();
  getLiveStatusCacheEventsCounter();
  getLiveStatusSseConnectionsGauge();
  getLiveStatusSseConnectsCounter();
  getLiveStatusSseDisconnectsCounter();
  getLiveStatusWatchesGauge();
  getLiveStatusWatchReconnectsCounter();
  getLiveStatusK8sListDurationHistogram();
  getLiveStatusK8sLookupsCounter();
  getMcpProbeCounter();
  getMcpProbeDurationHistogram();
  getMcpOidcTokenCounter();
  getMcpOidcTokenDurationHistogram();
}

export async function renderMetrics() {
  return getMetricsRegister().metrics();
}

export function metricsContentType() {
  return getMetricsRegister().contentType;
}
