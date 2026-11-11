import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getKubeConfig, kubeRequest, watchFn, logger } = vi.hoisted(() => ({
  getKubeConfig: vi.fn(),
  kubeRequest: vi.fn(),
  watchFn: vi.fn(),
  logger: { error: vi.fn() },
}));

vi.mock("utils/logger", () => ({
  default: () => logger,
}));

vi.mock("utils/config/kubernetes", () => ({
  getKubeConfig,
}));

vi.mock("utils/scaling/kube", () => ({
  kubeRequest,
}));

vi.mock("@kubernetes/client-node", () => ({
  CoreV1Api: class {},
  Watch: class {
    watch(...args) {
      return watchFn(...args);
    }
  },
}));

import { liveStatusCache } from "utils/live-status/cache";

import { listToggleable } from "./service";
import { resetScalingWatchForTests, startScalingWatch, stopScalingWatch } from "./watch";

const scaledObject = {
  metadata: {
    namespace: "chrome",
    name: "chrome-desktop",
    labels: { "scaling.rafaelgaspar.xyz/homepage-toggle": "true" },
  },
  spec: { minReplicaCount: 0, scaleTargetRef: { name: "chrome-desktop" } },
};

describe("scaling watch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    liveStatusCache.clear();
    resetScalingWatchForTests();
    getKubeConfig.mockReturnValue({});
    kubeRequest.mockResolvedValue({ items: [scaledObject] });
    watchFn.mockImplementation(async (_path, _params, _cb, done) => ({
      abort: () => done(null),
    }));
  });

  afterEach(async () => {
    await stopScalingWatch();
    resetScalingWatchForTests();
    liveStatusCache.clear();
  });

  it("hydrates the live-status cache from ScaledObjects and serves later lists from it", async () => {
    startScalingWatch();
    await vi.waitFor(() => expect(liveStatusCache.get("scaling:chrome/chrome-desktop")?.minReplicaCount).toBe(0));

    kubeRequest.mockClear();
    await expect(listToggleable()).resolves.toEqual([
      {
        namespace: "chrome",
        name: "chrome-desktop",
        minReplicaCount: 0,
        scaleTargetRef: "chrome-desktop",
      },
    ]);
    expect(kubeRequest).not.toHaveBeenCalled();
  });

  it("updates the cache when the ScaledObject watch fires", async () => {
    let onEvent;
    watchFn.mockImplementation(async (_path, _params, cb) => {
      onEvent = cb;
      return { abort: vi.fn() };
    });

    startScalingWatch();
    await vi.waitFor(() => expect(onEvent).toBeTypeOf("function"));

    onEvent("MODIFIED", {
      ...scaledObject,
      spec: { ...scaledObject.spec, minReplicaCount: 1 },
    });

    expect(liveStatusCache.get("scaling:chrome/chrome-desktop")).toMatchObject({ minReplicaCount: 1 });
  });
});
