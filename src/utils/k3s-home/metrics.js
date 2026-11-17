import { getPodMetricsSettings } from "utils/kubernetes/pod-metrics";
import { escapePrometheusLabelValue, queryPrometheusInstant } from "utils/kubernetes/prometheus";
import { NODE_EXPORTER_JOB, NODE_EXPORTER_PORT } from "utils/k3s-home/constants";
import createLogger from "utils/logger";

const logger = createLogger("k3sHomeMetrics");

const EMPTY_USAGE = { cpu: null, memory: null };

export function nodeExporterSelector(ip) {
  const instance = escapePrometheusLabelValue(`${ip}:${NODE_EXPORTER_PORT}`);
  return `job="${NODE_EXPORTER_JOB}",instance="${instance}"`;
}

export function nodeUsageQueries(ip) {
  const selector = nodeExporterSelector(ip);
  return {
    cpu: `sum(rate(node_cpu_seconds_total{${selector},mode!="idle"}[5m]))`,
    memory: `node_memory_MemTotal_bytes{${selector}} - node_memory_MemAvailable_bytes{${selector}}`,
    up: `max(up{${selector}})`,
  };
}

/**
 * CPU in cores and memory in bytes for a node, plus whether node-exporter is up.
 * Missing Prometheus config or a failed query yields nulls.
 */
export async function fetchNodeSample(ip) {
  const empty = { usage: { ...EMPTY_USAGE }, up: null };
  if (!ip) {
    return empty;
  }

  let url;
  let queryTimeoutMs;
  try {
    const settings = getPodMetricsSettings();
    url = settings?.prometheus?.url;
    queryTimeoutMs = settings?.prometheus?.queryTimeoutMs;
  } catch (err) {
    logger.error("kubernetes prometheus settings unavailable: %s", err?.message || err);
    return empty;
  }
  if (!url) {
    return empty;
  }

  const queries = nodeUsageQueries(ip);
  try {
    const [cpu, memory, up] = await Promise.all([
      queryPrometheusInstant(url, queries.cpu, queryTimeoutMs),
      queryPrometheusInstant(url, queries.memory, queryTimeoutMs),
      queryPrometheusInstant(url, queries.up, queryTimeoutMs),
    ]);
    return { usage: { cpu, memory }, up };
  } catch (err) {
    logger.error("node metrics query failed for %s: %s", ip, err?.message || err);
    return empty;
  }
}
