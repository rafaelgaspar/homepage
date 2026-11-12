import { beforeEach, describe, expect, it, vi } from "vitest";

const { existsSync, readFileSync, statSync } = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock("fs", () => ({
  existsSync,
  readFileSync,
  statSync,
}));

vi.mock("./config", () => ({
  substituteEnvironmentVars: (value) => value,
}));

import {
  DASHBOARD_CONFIG_FILES,
  evaluateDashboardConfigReadiness,
  onConfigFileTouched,
  resetDashboardConfigReadinessForTests,
} from "./reload-state";

describe("utils/config/reload-state", () => {
  beforeEach(() => {
    resetDashboardConfigReadinessForTests();
    vi.clearAllMocks();
    for (const name of DASHBOARD_CONFIG_FILES) {
      existsSync.mockImplementation((path) => String(path).endsWith(name));
      statSync.mockImplementation((path) => ({ mtimeMs: 1000 }));
      readFileSync.mockImplementation((path) => {
        if (String(path).endsWith("services.yaml")) {
          return "services:\n  - x:\n      href: http://x\n";
        }
        return "{}";
      });
    }
  });

  it("re-validates after a tracked file mtime changes", () => {
    const first = evaluateDashboardConfigReadiness();
    expect(first.ready).toBe(true);

    onConfigFileTouched("settings.yaml", 2000, true);
    statSync.mockImplementation((path) => ({
      mtimeMs: String(path).endsWith("settings.yaml") ? 2000 : 1000,
    }));

    const second = evaluateDashboardConfigReadiness();
    expect(second.ready).toBe(true);
  });
});
