import { withAuth } from "utils/auth";
import { getMaintenanceRunDetail } from "utils/k3s-home/detail";
import createLogger from "utils/logger";
import { withApiMetrics } from "utils/metrics/api";

const logger = createLogger("k3sHomeRun");

async function handler(req, res) {
  const { name } = req.query;
  if (req.method !== "GET" || !name || Array.isArray(name)) {
    res.status(400).json({ error: "run name is required" });
    return;
  }

  try {
    const result = await getMaintenanceRunDetail(name);
    if (!result) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.status(200).json(result);
  } catch (error) {
    if (error) logger.error(error);
    res.status(500).json({ error: "unknown error" });
  }
}

export default withAuth(withApiMetrics("/api/k3s-home/run/[name]", handler));
