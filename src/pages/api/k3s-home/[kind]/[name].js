import { withAuth } from "utils/auth";
import { NODE_KIND, SCHEDULE_KIND } from "utils/k3s-home/constants";
import { getK3sHomeStatus } from "utils/k3s-home/watch";
import createLogger from "utils/logger";
import { withApiMetrics } from "utils/metrics/api";

const logger = createLogger("k3sHomeStatus");

async function handler(req, res) {
  const { kind, name } = req.query;
  if ((kind !== NODE_KIND && kind !== SCHEDULE_KIND) || !name) {
    res.status(400).json({ error: "k3s-home kind and name are required" });
    return;
  }

  try {
    const result = await getK3sHomeStatus(kind, name);
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

export default withAuth(withApiMetrics("/api/k3s-home/[kind]/[name]", handler));
