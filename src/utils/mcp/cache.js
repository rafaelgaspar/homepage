import { loadMcpProbes } from "utils/mcp/service";
import { probeOne } from "utils/mcp/client";
import {
  MCP_MONITOR_REFRESH_MS,
  MCP_PROBE_CONCURRENCY,
  getMcpCacheTtlMs,
} from "utils/mcp/timing";

const cache = { at: 0, byId: Object.create(null) };
let refreshInFlight = null;

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

async function runRefresh(probes) {
  await mapWithConcurrency(
    probes,
    async (probe) => {
      cache.byId[probe.id] = await probeOne(probe);
    },
    MCP_PROBE_CONCURRENCY,
  );
  cache.at = Date.now();
  return Object.values(cache.byId);
}

function cachedResults() {
  return Object.values(cache.byId);
}

function hasCachedResults() {
  return cachedResults().length > 0;
}

function cacheAgeMs(now = Date.now()) {
  return cache.at ? now - cache.at : Number.POSITIVE_INFINITY;
}

export async function refreshAll(force = false) {
  const probes = await loadMcpProbes();
  const age = cacheAgeMs();
  const serveUntilMs = getMcpCacheTtlMs(probes.length);
  const dueForRefresh = !hasCachedResults() || age >= MCP_MONITOR_REFRESH_MS;

  if ((force || dueForRefresh) && !refreshInFlight) {
    refreshInFlight = runRefresh(probes).finally(() => {
      refreshInFlight = null;
    });
  }

  if (force) {
    await refreshInFlight;
    return cachedResults();
  }

  if (!hasCachedResults()) {
    return [];
  }

  // Keep serving the last snapshot through refresh interval + worst-case sweep.
  if (age < serveUntilMs || refreshInFlight) {
    return cachedResults();
  }

  return cachedResults();
}

export async function refreshOne(id, force = false) {
  const probes = await loadMcpProbes();
  const probe = probes.find((entry) => entry.id === id);
  if (!probe) return null;

  const cached = cache.byId[id];
  const age = cacheAgeMs();

  if (!force && cached && age < MCP_MONITOR_REFRESH_MS) {
    return cached;
  }

  const result = await probeOne(probe);
  cache.byId[id] = result;
  cache.at = Date.now();
  return result;
}
