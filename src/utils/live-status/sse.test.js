import { EventEmitter } from "node:events";

import { describe, expect, it } from "vitest";

import { createLiveStatusCache } from "./cache";
import { attachSse } from "./sse";

function createSseRes() {
  const chunks = [];
  return {
    chunks,
    statusCode: 200,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
    },
    write(chunk) {
      chunks.push(String(chunk));
    },
  };
}

describe("live-status SSE", () => {
  it("writes a snapshot then set events and disconnects on close", () => {
    const cache = createLiveStatusCache({ now: () => 0, defaultTtlMs: 1000 });
    cache.set("k8s:ns/app", { status: "running" });
    const req = new EventEmitter();
    const res = createSseRes();

    const cleanup = attachSse(req, res, cache, { heartbeatMs: 60_000 });
    cache.set("k8s:ns/app", { status: "down" });
    req.emit("close");

    const body = res.chunks.join("");
    expect(res.headers["Content-Type"]).toBe("text/event-stream; charset=utf-8");
    expect(body).toContain("event: snapshot");
    expect(body).toContain('"k8s:ns/app":{"status":"running"}');
    expect(body).toContain("event: set");
    expect(body).toContain('"status":"down"');
    cleanup();
  });

  it("filters events by prefix", () => {
    const cache = createLiveStatusCache({ now: () => 0, defaultTtlMs: 1000 });
    const req = new EventEmitter();
    const res = createSseRes();
    attachSse(req, res, cache, { prefix: "k8s:", heartbeatMs: 60_000 });

    cache.set("mcp:foo", { ok: true });
    cache.set("k8s:ns/app", { status: "running" });
    req.emit("close");

    const body = res.chunks.join("");
    expect(body).toContain("k8s:ns/app");
    expect(body).not.toContain("mcp:foo");
  });
});
