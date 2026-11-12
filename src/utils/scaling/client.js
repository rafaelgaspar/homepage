import { useLiveStatus } from "utils/live-status/client";
import { scalingCacheKey } from "utils/scaling/keys";

export const SCALING_LIST_KEY = "/api/scaling";

export function scalingItemKey(namespace, name) {
  if (!namespace || !name) {
    return null;
  }
  return `${SCALING_LIST_KEY}/${namespace}/${name}`;
}

function isToggleableItem(item) {
  return Boolean(item && Number.isInteger(item.minReplicaCount));
}

/** Live ScaledObject toggle state for a service card (namespace + app name). */
export function useServiceScaling(service) {
  const key = scalingCacheKey(service?.namespace, service?.app);
  const { data: item, error } = useLiveStatus(key);
  const valid = isToggleableItem(item);

  return {
    toggleItem: valid ? item : null,
    item: valid ? item : undefined,
    scaledIdle: Boolean(valid && item.minReplicaCount === 0),
    error,
  };
}
