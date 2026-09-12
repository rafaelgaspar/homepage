import { createHash } from "crypto";
import fs from "fs";
import path from "path";

export function getCustomAssetsDir() {
  return process.env.HOMEPAGE_CUSTOM_ASSETS_DIR || "/app/custom-assets";
}

const HASH_LENGTH = 16;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

/** @param {Buffer|string} data */
export function contentHash(data) {
  return createHash("sha256").update(data).digest("hex").slice(0, HASH_LENGTH);
}

function mimeTypeFor(relativePath) {
  return MIME_TYPES[path.posix.extname(relativePath).toLowerCase()] || "application/octet-stream";
}

function isAllowedRelativePath(relativePath) {
  if (relativePath === "css/custom.css" || relativePath === "js/custom.js") {
    return true;
  }
  if (!relativePath.startsWith("background/")) {
    return false;
  }
  const name = relativePath.slice("background/".length);
  return name.length > 0 && !name.includes("/") && !name.includes("\\") && name !== ".." && !name.startsWith(".");
}

function resolveAssetPath(relativePath) {
  if (!isAllowedRelativePath(relativePath)) {
    return null;
  }
  const abs = path.join(getCustomAssetsDir(), ...relativePath.split("/"));
  const normalizedRoot = path.resolve(getCustomAssetsDir());
  const normalizedAbs = path.resolve(abs);
  if (!normalizedAbs.startsWith(`${normalizedRoot}${path.sep}`) && normalizedAbs !== normalizedRoot) {
    return null;
  }
  return normalizedAbs;
}

/** @param {string} relativePath */
export function readCustomAsset(relativePath) {
  const abs = resolveAssetPath(relativePath);
  if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return null;
  }
  const buffer = fs.readFileSync(abs);
  return {
    buffer,
    hash: contentHash(buffer),
    mimeType: mimeTypeFor(relativePath),
    relativePath,
  };
}

/** @param {string} hash @param {string} relativePath */
export function readCustomAssetIfHashMatches(hash, relativePath) {
  if (!hash || hash.length !== HASH_LENGTH || !/^[a-f0-9]+$/.test(hash)) {
    return null;
  }
  const asset = readCustomAsset(relativePath);
  if (!asset || asset.hash !== hash) {
    return null;
  }
  return asset;
}

let cachedManifest = null;

export function resetCustomAssetsManifestCache() {
  cachedManifest = null;
}

/** @returns {{ css: { hash: string, url: string } | null, js: { hash: string, url: string } | null, backgrounds: { name: string, hash: string, url: string }[] }} */
export function getCustomAssetsManifest() {
  if (cachedManifest) {
    return cachedManifest;
  }

  const manifest = {
    css: null,
    js: null,
    backgrounds: [],
  };

  for (const relativePath of ["css/custom.css", "js/custom.js"]) {
    const asset = readCustomAsset(relativePath);
    if (!asset) continue;
    const key = relativePath.startsWith("css/") ? "css" : "js";
    manifest[key] = {
      hash: asset.hash,
      url: `/api/custom/${asset.hash}/${relativePath}`,
    };
  }

  const backgroundDir = path.join(getCustomAssetsDir(), "background");
  if (fs.existsSync(backgroundDir) && fs.statSync(backgroundDir).isDirectory()) {
    for (const name of fs.readdirSync(backgroundDir).sort()) {
      const asset = readCustomAsset(`background/${name}`);
      if (!asset) continue;
      manifest.backgrounds.push({
        name,
        hash: asset.hash,
        url: `/api/custom/${asset.hash}/background/${name}`,
      });
    }
  }

  cachedManifest = manifest;
  return manifest;
}

/** @param {string} pathname */
export function isPublicCustomCssPath(pathname) {
  if (pathname === "/api/config/custom.css") {
    return true;
  }
  return /^\/api\/custom\/[a-f0-9]{16}\/css\/custom\.css$/.test(pathname);
}
