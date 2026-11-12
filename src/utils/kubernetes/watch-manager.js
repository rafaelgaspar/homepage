import { CoreV1Api, Watch } from "@kubernetes/client-node";

import { getKubeConfig } from "utils/config/kubernetes";
import { statusFromPods } from "utils/kubernetes/status";
import { loadKubernetesStatusProbes, parseKubernetesStatusKey } from "utils/kubernetes/status-probes";
import { liveStatusCache } from "utils/live-status/cache";
import { registerLiveStatusSource } from "utils/live-status/sources";
import createLogger from "utils/logger";
import {
  recordLiveStatusK8sListDuration,
  recordLiveStatusK8sLookup,
  recordLiveStatusWatchReconnect,
  setLiveStatusWatches,
} from "utils/metrics/live-status";
import { isScaledIdle } from "utils/scaling/idle";

const logger = createLogger("kubernetesWatch");
const RECONNECT_MS = 1_000;

const controllers = new Map();
const podStore = new Map();
const inFlightList = new Map();

function podId(pod, index = 0) {
  if (pod?.metadata?.name) {
    return `${pod.metadata.namespace ?? ""}/${pod.metadata.name}`;
  }
  return `__anon:${index}`;
}

function podsFor(key) {
  return [...(podStore.get(key)?.values() ?? [])];
}

function overlayIdle(probe, status) {
  if (status === "not found" && isScaledIdle(probe.namespace, probe.app)) {
    return "idle";
  }
  return status;
}

function publishStatus(probe) {
  const status = overlayIdle(probe, statusFromPods(podsFor(probe.key)));
  liveStatusCache.set(probe.key, { status });
}

export function refreshKubernetesIdle(namespace, name) {
  const snapshot = liveStatusCache.snapshot({ prefix: "k8s:" });
  for (const key of Object.keys(snapshot)) {
    const probe = parseKubernetesStatusKey(key);
    if (probe?.namespace !== namespace || probe?.app !== name) {
      continue;
    }
    if (podStore.has(key)) {
      publishStatus(probe);
      continue;
    }
    liveStatusCache.set(key, { status: overlayIdle(probe, snapshot[key]?.status ?? "not found") });
  }
}

function applyWatchEvent(probe, phase, pod) {
  if (!pod?.metadata?.name) {
    return;
  }
  let pods = podStore.get(probe.key);
  if (!pods) {
    pods = new Map();
    podStore.set(probe.key, pods);
  }
  if (phase === "DELETED") {
    pods.delete(podId(pod));
  } else if (phase === "ADDED" || phase === "MODIFIED") {
    pods.set(podId(pod), pod);
  } else {
    return;
  }
  publishStatus(probe);
}

async function listAndPublish(probe) {
  const existing = inFlightList.get(probe.key);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    const startedAt = process.hrtime.bigint();
    try {
      const kc = getKubeConfig();
      if (!kc) {
        throw new Error("No kubernetes configuration");
      }
      const coreApi = kc.makeApiClient(CoreV1Api);
      const podsResponse = await coreApi.listNamespacedPod({
        namespace: probe.namespace,
        labelSelector: probe.labelSelector,
      });
      const pods = podsResponse?.items ?? [];
      podStore.set(probe.key, new Map(pods.map((pod, index) => [podId(pod, index), pod])));
      publishStatus(probe);
      return podsResponse;
    } finally {
      recordLiveStatusK8sListDuration(Number(process.hrtime.bigint() - startedAt) / 1e9);
    }
  })().finally(() => {
    inFlightList.delete(probe.key);
  });

  inFlightList.set(probe.key, promise);
  return promise;
}

function watchUntilDone(probe, kc) {
  const path = `/api/v1/namespaces/${probe.namespace}/pods`;
  return new Promise((resolve, reject) => {
    const state = controllers.get(probe.key);
    let settled = false;
    const finish = (err) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(err);
    };
    if (state) {
      state.abort = () => finish(null);
    }

    const watch = new Watch(kc);
    watch
      .watch(
        path,
        { labelSelector: probe.labelSelector, allowWatchBookmarks: true },
        (phase, obj) => {
          if (phase === "BOOKMARK" || phase === "ERROR") {
            return;
          }
          applyWatchEvent(probe, phase, obj);
        },
        finish,
      )
      .then((controller) => {
        if (state) {
          state.abort = () => {
            controller?.abort?.();
            finish(null);
          };
        }
      })
      .catch(reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runWatchLoop(probe) {
  while (controllers.get(probe.key)?.running) {
    try {
      const kc = getKubeConfig();
      if (!kc) {
        return;
      }
      if (!podStore.has(probe.key)) {
        await listAndPublish(probe);
      }
      if (!controllers.get(probe.key)?.running) {
        return;
      }
      await watchUntilDone(probe, kc);
      podStore.delete(probe.key);
      if (!controllers.get(probe.key)?.running) {
        return;
      }
      recordLiveStatusWatchReconnect("pods");
    } catch (err) {
      logger.error("k8s watch %s failed: %s", probe.key, err);
      podStore.delete(probe.key);
      if (!controllers.get(probe.key)?.running) {
        return;
      }
      recordLiveStatusWatchReconnect("pods");
      await sleep(RECONNECT_MS);
    }
  }
}

export function startWatch(probe) {
  if (!probe?.key || controllers.has(probe.key)) {
    return;
  }
  controllers.set(probe.key, { running: true, abort: null });
  setLiveStatusWatches("pods", controllers.size);
  void runWatchLoop(probe);
}

export function stopWatch(key) {
  const state = controllers.get(key);
  if (!state) {
    return;
  }
  state.running = false;
  state.abort?.();
  controllers.delete(key);
  podStore.delete(key);
  setLiveStatusWatches("pods", controllers.size);
}

export async function stopAllWatches() {
  for (const key of [...controllers.keys()]) {
    stopWatch(key);
  }
}

export async function syncWatchesFromConfig() {
  if (!getKubeConfig()) {
    return;
  }
  const probes = await loadKubernetesStatusProbes();
  const wanted = new Set(probes.map((probe) => probe.key));
  for (const probe of probes) {
    startWatch(probe);
  }
  for (const key of [...controllers.keys()]) {
    if (!wanted.has(key)) {
      stopWatch(key);
      liveStatusCache.delete(key);
    }
  }
}

export async function getKubernetesStatus(probe) {
  const cached = liveStatusCache.get(probe.key);
  if (cached) {
    startWatch(probe);
    const status = overlayIdle(probe, cached.status);
    if (status !== cached.status) {
      liveStatusCache.set(probe.key, { ...cached, status });
    }
    recordLiveStatusK8sLookup("hit");
    return liveStatusCache.peek(probe.key) ?? cached;
  }

  try {
    await listAndPublish(probe);
    startWatch(probe);
    recordLiveStatusK8sLookup("miss");
    return liveStatusCache.peek(probe.key) ?? { status: "not found" };
  } catch (err) {
    logger.error("Error getting pods: %d %s %s", err.statusCode, err.body, err.response);
    recordLiveStatusK8sLookup("error");
    return { error: "Error communicating with kubernetes" };
  }
}

export function resetKubernetesWatchesForTests() {
  void stopAllWatches();
  inFlightList.clear();
  podStore.clear();
}

registerLiveStatusSource({
  prefix: "k8s:",
  start: syncWatchesFromConfig,
  stop: stopAllWatches,
  refresh: async (key) => {
    const probe = parseKubernetesStatusKey(key);
    if (!probe) {
      return undefined;
    }
    return getKubernetesStatus(probe);
  },
});
