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
    expect(container.querySelector(".k3s-home-node").className).toContain("flex-nowrap");
    expect(screen.getByText("k3shome.cpu")).toBeInTheDocument();
    expect(screen.getByText("k3shome.memory")).toBeInTheDocument();
  });

  it("keeps address, versions, cpu, and memory on one line", () => {
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

    renderWithProviders(<K3sHomeNode service={{ k3sHome: { kind: "node", name: "mfth50" } }} />);

    expect(screen.getByText("192.168.2.41")).toBeInTheDocument();
    expect(screen.getByTitle("192.168.2.41, fd00::1")).toBeInTheDocument();
    expect(screen.queryByText("fd00::1", { exact: false })).not.toBeInTheDocument();
    expect(screen.getByText("7.2.15+deb14-amd64")).toBeInTheDocument();
    expect(screen.getByText("k3s v1.37.2+k3s1 · etcd 3.7.3")).toBeInTheDocument();
    expect(screen.getByText("1.25")).toBeInTheDocument();
    expect(screen.getByText(String(8 * 1024 ** 3))).toBeInTheDocument();
  });
});
