import { CustomObjectsApi } from "@kubernetes/client-node";

import { getKubeConfig } from "utils/config/kubernetes";
import { K3S_HOME_GROUP, K3S_HOME_VERSION } from "utils/k3s-home/constants";
import createLogger from "utils/logger";

const logger = createLogger("k3sHomeList");

export async function listClusterObjects(plural) {
  const kc = getKubeConfig();
  if (!kc) {
    return { items: [], missing: true };
  }

  const crd = kc.makeApiClient(CustomObjectsApi);
  try {
    const response = await crd.listClusterCustomObject({
      group: K3S_HOME_GROUP,
      version: K3S_HOME_VERSION,
      plural,
    });
    return { items: response?.items ?? [], missing: false };
  } catch (error) {
    if (error?.statusCode === 404) {
      return { items: [], missing: true };
    }
    logger.error("Error listing %s: %d %s %s", plural, error.statusCode, error.body, error.response);
    return { items: [], missing: false };
  }
}

export async function getClusterObject(plural, name) {
  const kc = getKubeConfig();
  if (!kc || !name) {
    return null;
  }

  const crd = kc.makeApiClient(CustomObjectsApi);
  try {
    return await crd.getClusterCustomObject({
      group: K3S_HOME_GROUP,
      version: K3S_HOME_VERSION,
      plural,
      name,
    });
  } catch (error) {
    if (error?.statusCode === 404) {
      return null;
    }
    logger.error("Error getting %s/%s: %d %s %s", plural, name, error.statusCode, error.body, error.response);
    return null;
  }
}
