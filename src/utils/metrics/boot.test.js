import { describe, expect, it, vi } from "vitest";

const { startMetricsServer } = vi.hoisted(() => ({
  startMetricsServer: vi.fn(),
}));

vi.mock("./server", () => ({
  startMetricsServer,
}));

describe("utils/metrics/boot", () => {
  it("starts the metrics server as a side effect of import", async () => {
    await import("./boot");

    expect(startMetricsServer).toHaveBeenCalled();
  });
});
