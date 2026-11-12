import { beforeEach, describe, expect, it, vi } from "vitest";

const { kubeRequest } = vi.hoisted(() => ({
  kubeRequest: vi.fn(),
}));

vi.mock("utils/scaling/kube", () => ({
  kubeRequest,
}));

vi.mock("@kubernetes/client-node", () => ({
  CoreV1Api: class {},
  Watch: class {
    watch() {
      return Promise.resolve({ abort: () => {} });
    }
  },
}));

vi.mock("utils/config/kubernetes", () => ({
  getKubeConfig: vi.fn(() => null),
}));

import { liveStatusCache } from "utils/live-status/cache";

import { getToggleable, listToggleable, setToggleState } from "./service";
import { resetScalingHydrationForTests } from "./store";

const item = {
  metadata: {
    namespace: "chrome",
    name: "chrome-desktop",
    labels: { "scaling.rafaelgaspar.xyz/homepage-toggle": "true" },
  },
  spec: { minReplicaCount: 0, scaleTargetRef: { name: "chrome-desktop" } },
};

describe("scaling service cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    liveStatusCache.clear();
    resetScalingHydrationForTests();
  });

  it("hydrates the live-status cache on list and serves the next list from it", async () => {
    kubeRequest.mockResolvedValueOnce({ items: [item] });

    await expect(listToggleable()).resolves.toEqual([
      {
        namespace: "chrome",
        name: "chrome-desktop",
        minReplicaCount: 0,
        scaleTargetRef: "chrome-desktop",
      },
    ]);

    kubeRequest.mockClear();
    await expect(listToggleable()).resolves.toHaveLength(1);
    expect(kubeRequest).not.toHaveBeenCalled();
  });

  it("serves getToggleable from the live-status cache when fresh", async () => {
    liveStatusCache.set("scaling:chrome/chrome-desktop", {
      namespace: "chrome",
      name: "chrome-desktop",
      minReplicaCount: 1,
      scaleTargetRef: "chrome-desktop",
    });

    await expect(getToggleable("chrome", "chrome-desktop")).resolves.toMatchObject({ minReplicaCount: 1 });
    expect(kubeRequest).not.toHaveBeenCalled();
  });

  it("publishes the new min replica count into the cache after toggling", async () => {
    liveStatusCache.set("scaling:chrome/chrome-desktop", {
      namespace: "chrome",
      name: "chrome-desktop",
      minReplicaCount: 0,
      scaleTargetRef: "chrome-desktop",
    });
    kubeRequest.mockResolvedValue({});

    await expect(setToggleState("chrome", "chrome-desktop")).resolves.toMatchObject({ minReplicaCount: 1 });
    expect(liveStatusCache.get("scaling:chrome/chrome-desktop")).toMatchObject({ minReplicaCount: 1 });
  });
});
