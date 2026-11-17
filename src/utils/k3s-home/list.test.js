import { beforeEach, describe, expect, it, vi } from "vitest";

const { getKubeConfig, crd, logger } = vi.hoisted(() => ({
  getKubeConfig: vi.fn(),
  crd: {
    listClusterCustomObject: vi.fn(),
    getClusterCustomObject: vi.fn(),
  },
  logger: { error: vi.fn() },
}));

vi.mock("utils/config/kubernetes", () => ({
  getKubeConfig,
}));

vi.mock("utils/logger", () => ({
  default: () => logger,
}));

vi.mock("@kubernetes/client-node", () => ({
  CustomObjectsApi: class CustomObjectsApi {},
}));

import { getClusterObject, listClusterObjects } from "./list";

describe("k3s-home list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKubeConfig.mockReturnValue({
      makeApiClient: () => crd,
    });
  });

  it("returns items from a cluster list", async () => {
    crd.listClusterCustomObject.mockResolvedValueOnce({ items: [{ metadata: { name: "mfth50" } }] });

    await expect(listClusterObjects("nodes")).resolves.toEqual({
      items: [{ metadata: { name: "mfth50" } }],
      missing: false,
    });
  });

  it("treats a missing CRD as missing rather than an error", async () => {
    crd.listClusterCustomObject.mockRejectedValueOnce({ statusCode: 404 });

    await expect(listClusterObjects("nodes")).resolves.toEqual({ items: [], missing: true });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("returns null when a named object is missing", async () => {
    crd.getClusterCustomObject.mockRejectedValueOnce({ statusCode: 404 });

    await expect(getClusterObject("nodes", "nope")).resolves.toBeNull();
  });
});
