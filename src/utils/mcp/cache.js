import { loadMcpProbes } from "utils/mcp/service";
import { probeOne } from "utils/mcp/client";

const CACHE_TTL_MS = 25000;
const cache = { at: 0, byId: Object.create(null) };

export async function refreshAll(force = false) {
  const now = Date.now();
  if (!force && now - cache.at < CACHE_TTL_MS && Object.keys(cache.byId).length) {
    return Object.values(cache.byId);
  }

  const probes = await loadMcpProbes();
  const gatewayCache = Object.create(null);
  const results = [];
  for (const probe of probes) {
    const result = await probeOne(probe, gatewayCache);
    cache.byId[probe.id] = result;
    results.push(result);
  }
  cache.at = Date.now();
  return results;
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
