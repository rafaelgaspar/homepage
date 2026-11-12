import { Watch } from "@kubernetes/client-node";

import { getKubeConfig } from "utils/config/kubernetes";
import { liveStatusCache } from "utils/live-status/cache";
import { registerLiveStatusSource } from "utils/live-status/sources";
import createLogger from "utils/logger";
import { recordLiveStatusWatchReconnect, setLiveStatusWatches } from "utils/metrics/live-status";
import { parseScalingCacheKey, SCALING_CACHE_PREFIX } from "utils/scaling/keys";
import {
  getToggleable,
  HOMEPAGE_TOGGLE_LABEL,
  HOMEPAGE_TOGGLE_SELECTOR,
  hydrateToggleableList,
  KEDA_GROUP,
  KEDA_PLURAL,
  KEDA_VERSION,
  mapScaledObject,
  publishMapped,
  unpublishToggleable,
} from "utils/scaling/service";
import { resetScalingHydrationForTests } from "utils/scaling/store";

const logger = createLogger("scalingWatch");
const RECONNECT_MS = 1_000;
const WATCH_PATH = `/apis/${KEDA_GROUP}/${KEDA_VERSION}/${KEDA_PLURAL}`;

let running = false;
let abortWatch = null;
let loopPromise = null;
let touchTimer = null;

function isToggleable(item) {
  return item?.metadata?.labels?.[HOMEPAGE_TOGGLE_LABEL] === "true";
}

function applyWatchEvent(phase, item) {
  const namespace = item?.metadata?.namespace;
  const name = item?.metadata?.name;
  if (!namespace || !name) {
    return;
  }

  if (phase === "DELETED" || !isToggleable(item)) {
    unpublishToggleable(namespace, name);
    return;
  }

  if (phase === "ADDED" || phase === "MODIFIED") {
    publishMapped(mapScaledObject(item));
  }
}

function watchUntilDone(kc) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(err);
    };
    abortWatch = () => finish(null);

    const watch = new Watch(kc);
    watch
      .watch(
        WATCH_PATH,
        { labelSelector: HOMEPAGE_TOGGLE_SELECTOR, allowWatchBookmarks: true },
        (phase, obj) => {
          if (phase === "BOOKMARK" || phase === "ERROR") {
            return;
          }
          applyWatchEvent(phase, obj);
        },
        finish,
      )
      .then((controller) => {
        abortWatch = () => {
          controller?.abort?.();
          finish(null);
        };
      })
      .catch(reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function startTouchLoop() {
  if (touchTimer) {
    return;
  }
  const touchMs = Math.max(1_000, Math.floor(liveStatusCache.defaultTtlMs / 2));
  touchTimer = setInterval(() => {
    for (const key of Object.keys(liveStatusCache.snapshot({ prefix: SCALING_CACHE_PREFIX }))) {
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

async function runWatchLoop() {
  while (running) {
    try {
      await hydrateToggleableList();
      const kc = getKubeConfig();
      if (!kc) {
        setLiveStatusWatches("scaledobjects", 0);
        return;
      }
      if (!running) {
        return;
      }
      await watchUntilDone(kc);
      if (!running) {
        return;
      }
      recordLiveStatusWatchReconnect("scaledobjects");
    } catch (err) {
      logger.error("scaledobject watch failed: %s", err);
      if (!running) {
        return;
      }
      recordLiveStatusWatchReconnect("scaledobjects");
      await sleep(RECONNECT_MS);
    }
  }
}

export function startScalingWatch() {
  if (running) {
    return;
  }
  running = true;
  setLiveStatusWatches("scaledobjects", 1);
  startTouchLoop();
  loopPromise = runWatchLoop().finally(() => {
    loopPromise = null;
    if (!running) {
      setLiveStatusWatches("scaledobjects", 0);
    }
  });
}

export async function stopScalingWatch() {
  running = false;
  stopTouchLoop();
  abortWatch?.();
  abortWatch = null;
  if (loopPromise) {
    await loopPromise;
  }
  setLiveStatusWatches("scaledobjects", 0);
}

export function resetScalingWatchForTests() {
  running = false;
  stopTouchLoop();
  abortWatch?.();
  abortWatch = null;
  loopPromise = null;
  resetScalingHydrationForTests();
  setLiveStatusWatches("scaledobjects", 0);
}

registerLiveStatusSource({
  prefix: SCALING_CACHE_PREFIX,
  start: startScalingWatch,
  stop: stopScalingWatch,
  refresh: async (key) => {
    const parsed = parseScalingCacheKey(key);
    if (!parsed) {
      return undefined;
    }
    return getToggleable(parsed.namespace, parsed.name);
  },
});
