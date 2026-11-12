import { beforeEach, describe, expect, it, vi } from "vitest";

const { isMetricsEnabled } = vi.hoisted(() => ({
  isMetricsEnabled: vi.fn(),
}));

vi.mock("./settings", () => ({
  isMetricsEnabled,
}));

import { recordMcpOidcToken } from "./mcp-oidc";
import { registerAppMetrics, renderMetrics } from "./registry";

const GLOBAL_STATE_KEY = "__homepagePrometheusMetricsState";

describe("utils/metrics/mcp-oidc", () => {
  beforeEach(() => {
    delete globalThis[GLOBAL_STATE_KEY];
    isMetricsEnabled.mockReturnValue(true);
    registerAppMetrics();
  });

  it("records token fetch results when enabled", async () => {
    recordMcpOidcToken("ok", 0.05);
    await vi.waitFor(async () => {
      const body = await renderMetrics();
      expect(body).toContain('homepage_mcp_oidc_token_total{result="ok"} 1');
      expect(body).toContain("homepage_mcp_oidc_token_duration_seconds_count 1");
    });
  });
});
