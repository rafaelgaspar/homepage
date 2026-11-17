import { beforeEach, describe, expect, it, vi } from "vitest";

const { getKubeConfig, getK3sHomeConfig, listClusterObjects } = vi.hoisted(() => ({
  getKubeConfig: vi.fn(),
  getK3sHomeConfig: vi.fn(),
  listClusterObjects: vi.fn(),
}));

vi.mock("utils/config/kubernetes", () => ({
  getKubeConfig,
}));

vi.mock("utils/k3s-home/config", () => ({
  getK3sHomeConfig,
}));

vi.mock("utils/k3s-home/list", () => ({
  listClusterObjects,
}));

import { nodeServiceFromCR, scheduleGroupFromCR, servicesFromK3sHome } from "./services";

describe("k3s-home services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getK3sHomeConfig.mockReturnValue({
      enabled: true,
      nodesGroup: "Nodes",
      nodesIcon: "mdi-server-network",
      maintenanceGroup: "Maintenance",
      maintenanceIcon: "mdi-wrench-clock",
    });
    getKubeConfig.mockReturnValue({});
  });

  it("builds a node card with pool description and no href", () => {
    expect(
      nodeServiceFromCR(
        {
          metadata: { name: "ms01vm" },
          spec: { taints: ["scheduling.rafaelgaspar.xyz/reserved=true:PreferNoSchedule"] },
        },
        { nodesIcon: "mdi-server-network" },
      ),
    ).toEqual({
      name: "ms01vm",
      description: "reserved",
      icon: "mdi-server-network",
      type: "service",
      k3sHome: { kind: "node", name: "ms01vm" },
    });
  });

  it("builds a schedule heading that lists runs as their own cards", () => {
    expect(scheduleGroupFromCR({ metadata: { name: "provision" } }, { maintenanceIcon: "mdi-wrench-clock" })).toEqual({
      name: "provision",
      services: [],
      k3sHome: { kind: "schedule", name: "provision", icon: "mdi-wrench-clock" },
    });
  });

  it("returns discovered groups from Node and MaintenanceSchedule CRs", async () => {
    listClusterObjects.mockImplementation(async (plural) => {
      if (plural === "nodes") {
        return { items: [{ metadata: { name: "mfth50" }, spec: {} }], missing: false };
      }
      return { items: [{ metadata: { name: "provision" } }], missing: false };
    });

    await expect(servicesFromK3sHome()).resolves.toEqual([
      {
        name: "Nodes",
        services: [
          expect.objectContaining({
            name: "mfth50",
            description: "free-pool",
            k3sHome: { kind: "node", name: "mfth50" },
            weight: 100,
          }),
        ],
      },
      {
        name: "Maintenance",
        services: [],
        groups: [
          {
            name: "provision",
            services: [],
            k3sHome: { kind: "schedule", name: "provision", icon: "mdi-wrench-clock" },
          },
        ],
      },
    ]);
  });

  it("returns [] when the feature is disabled", async () => {
    getK3sHomeConfig.mockReturnValueOnce({ enabled: false });
    await expect(servicesFromK3sHome()).resolves.toEqual([]);
    expect(listClusterObjects).not.toHaveBeenCalled();
  });
});
