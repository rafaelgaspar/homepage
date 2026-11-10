const APP_LABEL = "app.kubernetes.io/name";

export function labelSelectorFor({ app, podSelector } = {}) {
  return podSelector !== undefined ? podSelector : `${APP_LABEL}=${app}`;
}

export function kubernetesStatusKey({ namespace, app, podSelector } = {}) {
  const selector =
    podSelector !== undefined && podSelector !== null && podSelector !== "" ? `?podSelector=${podSelector}` : "";
  return `k8s:${namespace}/${app}${selector}`;
}

export function kubernetesStatusUrl({ namespace, app, podSelector } = {}) {
  const selector = podSelector !== undefined ? `podSelector=${podSelector}` : "";
  return `/api/kubernetes/status/${namespace}/${app}?${selector}`;
}

export function kubernetesProbeFromQuery(query = {}) {
  const { service, podSelector } = query;
  const [namespace, app] = Array.isArray(service) ? service : [];
  if (!namespace && !app) {
    return null;
  }
  return {
    namespace,
    app,
    podSelector,
    labelSelector: labelSelectorFor({ app, podSelector }),
    key: kubernetesStatusKey({ namespace, app, podSelector }),
  };
}

export function parseKubernetesStatusKey(key) {
  if (typeof key !== "string" || !key.startsWith("k8s:")) {
    return null;
  }
  const rest = key.slice("k8s:".length);
  const [path, query] = rest.split("?");
  const slash = path.indexOf("/");
  if (slash < 0) {
    return null;
  }
  const namespace = path.slice(0, slash);
  const app = path.slice(slash + 1);
  const params = new URLSearchParams(query ?? "");
  const podSelector = params.has("podSelector") ? params.get("podSelector") : undefined;
  return {
    namespace,
    app,
    podSelector,
    labelSelector: labelSelectorFor({ app, podSelector }),
    key,
  };
}
