// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useLiveStatus } = vi.hoisted(() => ({
  useLiveStatus: vi.fn(),
}));

vi.mock("utils/live-status/client", () => ({
  useLiveStatus,
}));

import { useServiceScaling } from "./client";

describe("useServiceScaling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLiveStatus.mockReturnValue({ data: undefined, error: undefined });
  });

  it("subscribes to the scaling live-status key without a GET fallback", () => {
    renderHook(() => useServiceScaling({ namespace: "chrome", app: "chrome-desktop" }));

    expect(useLiveStatus).toHaveBeenCalledWith("scaling:chrome/chrome-desktop");
  });

  it("treats minReplicaCount 0 as scaled idle", () => {
    useLiveStatus.mockReturnValue({
      data: { namespace: "chrome", name: "chrome-desktop", minReplicaCount: 0 },
      error: undefined,
    });

    const { result } = renderHook(() => useServiceScaling({ namespace: "chrome", app: "chrome-desktop" }));

    expect(result.current.scaledIdle).toBe(true);
    expect(result.current.toggleItem.minReplicaCount).toBe(0);
  });

  it("ignores non-toggleable fallback bodies", () => {
    useLiveStatus.mockReturnValue({ data: { error: "ScaledObject is not homepage-toggleable" }, error: undefined });

    const { result } = renderHook(() => useServiceScaling({ namespace: "chrome", app: "chrome-desktop" }));

    expect(result.current.toggleItem).toBeNull();
    expect(result.current.scaledIdle).toBe(false);
  });
});
