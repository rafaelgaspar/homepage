import { describe, expect, it } from "vitest";

import { buildProbe, probeUrl, shouldProbe } from "./detect";
import { countTools } from "./client";

describe("utils/mcp/detect", () => {
  it("requires explicit mcpProbe config", () => {
    expect(
      shouldProbe({
        name: "Flux MCP",
        href: "http://flux-mcp.flux-system.svc.cluster.local.rafaelgaspar.xyz:9090/mcp",
      }),
    ).toBe(false);
  });

  it("builds gateway-filtered probes from mcpProbe.url", () => {
    const probe = buildProbe({
      name: "Flux MCP",
      href: "http://flux-mcp.flux-system.svc.cluster.local.rafaelgaspar.xyz:9090/mcp",
      mcpProbe: {
        type: "gateway-filtered",
        url: "https://cluster-mcp.local.rafaelgaspar.xyz/mcp",
        tokenEnv: "CLUSTER_MCP_TOKEN",
        toolPrefix: "flux-mcp__",
      },
    });

    expect(probe.type).toBe("gateway-filtered");
    expect(probe.url).toBe("https://cluster-mcp.local.rafaelgaspar.xyz/mcp");
    expect(probe.toolPrefix).toBe("flux-mcp__");
  });
});

describe("utils/mcp/client countTools", () => {
  it("filters gateway tools by prefix", () => {
    const tools = [{ name: "flux-mcp__list" }, { name: "kubernetes-mcp__pods" }];
    expect(
      countTools(tools, {
        type: "gateway-filtered",
        toolPrefix: "flux-mcp__",
      }),
    ).toBe(1);
  });
});
