import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { getKubeConfig, coreApi, fetchPodUsage, logger } = vi.hoisted(() => ({
  getKubeConfig: vi.fn(),
  coreApi: { listNamespacedPod: vi.fn() },
  fetchPodUsage: vi.fn(),
  logger: { error: vi.fn() },
}));

vi.mock("@kubernetes/client-node", () => ({
  CoreV1Api: function CoreV1Api() {},
}));

vi.mock("utils/logger", () => ({
  default: () => logger,
}));

vi.mock("utils/config/kubernetes", () => ({
  getKubeConfig,
}));

vi.mock("utils/kubernetes/pod-metrics", () => ({
  fetchPodUsage,
}));

import handler from "pages/api/kubernetes/stats/[...service]";

describe("pages/api/kubernetes/stats/[...service]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKubeConfig.mockReturnValue({
      makeApiClient: () => coreApi,
    });
    fetchPodUsage.mockResolvedValue({ cpu: 0, mem: 0 });
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

    const req = { query: { service: ["default", "app"] } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      error: "no pods found with namespace=default and labelSelector=app.kubernetes.io/name=app",
    });
  });

  it("delegates usage to fetchPodUsage with kubeconfig and pod names", async () => {
    const kc = { makeApiClient: () => coreApi };
    getKubeConfig.mockReturnValue(kc);
    coreApi.listNamespacedPod.mockResolvedValue({
      items: [
        {
          metadata: { name: "pod-a" },
          spec: {
            containers: [{ resources: { limits: { cpu: "500m", memory: "1Gi" } } }],
          },
        },
      ],
    });
    fetchPodUsage.mockResolvedValue({ cpu: 0.25, mem: 512000000 });

    const req = { query: { service: ["default", "app"] } };
    const res = createMockRes();

    await handler(req, res);

    expect(fetchPodUsage).toHaveBeenCalledWith({
      kc,
      namespace: "default",
      podNames: ["pod-a"],
      logger,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.stats.cpu).toBe(0.25);
    expect(res.body.stats.mem).toBe(512000000);
  });

  it("aggregates limits and percent usage for matched pods", async () => {
    coreApi.listNamespacedPod.mockResolvedValue({
      items: [
        {
          metadata: { name: "pod-a" },
          spec: { containers: [{ resources: { limits: { cpu: "1000m", memory: "2Gi" } } }] },
        },
        {
          metadata: { name: "pod-b" },
          spec: { containers: [{ resources: { limits: { cpu: "500m", memory: "1Gi" } } }] },
        },
      ],
    });
    fetchPodUsage.mockResolvedValue({ cpu: 1.0, mem: 1200000000 });

    const req = { query: { service: ["default", "app"], podSelector: "app=test" } };
    const res = createMockRes();

    await handler(req, res);

    expect(coreApi.listNamespacedPod).toHaveBeenCalledWith({
      namespace: "default",
      labelSelector: "app=test",
    });
    expect(fetchPodUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: "default",
        podNames: ["pod-a", "pod-b"],
      }),
    );

    const { stats } = res.body;
    expect(stats.cpuLimit).toBe(1.5);
    expect(stats.memLimit).toBe(3000000000);
    expect(stats.cpu).toBeCloseTo(1.0, 5);
    expect(stats.mem).toBe(1200000000);
    expect(stats.cpuUsage).toBeCloseTo((100 * 1.0) / 1.5, 5);
    expect(stats.memUsage).toBeCloseTo((100 * 1200000000) / 3000000000, 5);
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
