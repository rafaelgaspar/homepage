import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getKubeConfig,
  getK3sHomeConfig,
  listClusterObjects,
  getClusterObject,
  probeHost,
  fetchNodeSample,
  watchFn,
  logger,
} = vi.hoisted(() => ({
  getKubeConfig: vi.fn(),
  getK3sHomeConfig: vi.fn(),
  listClusterObjects: vi.fn(),
  getClusterObject: vi.fn(),
  probeHost: vi.fn(),
  fetchNodeSample: vi.fn(),
  watchFn: vi.fn(),
  logger: { error: vi.fn() },
}));

vi.mock("utils/logger", () => ({
  default: () => logger,
}));

vi.mock("utils/config/kubernetes", () => ({
  getKubeConfig,
}));

vi.mock("utils/k3s-home/config", () => ({
  getK3sHomeConfig,
}));

vi.mock("utils/k3s-home/list", () => ({
  listClusterObjects,
  getClusterObject,
}));

vi.mock("utils/k3s-home/ping", () => ({
  probeHost,
}));

vi.mock("utils/k3s-home/metrics", () => ({
  fetchNodeSample,
}));

vi.mock("@kubernetes/client-node", () => ({
  Watch: class {
    watch(...args) {
      return watchFn(...args);
    }
  },
}));

import { liveStatusCache } from "utils/live-status/cache";

import {
  applyWatchEvent,
  getK3sHomeStatus,
  resetK3sHomeWatchForTests,
  startK3sHomeWatch,
  stopK3sHomeWatch,
} from "./watch";

const node = {
  metadata: { name: "mfth50" },
  spec: { ip: "192.168.2.41" },
  status: {
    conditions: [{ type: "Healthy", status: "True" }],
    core: { internalIPs: ["192.168.2.41"], kernelVersion: "7.2", kubeletVersion: "v1.37.2+k3s1" },
    host: { versions: { k3s: "v1.37.2+k3s1" } },
  },
};

const schedule = {
  metadata: { name: "provision" },
  spec: { schedule: "0 1 * * *" },
  status: { lastRun: "provision-1" },
};

const run = {
  metadata: { name: "provision-1" },
  spec: { schedule: "provision", firedAt: "2026-11-17T10:00:00Z" },
  status: { phase: "Partial" },
};

describe("k3s-home watch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    liveStatusCache.clear();
    resetK3sHomeWatchForTests();
    getK3sHomeConfig.mockReturnValue({ enabled: true });
    getKubeConfig.mockReturnValue({});
    probeHost.mockResolvedValue({ alive: true, time: 1 });
    fetchNodeSample.mockResolvedValue({ usage: { cpu: 12, memory: 40 }, up: 1 });
    listClusterObjects.mockImplementation(async (plural) => {
      if (plural === "nodes") return { items: [node], missing: false };
      if (plural === "maintenanceschedules") return { items: [schedule], missing: false };
      return { items: [run], missing: false };
    });
    watchFn.mockImplementation(async (_path, _params, _cb, done) => ({
      abort: () => done(null),
    }));
  });

  afterEach(async () => {
    await stopK3sHomeWatch();
    resetK3sHomeWatchForTests();
    liveStatusCache.clear();
  });

  it("hydrates node and schedule cache entries from CRs", async () => {
    await startK3sHomeWatch();

    await vi.waitFor(() => expect(liveStatusCache.get("k3shome:node:mfth50")?.name).toBe("mfth50"));
    expect(liveStatusCache.get("k3shome:schedule:provision")?.runs).toEqual([
      expect.objectContaining({ name: "provision-1", phase: "Partial" }),
    ]);
  });

  it("updates a node when the watch fires", async () => {
    applyWatchEvent("node", "ADDED", node);
    applyWatchEvent("node", "MODIFIED", {
      ...node,
      status: {
        ...node.status,
        conditions: [{ type: "Healthy", status: "False" }],
      },
    });

    expect(liveStatusCache.get("k3shome:node:mfth50").conditions[0].status).toBe("False");
  });

  it("attaches a new run to its schedule", () => {
    applyWatchEvent("schedule", "ADDED", schedule);
    applyWatchEvent("run", "ADDED", run);

    expect(liveStatusCache.get("k3shome:schedule:provision").runs[0].name).toBe("provision-1");
    expect(liveStatusCache.get("k3shome:run:provision-1").phase).toBe("Partial");
  });

  it("serves a cache miss from a direct get", async () => {
    getClusterObject.mockResolvedValueOnce(node);

    await expect(getK3sHomeStatus("node", "mfth50")).resolves.toMatchObject({ name: "mfth50", ip: "192.168.2.41" });
    expect(probeHost).toHaveBeenCalledWith("192.168.2.41");
  });
});
