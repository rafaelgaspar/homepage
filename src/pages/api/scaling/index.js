import createLogger from "utils/logger";
import { listToggleable } from "utils/scaling/service";

const logger = createLogger("scaling");

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }

  try {
    return res.status(200).json(await listToggleable());
  } catch (err) {
    logger.error("scaling list failed: %s", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
