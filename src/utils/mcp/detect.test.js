import { describe, expect, it } from "vitest";

import { buildProbe, shouldProbe } from "./detect";

describe("utils/mcp/detect", () => {
  it("probes MCP cards by href", () => {
    expect(
      shouldProbe({
        name: "Flux MCP",
        href: "http://flux-mcp.flux-system.svc.cluster.local.rafaelgaspar.xyz:9090/mcp",
      }),
    ).toBe(true);
  });

  it("ignores non-MCP hrefs", () => {
    expect(
      shouldProbe({
        name: "Grafana",
        href: "https://grafana.local.rafaelgaspar.xyz",
      }),
    ).toBe(false);
  });

  it("builds probes from href with optional tokenEnv", () => {
    const direct = buildProbe({
      name: "Flux MCP",
      href: "http://flux-mcp.flux-system.svc.cluster.local.rafaelgaspar.xyz:9090/mcp",
    });
    expect(direct.url).toBe("http://flux-mcp.flux-system.svc.cluster.local.rafaelgaspar.xyz:9090/mcp");
    expect(direct.tokenEnv).toBeUndefined();

    const gateway = buildProbe({
      name: "Cluster MCP",
      href: "https://cluster-mcp.local.rafaelgaspar.xyz/mcp",
      mcpProbe: { tokenEnv: "CLUSTER_MCP_TOKEN" },
    });
    expect(gateway.url).toBe("https://cluster-mcp.local.rafaelgaspar.xyz/mcp");
    expect(gateway.tokenEnv).toBe("CLUSTER_MCP_TOKEN");
  });
});
