import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getKubeConfig, coreApi, watchFn, logger } = vi.hoisted(() => ({
  getKubeConfig: vi.fn(),
  coreApi: { listNamespacedPod: vi.fn() },
  watchFn: vi.fn(),
  logger: { error: vi.fn() },
}));

vi.mock("utils/logger", () => ({
  default: () => logger,
}));

vi.mock("utils/config/kubernetes", () => ({
  getKubeConfig,
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

import { getKubernetesStatus, resetKubernetesWatchesForTests, startWatch, stopAllWatches } from "./watch-manager";

const probe = {
  namespace: "default",
  app: "app",
  labelSelector: "app.kubernetes.io/name=app",
  key: "k8s:default/app",
};

describe("kubernetes watch-manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    liveStatusCache.clear();
    resetKubernetesWatchesForTests();
    getKubeConfig.mockReturnValue({
      makeApiClient: () => coreApi,
    });
    watchFn.mockImplementation(async (_path, _params, _cb, done) => ({
      abort: () => done(null),
    }));
  });

  afterEach(async () => {
    await stopAllWatches();
    liveStatusCache.clear();
  });

  it("lists pods once and serves later reads from the cache", async () => {
    coreApi.listNamespacedPod.mockResolvedValue({
      items: [{ metadata: { namespace: "default", name: "app-0" }, status: { phase: "Running" } }],
    });

    await expect(getKubernetesStatus(probe)).resolves.toEqual({ status: "running" });
    await expect(getKubernetesStatus(probe)).resolves.toEqual({ status: "running" });

    expect(coreApi.listNamespacedPod).toHaveBeenCalledTimes(1);
    expect(coreApi.listNamespacedPod).toHaveBeenCalledWith({
      namespace: "default",
      labelSelector: "app.kubernetes.io/name=app",
    });
  });

  it("updates the cached status when the watch sees a pod phase change", async () => {
    coreApi.listNamespacedPod.mockResolvedValue({
      items: [{ metadata: { namespace: "default", name: "app-0" }, status: { phase: "Running" } }],
    });

    let onEvent;
    watchFn.mockImplementation(async (_path, _params, cb) => {
      onEvent = cb;
      return { abort: vi.fn() };
    });

    await getKubernetesStatus(probe);
    expect(liveStatusCache.get(probe.key)).toEqual({ status: "running" });

    startWatch(probe);
    await vi.waitFor(() => expect(onEvent).toBeTypeOf("function"));

    onEvent("MODIFIED", {
      metadata: { namespace: "default", name: "app-0" },
      status: { phase: "Pending" },
    });
    expect(liveStatusCache.get(probe.key)).toEqual({ status: "down" });
  });

  it("returns a communication error when the list fails", async () => {
    coreApi.listNamespacedPod.mockRejectedValue({ statusCode: 500, body: "nope", response: "nope" });

    await expect(getKubernetesStatus(probe)).resolves.toEqual({
      error: "Error communicating with kubernetes",
    });
  });
});
