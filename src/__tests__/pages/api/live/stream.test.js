import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

vi.mock("utils/live-status/boot", () => ({
  startLiveStatus: vi.fn(async () => {}),
}));

import { liveStatusCache } from "utils/live-status/cache";

import handler from "pages/api/live/stream";

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
    json(body) {
      this.body = body;
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

describe("pages/api/live/stream", () => {
  beforeEach(() => {
    liveStatusCache.clear();
  });

  afterEach(() => {
    liveStatusCache.clear();
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST", query: {}, on: vi.fn() };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
  });

  it("streams a cache snapshot over SSE", async () => {
    liveStatusCache.set("k8s:ns/app", { status: "running" }, { ttlMs: 60_000 });
    const req = new EventEmitter();
    req.method = "GET";
    req.query = {};
    const res = createSseRes();

    await handler(req, res);
    req.emit("close");

    const body = res.chunks.join("");
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("text/event-stream; charset=utf-8");
    expect(body).toContain("event: snapshot");
    expect(body).toContain("k8s:ns/app");
  });
});
