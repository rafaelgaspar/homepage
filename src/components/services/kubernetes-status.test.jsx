// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useSWR, useServiceScaling } = vi.hoisted(() => ({
  useSWR: vi.fn(),
  useServiceScaling: vi.fn(),
}));

vi.mock("swr", () => ({
  default: useSWR,
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
    useSWR.mockReturnValue({ data: undefined, error: undefined });
  });

  it("includes podSelector in the request when provided", () => {
    render(<KubernetesStatus service={{ namespace: "ns", app: "app", podSelector: "x=y" }} />);

    expect(useSWR).toHaveBeenCalledWith("/api/kubernetes/status/ns/app?podSelector=x=y");
  });

  it("skips kubernetes status polling when scaled idle", () => {
    useServiceScaling.mockReturnValue({ scaledIdle: true });

    render(<KubernetesStatus service={{ namespace: "ns", app: "app" }} style="dot" />);

    expect(useSWR).toHaveBeenCalledWith(null);
    expect(screen.getByTitle("scaled down")).toBeInTheDocument();
  });

  it("renders the health/status label when running", () => {
    useSWR.mockReturnValue({ data: { status: "running", health: "healthy" }, error: undefined });

    render(<KubernetesStatus service={{ namespace: "ns", app: "app" }} />);

    expect(screen.getByText("healthy")).toBeInTheDocument();
  });

  it("renders a dot when style is dot", () => {
    useSWR.mockReturnValue({ data: { status: "running" }, error: undefined });

    const { container } = render(<KubernetesStatus service={{ namespace: "ns", app: "app" }} style="dot" />);

    expect(container.querySelector(".rounded-full")).toBeTruthy();
  });

  it("renders an error label when SWR returns an error", () => {
    useSWR.mockReturnValue({ data: undefined, error: new Error("nope") });

    const { container } = render(<KubernetesStatus service={{ namespace: "ns", app: "app" }} />);

    expect(screen.getByText("docker.error")).toBeInTheDocument();
    expect(container.querySelector(".k8s-status")?.getAttribute("title")).toBe("docker.error");
  });

  it("renders orange status labels when the workload is down/partial/not found", () => {
    useSWR.mockReturnValue({ data: { status: "down" }, error: undefined });

    const { container } = render(<KubernetesStatus service={{ namespace: "ns", app: "app" }} />);

    expect(screen.getByText("down")).toBeInTheDocument();
    expect(container.querySelector(".k8s-status")?.getAttribute("title")).toBe("down");
  });
});
