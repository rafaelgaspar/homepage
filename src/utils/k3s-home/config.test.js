import { beforeEach, describe, expect, it, vi } from "vitest";

const { getKubernetes } = vi.hoisted(() => ({
  getKubernetes: vi.fn(),
}));

vi.mock("utils/config/kubernetes", () => ({
  getKubernetes,
}));

import { getK3sHomeConfig } from "./config";

describe("k3s-home config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is disabled when kubernetes is off", () => {
    getKubernetes.mockReturnValueOnce(null);
    expect(getK3sHomeConfig()).toEqual({ enabled: false });

    getKubernetes.mockReturnValueOnce({ mode: "disabled" });
    expect(getK3sHomeConfig()).toEqual({ enabled: false });
  });

  it("can be turned off explicitly", () => {
    getKubernetes.mockReturnValueOnce({ mode: "cluster", k3sHome: false });
    expect(getK3sHomeConfig()).toEqual({ enabled: false });

    getKubernetes.mockReturnValueOnce({ mode: "cluster", k3sHome: { enabled: false } });
    expect(getK3sHomeConfig()).toEqual({ enabled: false });
  });

  it("defaults group names and icons when kubernetes is on", () => {
    getKubernetes.mockReturnValueOnce({ mode: "cluster" });
    expect(getK3sHomeConfig()).toEqual({
      enabled: true,
      nodesGroup: "Nodes",
      nodesIcon: "mdi-server-network",
      maintenanceGroup: "Maintenance",
      maintenanceIcon: "mdi-wrench-clock",
    });
  });
});
