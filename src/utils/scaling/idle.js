import { liveStatusCache } from "utils/live-status/cache";
import { scalingCacheKey } from "utils/scaling/keys";

export function isScaledIdle(namespace, name) {
  if (!namespace || !name) {
    return false;
  }
  const item = liveStatusCache.get(scalingCacheKey(namespace, name));
  return Boolean(item && item.minReplicaCount === 0);
}
