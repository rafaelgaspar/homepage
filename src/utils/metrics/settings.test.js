import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSettings } = vi.hoisted(() => ({
  getSettings: vi.fn(),
}));

vi.mock("utils/config/config", () => ({
  getSettings,
}));

import { getMetricsSettings, isMetricsEnabled } from "./settings";

describe("utils/metrics/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is disabled by default", () => {
    getSettings.mockReturnValue({});
    expect(isMetricsEnabled()).toBe(false);
    expect(getMetricsSettings()).toMatchObject({ enabled: false, port: 9090, path: "/metrics" });
  });

  it("reads enabled, port, and path from settings.yaml", () => {
    getSettings.mockReturnValue({ metrics: { enabled: true, port: 9100, path: "/prom" } });
    expect(getMetricsSettings()).toEqual({ enabled: true, port: 9100, path: "/prom" });
  });

  it("normalizes path without leading slash", () => {
    getSettings.mockReturnValue({ metrics: { enabled: true, path: "metrics" } });
    expect(getMetricsSettings().path).toBe("/metrics");
  });
});
