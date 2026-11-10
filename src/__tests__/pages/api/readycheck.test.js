import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { evaluateDashboardConfigReadiness } = vi.hoisted(() => ({
  evaluateDashboardConfigReadiness: vi.fn(),
}));

vi.mock("utils/config/reload-state", () => ({
  evaluateDashboardConfigReadiness,
}));

import handler from "pages/api/readycheck";

describe("pages/api/readycheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ready when dashboard config validates", async () => {
    evaluateDashboardConfigReadiness.mockReturnValue({ ready: true });
    const res = createMockRes();
    await handler({}, res);
    expect(res.body).toBe("ready");
  });

  it("returns 503 while config is reloading or invalid", async () => {
    evaluateDashboardConfigReadiness.mockReturnValue({ ready: false, reason: "settings.yaml: bad" });
    const res = createMockRes();
    await handler({}, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.body).toBe("settings.yaml: bad");
  });
});
