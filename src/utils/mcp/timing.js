/** Client SWR interval and minimum server refresh spacing (5 minutes). */
export const MCP_MONITOR_REFRESH_MS = 300000;

export const MCP_PROBE_CONCURRENCY = 2;

/** POSTs per probe worst case: initialize, notifications/initialized, tools/list. */
export const MCP_POSTS_PER_PROBE = 3;

export function getProbeTimeoutMs() {
  const parsed = Number(process.env.HOMEPAGE_MCP_PROBE_TIMEOUT_MS || 15000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15000;
}

/** Wall-clock upper bound for one full monitor sweep. */
export function maxSweepDurationMs(probeCount, concurrency = MCP_PROBE_CONCURRENCY) {
  const count = Math.max(Number(probeCount) || 0, 1);
  const workers = Math.max(Number(concurrency) || 0, 1);
  const perProbeMs = MCP_POSTS_PER_PROBE * getProbeTimeoutMs();
  return Math.ceil(count / workers) * perProbeMs;
}

/**
 * Cache stays valid at least through refresh interval + worst-case in-flight sweep,
 * so polls during a long refresh still get the previous snapshot.
 */
export function getMcpCacheTtlMs(probeCount) {
  return MCP_MONITOR_REFRESH_MS + maxSweepDurationMs(probeCount);
}

/** TTL for a single-probe refresh (refresh spacing + one probe's POST chain). */
export function getMcpSingleProbeCacheTtlMs() {
  return MCP_MONITOR_REFRESH_MS + MCP_POSTS_PER_PROBE * getProbeTimeoutMs();
}
