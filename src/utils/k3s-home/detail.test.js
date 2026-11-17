import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClusterObject } = vi.hoisted(() => ({
  getClusterObject: vi.fn(),
}));

vi.mock("utils/k3s-home/list", () => ({
  getClusterObject,
}));

import { getMaintenanceRunDetail } from "./detail";

describe("k3s-home run detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads task logs without putting them on the run summary", async () => {
    getClusterObject.mockImplementation(async (plural, name) => {
      if (plural === "maintenanceruns") {
        return {
          metadata: { name },
          spec: { schedule: "provision", kind: "provision" },
          status: { phase: "Running", tasks: [{ task: "task-a", phase: "Running", node: "mfth50" }] },
        };
      }
      return { metadata: { name }, status: { run: { log: "line", phase: "Running" } } };
    });

    const detail = await getMaintenanceRunDetail("provision-1");
    expect(detail.tasks[0]).toMatchObject({ name: "task-a", log: "line", phase: "Running" });
    expect(getClusterObject).toHaveBeenCalledWith("maintenancetasks", "task-a");
  });

  it("loads logs for node and bounce tasks, and keeps inline node logs", async () => {
    getClusterObject.mockImplementation(async (plural, name) => {
      if (plural === "maintenanceruns") {
        return {
          metadata: { name },
          spec: { schedule: "cleanup", kind: "cleanup" },
          status: {
            phase: "Succeeded",
            nodes: {
              mele2q: { phase: "Succeeded", step: "cleanup", task: "cleanup-mele2q" },
              melex5: { phase: "Failed", step: "rollout", log: ["cordon", "drain"] },
            },
            bounce: { phase: "Succeeded", task: "cleanup-bounce" },
          },
        };
      }
      if (name === "cleanup-mele2q") {
        return { metadata: { name }, status: { run: { log: "cleaned" } } };
      }
      if (name === "cleanup-bounce") {
        return { metadata: { name }, status: { run: { log: "evicted 3" } } };
      }
      return null;
    });

    const detail = await getMaintenanceRunDetail("cleanup-1");
    expect(detail.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "cleanup-mele2q", log: "cleaned" }),
        expect.objectContaining({ name: "melex5-rollout", log: "cordon\ndrain" }),
        expect.objectContaining({ name: "cleanup-bounce", log: "evicted 3" }),
      ]),
    );
    expect(getClusterObject).toHaveBeenCalledWith("maintenancetasks", "cleanup-mele2q");
    expect(getClusterObject).toHaveBeenCalledWith("maintenancetasks", "cleanup-bounce");
  });

  it("returns null when the run is missing", async () => {
    getClusterObject.mockResolvedValueOnce(null);
    await expect(getMaintenanceRunDetail("missing")).resolves.toBeNull();
  });
});
