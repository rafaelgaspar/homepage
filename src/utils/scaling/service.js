import { refreshKubernetesIdle } from "utils/kubernetes/watch-manager";
import { liveStatusCache } from "utils/live-status/cache";
import { parseScalingCacheKey, scalingCacheKey } from "utils/scaling/keys";
import { kubeRequest } from "utils/scaling/kube";
import { isScalingHydrated, markScalingHydrated } from "utils/scaling/store";

export const HOMEPAGE_TOGGLE_LABEL = "scaling.rafaelgaspar.xyz/homepage-toggle";
export const HOMEPAGE_TOGGLE_SELECTOR = `${HOMEPAGE_TOGGLE_LABEL}=true`;
export const KEDA_GROUP = "keda.sh";
export const KEDA_VERSION = "v1alpha1";
export const KEDA_PLURAL = "scaledobjects";

const ALWAYS_ON_ANNOTATIONS = {
  "autoscaling.keda.sh/force-activation": "true",
  "autoscaling.keda.sh/paused-scale-in": "true",
};

const CLEAR_ALWAYS_ON_ANNOTATIONS = {
  "autoscaling.keda.sh/force-activation": null,
  "autoscaling.keda.sh/paused-scale-in": null,
  "autoscaling.keda.sh/paused": null,
  "autoscaling.keda.sh/paused-replicas": null,
};

export function mapScaledObject(item) {
  return {
    namespace: item.metadata.namespace,
    name: item.metadata.name,
    minReplicaCount: item.spec?.minReplicaCount ?? 0,
    scaleTargetRef: item.spec?.scaleTargetRef?.name ?? item.metadata.name,
  };
}

export function publishMapped(mapped) {
  liveStatusCache.set(scalingCacheKey(mapped.namespace, mapped.name), mapped);
  refreshKubernetesIdle(mapped.namespace, mapped.name);
  return mapped;
}

export function unpublishToggleable(namespace, name) {
  liveStatusCache.delete(scalingCacheKey(namespace, name));
  refreshKubernetesIdle(namespace, name);
}

export function listCachedToggleable() {
  return Object.values(liveStatusCache.snapshot({ prefix: "scaling:" }));
}

export async function fetchToggleableList() {
  const query = `labelSelector=${encodeURIComponent(HOMEPAGE_TOGGLE_SELECTOR)}`;
  const data = await kubeRequest("GET", `/apis/${KEDA_GROUP}/${KEDA_VERSION}/${KEDA_PLURAL}?${query}`);
  return (data.items || []).map(mapScaledObject);
}

export async function hydrateToggleableList() {
  const items = await fetchToggleableList();
  const seen = new Set(items.map((item) => scalingCacheKey(item.namespace, item.name)));
  items.forEach(publishMapped);
  for (const key of Object.keys(liveStatusCache.snapshot({ prefix: "scaling:" }))) {
    if (!seen.has(key)) {
      const parsed = parseScalingCacheKey(key);
      if (parsed) {
        unpublishToggleable(parsed.namespace, parsed.name);
      }
    }
  }
  markScalingHydrated();
  return items;
}

export async function listToggleable() {
  const cached = listCachedToggleable();
  if (isScalingHydrated() || cached.length) {
    return cached;
  }
  return hydrateToggleableList();
}

export async function getToggleable(namespace, name) {
  const cached = liveStatusCache.get(scalingCacheKey(namespace, name));
  if (cached) {
    return cached;
  }
  const item = await kubeRequest(
    "GET",
    `/apis/${KEDA_GROUP}/${KEDA_VERSION}/namespaces/${namespace}/${KEDA_PLURAL}/${name}`,
  );
  if (item.metadata?.labels?.[HOMEPAGE_TOGGLE_LABEL] !== "true") {
    throw new Error("ScaledObject is not homepage-toggleable");
  }
  return publishMapped(mapScaledObject(item));
}

async function scaleDeployment(namespace, name, replicas) {
  return kubeRequest("PATCH", `/apis/apps/v1/namespaces/${namespace}/deployments/${name}/scale`, {
    spec: { replicas },
  });
}

async function applyToggleState(namespace, name, item, minReplicaCount, options) {
  const deployment = item.scaleTargetRef ?? name;
  const soPath = `/apis/${KEDA_GROUP}/${KEDA_VERSION}/namespaces/${namespace}/${KEDA_PLURAL}/${name}`;

  if (minReplicaCount === 1) {
    await kubeRequest("PATCH", soPath, {
      spec: { minReplicaCount: 1 },
      metadata: { annotations: ALWAYS_ON_ANNOTATIONS },
    });
    await scaleDeployment(namespace, deployment, 1);
    return;
  }

  await kubeRequest("PATCH", soPath, {
    metadata: { annotations: CLEAR_ALWAYS_ON_ANNOTATIONS },
  });
  await kubeRequest("PATCH", soPath, {
    spec: { minReplicaCount: 0 },
  });
  if (options?.scaleDown) {
    await scaleDeployment(namespace, deployment, 0);
  }
}

export async function setToggleState(namespace, name, { minReplicaCount, scaleDown = false } = {}) {
  const item = await getToggleable(namespace, name);
  let next = item.minReplicaCount === 0 ? 1 : 0;
  if (minReplicaCount !== undefined && minReplicaCount !== null) {
    next = Number(minReplicaCount);
    if (!Number.isInteger(next) || next < 0 || next > 1) {
      throw new Error("minReplicaCount must be 0 or 1");
    }
  }
  await applyToggleState(namespace, name, item, next, { scaleDown });
  return publishMapped({
    ...item,
    minReplicaCount: next,
  });
}
