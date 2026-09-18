import http from "node:http";
import https from "node:https";

const DEFAULT_QUERY_TIMEOUT_MS = 15000;

/** Escape a pod name for use inside PromQL `pod=~"..."` alternation. */
export function escapePromRegexLiteral(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildPodNameRegex(podNames) {
  const names = [...new Set(podNames.filter(Boolean))];
  if (!names.length) {
    return null;
  }
  return names.map(escapePromRegexLiteral).join("|");
}

function promQueryUrl(baseUrl, query) {
  const url = new URL("/api/v1/query", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  url.searchParams.set("query", query);
  return url;
}

function httpGetJson(urlString, queryTimeoutMs = DEFAULT_QUERY_TIMEOUT_MS) {
  const url = new URL(urlString);
  const lib = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: { Accept: "application/json" },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Prometheus HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(new Error(`Prometheus JSON parse failed: ${err.message}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(queryTimeoutMs, () => {
      req.destroy(new Error(`Prometheus query timed out after ${queryTimeoutMs}ms`));
    });
    req.end();
  });
}

function scalarFromInstantResponse(payload) {
  if (payload?.status !== "success") {
    throw new Error(payload?.error || "Prometheus query failed");
  }
  const value = payload?.data?.result?.[0]?.value?.[1];
  if (value === undefined || value === null) {
    return 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export const PROMETHEUS_QUERY_RECORDING_RULES = "recordingRules";
export const PROMETHEUS_QUERY_CADVISOR = "cadvisor";

/**
 * PromQL for pod CPU/memory usage. Default `recordingRules` matches kube-prometheus
 * pre-aggregates and works against Thanos Query (raw cAdvisor + rate() is often empty or slow there).
 */
export function buildPodUsageQueries({ namespace, podRegex, queryMode = PROMETHEUS_QUERY_RECORDING_RULES }) {
  const podSelector = `{namespace="${escapePrometheusLabelValue(namespace)}",pod=~"${podRegex}"}`;

  if (queryMode === PROMETHEUS_QUERY_CADVISOR) {
    // kube-prometheus / mixin style: exclude pause; do not use container!="" (drops missing label).
    const cadvisorSelector = `{namespace="${escapePrometheusLabelValue(namespace)}",pod=~"${podRegex}",container!="POD",image!=""}`;
    return {
      cpuQuery: `sum(rate(container_cpu_usage_seconds_total${cadvisorSelector}[2m]))`,
      memQuery: `sum(container_memory_working_set_bytes${cadvisorSelector})`,
    };
  }

  return {
    cpuQuery: `sum(node_namespace_pod_container:container_cpu_usage_seconds_total:sum_irate${podSelector})`,
    memQuery: `sum(node_namespace_pod_container:container_memory_working_set_bytes${podSelector})`,
  };
}

/**
 * Sum CPU (cores) and memory (bytes) for pods selected by name in a namespace.
 */
export async function fetchPodUsageFromPrometheus({
  namespace,
  podNames,
  url,
  queryTimeoutMs,
  queryMode = PROMETHEUS_QUERY_RECORDING_RULES,
}) {
  if (!url) {
    throw new Error("prometheus url is required");
  }

  const timeoutMs = Number(queryTimeoutMs ?? DEFAULT_QUERY_TIMEOUT_MS);
  const podRegex = buildPodNameRegex(podNames);
  if (!podRegex) {
    return { cpu: 0, mem: 0 };
  }

  const { cpuQuery, memQuery } = buildPodUsageQueries({ namespace, podRegex, queryMode });

  const [cpuPayload, memPayload] = await Promise.all([
    httpGetJson(promQueryUrl(url, cpuQuery).href, timeoutMs),
    httpGetJson(promQueryUrl(url, memQuery).href, timeoutMs),
  ]);

  return {
    cpu: scalarFromInstantResponse(cpuPayload),
    mem: scalarFromInstantResponse(memPayload),
  };
}

/** Escape a label value for PromQL / metrics label matchers. */
export function escapePrometheusLabelValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
