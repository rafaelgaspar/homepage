// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useLiveStatus } = vi.hoisted(() => ({
  useLiveStatus: vi.fn(),
}));

vi.mock("utils/live-status/client", () => ({
  useLiveStatus,
}));

import K3sHomeNode from "./k3s-home-node";

function rowLabels(container) {
  return [...container.querySelectorAll(".k3s-home-node-row")].map((row) =>
    [...row.querySelectorAll(".service-block-label")].map((label) => label.textContent),
  );
}

describe("components/services/k3s-home-node", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLiveStatus.mockReturnValue({ data: undefined, error: undefined });
  });

  it("renders placeholder boxes while loading", () => {
    const { container } = renderWithProviders(
      <K3sHomeNode service={{ k3sHome: { kind: "node", name: "mfth50" } }} />,
    );

    expect(container.querySelectorAll(".service-block")).toHaveLength(7);
    expect(rowLabels(container)).toEqual([
      ["k3shome.cpu", "k3shome.memory"],
      ["k3shome.ipv4", "k3shome.ipv6"],
      ["k3shome.kernel", "k3shome.kubelet"],
      ["k3shome.versions"],
    ]);
    const ipRow = container.querySelectorAll(".k3s-home-node-row")[1];
    expect(ipRow.className).toContain("justify-center");
    expect(ipRow.querySelectorAll(".k3s-home-equal")).toHaveLength(2);
  });

  it("spreads address boxes across the row and puts two versions on one line", () => {
    useLiveStatus.mockReturnValue({
      data: {
        ip: "192.168.2.41",
        internalIPs: ["192.168.2.41", "fd00::1"],
        kernelVersion: "7.2.15+deb14-amd64",
        kubeletVersion: "v1.37.2+k3s1",
        versions: { k3s: "v1.37.2+k3s1", etcd: "3.7.3" },
        usage: { cpu: 1.25, memory: 8 * 1024 ** 3 },
      },
      error: undefined,
    });

    const { container } = renderWithProviders(<K3sHomeNode service={{ k3sHome: { kind: "node", name: "mfth50" } }} />);

    expect(screen.getByText("192.168.2.41")).toBeInTheDocument();
    expect(screen.getByText("fd00::1")).toBeInTheDocument();
    const ipRow = container.querySelectorAll(".k3s-home-node-row")[1];
    expect(ipRow.className).toContain("justify-center");
    for (const box of ipRow.querySelectorAll(".k3s-home-equal")) {
      expect(box.className).toContain("flex-1");
    }
    expect(rowLabels(container).slice(-1)).toEqual([["k3shome.k3s", "k3shome.etcd"]]);
    expect(container.querySelectorAll(".k3s-home-version")).toHaveLength(2);
    expect(screen.getAllByText("v1.37.2+k3s1").length).toBeGreaterThan(0);
    expect(screen.getByText("3.7.3")).toBeInTheDocument();
    expect(screen.getByText("1.25")).toBeInTheDocument();
    expect(screen.getByText(String(8 * 1024 ** 3))).toBeInTheDocument();
  });

  it("wraps a third version onto a second line and stretches a lone block full width", () => {
    useLiveStatus.mockReturnValue({
      data: {
        ip: "192.168.2.41",
        internalIPs: ["192.168.2.41"],
        kernelVersion: "7.2.15",
        kubeletVersion: "v1.37.2+k3s1",
        versions: { k3s: "v1.37.2+k3s1", etcd: "3.7.3", nvidiaRunning: "580.95.05", nvidiaInstalled: "580.95.05" },
        usage: { cpu: null, memory: null },
      },
      error: undefined,
    });

    const { container } = renderWithProviders(<K3sHomeNode service={{ k3sHome: { kind: "node", name: "mele2q" } }} />);

    expect(rowLabels(container).slice(-2)).toEqual([["k3shome.k3s", "k3shome.etcd"], ["k3shome.nvidia"]]);
    const boxes = [...container.querySelectorAll(".k3s-home-version")];
    expect(boxes).toHaveLength(3);
    expect(boxes[0].className).toContain("w-[calc(50%-0.125rem)]");
    expect(boxes[1].className).toContain("w-[calc(50%-0.125rem)]");
    expect(boxes[2].className).toContain("flex-1");
    expect(boxes[2].className).not.toContain("w-[calc(50%-0.125rem)]");
    expect(screen.getByText("580.95.05")).toBeInTheDocument();
    expect(screen.queryByText("k3shome.ipv6")).not.toBeInTheDocument();
  });
});
