// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useLiveStatus } = vi.hoisted(() => ({
  useLiveStatus: vi.fn(),
}));

vi.mock("utils/live-status/client", () => ({
  useLiveStatus,
}));

import K3sHomeStatus from "./k3s-home-status";

const conditions = [
  { type: "Healthy", status: "True" },
  { type: "Degraded", status: "False" },
  { type: "NeedsReboot", status: "False" },
];

describe("components/services/k3s-home-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLiveStatus.mockReturnValue({ data: undefined, error: undefined });
  });

  it("subscribes to the node live-status key", () => {
    render(<K3sHomeStatus service={{ k3sHome: { kind: "node", name: "mfth50" } }} />);

    expect(useLiveStatus).toHaveBeenCalledWith("k3shome:node:mfth50", {
      fallbackUrl: "/api/k3s-home/node/mfth50",
    });
  });

  it("renders a green dot when only Healthy is on", () => {
    useLiveStatus.mockReturnValue({
      data: { conditions, ping: { alive: true, time: 2 } },
      error: undefined,
    });

    const { container } = render(
      <K3sHomeStatus service={{ k3sHome: { kind: "node", name: "mfth50" } }} style="dot" />,
    );

    const status = container.querySelector(".k3s-home-status");
    expect(status?.getAttribute("title")).toContain("Healthy: True");
    expect(status?.getAttribute("title")).toContain("Ping: 2 ms");
    expect(container.querySelector(".bg-emerald-500")).toBeTruthy();
  });

  it("renders a red dot when Healthy is False", () => {
    useLiveStatus.mockReturnValue({
      data: {
        conditions: [
          { type: "Healthy", status: "False" },
          { type: "Degraded", status: "True" },
          { type: "NeedsReboot", status: "True" },
        ],
      },
      error: undefined,
    });

    const { container } = render(
      <K3sHomeStatus service={{ k3sHome: { kind: "node", name: "mfth50" } }} style="dot" />,
    );

    expect(container.querySelector(".bg-rose-500")).toBeTruthy();
  });

  it("renders an orange dot when Healthy is True and another status is on", () => {
    useLiveStatus.mockReturnValue({
      data: {
        conditions: [
          { type: "Healthy", status: "True" },
          { type: "Degraded", status: "False" },
          { type: "NeedsReboot", status: "True" },
        ],
      },
      error: undefined,
    });

    const { container } = render(
      <K3sHomeStatus service={{ k3sHome: { kind: "node", name: "mfth50" } }} style="dot" />,
    );

    expect(container.querySelector(".bg-orange-400")).toBeTruthy();
  });
});
