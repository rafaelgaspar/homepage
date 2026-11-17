import { getKubernetes } from "utils/config/kubernetes";
import {
  DEFAULT_MAINTENANCE_GROUP,
  DEFAULT_NODE_ICON,
  DEFAULT_NODES_GROUP,
  DEFAULT_SCHEDULE_ICON,
} from "utils/k3s-home/constants";

export function getK3sHomeConfig() {
  const kube = getKubernetes();
  if (!kube || kube.mode === "disabled") {
    return { enabled: false };
  }

  const raw = kube.k3sHome;
  if (raw === false) {
    return { enabled: false };
  }

  const options = raw && typeof raw === "object" ? raw : {};
  if (options.enabled === false) {
    return { enabled: false };
  }

  return {
    enabled: true,
    nodesGroup: options.nodes?.group ?? DEFAULT_NODES_GROUP,
    nodesIcon: options.nodes?.icon ?? DEFAULT_NODE_ICON,
    maintenanceGroup: options.maintenance?.group ?? DEFAULT_MAINTENANCE_GROUP,
    maintenanceIcon: options.maintenance?.icon ?? DEFAULT_SCHEDULE_ICON,
  };
}
