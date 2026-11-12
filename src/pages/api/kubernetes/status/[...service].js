import { getKubeConfig } from "../../../../utils/config/kubernetes";
import createLogger from "../../../../utils/logger";

import { withAuth } from "utils/auth";
import { kubernetesProbeFromQuery } from "utils/kubernetes/status-probes";
import { getKubernetesStatus } from "utils/kubernetes/watch-manager";
import { withApiMetrics } from "utils/metrics/api";

const logger = createLogger("kubernetesStatusService");

async function handler(req, res) {
  const probe = kubernetesProbeFromQuery(req.query);
  if (!probe) {
    res.status(400).send({
      error: "kubernetes query parameters are required",
    });
    return;
  }

  try {
    const kc = getKubeConfig();
    if (!kc) {
      res.status(500).send({
        error: "No kubernetes configuration",
      });
      return;
    }

    const result = await getKubernetesStatus(probe);
    if (result?.error) {
      res.status(500).send({
        error: result.error,
      });
      return;
    }

    const status = result?.status ?? "not found";
    if (status === "not found") {
      res.status(404).send({
        status: "not found",
      });
      return;
    }

    res.status(200).json({
      status,
    });
  } catch (e) {
    if (e) logger.error(e);
    res.status(500).send({
      error: "unknown error",
    });
  }
}

export default withAuth(withApiMetrics("/api/kubernetes/status/[...service]", handler));
