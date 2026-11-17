import { describe, expect, it } from "vitest";

import { formatPingLatency, nodeHealthTone, nodeHealthTooltip, runPhaseTone } from "./health";

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
  });

  it("maps maintenance run phases to tones", () => {
    expect(runPhaseTone("Succeeded")).toBe("green");
    expect(runPhaseTone("Failed")).toBe("red");
    expect(runPhaseTone("Partial")).toBe("orange");
    expect(runPhaseTone("Unknown")).toBe("gray");
  });
});
