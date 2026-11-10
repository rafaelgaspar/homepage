import { describe, expect, it } from "vitest";

import { parseScalingCacheKey, scalingCacheKey } from "./keys";

describe("scaling cache keys", () => {
  it("builds and parses namespace/name keys", () => {
    expect(scalingCacheKey("chrome", "chrome-desktop")).toBe("scaling:chrome/chrome-desktop");
    expect(parseScalingCacheKey("scaling:chrome/chrome-desktop")).toEqual({
      namespace: "chrome",
      name: "chrome-desktop",
    });
  });

  it("returns null for incomplete or unrelated keys", () => {
    expect(scalingCacheKey("chrome")).toBeNull();
    expect(parseScalingCacheKey("k8s:chrome/chrome-desktop")).toBeNull();
    expect(parseScalingCacheKey("scaling:chrome")).toBeNull();
  });
});
