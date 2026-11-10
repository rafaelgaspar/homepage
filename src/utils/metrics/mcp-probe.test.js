import { describe, expect, it } from "vitest";

import { classifyMcpProbeFailure } from "./mcp-probe";

describe("utils/metrics/mcp-probe", () => {
  it("classifies common MCP probe failures", () => {
    expect(classifyMcpProbeFailure("probe timeout")).toBe("timeout");
    expect(classifyMcpProbeFailure("missing env CLUSTER_MCP_TOKEN")).toBe("auth");
    expect(classifyMcpProbeFailure("tools/list error")).toBe("tools_error");
    expect(classifyMcpProbeFailure("HTTP 502: bad gateway")).toBe("http_error");
    expect(classifyMcpProbeFailure("something else")).toBe("other");
  });
});
