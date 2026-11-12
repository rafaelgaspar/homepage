// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useLiveStatus } = vi.hoisted(() => ({
  useLiveStatus: vi.fn(),
}));

vi.mock("utils/live-status/client", () => ({
  useLiveStatus,
  FALLBACK_BACKOFF_INITIAL_MS: 1_000,
  FALLBACK_BACKOFF_MAX_MS: 64_000,
}));

import { resetScalingClientForTests, useServiceScaling } from "./client";

const toggle = {
  namespace: "chrome",
  name: "chrome-desktop",
  minReplicaCount: 0,
  scaleTargetRef: "chrome-desktop",
};

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

describe("useServiceScaling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLiveStatus.mockReturnValue({ data: undefined, error: undefined });
    vi.stubGlobal("fetch", vi.fn());
    resetScalingClientForTests();
  });

  afterEach(() => {
    resetScalingClientForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("subscribes to the scaling live-status key without a per-card GET", () => {
    fetch.mockResolvedValue(jsonResponse(200, []));
    renderHook(() => useServiceScaling({ namespace: "chrome", app: "chrome-desktop" }));

    expect(useLiveStatus).toHaveBeenCalledWith("scaling:chrome/chrome-desktop");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/scaling", expect.any(Object));
  });

  it("shows a toggle from the shared list when the live entry has not arrived", async () => {
    fetch.mockResolvedValue(jsonResponse(200, [toggle]));
    const { result } = renderHook(() => useServiceScaling({ namespace: "chrome", app: "chrome-desktop" }));

    await waitFor(() => {
      expect(result.current.toggleItem).toMatchObject({ minReplicaCount: 0 });
    });
    expect(result.current.scaledIdle).toBe(true);
  });

  it("does not show a toggle for a card missing from the list", async () => {
    fetch.mockResolvedValue(jsonResponse(200, [toggle]));
    const first = renderHook(() => useServiceScaling({ namespace: "chrome", app: "chrome-desktop" }));
    const second = renderHook(() => useServiceScaling({ namespace: "valkey", app: "valkey" }));

    await waitFor(() => {
      expect(first.result.current.toggleItem).toMatchObject({ name: "chrome-desktop" });
    });
    expect(second.result.current.toggleItem).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("prefers the live entry over the list", async () => {
    fetch.mockResolvedValue(jsonResponse(200, [toggle]));
    useLiveStatus.mockReturnValue({
      data: { namespace: "chrome", name: "chrome-desktop", minReplicaCount: 1 },
      error: undefined,
    });

    const { result } = renderHook(() => useServiceScaling({ namespace: "chrome", app: "chrome-desktop" }));

    expect(result.current.scaledIdle).toBe(false);
    expect(result.current.toggleItem.minReplicaCount).toBe(1);
    await flushFetch();
    expect(result.current.toggleItem.minReplicaCount).toBe(1);
  });

  it.each([404, 429, 500])("retries the list on HTTP %s with exponential backoff", async (status) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fetch.mockResolvedValue(jsonResponse(status, { error: "unavailable" }));
    const { result } = renderHook(() => useServiceScaling({ namespace: "chrome", app: "chrome-desktop" }));

    await flushFetch();
    expect(result.current.error).toMatchObject({ message: `scaling list ${status}` });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    await flushFetch();
    expect(fetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(fetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    await flushFetch();
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
