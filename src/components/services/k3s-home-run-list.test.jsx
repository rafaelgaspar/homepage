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

vi.mock("./k3s-home-run-status", () => ({
  default: function K3sHomeRunStatusMock({ service }) {
    return <div data-testid="k3s-home-run-status" title={service.k3sHome.phase} />;
  },
}));

vi.mock("./k3s-home-run-overlay", () => ({
  default: function OverlayMock() {
    return null;
  },
}));

vi.mock("components/resolvedicon", () => ({
  default: function ResolvedIconMock() {
    return <div data-testid="resolved-icon" />;
  },
}));

import K3sHomeRunList from "./k3s-home-run-list";

describe("components/services/k3s-home-run-list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLiveStatus.mockReturnValue({ data: undefined, error: undefined });
  });

  it("renders an empty state when the schedule has no runs", () => {
    renderWithProviders(
      <K3sHomeRunList groupName="provision" schedule={{ kind: "schedule", name: "provision" }} />,
    );
    expect(screen.getByText("k3shome.no_runs")).toBeInTheDocument();
  });

  it("renders each run as its own card", () => {
    useLiveStatus.mockReturnValue({
      data: {
        runs: [
          { name: "provision-2", phase: "Partial", kind: "provision", trigger: "manual" },
          { name: "provision-1", phase: "Succeeded", kind: "provision" },
        ],
      },
      error: undefined,
    });

    renderWithProviders(
      <K3sHomeRunList
        groupName="provision"
        schedule={{ kind: "schedule", name: "provision", icon: "mdi-wrench-clock" }}
      />,
    );

    expect(screen.getByText("provision-2")).toBeInTheDocument();
    expect(screen.getByText("provision · manual")).toBeInTheDocument();
    expect(screen.getByText("provision-1")).toBeInTheDocument();
    expect(screen.getAllByTestId("k3s-home-run-status")).toHaveLength(2);
  });
});
