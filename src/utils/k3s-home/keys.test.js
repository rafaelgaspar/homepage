import { describe, expect, it } from "vitest";

import { k3sHomeCacheKey, k3sHomeStatusUrl, parseK3sHomeCacheKey } from "./keys";

describe("k3s-home keys", () => {
  it("builds cache keys and fallback URLs", () => {
    expect(k3sHomeCacheKey("node", "mfth50")).toBe("k3shome:node:mfth50");
    expect(k3sHomeStatusUrl("schedule", "provision")).toBe("/api/k3s-home/schedule/provision");
  });

  it("parses node and schedule keys only", () => {
    expect(parseK3sHomeCacheKey("k3shome:node:mfth50")).toEqual({
      kind: "node",
      name: "mfth50",
      key: "k3shome:node:mfth50",
    });
    expect(parseK3sHomeCacheKey("k3shome:run:x")).toBeNull();
    expect(parseK3sHomeCacheKey("k8s:ns/app")).toBeNull();
  });
});
