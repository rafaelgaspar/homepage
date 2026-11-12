import { beforeEach, describe, expect, it, vi } from "vitest";

const { isMetricsEnabled } = vi.hoisted(() => ({
  isMetricsEnabled: vi.fn(),
}));

vi.mock("./settings", () => ({
  isMetricsEnabled,
}));

import {
  liveStatusPrefix,
  recordLiveStatusCacheEvent,
  recordLiveStatusK8sLookup,
  resetLiveStatusMetricsForTests,
  setLiveStatusCacheCounts,
} from "./live-status";
import { getMetricsRegister, registerAppMetrics, renderMetrics } from "./registry";

const GLOBAL_STATE_KEY = "__homepagePrometheusMetricsState";

describe("utils/metrics/live-status", () => {
  beforeEach(() => {
    delete globalThis[GLOBAL_STATE_KEY];
    resetLiveStatusMetricsForTests();
    isMetricsEnabled.mockReturnValue(true);
    registerAppMetrics();
  });

  it("parses cache key prefixes", () => {
    expect(liveStatusPrefix("k8s:ns/app")).toBe("k8s:");
    expect(liveStatusPrefix("mcp:imap")).toBe("mcp:");
    expect(liveStatusPrefix("scaling:chrome/app")).toBe("scaling:");
    expect(liveStatusPrefix("nocolon")).toBe("other");
  });

  it("records cache events and entry gauges when enabled", async () => {
    recordLiveStatusCacheEvent("set", "k8s:ns/app");
    setLiveStatusCacheCounts({ "k8s:": 2, "mcp:": 1 });
    await vi.waitFor(async () => {
      const body = await renderMetrics();
      expect(body).toContain('homepage_live_status_cache_events_total{type="set",prefix="k8s:"} 1');
      expect(body).toContain('homepage_live_status_cache_entries{prefix="k8s:"} 2');
      expect(body).toContain('homepage_live_status_cache_entries{prefix="mcp:"} 1');
    });
  });

  it("records kubernetes status lookups", async () => {
    recordLiveStatusK8sLookup("hit");
    await vi.waitFor(async () => {
      const body = await renderMetrics();
      expect(body).toContain('homepage_live_status_k8s_lookups_total{outcome="hit"} 1');
    });
  });

  it("does not increment series when metrics are disabled", async () => {
    isMetricsEnabled.mockReturnValue(false);
    recordLiveStatusCacheEvent("set", "k8s:ns/app");
    recordLiveStatusK8sLookup("hit");
    await Promise.resolve();
    const body = await renderMetrics();
    expect(body).not.toContain('homepage_live_status_cache_events_total{type="set",prefix="k8s:"}');
    expect(body).not.toContain('homepage_live_status_k8s_lookups_total{outcome="hit"}');
    expect(getMetricsRegister()).toBeDefined();
  });
});
