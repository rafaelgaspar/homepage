import http from "http";
import https from "https";
import { performance } from "perf_hooks";

const PROBE_TIMEOUT_MS = Number(process.env.HOMEPAGE_MCP_PROBE_TIMEOUT_MS || 15000);
const MCP_PROTOCOL = "2024-11-05";
const SESSION_HEADER = "mcp-session-id";

/** Parse JSON-RPC from plain JSON or MCP streamable HTTP (SSE) bodies. */
export function parseJsonRpcMessage(raw) {
  const chunks = raw.trim();
  if (!chunks) {
    return null;
  }
  if (chunks.startsWith("event:") || chunks.includes("\ndata:")) {
    const dataLines = chunks
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());
    if (!dataLines.length) {
      throw new Error("SSE response missing data line");
    }
    return JSON.parse(dataLines[dataLines.length - 1]);
  }
  return JSON.parse(chunks);
}

function resolveToken(tokenEnv) {
  if (!tokenEnv) return null;
  const value = process.env[tokenEnv];
  if (!value) {
    throw new Error(`missing env ${tokenEnv}`);
  }
  return value;
}

function parseProbeUrl(urlString) {
  const url = new URL(urlString);
  return {
    url,
    requestModule: url.protocol === "https:" ? https : http,
  };
}

function mcpPost(urlString, body, headers) {
  const { url, requestModule } = parseProbeUrl(urlString);
  const payload = JSON.stringify(body);
  const start = performance.now();

  return new Promise((resolve, reject) => {
    let timer;
    const req = requestModule.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          ...headers,
        },
        servername: url.hostname,
      },
      (res) => {
        let chunks = "";
        res.on("data", (chunk) => {
          chunks += chunk;
        });
        res.on("end", () => {
          clearTimeout(timer);
          const latencyMs = Math.round(performance.now() - start);
          const sessionId =
            res.headers[SESSION_HEADER] || res.headers["Mcp-Session-Id"] || res.headers["mcp-session-id"];
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}: ${chunks.slice(0, 200)}`));
            return;
          }
          let parsed;
          try {
            parsed = parseJsonRpcMessage(chunks);
          } catch (err) {
            reject(new Error(`invalid JSON: ${err.message}`));
            return;
          }
          resolve({ body: parsed, latencyMs, sessionId });
        });
      },
    );
    timer = setTimeout(() => {
      req.destroy(new Error("probe timeout"));
    }, PROBE_TIMEOUT_MS);
    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    req.write(payload);
    req.end();
  });
}

function authHeaders(probe) {
  const headers = {};
  if (probe.tokenEnv) {
    headers.Authorization = `Bearer ${resolveToken(probe.tokenEnv)}`;
  }
  return headers;
}

async function fetchToolsList(probe) {
  const baseHeaders = authHeaders(probe);
  let rpcId = 1;
  const init = await mcpPost(
    probe.url,
    {
      jsonrpc: "2.0",
      id: rpcId,
      method: "initialize",
      params: {
        protocolVersion: MCP_PROTOCOL,
        capabilities: {},
        clientInfo: { name: "homepage-mcp-monitor", version: "1.0.0" },
      },
    },
    baseHeaders,
  );
  rpcId += 1;

  const sessionHeaders = { ...baseHeaders };
  if (init.sessionId) {
    sessionHeaders["Mcp-Session-Id"] = init.sessionId;
  }

  await mcpPost(
    probe.url,
    {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    },
    sessionHeaders,
  );

  const listed = await mcpPost(
    probe.url,
    {
      jsonrpc: "2.0",
      id: rpcId,
      method: "tools/list",
      params: {},
    },
    sessionHeaders,
  );

  if (listed.body?.error) {
    throw new Error(listed.body.error.message || "tools/list error");
  }

  const tools = listed.body?.result?.tools || [];
  return {
    toolCount: Array.isArray(tools) ? tools.length : 0,
    latencyMs: listed.latencyMs,
  };
}

import { recordMcpProbeResult } from "utils/metrics/mcp-probe";

export async function probeOne(probe) {
  try {
    const listed = await fetchToolsList(probe);
    const result = {
      ok: true,
      toolCount: listed.toolCount,
      latencyMs: listed.latencyMs,
      serviceName: probe.serviceName,
      id: probe.id,
    };
    recordMcpProbeResult(result);
    return result;
  } catch (err) {
    const result = {
      ok: false,
      toolCount: 0,
      latencyMs: null,
      error: String(err.message || err),
      serviceName: probe.serviceName,
      id: probe.id,
    };
    recordMcpProbeResult(result);
    return result;
  }
}
