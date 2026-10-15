import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

import { contentHash } from "utils/custom-assets";

import handler from "pages/api/custom/[hash]/[...path]";

describe("pages/api/custom/[hash]/[...path]", () => {
  /** @type {string} */
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "homepage-custom-api-"));
    process.env.HOMEPAGE_CUSTOM_ASSETS_DIR = tempDir;
    fs.mkdirSync(path.join(tempDir, "css"), { recursive: true });
    fs.writeFileSync(path.join(tempDir, "css/custom.css"), "body { color: red; }");
  });

  afterEach(() => {
    delete process.env.HOMEPAGE_CUSTOM_ASSETS_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it("returns fingerprinted CSS with immutable cache headers", async () => {
    const hash = contentHash("body { color: red; }");
    const req = { method: "GET", query: { hash, path: ["css", "custom.css"] } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.toString()).toBe("body { color: red; }");
    expect(res.headers["Content-Type"]).toBe("text/css; charset=utf-8");
    expect(res.headers["Cache-Control"]).toBe("public, max-age=31536000, immutable");
  });

  it("returns 404 when the hash does not match", async () => {
    const req = { method: "GET", query: { hash: "deadbeefdeadbeef", path: ["css", "custom.css"] } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
  });
});
