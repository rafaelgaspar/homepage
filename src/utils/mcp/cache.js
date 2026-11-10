import { liveStatusCache } from "utils/live-status/cache";
import { registerLiveStatusSource } from "utils/live-status/sources";
import { probeOne } from "utils/mcp/client";
import { mcpCacheKey, mcpIdFromCacheKey } from "utils/mcp/keys";
import { loadMcpProbes } from "utils/mcp/service";
import {
  MCP_MONITOR_REFRESH_MS,
  MCP_PROBE_CONCURRENCY,
  getMcpCacheTtlMs,
  getMcpSingleProbeCacheTtlMs,
} from "utils/mcp/timing";

let refreshInFlight = null;
let refreshTimer = null;

async function mapWithConcurrency(items, fn, limit) {
  if (!items.length) {
    return [];
  }
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

function publish(result, ttlMs) {
  liveStatusCache.set(mcpCacheKey(result.id), result, { ttlMs });
  return result;
}

function cachedResults(probes) {
  if (probes) {
    return probes.map((probe) => liveStatusCache.get(mcpCacheKey(probe.id))).filter(Boolean);
  }
  return Object.values(liveStatusCache.snapshot({ prefix: "mcp:" }));
}

async function runRefresh(probes) {
  const ttlMs = getMcpCacheTtlMs(probes.length);
  await mapWithConcurrency(
    probes,
    async (probe) => {
      publish(await probeOne(probe), ttlMs);
    },
    MCP_PROBE_CONCURRENCY,
  );
  return cachedResults(probes);
}

export async function refreshAll(force = false) {
  const probes = await loadMcpProbes();
  const cached = cachedResults(probes);
  const fresh = probes.length > 0 && cached.length === probes.length;

  if (!force && fresh) {
    return cached;
  }

  if (!refreshInFlight) {
    refreshInFlight = runRefresh(probes).finally(() => {
      refreshInFlight = null;
    });
  }

  if (force) {
    await refreshInFlight;
    return cachedResults(probes);
  }

  return cached;
}

export async function refreshOne(id, force = false) {
  const probes = await loadMcpProbes();
  const probe = probes.find((entry) => entry.id === id);
  if (!probe) return null;

  const cached = liveStatusCache.get(mcpCacheKey(id));
  if (!force && cached) {
    return cached;
  }

  return publish(await probeOne(probe), getMcpSingleProbeCacheTtlMs());
}

export function startMcpRefreshLoop() {
  if (refreshTimer) {
    return;
  }
  void refreshAll(true).catch(() => {});
  refreshTimer = setInterval(() => {
    void refreshAll(true).catch(() => {});
  }, MCP_MONITOR_REFRESH_MS);
}

export function stopMcpRefreshLoop() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

export function resetMcpCacheForTests() {
  stopMcpRefreshLoop();
  refreshInFlight = null;
  for (const key of Object.keys(liveStatusCache.snapshot({ prefix: "mcp:" }))) {
    liveStatusCache.delete(key);
  }
}

registerLiveStatusSource({
  prefix: "mcp:",
  start: async () => {
    startMcpRefreshLoop();
  },
  stop: async () => {
    stopMcpRefreshLoop();
  },
  refresh: async (key) => {
    const id = mcpIdFromCacheKey(key);
    if (!id) {
      return undefined;
    }
    return refreshOne(id);
  },
});
