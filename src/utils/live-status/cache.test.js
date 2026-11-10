import { afterEach, describe, expect, it, vi } from "vitest";

import { createLiveStatusCache } from "./cache";

describe("live-status cache", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns undefined for missing keys", () => {
    const cache = createLiveStatusCache({ now: () => 1000, defaultTtlMs: 5000 });
    expect(cache.get("missing")).toBeUndefined();
  });

  it("stores a value until TTL expires", () => {
    let now = 1000;
    const cache = createLiveStatusCache({ now: () => now, defaultTtlMs: 5000 });
    cache.set("k8s:ns/app", { status: "running" });

    expect(cache.get("k8s:ns/app")).toEqual({ status: "running" });

    now = 5999;
    expect(cache.get("k8s:ns/app")).toEqual({ status: "running" });

    now = 6000;
    expect(cache.get("k8s:ns/app")).toBeUndefined();
  });

  it("emits set only when the value changes and expire when TTL elapses", () => {
    let now = 0;
    const cache = createLiveStatusCache({ now: () => now, defaultTtlMs: 10 });
    const events = [];
    cache.subscribe((event) => events.push(event));

    cache.set("mcp:foo", { ok: true });
    cache.set("mcp:foo", { ok: true });
    cache.set("mcp:foo", { ok: false });

    now = 10;
    expect(cache.get("mcp:foo")).toBeUndefined();

    expect(events.map((event) => event.type)).toEqual(["set", "set", "expire"]);
    expect(events[1].value).toEqual({ ok: false });
  });

  it("touch refreshes TTL without emitting", () => {
    let now = 0;
    const cache = createLiveStatusCache({ now: () => now, defaultTtlMs: 10 });
    const events = [];
    cache.subscribe((event) => events.push(event));

    cache.set("scaling:ns/app", { minReplicaCount: 1 });
    now = 9;
    expect(cache.touch("scaling:ns/app")).toBe(true);
    now = 18;
    expect(cache.get("scaling:ns/app")).toEqual({ minReplicaCount: 1 });
    expect(events).toHaveLength(1);
  });

  it("snapshot filters by prefix and sweeps stale keys", () => {
    let now = 0;
    const cache = createLiveStatusCache({ now: () => now, defaultTtlMs: 5 });
    cache.set("k8s:a/b", { status: "running" });
    cache.set("mcp:a", { ok: true }, { ttlMs: 100 });

    now = 5;
    expect(cache.snapshot({ prefix: "k8s:" })).toEqual({});
    expect(cache.snapshot({ prefix: "mcp:" })).toEqual({ "mcp:a": { ok: true } });
  });
});
