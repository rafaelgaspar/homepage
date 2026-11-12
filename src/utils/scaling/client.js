import { useSyncExternalStore } from "react";

import { FALLBACK_BACKOFF_INITIAL_MS, FALLBACK_BACKOFF_MAX_MS, useLiveStatus } from "utils/live-status/client";
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

function nextBackoffMs(attempt) {
  return Math.min(FALLBACK_BACKOFF_MAX_MS, FALLBACK_BACKOFF_INITIAL_MS * 2 ** attempt);
}

const emptyCatalog = { byKey: {}, error: null, revision: 0 };

let catalog = emptyCatalog;
const catalogListeners = new Set();
let catalogInFlight = null;
let catalogTimer = null;
let catalogAttempt = 0;
let catalogSucceeded = false;

function emitCatalog(next) {
  catalog = next;
  for (const listener of catalogListeners) {
    listener();
  }
}

function catalogFromItems(items) {
  const byKey = {};
  if (!Array.isArray(items)) {
    return byKey;
  }
  for (const item of items) {
    if (!isToggleableItem(item)) {
      continue;
    }
    const key = scalingCacheKey(item.namespace, item.name);
    if (key) {
      byKey[key] = item;
    }
  }
  return byKey;
}

function fetchCatalog() {
  if (catalogSucceeded) {
    return Promise.resolve();
  }
  if (catalogInFlight) {
    return catalogInFlight;
  }

  const promise = fetch(SCALING_LIST_KEY, { credentials: "same-origin", headers: { Accept: "application/json" } })
    .then(async (response) => {
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`scaling list ${response.status}`);
      }
      catalogSucceeded = true;
      catalogAttempt = 0;
      emitCatalog({
        byKey: catalogFromItems(body),
        error: null,
        revision: catalog.revision + 1,
      });
    })
    .catch((error) => {
      catalogAttempt += 1;
      emitCatalog({ ...catalog, error, revision: catalog.revision + 1 });
      if (catalogListeners.size > 0) {
        const delay = nextBackoffMs(catalogAttempt - 1);
        catalogTimer = setTimeout(() => {
          catalogTimer = null;
          fetchCatalog();
        }, delay);
      }
    })
    .finally(() => {
      if (catalogInFlight === promise) {
        catalogInFlight = null;
      }
    });

  catalogInFlight = promise;
  return promise;
}

function ensureCatalog() {
  if (catalogSucceeded || catalogInFlight || catalogTimer) {
    return;
  }
  fetchCatalog();
}

function subscribeCatalog(listener) {
  catalogListeners.add(listener);
  ensureCatalog();
  return () => {
    catalogListeners.delete(listener);
    if (catalogListeners.size === 0 && catalogTimer) {
      clearTimeout(catalogTimer);
      catalogTimer = null;
    }
  };
}

function getCatalog() {
  return catalog;
}

/** Merge a POST response so the switch updates before the next SSE event. */
export function noteScalingItem(item) {
  if (!isToggleableItem(item)) {
    return;
  }
  const key = scalingCacheKey(item.namespace, item.name);
  if (!key) {
    return;
  }
  emitCatalog({
    byKey: { ...catalog.byKey, [key]: item },
    error: null,
    revision: catalog.revision + 1,
  });
}

export function resetScalingClientForTests() {
  if (catalogTimer) {
    clearTimeout(catalogTimer);
  }
  catalog = emptyCatalog;
  catalogListeners.clear();
  catalogInFlight = null;
  catalogTimer = null;
  catalogAttempt = 0;
  catalogSucceeded = false;
}

/** Live ScaledObject toggle state for a service card (namespace + app name). */
export function useServiceScaling(service) {
  const key = scalingCacheKey(service?.namespace, service?.app);
  const { data: liveItem, error: liveError } = useLiveStatus(key);
  const listed = useSyncExternalStore(subscribeCatalog, getCatalog, getCatalog);
  const live = isToggleableItem(liveItem) ? liveItem : undefined;
  const item = live ?? (key ? listed.byKey[key] : undefined);

  return {
    toggleItem: item ?? null,
    item,
    scaledIdle: Boolean(item && item.minReplicaCount === 0),
    error: liveError ?? listed.error,
  };
}
