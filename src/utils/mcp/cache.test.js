import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { probeOne, loadMcpProbes } = vi.hoisted(() => ({
  probeOne: vi.fn(),
  loadMcpProbes: vi.fn(),
}));

vi.mock("utils/mcp/client", () => ({
  probeOne,
}));

vi.mock("utils/mcp/service", () => ({
  loadMcpProbes,
}));

import { liveStatusCache } from "utils/live-status/cache";

import { refreshAll, refreshOne, resetMcpCacheForTests } from "./cache";
import { mcpCacheKey } from "./keys";

const probe = { id: "imap", serviceName: "IMAP" };

describe("utils/mcp/cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMcpCacheForTests();
    liveStatusCache.clear();
    loadMcpProbes.mockResolvedValue([probe]);
  });

  afterEach(() => {
    resetMcpCacheForTests();
    liveStatusCache.clear();
  });

  it("publishes probe results into the live-status cache with TTL", async () => {
    probeOne.mockResolvedValue({ id: "imap", serviceName: "IMAP", ok: true, toolCount: 3, latencyMs: 12 });

    await expect(refreshAll(true)).resolves.toEqual([
      { id: "imap", serviceName: "IMAP", ok: true, toolCount: 3, latencyMs: 12 },
    ]);
    expect(liveStatusCache.get(mcpCacheKey("imap"))).toMatchObject({ ok: true, toolCount: 3 });
  });

  it("serves refreshOne from the live-status cache when still fresh", async () => {
    probeOne.mockResolvedValue({ id: "imap", serviceName: "IMAP", ok: true, toolCount: 1, latencyMs: 9 });
    await refreshOne("imap", true);
    probeOne.mockClear();

    await expect(refreshOne("imap")).resolves.toMatchObject({ ok: true, toolCount: 1 });
    expect(probeOne).not.toHaveBeenCalled();
  });
});
