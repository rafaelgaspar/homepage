import { describe, expect, it, vi } from "vitest";

import { emitConfigReloadMetric } from "./config-reload";

const { isMetricsEnabled, getConfigReloadCounter } = vi.hoisted(() => ({
  isMetricsEnabled: vi.fn(),
  getConfigReloadCounter: vi.fn(),
}));

vi.mock("./settings", () => ({
  isMetricsEnabled,
}));

vi.mock("./registry", () => ({
  getConfigReloadCounter,
}));

describe("utils/metrics/config-reload", () => {
  it("emits reload counter when metrics are enabled", async () => {
    isMetricsEnabled.mockReturnValue(true);
    const inc = vi.fn();
    getConfigReloadCounter.mockReturnValue({ inc });

    emitConfigReloadMetric("success");
    await vi.waitFor(() => expect(inc).toHaveBeenCalledWith({ result: "success" }));
  });
});
