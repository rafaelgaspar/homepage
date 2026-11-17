// @vitest-environment jsdom

import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

import K3sHomeRunOverlay from "./k3s-home-run-overlay";

describe("components/services/k3s-home-run-overlay", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the run, its tasks, and the running task log", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        schedule: "provision",
        kind: "provision",
        phase: "Running",
        firedAt: "2026-11-17T13:44:14Z",
        steps: ["init-host", "bootstrap-k3s"],
        plan: ["mfth50"],
        skipped: { mele2q: "unreachable" },
        tasks: [
          {
            name: "init-host",
            node: "mfth50",
            step: "init-host",
            phase: "Succeeded",
            log: "host ready",
          },
          {
            name: "bootstrap-k3s",
            node: "mfth50",
            step: "bootstrap-k3s",
            phase: "Running",
            log: "joining",
          },
        ],
      }),
    });

    renderWithProviders(<K3sHomeRunOverlay name="provision-1" onClose={() => {}} />);

    expect(await screen.findByRole("dialog", { name: "provision-1" })).toBeInTheDocument();
    expect(screen.getByText("host ready")).toBeInTheDocument();
    expect(screen.getByText("joining")).toBeInTheDocument();
    expect(screen.getByText("init-host, bootstrap-k3s")).toBeInTheDocument();
    expect(screen.getByText("mele2q: unreachable")).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/k3s-home/run/provision-1"));
  });
});
