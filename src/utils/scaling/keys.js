export const SCALING_CACHE_PREFIX = "scaling:";

export function scalingCacheKey(namespace, name) {
  if (!namespace || !name) {
    return null;
  }
  return `${SCALING_CACHE_PREFIX}${namespace}/${name}`;
}

export function parseScalingCacheKey(key) {
  if (typeof key !== "string" || !key.startsWith(SCALING_CACHE_PREFIX)) {
    return null;
  }
  const rest = key.slice(SCALING_CACHE_PREFIX.length);
  const slash = rest.indexOf("/");
  if (slash < 0) {
    return null;
  }
  return {
    namespace: rest.slice(0, slash),
    name: rest.slice(slash + 1),
  };
}
