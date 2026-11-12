import { isMetricsEnabled } from "./settings";

const seenCachePrefixes = new Set();

export function liveStatusPrefix(key) {
  if (typeof key !== "string") {
    return "other";
  }
  const index = key.indexOf(":");
  return index > 0 ? key.slice(0, index + 1) : "other";
}

export function recordLiveStatusCacheEvent(type, key) {
  if (!isMetricsEnabled() || !type || !key) {
    return;
  }
  void import("./registry").then(({ getLiveStatusCacheEventsCounter }) => {
    getLiveStatusCacheEventsCounter().inc({ type, prefix: liveStatusPrefix(key) });
  });
}

export function setLiveStatusCacheCounts(counts = {}) {
  if (!isMetricsEnabled()) {
    return;
  }
  void import("./registry").then(({ getLiveStatusCacheEntriesGauge }) => {
    const gauge = getLiveStatusCacheEntriesGauge();
    const prefixes = new Set([...seenCachePrefixes, ...Object.keys(counts)]);
    for (const prefix of prefixes) {
      gauge.set({ prefix }, counts[prefix] ?? 0);
    }
    seenCachePrefixes.clear();
    for (const prefix of Object.keys(counts)) {
      seenCachePrefixes.add(prefix);
    }
  });
}

export function recordLiveStatusSseConnect() {
  if (!isMetricsEnabled()) {
    return;
  }
  void import("./registry").then(({ getLiveStatusSseConnectionsGauge, getLiveStatusSseConnectsCounter }) => {
    getLiveStatusSseConnectionsGauge().inc();
    getLiveStatusSseConnectsCounter().inc();
  });
}

export function recordLiveStatusSseDisconnect() {
  if (!isMetricsEnabled()) {
    return;
  }
  void import("./registry").then(({ getLiveStatusSseConnectionsGauge, getLiveStatusSseDisconnectsCounter }) => {
    getLiveStatusSseConnectionsGauge().dec();
    getLiveStatusSseDisconnectsCounter().inc();
  });
}

export function setLiveStatusWatches(resource, count) {
  if (!isMetricsEnabled() || !resource) {
    return;
  }
  void import("./registry").then(({ getLiveStatusWatchesGauge }) => {
    getLiveStatusWatchesGauge().set({ resource }, count);
  });
}

export function recordLiveStatusWatchReconnect(resource) {
  if (!isMetricsEnabled() || !resource) {
    return;
  }
  void import("./registry").then(({ getLiveStatusWatchReconnectsCounter }) => {
    getLiveStatusWatchReconnectsCounter().inc({ resource });
  });
}

export function recordLiveStatusK8sListDuration(seconds) {
  if (!isMetricsEnabled() || !Number.isFinite(seconds)) {
    return;
  }
  void import("./registry").then(({ getLiveStatusK8sListDurationHistogram }) => {
    getLiveStatusK8sListDurationHistogram().observe(seconds);
  });
}

export function recordLiveStatusK8sLookup(outcome) {
  if (!isMetricsEnabled() || !outcome) {
    return;
  }
  void import("./registry").then(({ getLiveStatusK8sLookupsCounter }) => {
    getLiveStatusK8sLookupsCounter().inc({ outcome });
  });
}

export function resetLiveStatusMetricsForTests() {
  seenCachePrefixes.clear();
}
