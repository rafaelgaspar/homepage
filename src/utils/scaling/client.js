import useSWR from "swr";

export const SCALING_LIST_KEY = "/api/scaling";

export function scalingItemKey(namespace, name) {
  if (!namespace || !name) {
    return null;
  }
  return `${SCALING_LIST_KEY}/${namespace}/${name}`;
}

/** Poll toggle state for a service card (namespace + app name). */
export function useServiceScaling(service) {
  const { data: items } = useSWR(SCALING_LIST_KEY, { refreshInterval: 30000 });
  const toggleItem = Array.isArray(items)
    ? items.find((entry) => entry.namespace === service.namespace && entry.name === service.app)
    : null;
  const itemKey = toggleItem ? scalingItemKey(service.namespace, service.app) : null;
  const { data: item } = useSWR(itemKey, { refreshInterval: 30000 });

  return {
    toggleItem,
    item,
    scaledIdle: Boolean(item && item.minReplicaCount === 0),
  };
}
