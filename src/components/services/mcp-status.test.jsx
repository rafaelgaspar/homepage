// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useLiveStatus } = vi.hoisted(() => ({
  useLiveStatus: vi.fn(),
}));

vi.mock("utils/live-status/client", () => ({
  useLiveStatus,
}));

import McpStatus from "./mcp-status";

describe("components/services/mcp-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLiveStatus.mockReturnValue({ data: undefined, error: undefined });
  });

  it("subscribes to the mcp live-status key for the service", () => {
    render(<McpStatus service={{ name: "IMAP MCP" }} style="dot" />);

    expect(useLiveStatus).toHaveBeenCalledWith("mcp:imap-mcp", {
      fallbackUrl: "/api/mcpMonitor?id=imap-mcp",
    });
  });

  it("renders the tool count when the probe is ok", () => {
    useLiveStatus.mockReturnValue({
      data: { ok: true, toolCount: 2, latencyMs: 15 },
      error: undefined,
    });

    render(<McpStatus service={{ name: "IMAP MCP" }} style="dot" />);

    expect(screen.getByText("2 tools")).toBeInTheDocument();
    expect(screen.getByTitle("MCP tools/list OK")).toBeInTheDocument();
  });
});
