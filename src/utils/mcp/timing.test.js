import { afterEach, describe, expect, it } from "vitest";

import {
  MCP_MONITOR_REFRESH_MS,
  getMcpCacheTtlMs,
  getMcpSingleProbeCacheTtlMs,
  maxSweepDurationMs,
} from "./timing";

describe("utils/mcp/timing", () => {
  afterEach(() => {
    delete process.env.HOMEPAGE_MCP_PROBE_TIMEOUT_MS;
  });

  it("cache TTL is at least refresh plus full sweep at default timeout", () => {
    process.env.HOMEPAGE_MCP_PROBE_TIMEOUT_MS = "60000";
    const sweep = maxSweepDurationMs(30, 2);
    expect(sweep).toBe(Math.ceil(30 / 2) * 3 * 60000);
    expect(getMcpCacheTtlMs(30)).toBe(MCP_MONITOR_REFRESH_MS + sweep);
    expect(getMcpCacheTtlMs(30)).toBeGreaterThan(MCP_MONITOR_REFRESH_MS + 60000);
  });

  it("single-probe TTL is refresh plus three probe timeouts", () => {
    process.env.HOMEPAGE_MCP_PROBE_TIMEOUT_MS = "10000";
    expect(getMcpSingleProbeCacheTtlMs()).toBe(MCP_MONITOR_REFRESH_MS + 30000);
  });
});
