import { describe, expect, it } from "vitest";

import { formatInternalIPs, formatVersions, mapNode, mapRunDetail, mapSchedule, primaryNodeAddress } from "./map";

describe("k3s-home map", () => {
  it("maps node CR status used by the card", () => {
    const mapped = mapNode(
      {
        metadata: { name: "mfth50" },
        spec: { ip: "192.168.2.41", taints: [] },
        status: {
          conditions: [{ type: "Healthy", status: "True" }],
          core: {
            internalIPs: ["192.168.2.41", "fd00::1"],
            kernelVersion: "7.2.15",
            kubeletVersion: "v1.37.2+k3s1",
          },
          host: { versions: { k3s: "v1.37.2+k3s1", etcd: "3.7.3" } },
        },
      },
      { alive: true, time: 2 },
    );

    expect(mapped).toMatchObject({
      name: "mfth50",
      pool: "free-pool",
      ip: "192.168.2.41",
      kernelVersion: "7.2.15",
      kubeletVersion: "v1.37.2+k3s1",
      ping: { alive: true, time: 2 },
    });
    expect(mapped.usage).toEqual({ cpu: null, memory: null });
    expect(formatInternalIPs(mapped.internalIPs)).toBe("192.168.2.41, fd00::1");
    expect(primaryNodeAddress(mapped.internalIPs)).toBe("192.168.2.41");
    expect(formatVersions(mapped.versions)).toBe("k3s v1.37.2+k3s1 · etcd 3.7.3");
  });

  it("attaches newest-first runs to a schedule", () => {
    const mapped = mapSchedule(
      { metadata: { name: "provision" }, spec: { schedule: "0 1 * * *" }, status: { lastRun: "provision-2" } },
      [
        {
          metadata: { name: "provision-1" },
          spec: { schedule: "provision", firedAt: "2026-11-16T00:00:00Z" },
          status: { phase: "Failed" },
        },
        {
          metadata: { name: "other" },
          spec: { schedule: "cleanup", firedAt: "2026-11-17T00:00:00Z" },
          status: { phase: "Succeeded" },
        },
        {
          metadata: { name: "provision-2" },
          spec: { schedule: "provision", firedAt: "2026-11-17T10:00:00Z" },
          status: { phase: "Partial" },
        },
      ],
    );

    expect(mapped.runs.map((run) => run.name)).toEqual(["provision-2", "provision-1"]);
    expect(mapped.runs[0].phase).toBe("Partial");
  });

  it("attaches task logs only on the detail view", () => {
    const detail = mapRunDetail(
      {
        metadata: { name: "provision-1" },
        spec: { schedule: "provision", kind: "provision", firedAt: "2026-11-17T10:00:00Z", steps: ["init-host"] },
        status: {
          phase: "Running",
          tasks: [{ task: "provision-1-init", node: "mfth50", step: "init-host", phase: "Running" }],
        },
      },
      [
        {
          metadata: { name: "provision-1-init" },
          status: { run: { phase: "Running", log: "tail line" } },
        },
      ],
    );

    expect(detail.tasks).toEqual([
      expect.objectContaining({ name: "provision-1-init", phase: "Running", log: "tail line" }),
    ]);
    expect(detail.report).toBe("");
    expect(detail.discordSummary).toBe("");
  });

  it("formats mismatched NVIDIA versions", () => {
    expect(formatVersions({ nvidiaInstalled: "620.70.06", nvidiaRunning: "550.0" })).toBe("nvidia 620.70.06 / 550.0");
  });
});
