import { readCustomAssetIfHashMatches } from "utils/custom-assets";

/**
 * @param {import("next").NextApiRequest} req
 * @param {import("next").NextApiResponse} res
 */
export default function handler(req, res) {
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
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  if (req.method === "HEAD") {
    return res.status(200).end();
  }
  return res.status(200).send(asset.buffer);
}
