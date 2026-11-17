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

import K3sHomeSchedule from "./k3s-home-schedule";

describe("components/services/k3s-home-schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLiveStatus.mockReturnValue({ data: undefined, error: undefined });
  });

  it("renders an empty state when there are no runs", () => {
    renderWithProviders(<K3sHomeSchedule service={{ k3sHome: { kind: "schedule", name: "provision" } }} />);
    expect(screen.getByText("k3shome.no_runs")).toBeInTheDocument();
  });

  it("renders each current run with its phase", () => {
    useLiveStatus.mockReturnValue({
      data: {
        runs: [
          { name: "provision-2", phase: "Partial" },
          { name: "provision-1", phase: "Succeeded" },
        ],
      },
      error: undefined,
    });

    renderWithProviders(<K3sHomeSchedule service={{ k3sHome: { kind: "schedule", name: "provision" } }} />);

    expect(screen.getByText("provision-2")).toBeInTheDocument();
    expect(screen.getByText("Partial")).toBeInTheDocument();
    expect(screen.getByText("provision-1")).toBeInTheDocument();
    expect(screen.getByText("Succeeded")).toBeInTheDocument();
  });
});
