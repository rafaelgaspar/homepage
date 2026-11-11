// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useLiveStatus, useServiceScaling } = vi.hoisted(() => ({
  useLiveStatus: vi.fn(),
  useServiceScaling: vi.fn(),
}));

vi.mock("utils/live-status/client", () => ({
  useLiveStatus,
}));

vi.mock("utils/scaling/client", () => ({
  useServiceScaling,
  SCALING_LIST_KEY: "/api/scaling",
  scalingItemKey: (ns, name) => `/api/scaling/${ns}/${name}`,
}));

vi.mock("i18next", () => ({
  t: (key) => key,
}));

import KubernetesStatus from "./kubernetes-status";

describe("components/services/kubernetes-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useServiceScaling.mockReturnValue({ scaledIdle: false });
    useLiveStatus.mockReturnValue({ data: undefined, error: undefined });
  });

  it("subscribes to the live-status key including podSelector", () => {
    render(<KubernetesStatus service={{ namespace: "ns", app: "app", podSelector: "x=y" }} />);

    expect(useLiveStatus).toHaveBeenCalledWith("k8s:ns/app?podSelector=x=y", {
      fallbackUrl: "/api/kubernetes/status/ns/app?podSelector=x=y",
    });
  });

  it("skips kubernetes status polling when scaled idle", () => {
    useServiceScaling.mockReturnValue({ scaledIdle: true });

    render(<KubernetesStatus service={{ namespace: "ns", app: "app" }} style="dot" />);

    expect(useLiveStatus).toHaveBeenCalledWith(null, { fallbackUrl: undefined });
    expect(screen.getByTitle("scaled down")).toBeInTheDocument();
  });

  it("renders the health/status label when running", () => {
    useLiveStatus.mockReturnValue({ data: { status: "running", health: "healthy" }, error: undefined });

    render(<KubernetesStatus service={{ namespace: "ns", app: "app" }} />);

    expect(screen.getByText("healthy")).toBeInTheDocument();
  });

  it("renders a dot when style is dot", () => {
    useLiveStatus.mockReturnValue({ data: { status: "running" }, error: undefined });

    const { container } = render(<KubernetesStatus service={{ namespace: "ns", app: "app" }} style="dot" />);

    expect(container.querySelector(".rounded-full")).toBeTruthy();
  });

  it("renders an error label when the live stream returns an error", () => {
    useLiveStatus.mockReturnValue({ data: undefined, error: new Error("nope") });

    const { container } = render(<KubernetesStatus service={{ namespace: "ns", app: "app" }} />);

    expect(screen.getByText("docker.error")).toBeInTheDocument();
    expect(container.querySelector(".k8s-status")?.getAttribute("title")).toBe("docker.error");
  });

  it("renders orange status labels when the workload is down/partial/not found", () => {
    useLiveStatus.mockReturnValue({ data: { status: "down" }, error: undefined });

    const { container } = render(<KubernetesStatus service={{ namespace: "ns", app: "app" }} />);

    expect(screen.getByText("down")).toBeInTheDocument();
    expect(container.querySelector(".k8s-status")?.getAttribute("title")).toBe("down");
  });
});
