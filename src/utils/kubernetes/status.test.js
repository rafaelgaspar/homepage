import { describe, expect, it } from "vitest";

import { statusFromPods } from "./status";

describe("statusFromPods", () => {
  it("returns not found when there are no pods", () => {
    expect(statusFromPods([])).toBe("not found");
    expect(statusFromPods(undefined)).toBe("not found");
  });

  it("returns running when every pod is Running or Succeeded", () => {
    expect(statusFromPods([{ status: { phase: "Running" } }, { status: { phase: "Succeeded" } }])).toBe("running");
  });

  it("returns partial when some pods are ready", () => {
    expect(statusFromPods([{ status: { phase: "Running" } }, { status: { phase: "Pending" } }])).toBe("partial");
  });

  it("returns down when no pods are ready", () => {
    expect(statusFromPods([{ status: { phase: "Pending" } }])).toBe("down");
  });
});
