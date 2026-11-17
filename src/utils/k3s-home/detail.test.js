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

  it("returns null when the run is missing", async () => {
    getClusterObject.mockResolvedValueOnce(null);
    await expect(getMaintenanceRunDetail("missing")).resolves.toBeNull();
  });
});
