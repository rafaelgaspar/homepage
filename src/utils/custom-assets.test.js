import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  contentHash,
  getCustomAssetsManifest,
  isPublicCustomCssPath,
  readCustomAssetIfHashMatches,
  resetCustomAssetsManifestCache,
} from "./custom-assets";

describe("utils/custom-assets", () => {
  /** @type {string} */
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "homepage-custom-assets-"));
    process.env.HOMEPAGE_CUSTOM_ASSETS_DIR = tempDir;
    resetCustomAssetsManifestCache();
  });

  afterEach(() => {
    delete process.env.HOMEPAGE_CUSTOM_ASSETS_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("builds a manifest with fingerprinted URLs", () => {
    fs.mkdirSync(path.join(tempDir, "css"), { recursive: true });
    fs.mkdirSync(path.join(tempDir, "js"), { recursive: true });
    fs.mkdirSync(path.join(tempDir, "background"), { recursive: true });
    fs.writeFileSync(path.join(tempDir, "css/custom.css"), "body { color: red; }");
    fs.writeFileSync(path.join(tempDir, "js/custom.js"), "console.log('hi');");
    fs.writeFileSync(path.join(tempDir, "background/background-0.png"), "png");

    const manifest = getCustomAssetsManifest();
    const cssHash = contentHash("body { color: red; }");

    expect(manifest.css).toEqual({
      hash: cssHash,
      url: `/api/custom/${cssHash}/css/custom.css`,
    });
    expect(manifest.js?.url).toMatch(/^\/api\/custom\/[a-f0-9]{16}\/js\/custom\.js$/);
    expect(manifest.backgrounds).toHaveLength(1);
    expect(manifest.backgrounds[0].url).toMatch(/^\/api\/custom\/[a-f0-9]{16}\/background\/background-0\.png$/);
  });

  it("rejects assets when the URL hash does not match file content", () => {
    fs.mkdirSync(path.join(tempDir, "css"), { recursive: true });
    fs.writeFileSync(path.join(tempDir, "css/custom.css"), "body { color: red; }");

    expect(readCustomAssetIfHashMatches("deadbeefdeadbeef", "css/custom.css")).toBeNull();
  });

  it("serves only allowlisted relative paths", () => {
    fs.mkdirSync(path.join(tempDir, "css"), { recursive: true });
    fs.writeFileSync(path.join(tempDir, "css/custom.css"), "body {}");
    fs.writeFileSync(path.join(tempDir, "css/evil.css"), "body {}");

    expect(readCustomAssetIfHashMatches(contentHash("body {}"), "css/custom.css")).not.toBeNull();
    expect(readCustomAssetIfHashMatches(contentHash("body {}"), "css/evil.css")).toBeNull();
    expect(readCustomAssetIfHashMatches(contentHash("body {}"), "../css/custom.css")).toBeNull();
  });

  it("treats fingerprinted custom CSS as public", () => {
    expect(isPublicCustomCssPath("/api/config/custom.css")).toBe(true);
    expect(isPublicCustomCssPath("/api/custom/0123456789abcdef/css/custom.css")).toBe(true);
    expect(isPublicCustomCssPath("/api/custom/0123456789abcdef/js/custom.js")).toBe(false);
  });
});
