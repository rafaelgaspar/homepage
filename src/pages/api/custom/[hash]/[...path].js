import fs from "fs";

import { readCustomAssetIfHashMatches } from "utils/custom-assets";
import { withApiMetrics } from "utils/metrics/api";

export const config = {
  api: {
    responseLimit: false,
  },
};

/**
 * @param {import("next").NextApiRequest} req
 * @param {import("next").NextApiResponse} res
 */
function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).end("Method Not Allowed");
  }

  const { hash, path: pathSegments } = req.query;
  if (!hash || !Array.isArray(pathSegments) || pathSegments.length === 0) {
    return res.status(404).end("Not Found");
  }

  const relativePath = pathSegments.join("/");
  const asset = readCustomAssetIfHashMatches(String(hash), relativePath);
  if (!asset) {
    return res.status(404).end("Not Found");
  }

  res.setHeader("Content-Type", asset.mimeType);
  res.setHeader("Content-Length", String(asset.size));
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  if (req.method === "HEAD") {
    return res.status(200).end();
  }

  const stream = fs.createReadStream(asset.abs);
  return new Promise((resolve) => {
    stream.on("error", () => {
      if (!res.headersSent) {
        res.status(500).end("Internal Server Error");
      } else {
        res.destroy();
      }
      resolve(undefined);
    });
    res.on("finish", () => resolve(undefined));
    stream.pipe(res);
  });
}

export default withApiMetrics("/api/custom/[hash]/[...path]", handler);
