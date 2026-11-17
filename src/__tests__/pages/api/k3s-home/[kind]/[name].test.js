import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { getK3sHomeStatus, logger } = vi.hoisted(() => ({
  getK3sHomeStatus: vi.fn(),
  logger: { error: vi.fn() },
}));

vi.mock("utils/logger", () => ({
  default: () => logger,
}));

vi.mock("utils/k3s-home/watch", () => ({
  getK3sHomeStatus,
}));

vi.mock("utils/auth", () => ({
  withAuth: (handler) => handler,
}));

vi.mock("utils/metrics/api", () => ({
  withApiMetrics: (_path, handler) => handler,
}));

import handler from "pages/api/k3s-home/[kind]/[name]";

describe("pages/api/k3s-home/[kind]/[name]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when kind or name is missing", async () => {
    const res = createMockRes();
    await handler({ query: { kind: "node" } }, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when the object is missing", async () => {
    getK3sHomeStatus.mockResolvedValueOnce(undefined);
    const res = createMockRes();
    await handler({ query: { kind: "node", name: "mfth50" } }, res);
    expect(res.statusCode).toBe(404);
  });

  it("returns the cached payload", async () => {
    getK3sHomeStatus.mockResolvedValueOnce({ name: "mfth50", pool: "free-pool" });
    const res = createMockRes();
    await handler({ query: { kind: "node", name: "mfth50" } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ name: "mfth50", pool: "free-pool" });
  });
});
