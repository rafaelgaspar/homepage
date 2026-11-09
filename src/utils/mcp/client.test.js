import { describe, expect, it } from "vitest";

import { parseJsonRpcMessage } from "./client";

describe("utils/mcp/client", () => {
  it("parses plain JSON-RPC bodies", () => {
    expect(parseJsonRpcMessage('{"jsonrpc":"2.0","id":1,"result":{"tools":[]}}')).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: { tools: [] },
    });
  });

  it("parses MCP streamable HTTP SSE bodies", () => {
    const sse = ["event: message", 'data: {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05"}}', ""].join(
      "\n",
    );

    expect(parseJsonRpcMessage(sse)).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: { protocolVersion: "2024-11-05" },
    });
  });

  it("returns null for empty notification responses", () => {
    expect(parseJsonRpcMessage("")).toBeNull();
    expect(parseJsonRpcMessage("   ")).toBeNull();
  });
});
