// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FALLBACK_BACKOFF_INITIAL_MS, resetLiveStatusClientForTests, useLiveStatus } from "./client";

class FakeEventSource {
  static instances = [];

  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.listeners = {};
    this.onerror = null;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type, cb) {
    this.listeners[type] = this.listeners[type] ?? [];
    this.listeners[type].push(cb);
  }

  close() {
    this.closed = true;
  }

  emit(type, data) {
    for (const cb of this.listeners[type] ?? []) {
      cb({ data: JSON.stringify(data) });
    }
  }
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

async function flushFetch() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useLiveStatus", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", vi.fn());
    resetLiveStatusClientForTests();
  });

  afterEach(() => {
    resetLiveStatusClientForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("opens one EventSource and updates when a set event arrives", async () => {
    const { result } = renderHook(() => useLiveStatus("k8s:ns/app"));
    const source = FakeEventSource.instances[0];

    expect(source.url).toBe("/api/live/stream");
    source.emit("snapshot", { entries: { "k8s:ns/app": { status: "running" } } });

    await waitFor(() => {
      expect(result.current.data).toEqual({ status: "running" });
    });

    source.emit("set", { key: "k8s:ns/app", value: { status: "down" } });
    await waitFor(() => {
      expect(result.current.data).toEqual({ status: "down" });
    });
  });

  it("does not refetch a successful fallback when other live-status keys update", async () => {
    fetch.mockResolvedValue(jsonResponse(200, { status: "running" }));
    const { result } = renderHook(() =>
      useLiveStatus("k8s:ns/app", { fallbackUrl: "/api/kubernetes/status/ns/app" }),
    );

    await waitFor(() => {
      expect(result.current.data).toEqual({ status: "running" });
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    FakeEventSource.instances[0].emit("set", { key: "k8s:other/app", value: { status: "running" } });
    await waitFor(() => {
      expect(result.current.data).toEqual({ status: "running" });
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([404, 429, 500])("retries HTTP %s with exponential backoff", async (status) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fetch.mockResolvedValue(jsonResponse(status, { error: "missing" }));
    const { result } = renderHook(() =>
      useLiveStatus("k8s:ns/app", { fallbackUrl: "/api/kubernetes/status/ns/app" }),
    );

    await flushFetch();
    expect(result.current.error).toMatchObject({ message: `live status ${status}` });
    expect(fetch).toHaveBeenCalledTimes(1);

    FakeEventSource.instances[0].emit("set", { key: "k8s:other/app", value: { status: "running" } });
    await flushFetch();
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FALLBACK_BACKOFF_INITIAL_MS - 1);
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    await flushFetch();
    expect(fetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FALLBACK_BACKOFF_INITIAL_MS);
    });
    expect(fetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FALLBACK_BACKOFF_INITIAL_MS);
    });
    await flushFetch();
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
