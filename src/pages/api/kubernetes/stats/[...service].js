import { CoreV1Api } from "@kubernetes/client-node";

import { getKubeConfig } from "utils/config/kubernetes";
import { fetchPodUsage } from "utils/kubernetes/pod-metrics";
import { parseCpu, parseMemory } from "utils/kubernetes/utils";
import createLogger from "utils/logger";

const logger = createLogger("kubernetesStatsService");

export default async function handler(req, res) {
  const APP_LABEL = "app.kubernetes.io/name";
  const { service, podSelector } = req.query;

  const [namespace, appName] = service;
  if (!namespace && !appName) {
    res.status(400).send({
      error: "kubernetes query parameters are required",
    });
    return;
  }
  const labelSelector = podSelector !== undefined ? podSelector : `${APP_LABEL}=${appName}`;

  try {
    const kc = getKubeConfig();
    if (!kc) {
      res.status(500).send({
        error: "No kubernetes configuration",
      });
      return;
    }
    const coreApi = kc.makeApiClient(CoreV1Api);
    const podsResponse = await coreApi
      .listNamespacedPod({
        namespace,
        labelSelector,
      })
      .catch((err) => {
        logger.error("Error getting pods: %d %s %s", err.statusCode, err.body, err.response);
        return null;
      });
    if (!podsResponse) {
      res.status(500).send({
        error: "Error communicating with kubernetes",
      });
      return;
    }
    const pods = podsResponse.items;

    if (pods.length === 0) {
      res.status(404).send({
        error: `no pods found with namespace=${namespace} and labelSelector=${labelSelector}`,
      });
      return;
    }

    const podNames = [];
    let cpuLimit = 0;
    let memLimit = 0;
    pods.forEach((pod) => {
      podNames.push(pod.metadata.name);
      pod.spec.containers.forEach((container) => {
        if (container?.resources?.limits?.cpu) {
          cpuLimit += parseCpu(container?.resources?.limits?.cpu);
        }
        if (container?.resources?.limits?.memory) {
          memLimit += parseMemory(container?.resources?.limits?.memory);
        }
      });
    });

    const usage = await fetchPodUsage({ kc, namespace, podNames, logger });

    const stats = {
      mem: usage.mem,
      cpu: usage.cpu,
      cpuLimit,
      memLimit,
      cpuUsage: cpuLimit ? 100 * (usage.cpu / cpuLimit) : 0,
      memUsage: memLimit ? 100 * (usage.mem / memLimit) : 0,
    };

    res.status(200).json({
      stats,
    });
  } catch (e) {
    if (e) logger.error(e);
    res.status(500).send({
      error: "unknown error",
    });
  }
}
