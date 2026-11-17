import { Watch } from "@kubernetes/client-node";

import { getKubeConfig } from "utils/config/kubernetes";
import { getK3sHomeConfig } from "utils/k3s-home/config";
import {
  K3S_HOME_CACHE_PREFIX,
  K3S_HOME_GROUP,
  K3S_HOME_VERSION,
  NODE_KIND,
  NODE_PLURAL,
  PING_INTERVAL_MS,
  RECONNECT_MS,
  RUN_KIND,
  RUN_PLURAL,
  SCHEDULE_KIND,
  SCHEDULE_PLURAL,
} from "utils/k3s-home/constants";
import { k3sHomeCacheKey, parseK3sHomeCacheKey } from "utils/k3s-home/keys";
import { getClusterObject, listClusterObjects } from "utils/k3s-home/list";
import { mapNode, mapSchedule } from "utils/k3s-home/map";
import { probeHost } from "utils/k3s-home/ping";
import { liveStatusCache } from "utils/live-status/cache";
import { registerLiveStatusSource } from "utils/live-status/sources";
import createLogger from "utils/logger";
import { recordLiveStatusWatchReconnect, setLiveStatusWatches } from "utils/metrics/live-status";

const logger = createLogger("k3sHomeWatch");

const RESOURCES = [
  { kind: NODE_KIND, plural: NODE_PLURAL },
  { kind: SCHEDULE_KIND, plural: SCHEDULE_PLURAL },
  { kind: RUN_KIND, plural: RUN_PLURAL },
];

const store = {
  nodes: new Map(),
  schedules: new Map(),
  runs: new Map(),
  pings: new Map(),
};

const controllers = new Map();
let pingTimer = null;
let touchTimer = null;
let pingInFlight = null;

function objectName(item) {
  return item?.metadata?.name ?? "";
}

function watchPath(plural) {
  return `/apis/${K3S_HOME_GROUP}/${K3S_HOME_VERSION}/${plural}`;
}

function storeFor(kind) {
  if (kind === NODE_KIND) {
    return store.nodes;
  }
  if (kind === SCHEDULE_KIND) {
    return store.schedules;
  }
  return store.runs;
}

function publishNode(name) {
  const node = store.nodes.get(name);
  const key = k3sHomeCacheKey(NODE_KIND, name);
  if (!node || !key) {
    if (key) {
      liveStatusCache.delete(key);
    }
    return;
  }
  liveStatusCache.set(key, mapNode(node, store.pings.get(name) ?? null));
}

function publishSchedule(name) {
  const schedule = store.schedules.get(name);
  const key = k3sHomeCacheKey(SCHEDULE_KIND, name);
  if (!schedule || !key) {
    if (key) {
      liveStatusCache.delete(key);
    }
    return;
  }
  liveStatusCache.set(key, mapSchedule(schedule, [...store.runs.values()]));
}

function publishAll() {
  for (const name of store.nodes.keys()) {
    publishNode(name);
  }
  for (const name of store.schedules.keys()) {
    publishSchedule(name);
  }
}

export function applyWatchEvent(kind, phase, item) {
  const name = objectName(item);
  if (!name) {
    return;
  }
  const bucket = storeFor(kind);
  if (phase === "DELETED") {
    bucket.delete(name);
    if (kind === NODE_KIND) {
      store.pings.delete(name);
      publishNode(name);
    } else if (kind === SCHEDULE_KIND) {
      publishSchedule(name);
    } else {
      const schedule = item?.spec?.schedule;
      if (schedule) {
        publishSchedule(schedule);
      } else {
        publishAll();
      }
    }
    return;
  }
  if (phase !== "ADDED" && phase !== "MODIFIED") {
    return;
  }
  bucket.set(name, item);
  if (kind === NODE_KIND) {
    publishNode(name);
  } else if (kind === SCHEDULE_KIND) {
    publishSchedule(name);
  } else {
    publishSchedule(item?.spec?.schedule ?? "");
  }
}

function replaceStore(kind, items) {
  const bucket = storeFor(kind);
  const wanted = new Set(items.map(objectName).filter(Boolean));
  for (const name of [...bucket.keys()]) {
    if (!wanted.has(name)) {
      bucket.delete(name);
      if (kind === NODE_KIND) {
        store.pings.delete(name);
      }
    }
  }
  for (const item of items) {
    const name = objectName(item);
    if (name) {
      bucket.set(name, item);
    }
  }
}

async function hydrate() {
  const results = await Promise.all(
    RESOURCES.map(async (resource) => {
      const listed = await listClusterObjects(resource.plural);
      if (!listed.missing) {
        replaceStore(resource.kind, listed.items);
      }
      return { ...resource, missing: listed.missing };
    }),
  );
  publishAll();
  return results;
}

function watchUntilDone(plural, kind, kc) {
  return new Promise((resolve, reject) => {
    const state = controllers.get(kind);
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
        watchPath(plural),
        { allowWatchBookmarks: true },
        (phase, obj) => {
          if (phase === "BOOKMARK" || phase === "ERROR") {
            return;
          }
          applyWatchEvent(kind, phase, obj);
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

async function runWatchLoop(resource) {
  while (controllers.get(resource.kind)?.running) {
    try {
      const kc = getKubeConfig();
      if (!kc) {
        return;
      }
      await watchUntilDone(resource.plural, resource.kind, kc);
      if (!controllers.get(resource.kind)?.running) {
        return;
      }
      recordLiveStatusWatchReconnect(resource.plural);
    } catch (err) {
      logger.error("%s watch failed: %s", resource.plural, err);
      if (!controllers.get(resource.kind)?.running) {
        return;
      }
      recordLiveStatusWatchReconnect(resource.plural);
      await sleep(RECONNECT_MS);
    }
  }
}

function startResourceWatch(resource) {
  if (controllers.has(resource.kind)) {
    return;
  }
  controllers.set(resource.kind, { running: true, abort: null });
  void runWatchLoop(resource);
}

function stopResourceWatch(kind) {
  const state = controllers.get(kind);
  if (!state) {
    return;
  }
  state.running = false;
  state.abort?.();
  controllers.delete(kind);
}

async function pingNodes() {
  const nodes = [...store.nodes.values()];
  await Promise.all(
    nodes.map(async (node) => {
      const name = objectName(node);
      const ip = node?.spec?.ip;
      if (!name || !ip) {
        return;
      }
      store.pings.set(name, await probeHost(ip));
      publishNode(name);
    }),
  );
}

function startPingLoop() {
  if (pingTimer) {
    return;
  }
  const tick = () => {
    if (pingInFlight) {
      return;
    }
    pingInFlight = pingNodes().finally(() => {
      pingInFlight = null;
    });
  };
  tick();
  pingTimer = setInterval(tick, PING_INTERVAL_MS);
}

function stopPingLoop() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

function startTouchLoop() {
  if (touchTimer) {
    return;
  }
  const touchMs = Math.max(1_000, Math.floor(liveStatusCache.defaultTtlMs / 2));
  touchTimer = setInterval(() => {
    for (const key of Object.keys(liveStatusCache.snapshot({ prefix: K3S_HOME_CACHE_PREFIX }))) {
      liveStatusCache.touch(key);
    }
  }, touchMs);
}

function stopTouchLoop() {
  if (touchTimer) {
    clearInterval(touchTimer);
    touchTimer = null;
  }
}

function updateWatchMetrics() {
  setLiveStatusWatches("k3shome", controllers.size);
}

export async function startK3sHomeWatch() {
  if (!getK3sHomeConfig().enabled || !getKubeConfig()) {
    return;
  }
  const results = await hydrate();
  startTouchLoop();
  startPingLoop();
  for (const resource of results) {
    if (!resource.missing) {
      startResourceWatch(resource);
    }
  }
  updateWatchMetrics();
}

export async function stopK3sHomeWatch() {
  stopPingLoop();
  stopTouchLoop();
  for (const kind of [...controllers.keys()]) {
    stopResourceWatch(kind);
  }
  updateWatchMetrics();
}

export async function getK3sHomeStatus(kind, name) {
  const key = k3sHomeCacheKey(kind, name);
  if (!key) {
    return undefined;
  }
  const cached = liveStatusCache.get(key);
  if (cached) {
    return cached;
  }

  if (kind === NODE_KIND) {
    const node = await getClusterObject(NODE_PLURAL, name);
    if (!node) {
      return undefined;
    }
    store.nodes.set(name, node);
    if (node?.spec?.ip && !store.pings.has(name)) {
      store.pings.set(name, await probeHost(node.spec.ip));
    }
    publishNode(name);
    return liveStatusCache.peek(key);
  }

  if (kind === SCHEDULE_KIND) {
    const [schedule, runs] = await Promise.all([
      getClusterObject(SCHEDULE_PLURAL, name),
      listClusterObjects(RUN_PLURAL),
    ]);
    if (!schedule) {
      return undefined;
    }
    store.schedules.set(name, schedule);
    if (!runs.missing) {
      replaceStore(RUN_KIND, runs.items);
    }
    publishSchedule(name);
    return liveStatusCache.peek(key);
  }

  return undefined;
}

export function resetK3sHomeWatchForTests() {
  void stopK3sHomeWatch();
  store.nodes.clear();
  store.schedules.clear();
  store.runs.clear();
  store.pings.clear();
  pingInFlight = null;
}

registerLiveStatusSource({
  prefix: K3S_HOME_CACHE_PREFIX,
  start: startK3sHomeWatch,
  stop: stopK3sHomeWatch,
  refresh: async (key) => {
    const parsed = parseK3sHomeCacheKey(key);
    if (!parsed) {
      return undefined;
    }
    return getK3sHomeStatus(parsed.kind, parsed.name);
  },
});
