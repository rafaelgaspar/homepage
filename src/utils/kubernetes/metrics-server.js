import { Metrics } from "@kubernetes/client-node";

import { parseCpu, parseMemory } from "utils/kubernetes/utils";

/**
 * Sum CPU (cores) and memory (bytes) from metrics.k8s.io for the given pod names.
 */
export async function fetchPodUsageFromMetricsServer({ kc, namespace, podNames, logger }) {
  const podNameSet = new Set(podNames);
  const metricsApi = new Metrics(kc);

  const namespaceMetrics = await metricsApi
    .getPodMetrics(namespace)
    .then((response) => response.items)
    .catch((err) => {
      // 404 generally means that the metrics have not been populated yet
      if (err.statusCode !== 404) {
        logger.error("Error getting pod metrics: %d %s %s", err.statusCode, err.body, err.response);
      }
      return null;
    });

  const stats = { mem: 0, cpu: 0 };

  if (!namespaceMetrics) {
    return stats;
  }

  const podMetrics = namespaceMetrics.filter((item) => podNameSet.has(item.metadata.name));
  podMetrics.forEach((metrics) => {
    metrics.containers.forEach((container) => {
      stats.mem += parseMemory(container.usage.memory);
      stats.cpu += parseCpu(container.usage.cpu);
    });
  });

  return stats;
}
