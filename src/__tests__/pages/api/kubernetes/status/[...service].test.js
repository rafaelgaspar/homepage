import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { getKubeConfig, coreApi, logger, getToggleable } = vi.hoisted(() => ({
  getKubeConfig: vi.fn(),
  coreApi: { listNamespacedPod: vi.fn() },
  logger: { error: vi.fn() },
  getToggleable: vi.fn(),
}));

vi.mock("utils/logger", () => ({
  default: () => logger,
}));

vi.mock("utils/config/kubernetes", () => ({
  getKubeConfig,
}));

vi.mock("utils/scaling/service", () => ({
  getToggleable,
}));

import handler from "pages/api/kubernetes/status/[...service]";

describe("pages/api/kubernetes/status/[...service]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKubeConfig.mockReturnValue({
      makeApiClient: () => coreApi,
    });
  });

  it("returns 400 when namespace/appName params are missing", async () => {
    const req = { query: { service: [] } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "kubernetes query parameters are required" });
  });

  it("returns 500 when kubernetes is not configured", async () => {
    getKubeConfig.mockReturnValue(null);

    const req = { query: { service: ["default", "app"] } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "No kubernetes configuration" });
  });

  it("returns 500 when listNamespacedPod fails", async () => {
    coreApi.listNamespacedPod.mockRejectedValue({ statusCode: 500, body: "nope", response: "nope" });

    const req = { query: { service: ["default", "app"] } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Error communicating with kubernetes" });
  });

  it("returns 404 when no pods match the selector", async () => {
    coreApi.listNamespacedPod.mockResolvedValue({ items: [] });
    getToggleable.mockRejectedValue(new Error("not toggleable"));

    const req = { query: { service: ["default", "app"] } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ status: "not found" });
  });

  it("returns idle when toggleable workload is scaled down", async () => {
    coreApi.listNamespacedPod.mockResolvedValue({ items: [] });
    getToggleable.mockResolvedValue({ minReplicaCount: 0 });

    const req = { query: { service: ["chrome", "chrome-desktop"] } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "idle" });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("returns partial when some pods are ready but not all", async () => {
    coreApi.listNamespacedPod.mockResolvedValue({
      items: [{ status: { phase: "Running" } }, { status: { phase: "Pending" } }],
    });

    const req = { query: { service: ["default", "app"] } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "partial" });
  });

  it("returns running when all pods are ready", async () => {
    coreApi.listNamespacedPod.mockResolvedValue({
      items: [{ status: { phase: "Running" } }, { status: { phase: "Succeeded" } }],
    });

    const req = { query: { service: ["default", "app"], podSelector: "app=test" } };
    const res = createMockRes();

    await handler(req, res);

    expect(coreApi.listNamespacedPod).toHaveBeenCalledWith({
      namespace: "default",
      labelSelector: "app=test",
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "running" });
  });

  it("returns 500 when an unexpected error is thrown", async () => {
    getKubeConfig.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const req = { query: { service: ["default", "app"] } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "unknown error" });
    expect(logger.error).toHaveBeenCalled();
  });
});
