import { K3S_HOME_CACHE_PREFIX, NODE_KIND, SCHEDULE_KIND } from "utils/k3s-home/constants";

export function k3sHomeCacheKey(kind, name) {
  if (!kind || !name) {
    return null;
  }
  return `${K3S_HOME_CACHE_PREFIX}${kind}:${name}`;
}

export function k3sHomeStatusUrl(kind, name) {
  if (!kind || !name) {
    return null;
  }
  return `/api/k3s-home/${encodeURIComponent(kind)}/${encodeURIComponent(name)}`;
}

export function parseK3sHomeCacheKey(key) {
  if (typeof key !== "string" || !key.startsWith(K3S_HOME_CACHE_PREFIX)) {
    return null;
  }
  const rest = key.slice(K3S_HOME_CACHE_PREFIX.length);
  const split = rest.indexOf(":");
  if (split < 1) {
    return null;
  }
  const kind = rest.slice(0, split);
  const name = rest.slice(split + 1);
  if ((kind !== NODE_KIND && kind !== SCHEDULE_KIND) || !name) {
    return null;
  }
  return { kind, name, key };
}
