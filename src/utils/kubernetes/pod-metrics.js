import { getKubernetes } from "utils/config/kubernetes";
import { fetchPodUsageFromMetricsServer } from "utils/kubernetes/metrics-server";
import { fetchPodUsageFromPrometheus } from "utils/kubernetes/prometheus";

export const POD_METRICS_METRICS_SERVER = "metricsServer";
export const POD_METRICS_PROMETHEUS = "prometheus";

export function getPodMetricsSettings() {
  const config = getKubernetes() ?? {};
  const provider = config.podMetrics ?? POD_METRICS_METRICS_SERVER;
  return {
    provider,
    prometheus: config.prometheus ?? {},
  };
}

/**
 * CPU/memory usage for pods, using metrics-server or Prometheus per kubernetes.yaml.
 */
export async function fetchPodUsage({ kc, namespace, podNames, logger }) {
  const { provider, prometheus } = getPodMetricsSettings();

  if (provider === POD_METRICS_PROMETHEUS) {
    const url = prometheus?.url;
    if (!url) {
      logger.error("kubernetes.yaml podMetrics is prometheus but prometheus.url is not set");
      return { cpu: 0, mem: 0 };
    }
    try {
      return await fetchPodUsageFromPrometheus({
        namespace,
        podNames,
        url,
        queryTimeoutMs: prometheus?.queryTimeoutMs,
      });
    } catch (err) {
      logger.error("Error querying Prometheus for pod usage: %s", err.message || err);
      return { cpu: 0, mem: 0 };
    }
  }

  if (provider !== POD_METRICS_METRICS_SERVER) {
    logger.error("kubernetes.yaml podMetrics %s is invalid; expected metricsServer or prometheus", provider);
    return { cpu: 0, mem: 0 };
  }

  return fetchPodUsageFromMetricsServer({ kc, namespace, podNames, logger });
}
