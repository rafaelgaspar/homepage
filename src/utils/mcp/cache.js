import { loadMcpProbes } from "utils/mcp/service";
import { probeOne } from "utils/mcp/client";

const CACHE_TTL_MS = 30000;
const PROBE_CONCURRENCY = 2;

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
    PROBE_CONCURRENCY,
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

export async function refreshAll(force = false) {
  const now = Date.now();
  const stale = !hasCachedResults() || now - cache.at >= CACHE_TTL_MS;

  if (!force && !stale) {
    return cachedResults();
  }

  if (!refreshInFlight) {
    refreshInFlight = loadMcpProbes()
      .then((probes) => runRefresh(probes))
      .finally(() => {
        refreshInFlight = null;
      });
  }

  if (force) {
    await refreshInFlight;
    return cachedResults();
  }

  return hasCachedResults() ? cachedResults() : [];
}

export async function refreshOne(id, force = false) {
  const probes = await loadMcpProbes();
  const probe = probes.find((entry) => entry.id === id);
  if (!probe) return null;

  const cached = cache.byId[id];
  if (!force && cached && Date.now() - cache.at < CACHE_TTL_MS) {
    return cached;
  }

  const result = await probeOne(probe);
  cache.byId[id] = result;
  cache.at = Date.now();
  return result;
}
