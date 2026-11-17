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

describe("components/services/k3s-home-node", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLiveStatus.mockReturnValue({ data: undefined, error: undefined });
  });

  it("renders one placeholder line while loading", () => {
    const { container } = renderWithProviders(
      <K3sHomeNode service={{ k3sHome: { kind: "node", name: "mfth50" } }} />,
    );

    expect(container.querySelectorAll(".service-block")).toHaveLength(6);
    expect(container.querySelectorAll(".k3s-home-node-row")).toHaveLength(4);
    const rows = [...container.querySelectorAll(".k3s-home-node-row")].map((row) =>
      [...row.querySelectorAll(".service-block-label")].map((label) => label.textContent),
    );
    expect(rows).toEqual([["k3shome.cpu", "k3shome.memory"], ["k3shome.ips"], ["k3shome.kernel", "k3shome.kubelet"], ["k3shome.versions"]]);
  });

  it("puts cpu and memory, addresses, kernel and kubelet, and versions on separate lines", () => {
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

    expect(screen.getByText("192.168.2.41, fd00::1")).toBeInTheDocument();
    expect(screen.getByText("7.2.15+deb14-amd64")).toBeInTheDocument();
    expect(screen.getByText("k3s v1.37.2+k3s1")).toBeInTheDocument();
    expect(screen.getByText("etcd 3.7.3")).toBeInTheDocument();
    const versions = container.querySelector(".k3s-home-versions");
    expect(versions.className).toContain("overflow-hidden");
    expect(versions.querySelectorAll(".k3s-home-version-sep")).toHaveLength(1);
    expect(versions.querySelector(".k3s-home-version-sep").className).toContain("absolute");
    expect(screen.getByText("1.25")).toBeInTheDocument();
    expect(screen.getByText(String(8 * 1024 ** 3))).toBeInTheDocument();
  });
});
