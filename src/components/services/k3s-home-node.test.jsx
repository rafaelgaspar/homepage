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

  it("renders placeholders while loading", () => {
    const { container } = renderWithProviders(
      <K3sHomeNode service={{ k3sHome: { kind: "node", name: "mfth50" } }} />,
    );

    expect(container.querySelectorAll(".service-block")).toHaveLength(4);
    expect(screen.getByText("k3shome.ips")).toBeInTheDocument();
    expect(screen.getByText("k3shome.kernel")).toBeInTheDocument();
    expect(screen.getByText("k3shome.kubelet")).toBeInTheDocument();
    expect(screen.getByText("k3shome.versions")).toBeInTheDocument();
  });

  it("renders extra status fields from the CR", () => {
    useLiveStatus.mockReturnValue({
      data: {
        internalIPs: ["192.168.2.41", "fd00::1"],
        kernelVersion: "7.2.15+deb14-amd64",
        kubeletVersion: "v1.37.2+k3s1",
        versions: { k3s: "v1.37.2+k3s1", etcd: "3.7.3" },
      },
      error: undefined,
    });

    renderWithProviders(<K3sHomeNode service={{ k3sHome: { kind: "node", name: "mfth50" } }} />);

    expect(screen.getByText("192.168.2.41, fd00::1")).toBeInTheDocument();
    expect(screen.getByText("7.2.15+deb14-amd64")).toBeInTheDocument();
    expect(screen.getByText("v1.37.2+k3s1")).toBeInTheDocument();
    expect(screen.getByText("k3s v1.37.2+k3s1 · etcd 3.7.3")).toBeInTheDocument();
  });
});
