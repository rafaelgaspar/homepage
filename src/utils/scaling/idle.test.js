import { beforeEach, describe, expect, it } from "vitest";

import { liveStatusCache } from "utils/live-status/cache";

import { isScaledIdle } from "./idle";

describe("isScaledIdle", () => {
  beforeEach(() => {
    liveStatusCache.clear();
  });

  it("is true only when the ScaledObject is cached at min replicas 0", () => {
    expect(isScaledIdle("chrome", "chrome-desktop")).toBe(false);

    liveStatusCache.set("scaling:chrome/chrome-desktop", { minReplicaCount: 1 });
    expect(isScaledIdle("chrome", "chrome-desktop")).toBe(false);

    liveStatusCache.set("scaling:chrome/chrome-desktop", { minReplicaCount: 0 });
    expect(isScaledIdle("chrome", "chrome-desktop")).toBe(true);
  });
});
