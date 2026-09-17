import createLogger from "utils/logger";
import { listToggleable } from "utils/scaling/service";
import { withApiMetrics } from "utils/metrics/api";

const logger = createLogger("scaling");

async function handler(req, res) {
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

export default withApiMetrics('/api/scaling', handler);
