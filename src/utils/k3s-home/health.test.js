import { describe, expect, it } from "vitest";

import {
  formatPingLatency,
  formatRunDuration,
  nodeHealthTone,
  nodeHealthTooltip,
  resolvePing,
  runPhaseTone,
} from "./health";

function conditions({ healthy = "True", degraded = "False", needsReboot = "False", message = "" } = {}) {
  return [
    { type: "Healthy", status: healthy },
    { type: "Degraded", status: degraded },
    { type: "NeedsReboot", status: needsReboot, message },
  ];
}

describe("k3s-home health", () => {
  it("is green when Healthy is True and other statuses are off", () => {
    expect(nodeHealthTone(conditions())).toBe("green");
    expect(nodeHealthTone(conditions({ needsReboot: "Unknown" }))).toBe("green");
  });

  it("is red when Healthy is False regardless of other statuses", () => {
    expect(nodeHealthTone(conditions({ healthy: "False", needsReboot: "True" }))).toBe("red");
    expect(nodeHealthTone(conditions({ healthy: "False", degraded: "True" }))).toBe("red");
  });

  it("is orange for every other combination", () => {
    expect(nodeHealthTone(conditions({ degraded: "True" }))).toBe("orange");
    expect(nodeHealthTone(conditions({ needsReboot: "True" }))).toBe("orange");
    expect(nodeHealthTone([])).toBe("orange");
  });

  it("includes the three statuses and ping latency in the tooltip", () => {
    expect(nodeHealthTooltip(conditions({ message: "kernel pending" }), { alive: true, time: 1.2 })).toBe(
      ["Healthy: True", "Degraded: False", "NeedsReboot: False (kernel pending)", "Ping: 1 ms"].join("\n"),
    );
    expect(formatPingLatency(null)).toBe("n/a");
    expect(formatPingLatency({ alive: false })).toBe("down");
    expect(formatPingLatency({ alive: true, time: null })).toBe("up");
  });

  it("treats a scraped node-exporter as up when ICMP gets no reply", () => {
    expect(resolvePing({ alive: false, time: null }, 1)).toEqual({ alive: true, time: null });
    expect(resolvePing({ alive: true, time: 4 }, 0)).toEqual({ alive: true, time: 4 });
    expect(resolvePing({ alive: false, time: null }, 0)).toEqual({ alive: false, time: null });
    expect(resolvePing(null, null)).toBeNull();
  });

  it("formats run duration from start to finish, or to now while running", () => {
    expect(
      formatRunDuration(
        { startedAt: "2026-11-17T13:44:14Z", finishedAt: "2026-11-17T15:44:34Z" },
        Date.parse("2026-11-17T16:00:00Z"),
      ),
    ).toBe("2h 0m");
    expect(
      formatRunDuration({ firedAt: "2026-11-17T13:44:14Z" }, Date.parse("2026-11-17T13:45:14Z")),
    ).toBe("1m 0s");
    expect(formatRunDuration({})).toBe("n/a");
  });

  it("maps maintenance run phases to tones", () => {
    expect(runPhaseTone("Succeeded")).toBe("green");
    expect(runPhaseTone("Failed")).toBe("red");
    expect(runPhaseTone("Partial")).toBe("orange");
    expect(runPhaseTone("Unknown")).toBe("gray");
  });
});
