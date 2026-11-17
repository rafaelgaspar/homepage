import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { getMaintenanceRunDetail, logger } = vi.hoisted(() => ({
  getMaintenanceRunDetail: vi.fn(),
  logger: { error: vi.fn() },
}));

vi.mock("utils/logger", () => ({
  default: () => logger,
}));

vi.mock("utils/k3s-home/detail", () => ({
  getMaintenanceRunDetail,
}));

vi.mock("utils/auth", () => ({
  withAuth: (handler) => handler,
}));

vi.mock("utils/metrics/api", () => ({
  withApiMetrics: (_path, handler) => handler,
}));

import handler from "pages/api/k3s-home/run/[name]";

describe("pages/api/k3s-home/run/[name]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the run detail", async () => {
    getMaintenanceRunDetail.mockResolvedValueOnce({ name: "provision-1", tasks: [] });
    const res = createMockRes();
    await handler({ method: "GET", query: { name: "provision-1" } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.tasks).toEqual([]);
  });

  it("returns 404 when the run is missing", async () => {
    getMaintenanceRunDetail.mockResolvedValueOnce(null);
    const res = createMockRes();
    await handler({ method: "GET", query: { name: "missing" } }, res);
    expect(res.statusCode).toBe(404);
  });
});
